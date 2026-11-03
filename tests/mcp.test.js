// /mcp endpoint tests (mcp.js): protocol shape, agent-token auth, the $1 request fee, freeze
// enforcement, and the crash-safety journal (retry replays, pending reconciles, never re-runs).
// D1 is shimmed over node:sqlite exactly like tests/billing-entrypoint.test.js.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleMcp, MCP_REQUEST_FEE_CENTS } from '../mcp.js';

function d1Shim(db) {
  const prepare = sql => ({
    bind(...params) { this.params = params; return this; },
    async first() { return db.prepare(sql).get(...(this.params || [])) ?? null; },
    async all() { return { results: db.prepare(sql).all(...(this.params || [])) }; },
    async run() {
      const r = db.prepare(sql).run(...(this.params || []));
      return { meta: { changes: Number(r.changes) } };
    },
  });
  let queue = Promise.resolve();
  return {
    prepare,
    batch(statements) {
      const result = queue.then(async () => {
        db.exec('BEGIN');
        try {
          const results = [];
          for (const statement of statements) results.push(await statement.run());
          db.exec('COMMIT');
          return results;
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      });
      queue = result.catch(() => {});
      return result;
    },
  };
}

// Distinct user ids per test. Identity answers: agent-token resolves tokens named 'good-*',
// freeze endpoint returns the configured frozen state (or throws when unreachable).
function setup(userId, { frozen = false, identityUnreachable = false, secret = 'bsec' } = {}) {
  const db = new DatabaseSync(':memory:');
  for (const file of readdirSync('migrations').sort()) db.exec(readFileSync('migrations/' + file, 'utf8'));
  db.prepare('INSERT INTO users (id, email, name, created_at, updated_at) VALUES (?, ?, ?, 0, 0)').run(userId, `${userId}@x.test`, userId);
  // last_account_fee_at = now: the daily-fee backstop stays out of these assertions.
  db.prepare("INSERT INTO accounts (user_id, balance, updated_at, status, last_account_fee_at) VALUES (?, 10000, 0, 'active', ?)").run(userId, Date.now());
  const env = {
    DB: d1Shim(db),
    IDENTITY_INTERNAL_SECRET: secret,
    IDENTITY_ORIGIN: 'http://identity.test',
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (identityUnreachable) throw new Error('connection refused');
    if (String(url).endsWith('/api/internal/agent-token')) {
      const token = JSON.parse(init.body).token;
      if (!String(token).startsWith('good-')) return new Response(JSON.stringify({ error: 'unknown_token' }), { status: 404 });
      return new Response(JSON.stringify({ tokenId: 'tok1', tokenName: 'test', userId, email: `${userId}@x.test`, name: userId }), { status: 200 });
    }
    return new Response(JSON.stringify({ frozen }), { status: 200 });
  };
  return { db, env, restore: () => { globalThis.fetch = originalFetch; } };
}

const post = (body, headers = {}) => new Request('https://bank.southbag.cc/mcp', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const rpc = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
const auth = { authorization: 'Bearer good-token-1' };
const key = { 'idempotency-key': 'test-key-0001' };
const balance = db => db.prepare('SELECT balance FROM accounts WHERE user_id = ?').get('u1')?.balance;
const journal = db => db.prepare('SELECT * FROM mcp_call').all();
const feeTxns = db => db.prepare("SELECT * FROM transactions WHERE idempotency_key LIKE 'mcp|%'").all();
const getBalanceHash = async () => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('{"arguments":{},"name":"get_balance"}'));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
};


test('initialize needs no auth and explains the fees', async () => {
  const { env, restore } = setup('u0');
  const res = await handleMcp(post(rpc(1, 'initialize')), env, {});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.result.protocolVersion, '2025-06-18');
  assert.match(body.result.instructions, /\$1\.00 request fee/);
  assert.match(body.result.instructions, /Idempotency-Key/);
  assert.equal(res.headers.get('mcp-protocol-version'), '2025-06-18');
  restore();
});

test('GET is 405, batches are rejected, notifications are 202', async () => {
  const { env, restore } = setup('u0');
  const get = await handleMcp(new Request('https://bank.southbag.cc/mcp'), env, {});
  assert.equal(get.status, 405);
  const batch = await handleMcp(post([rpc(1, 'ping')]), env, {});
  assert.equal(batch.status, 400);
  const note = await handleMcp(post({ jsonrpc: '2.0', method: 'notifications/initialized' }), env, {});
  assert.equal(note.status, 202);
  restore();
});

