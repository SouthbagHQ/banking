// Compatibility test with the OFFICIAL MCP TypeScript SDK client (devDependency), not handcrafted
// JSON: a real StreamableHTTPClientTransport talks to handleMcp over a real HTTP server. Covers
// the initialize handshake, the initialized notification, tools/list schema parsing and a billed
// tools/call - the exact traffic an off-the-shelf agent produces.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { handleMcp, MCP_REQUEST_FEE_CENTS } from '../mcp.js';

function d1Shim(db) {
  const prepare = sql => ({
    bind(...params) { this.params = params; return this; },
    async first() { return db.prepare(sql).get(...(this.params || [])) ?? null; },
    async all() { return { results: db.prepare(sql).all(...(this.params || [])) }; },
    async run() { const r = db.prepare(sql).run(...(this.params || [])); return { meta: { changes: Number(r.changes) } }; },
  });
  let queue = Promise.resolve();
  return { prepare, batch(s) { return Promise.all(s.map(x => x.run())); } };
}

test('official MCP SDK client: initialize, listTools, callTool, replay', async () => {
  const db = new DatabaseSync(':memory:');
  for (const file of readdirSync('migrations').sort()) db.exec(readFileSync('migrations/' + file, 'utf8'));
  db.prepare('INSERT INTO users (id, email, name, created_at, updated_at) VALUES (?, ?, ?, 0, 0)').run('sdk-user', 'sdk@x.test', 'SDK');
  db.prepare("INSERT INTO accounts (user_id, balance, updated_at, status, last_account_fee_at) VALUES (?, 10000, 0, 'active', ?)").run('sdk-user', Date.now());
  const env = {
    DB: d1Shim(db),
    IDENTITY_INTERNAL_SECRET: 'bsec',
    IDENTITY_ORIGIN: 'http://identity.test',
  };
  // The request fee is a real ledger write through economy.js billingCharge; count it in D1.
  const feeCharges = () => db.prepare("SELECT COUNT(*) AS n FROM transactions WHERE user_id = 'sdk-user' AND description LIKE '%MCP request fee%'").get().n;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/api/internal/agent-token')) {
      const token = JSON.parse(init.body).token;
      if (!String(token).startsWith('good-')) return new Response(JSON.stringify({ error: 'unknown_token' }), { status: 404 });
      return new Response(JSON.stringify({ tokenId: 'tok1', tokenName: 'sdk', userId: 'sdk-user', email: 'sdk@x.test', name: 'SDK', scopes: ['read', 'write'] }), { status: 200 });
    }
    if (String(url).startsWith('http://identity.test/')) return new Response(JSON.stringify({ frozen: false }), { status: 200 });
    return originalFetch(url, init); // the SDK client's own HTTP to the local server passes through
  };

  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    const request = new Request(`http://mcp.test${req.url}`, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
    const response = await handleMcp(request, env, { waitUntil() {} });
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = new URL(`http://127.0.0.1:${server.address().port}/mcp`);

  try {
    const connect = (idemKey) => {
      const transport = new StreamableHTTPClientTransport(url, {
        requestInit: { headers: { authorization: 'Bearer good-sdk', 'idempotency-key': idemKey } },
      });
      const client = new Client({ name: 'sdk-compat-test', version: '1.0.0' });
      return { transport, client };
    };

    // 1. Handshake + discovery through the real client.
    const first = connect('sdk-key-00001');
    await first.client.connect(first.transport);
    const { tools } = await first.client.listTools();
    assert.deepEqual(tools.map(t => t.name).sort(), ['get_balance', 'list_transactions']);
    assert.ok(tools.every(t => t.inputSchema && t.description.includes('$1.00')));

    // 2. A billed call through the real client: structured receipt + text content.
    const result = await first.client.callTool({ name: 'get_balance', arguments: {} });
    assert.equal(result.isError, false);
    assert.equal(result.structuredContent.receipt.requestFee.amount, MCP_REQUEST_FEE_CENTS);
    assert.equal(typeof result.structuredContent.receipt.balanceAfter, "number");
    assert.ok(Array.isArray(result.structuredContent.receipt.actionFees)); // standard action fees itemised
    assert.match(result.content[0].text, /\$/);
    assert.equal(feeCharges(), 1);
    await first.client.close();

    // 3. The same Idempotency-Key from a NEW connection replays without a second charge.
    const second = connect('sdk-key-00001');
    await second.client.connect(second.transport);
    const replayed = await second.client.callTool({ name: 'get_balance', arguments: {} });
    assert.equal(replayed.structuredContent.receipt.duplicate, true);
    assert.equal(feeCharges(), 1);
    await second.client.close();

    // 4. Protocol errors surface as JSON-RPC errors the client throws on: unknown tool.
    const third = connect('sdk-key-00002');
    await third.client.connect(third.transport);
    await assert.rejects(third.client.callTool({ name: 'wire_money', arguments: {} }), /Unknown tool/);
    assert.equal(feeCharges(), 1);
    await third.client.close();
  } finally {
    globalThis.fetch = originalFetch;
    server.close();
  }
});
