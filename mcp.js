// Agent (MCP) endpoint for Southbag Banking. Customers issue named, revocable agent tokens at
// https://identity.southbag.cc/agents; an agent presents one as a bearer token here. Identity
// resolves it fresh on every call, so revocation applies immediately.
//
// Protocol: MCP spec 2025-06-18, Streamable HTTP in its JSON-only form - POST of one JSON-RPC
// message, JSON response; no SSE, no sessions, no batching (batching was removed in 2025-06-18).
//
// Fees: every tools/call costs the MCP request fee below, charged through the same billingCharge
// path as every other Southbag fee, ON TOP of any standard action fees (each tool's description
// quotes them). initialize / tools/list are free so agents can quote fees before spending.
//
// Exactly-once: tools/call requires an Idempotency-Key header. The mcp_call journal row starts
// 'pending' BEFORE any fee moves and ends 'done' with the full result, so a retried key replays
// the stored answer without charging again. A key left 'pending' means the outcome is UNKNOWN:
// it is never silently re-run (the action may have committed), it reconciles instead.

import { billingCharge, createD1Repo, handleEconomy, money } from './economy.js';
import { centralStatus, identityHooks, FROZEN_TEXT, STATUS_UNKNOWN_TEXT, IDENTITY_ORIGIN } from './identity.js';

// Ingo's ruling in the dev Slack thread (2026-11-03): "fee for everything", then "$1" per MCP
// request. One clearly-marked constant so a pricing change is a one-line PR.
export const MCP_REQUEST_FEE_CENTS = 100;
const MCP_REQUEST_FEE_DESCRIPTION = 'MCP request fee';

// MCP protocol versions this endpoint speaks. 2025-03-26 is accepted so older clients fail
// cleanly through negotiation instead of a hard error.
const PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED_VERSIONS = new Set(['2025-06-18', '2025-03-26']);

// A 'pending' journal row younger than this may still be mid-flight in another isolate, so an
// unknown-looking retry must wait rather than reclaim it. Workers CPU limits make a genuine
// in-flight call far shorter than this.
const RECLAIM_AFTER_MS = 60000;

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json', ...headers },
});
const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message, data) => ({ jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } });

const feeKey = (userId, key) => `mcp|banking|request|${userId}|${key}`;

// Canonical JSON (keys sorted recursively) so {a:1,b:2} and {b:2,a:1} hash alike.
const canonical = value => JSON.stringify(value, (_, v) =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : v);
const argsHash = async (name, args) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical({ name, arguments: args ?? {} })));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
};

// ── Agent token auth ──
// Bearer token -> Identity's internal resolution endpoint (shared INTERNAL_API_SECRETS service
// credential, same as the freeze API). 401 unknown/revoked token; 503 Identity down or this
// service unconfigured. No caching: a cached 'valid' answer is a revocation bypass window.
async function resolveAgent(env, token) {
  const secret = env.IDENTITY_INTERNAL_SECRET;
  if (!secret) return { status: 503, text: 'Agent access is not configured on this service.' };
  const origin = env.IDENTITY_ORIGIN || IDENTITY_ORIGIN;
  let response;
  try {
    response = await fetch(`${origin}/api/internal/agent-token`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } catch (error) {
    console.error('identity agent-token resolution failed', error);
    return { status: 503, text: 'Southbag Identity is unavailable, so your agent token cannot be checked. Try again shortly.' };
  }
  if (response.status === 404) return { status: 401, text: 'Unknown or revoked agent token. Tokens are issued at https://identity.southbag.cc/agents' };
  if (response.status === 401 || response.status === 403) {
    console.error(`identity agent-token REJECTED the configured secret (HTTP ${response.status}) - check IDENTITY_INTERNAL_SECRET`);
    return { status: 503, text: 'Agent access is misconfigured on this service.' };
  }
  if (!response.ok) return { status: 503, text: 'Southbag Identity is unavailable, so your agent token cannot be checked. Try again shortly.' };
  const row = await response.json();
  if (!row || typeof row.userId !== 'string' || !row.userId) return { status: 401, text: 'Unknown or revoked agent token.' };
  return { user: { id: row.userId, email: row.email ?? null, name: row.name ?? null }, tokenId: row.tokenId, tokenName: row.tokenName };
}

function toolList() {
  return [
    {
      name: 'get_balance',
      title: 'Check balance',
      description: `Current balance and account status. Costs the ${money(MCP_REQUEST_FEE_CENTS)} MCP request fee plus the standard balance inquiry fees ($0.07). Industry standard.`,
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'list_transactions',
      title: 'List transactions',
      description: `The 20 most recent ledger entries. Costs the ${money(MCP_REQUEST_FEE_CENTS)} MCP request fee; no additional action fee.`,
      inputSchema: { type: 'object', properties: {} },
    },
  ];
}

function initializeResult() {
  return {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: 'southbag-banking', title: 'Southbag Banking', version: '1.0.0' },
    instructions: [
      `Fees: every tools/call costs a ${money(MCP_REQUEST_FEE_CENTS)} request fee, charged to the token owner's Southbag account, plus any standard action fees quoted in each tool's description. Discovery (initialize, tools/list) is free.`,
      'Every tools/call MUST include an Idempotency-Key header (8-120 characters). A retried key replays the stored result without charging again. A key whose outcome is unknown is never re-run; the response says what can be verified.',
      'Every tools/call returns an itemised receipt: request fee, action fees, balance after.',
      'Agent tokens are issued and revoked at https://identity.southbag.cc/agents. Revocation applies immediately.',
    ].join(' '),
  };
}