test('tools/list is authenticated but free', async () => {
  const { db, env, restore } = setup('u1');
  const noAuth = await handleMcp(post(rpc(1, 'tools/list')), env, {});
  assert.equal(noAuth.status, 401);
  const res = await handleMcp(post(rpc(2, 'tools/list'), auth), env, {});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.result.tools.map(t => t.name), ['get_balance', 'list_transactions']);
  assert.match(body.result.tools[0].description, /\$1\.00/);
  assert.equal(balance(db), 10000); // no charge
  assert.equal(journal(db).length, 0);
  restore();
});

test('tools/call charges $1 plus action fees and returns an itemised receipt', async () => {
  const { db, env, restore } = setup('u1');
  const res = await handleMcp(post(rpc(1, 'tools/call', { name: 'get_balance', arguments: {} }), { ...auth, ...key }), env, {});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.result.isError, false);
  assert.match(body.result.content[0].text, /Balance: \$98\.93/); // 10000 - 100 - 7 = 9893
  const receipt = body.result.structuredContent.receipt;
  assert.equal(receipt.requestFee.amount, MCP_REQUEST_FEE_CENTS);
  assert.equal(receipt.requestFee.duplicate, false);
  assert.equal(receipt.actionFees.length, 2); // 5c inquiry + 2c awareness
  assert.equal(receipt.actionFees.reduce((sum, f) => sum + f.amount, 0), -7);
  assert.equal(receipt.balanceAfter, 9893);
  assert.equal(receipt.duplicate, false);
  assert.equal(balance(db), 9893);
  assert.equal(journal(db)[0].status, 'done');
  restore();
});

test('a retried Idempotency-Key replays the stored result and charges nothing again', async () => {
  const { db, env, restore } = setup('u1');
  const first = await handleMcp(post(rpc(1, 'tools/call', { name: 'get_balance' }), { ...auth, ...key }), env, {});
  assert.equal(first.status, 200);
  const second = await handleMcp(post(rpc(2, 'tools/call', { name: 'get_balance' }), { ...auth, ...key }), env, {});
  const replayed = await second.json();
  assert.equal(replayed.result.structuredContent.receipt.duplicate, true);
  assert.equal(balance(db), 9893); // unchanged
  assert.equal(feeTxns(db).length, 1);
  restore();
});

test('tools/call without an Idempotency-Key is refused before charging', async () => {
  const { db, env, restore } = setup('u1');
  const res = await handleMcp(post(rpc(1, 'tools/call', { name: 'get_balance' }), auth), env, {});
  const body = await res.json();
  assert.equal(body.error.code, -32602);
  assert.match(body.error.message, /Idempotency-Key/);
  assert.equal(balance(db), 10000);
  restore();
});

test('a frozen account is fail-closed: no charge, no journal row', async () => {
  const { db, env, restore } = setup('u1', { frozen: true });
  const res = await handleMcp(post(rpc(1, 'tools/call', { name: 'get_balance' }), { ...auth, ...key }), env, {});
  const body = await res.json();
  assert.equal(body.result.isError, true);
  assert.match(body.result.content[0].text, /frozen/);
  assert.equal(balance(db), 10000);
  assert.equal(journal(db).length, 0); // not journaled: the same key works after unfreeze
  restore();
});

test('identity unreachable fails closed with no charge', async () => {
  const { db, env, restore } = setup('u1', { identityUnreachable: true });
  const res = await handleMcp(post(rpc(1, 'tools/call', { name: 'get_balance' }), { ...auth, ...key }), env, {});
  assert.equal(res.status, 503); // token resolution itself fails closed before any charge
  const body = await res.json();
  assert.ok(body.error);
  assert.equal(balance(db), 10000);
  restore();
});

test('unknown or revoked token is 401 and free', async () => {
  const { db, env, restore } = setup('u1');
  const res = await handleMcp(post(rpc(1, 'tools/call', { name: 'get_balance' }), { authorization: 'Bearer bad-token', ...key }), env, {});
  assert.equal(res.status, 401);
  assert.equal(balance(db), 10000);
  restore();
});

test('an Idempotency-Key is bound to one tool', async () => {
  const { env, restore } = setup('u1');
  await handleMcp(post(rpc(1, 'tools/call', { name: 'get_balance' }), { ...auth, ...key }), env, {});
  const res = await handleMcp(post(rpc(2, 'tools/call', { name: 'list_transactions' }), { ...auth, ...key }), env, {});
  const body = await res.json();
  assert.equal(body.error.code, -32602);
  restore();
});

test('a pending row whose fee landed is an unknown outcome: never re-run, no second charge', async () => {
  const { db, env, restore } = setup('u1');
  // Simulate a crash after the request fee committed but before the journal closed.
  db.prepare("INSERT INTO mcp_call (idempotency_key, user_id, tool, args_hash, status, created_at, updated_at) VALUES ('u1|test-key-0001', 'u1', 'get_balance', ?, 'pending', ?, ?)")
    .run(await getBalanceHash(), Date.now() - 120000, Date.now() - 120000);
  db.prepare("INSERT INTO transactions (user_id, amount, kind, description, idempotency_key, created_at) VALUES ('u1', -100, 'subscription', 'Southbag Banking: MCP request fee', 'mcp|banking|request|u1|test-key-0001', ?)")
    .run(Date.now() - 120000);
  const res = await handleMcp(post(rpc(1, 'tools/call', { name: 'get_balance' }), { ...auth, ...key }), env, {});
  const body = await res.json();
  assert.equal(body.result.isError, true);
  assert.equal(body.result.structuredContent.unknownOutcome, true);
  assert.equal(body.result.structuredContent.requestFeeCharged, true);
  assert.equal(balance(db), 10000); // nothing re-ran, nothing new charged
  assert.equal(journal(db)[0].status, 'pending'); // still pending: reconciled by a human, not re-run
  restore();
});

test('a pending row whose fee never landed is still never re-run', async () => {
  const { db, env, restore } = setup('u1');
  db.prepare("INSERT INTO mcp_call (idempotency_key, user_id, tool, args_hash, status, created_at, updated_at) VALUES ('u1|test-key-0001', 'u1', 'get_balance', ?, 'pending', ?, ?)")
    .run(await getBalanceHash(), Date.now() - 120000, Date.now() - 120000);
  const res = await handleMcp(post(rpc(1, 'tools/call', { name: 'get_balance' }), { ...auth, ...key }), env, {});
  const body = await res.json();
  assert.equal(body.result.isError, true);
  assert.equal(body.result.structuredContent.unknownOutcome, true);
  assert.equal(body.result.structuredContent.requestFeeCharged, false);
  assert.equal(balance(db), 10000); // nothing charged, nothing ran
  assert.equal(journal(db)[0].status, 'pending'); // stays reconciliation-required, not reclaimed
  restore();
});

test('a retry during a slow original never double-runs, then replays once the original lands', async () => {
  const { db, env, restore } = setup('u1');
  // The original has claimed the key but not yet charged (still in flight).
  db.prepare("INSERT INTO mcp_call (idempotency_key, user_id, tool, args_hash, status, created_at, updated_at) VALUES ('u1|test-key-0001', 'u1', 'get_balance', ?, 'pending', ?, ?)")
    .run(await getBalanceHash(), Date.now(), Date.now());
  const retry = await handleMcp(post(rpc(1, 'tools/call', { name: 'get_balance' }), { ...auth, ...key }), env, {});
  const retryBody = await retry.json();
  assert.equal(retryBody.result.structuredContent.unknownOutcome, true);
  assert.equal(balance(db), 10000); // the retry did NOT charge or run
  // The original now completes: charge + action + journal close.
  db.prepare("INSERT INTO transactions (user_id, amount, kind, description, idempotency_key, created_at) VALUES ('u1', -100, 'subscription', 'Southbag Banking: MCP request fee', 'mcp|banking|request|u1|test-key-0001', ?)").run(Date.now());
  db.prepare('UPDATE accounts SET balance = balance - 107 WHERE user_id = ?').run('u1');
  const stored = { content: [{ type: 'text', text: 'Balance: $98.93 (active).' }], isError: false, structuredContent: { receipt: { duplicate: false, balanceAfter: 9893 } } };
  db.prepare("UPDATE mcp_call SET status = 'done', response = ?, updated_at = ? WHERE idempotency_key = 'u1|test-key-0001'")
    .run(JSON.stringify(stored), Date.now());
  // A later retry replays the original's stored result; no second action, no second charge.
  const replay = await handleMcp(post(rpc(2, 'tools/call', { name: 'get_balance' }), { ...auth, ...key }), env, {});
  const replayBody = await replay.json();
  assert.equal(replayBody.result.structuredContent.receipt.duplicate, true);
  assert.equal(replayBody.result.structuredContent.receipt.balanceAfter, 9893);
  assert.equal(balance(db), 9893);
  assert.equal(feeTxns(db).length, 1);
  restore();
});