// Runs an economy action with the repo's addTxn wrapped, so every fee the action charges is
// captured for the receipt.
async function runBankingTool(env, user, name) {
  const captured = [];
  const repo = createD1Repo(env.DB, identityHooks(env));
  const inner = repo.addTxn.bind(repo);
  repo.addTxn = async row => {
    captured.push({ amount: row.amount, kind: row.kind, description: row.description });
    return inner(row);
  };
  const action = { get_balance: 'balance', list_transactions: 'transactions' }[name];
  const outcome = await handleEconomy(repo, user, { action });
  const account = await env.DB.prepare('SELECT balance FROM accounts WHERE user_id = ?').bind(user.id).first();
  return { outcome, captured, balanceAfter: account ? account.balance : null };
}

// A 'pending' journal row means a previous call with this key did not finish cleanly. It is NEVER
// silently re-run. What can be verified: whether the request fee landed (its ledger row and debit
// are one atomic batch).
//   - Fee landed: the action may or may not have committed. Genuinely unknown; reported, and the
//     key stays pending for reconciliation. No retry advice, no re-run.
//   - Fee absent: the charge never committed, and the action cannot have started (it only runs
//     after a successful charge). Reclaiming and running fresh cannot duplicate anything PROVIDED
//     the original call is no longer in flight. Between the journal INSERT and the fee commit the
//     only async step is one D1 batch: an isolate is not suspended and resumed, and D1's own
//     statement timeout is far below RECLAIM_AFTER_MS, so a row older than that cannot still
//     commit. The compare-and-swap closes the remaining concurrent-retry race, and the fee key's
//     UNIQUE constraint is the final backstop against a double debit.
async function reconcilePending(env, user, rowKey, key, row) {
  const fee = await env.DB.prepare('SELECT 1 AS present FROM transactions WHERE idempotency_key = ?')
    .bind(feeKey(user.id, key)).first();
  const feeLanded = !!fee;
  if (!feeLanded && Date.now() - row.updated_at > RECLAIM_AFTER_MS) {
    // Crashed before the request fee moved: the action never ran (it runs only after a successful
    // charge), so reclaiming the key and running fresh cannot duplicate anything. Compare-and-swap
    // so two concurrent retries cannot both reclaim.
    const claim = await env.DB.prepare('UPDATE mcp_call SET updated_at = ? WHERE idempotency_key = ? AND status = \'pending\' AND updated_at = ?')
      .bind(Date.now(), rowKey, row.updated_at).run();
    if ((claim.meta?.changes ?? 0) === 1) return null; // reclaimed; caller proceeds as fresh
  }
  const text = feeLanded
    ? `A previous call with this Idempotency-Key did not complete. Its outcome is unknown and Southbag does not re-run unknown outcomes. The ${money(MCP_REQUEST_FEE_CENTS)} request fee was charged. Kevin has been notified.`
    : `A previous call with this Idempotency-Key is still being processed or did not complete. No request fee has been charged for it yet. Try again shortly with the same key.`;
  return {
    content: [{ type: 'text', text }],
    isError: true,
    structuredContent: { unknownOutcome: true, requestFeeCharged: feeLanded },
  };
}