test('a key replayed with different arguments is a caller bug, not a replay', async () => {
  const { db, env, restore } = setup('u1');
  await handleMcp(post(rpc(1, 'tools/call', { name: 'list_transactions', arguments: {} }), { ...auth, ...key }), env, {});
  const res = await handleMcp(post(rpc(2, 'tools/call', { name: 'list_transactions', arguments: { limit: 5 } }), { ...auth, ...key }), env, {});
  const body = await res.json();
  assert.equal(body.error.code, -32602);
  assert.match(body.error.message, /different arguments/);
  assert.equal(balance(db), 9900); // only the first call's $1
  restore();
});

test('the same key under a different user is a different call', async () => {
  const { db, env, restore } = setup('u1');
  await handleMcp(post(rpc(1, 'tools/call', { name: 'get_balance' }), { ...auth, ...key }), env, {});
  // u2 presents the same key: independent journal row, own charge, no cross-user replay.
  db.prepare("INSERT INTO users (id, email, name, created_at, updated_at) VALUES ('u2', 'u2@x.test', 'u2', 0, 0)").run();
  db.prepare("INSERT INTO accounts (user_id, balance, updated_at, status, last_account_fee_at) VALUES ('u2', 5000, 0, 'active', ?)").run(Date.now());
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/api/internal/agent-token')) {
      const token = JSON.parse(init.body).token;
      const userId = token === 'good-u2' ? 'u2' : 'u1';
      return new Response(JSON.stringify({ tokenId: 'tok', tokenName: 't', userId, email: `${userId}@x.test`, name: userId }), { status: 200 });
    }
    return new Response(JSON.stringify({ frozen: false }), { status: 200 });
  };
  const res = await handleMcp(post(rpc(2, 'tools/call', { name: 'get_balance' }), { authorization: 'Bearer good-u2', ...key }), env, {});
  const body = await res.json();
  assert.equal(body.result.structuredContent.receipt.duplicate, false);
  assert.equal(body.result.structuredContent.receipt.balanceAfter, 4893); // u2's own account charged
  assert.equal(db.prepare('SELECT balance FROM accounts WHERE user_id = ?').get('u1').balance, 9893); // u1 untouched
  globalThis.fetch = originalFetch;
  restore();
});

test('an action failure after the fee stays pending: unknown outcome, never a stored failure', async () => {
  const { db, env, restore } = setup('u1');
  // Crash the ACTION executor only: every ledger insert that is not the MCP request fee.
  const inner = env.DB;
  env.DB = {
    ...inner,
    prepare: sql => {
      const stmt = inner.prepare(sql);
      if (!sql.startsWith('INSERT INTO transactions')) return stmt;
      return {
        bind(...params) { this.params = params; return this; },
        async first() { return null; },
        async all() { return { results: [] }; },
        async run() {
          if (!this.params?.some(p => String(p).includes('MCP request fee')))
            throw new Error('simulated action executor crash');
          return stmt.bind(...this.params).run();
        },
      };
    },
  };
  const res1 = await handleMcp(post(rpc(1, 'tools/call', { name: 'get_balance', arguments: {} }), { ...auth, ...key }), env, {});
  const body1 = await res1.json();
  assert.equal(body1.result.structuredContent.unknownOutcome, true);
  assert.equal(body1.result.structuredContent.requestFeeCharged, true);
  assert.equal(journal(db)[0].status, 'pending'); // unknown effect: never journaled as a failure
  assert.equal(feeTxns(db).length, 1); // exactly the request fee
  assert.equal(balance(db), 9900);

  // A retry reconciles the same pending row - it never re-runs and never charges again.
  const res2 = await handleMcp(post(rpc(2, 'tools/call', { name: 'get_balance', arguments: {} }), { ...auth, ...key }), env, {});
  const body2 = await res2.json();
  assert.equal(body2.result.structuredContent.unknownOutcome, true);
  assert.equal(feeTxns(db).length, 1);
  assert.equal(balance(db), 9900);
  restore();
});