async function handleToolsCall(request, env, message) {
  const auth = await resolveAgent(env, request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1] || '');
  if (auth.status) return json(rpcError(message.id, -32001, auth.text), auth.status);
  const params = message.params || {};
  const name = typeof params.name === 'string' ? params.name : '';
  if (!toolList().some(tool => tool.name === name))
    return json(rpcError(message.id, -32602, `Unknown tool '${name}'. tools/list is free and quotes every fee.`));
  const key = request.headers.get('idempotency-key')?.trim() || '';
  if (key.length < 8 || key.length > 120)
    return json(rpcError(message.id, -32602, 'tools/call requires an Idempotency-Key header (8-120 characters). A retried key replays its stored result without charging again.'));

  const db = env.DB;
  const rowKey = `${auth.user.id}|${key}`;
  const hash = await argsHash(name, params.arguments);
  const replay = storedRow => {
    const stored = JSON.parse(storedRow.response);
    if (stored.structuredContent?.receipt) stored.structuredContent.receipt.duplicate = true;
    return json(rpcResult(message.id, stored));
  };

  const existing = await db.prepare('SELECT tool, args_hash, status, response, updated_at FROM mcp_call WHERE idempotency_key = ?').bind(rowKey).first();
  if (existing) {
    // An idempotency key names ONE call: this user, this tool, these arguments. A different tool
    // or different arguments under a used key is a caller bug, never a replay.
    if (existing.tool !== name)
      return json(rpcError(message.id, -32602, `This Idempotency-Key was already used for '${existing.tool}'. Keys are not shared across tools.`));
    if (existing.args_hash !== hash)
      return json(rpcError(message.id, -32602, 'This Idempotency-Key was already used with different arguments. Keys name one exact call.'));
    if (existing.status === 'done') return replay(existing);
    const pending = await reconcilePending(env, auth.user, rowKey, key, existing);
    if (pending) return json(rpcResult(message.id, pending));
    // else: reclaimed below, after the same fresh freeze check as any other call.
  }

  // Central freeze check BEFORE any fee moves, fresh per call, fail closed. Frozen/unknown
  // answers are not journaled (a fresh claim is not inserted) and not charged, so the same key
  // works once the account is back.
  const central = await centralStatus(env, auth.user.id);
  if (central === 'unknown') return json(rpcResult(message.id, { content: [{ type: 'text', text: STATUS_UNKNOWN_TEXT }], isError: true }));
  if (central !== 'off' && central.frozen) return json(rpcResult(message.id, { content: [{ type: 'text', text: FROZEN_TEXT }], isError: true }));

  if (!existing) {
    try {
      await db.prepare("INSERT INTO mcp_call (idempotency_key, user_id, tool, args_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)")
        .bind(rowKey, auth.user.id, name, hash, Date.now(), Date.now()).run();
    } catch (error) {
      if (!String(error).includes('UNIQUE constraint failed')) throw error;
      // A concurrent call with the same key claimed it first.
      const raced = await db.prepare('SELECT tool, args_hash, status, response, updated_at FROM mcp_call WHERE idempotency_key = ?').bind(rowKey).first();
      if (!raced) throw error;
      if (raced.args_hash !== hash)
        return json(rpcError(message.id, -32602, 'This Idempotency-Key was already used with different arguments. Keys name one exact call.'));
      if (raced.status === 'done') return replay(raced);
      const pending = await reconcilePending(env, auth.user, rowKey, key, raced);
      if (pending) return json(rpcResult(message.id, pending));
    }
  }

  // Claimed. Charge the request fee first: the journal row is already 'pending', and the fee's
  // own idempotency key makes a retry of THIS charge a no-op instead of a second debit. If the
  // charge throws, the row stays 'pending' - the outcome is unknown and reconciles, never re-runs.
  const charge = await billingCharge(db, {
    userId: auth.user.id,
    email: auth.user.email,
    name: auth.user.name,
    amount: MCP_REQUEST_FEE_CENTS,
    product: 'Southbag Banking',
    description: MCP_REQUEST_FEE_DESCRIPTION,
    idempotencyKey: feeKey(auth.user.id, key),
  });

  let result;
  try {
    const { outcome, captured, balanceAfter } = await runBankingTool(env, auth.user, name);
    result = {
      content: [{ type: 'text', text: outcome.text || '' }],
      isError: outcome.ok === false,
      structuredContent: {
        ...(outcome.ok !== false && outcome.transactions ? { transactions: outcome.transactions } : {}),
        receipt: {
          requestFee: { amount: MCP_REQUEST_FEE_CENTS, description: MCP_REQUEST_FEE_DESCRIPTION, duplicate: charge.duplicate ?? false },
          actionFees: captured,
          balanceAfter,
          duplicate: false,
        },
      },
    };
  } catch (error) {
    console.error(`mcp tools/call ${name} failed after charging`, error);
    // The request fee was charged; the action's own writes are in an unknown state. The result is
    // terminal (journaled 'done'): the call is never re-run, and the receipt says what landed.
    result = {
      content: [{ type: 'text', text: `The ${money(MCP_REQUEST_FEE_CENTS)} request fee was charged, then the action failed (${String(error.message || error)}). Southbag does not re-run it. Kevin has been notified.` }],
      isError: true,
      structuredContent: {
        receipt: {
          requestFee: { amount: MCP_REQUEST_FEE_CENTS, description: MCP_REQUEST_FEE_DESCRIPTION, duplicate: charge.duplicate ?? false },
          actionFailed: true,
          duplicate: false,
        },
      },
    };
  }
  await db.prepare("UPDATE mcp_call SET status = 'done', response = ?, updated_at = ? WHERE idempotency_key = ?")
    .bind(JSON.stringify(result), Date.now(), rowKey).run();
  return json(rpcResult(message.id, result));
}

export async function handleMcp(request, env, ctx) {
  if (request.method === 'GET' || request.method === 'DELETE')
    return json({ error: 'This endpoint speaks JSON only; no event stream.' }, 405, { allow: 'POST' });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { allow: 'POST' });

  const version = request.headers.get('mcp-protocol-version');
  if (version && !SUPPORTED_VERSIONS.has(version))
    return json(rpcError(null, -32600, `Unsupported MCP protocol version '${version}'. This server speaks ${[...SUPPORTED_VERSIONS].join(', ')}.`), 400);

  let message;
  try {
    message = await request.json();
  } catch {
    return json(rpcError(null, -32700, 'Parse error'), 400);
  }
  if (Array.isArray(message) || !message || typeof message !== 'object' || message.jsonrpc !== '2.0' || typeof message.method !== 'string')
    return json(rpcError(message?.id ?? null, -32600, 'Invalid request: one JSON-RPC message per POST; batching is not supported.'), 400);

  // Notifications have no id and get no response body.
  if (message.id === undefined || message.id === null) {
    if (message.method.startsWith('notifications/')) return new Response(null, { status: 202 });
    return json(rpcError(null, -32600, 'Requests must carry an id; notifications use the notifications/* methods.'), 400);
  }

  switch (message.method) {
    case 'initialize':
      return json(rpcResult(message.id, initializeResult()), 200, { 'mcp-protocol-version': PROTOCOL_VERSION });
    case 'ping':
      return json(rpcResult(message.id, {}));
    case 'tools/list': {
      // Discovery is free but authenticated: the catalogue is for customers' agents.
      const auth = await resolveAgent(env, request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1] || '');
      if (auth.status) return json(rpcError(message.id, -32001, auth.text), auth.status);
      return json(rpcResult(message.id, { tools: toolList() }));
    }
    case 'tools/call':
      return await handleToolsCall(request, env, message);
    default:
      return json(rpcError(message.id, -32601, `Method not found: ${message.method}`));
  }
}
