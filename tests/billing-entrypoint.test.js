// Full Billing.charge ENTRYPOINT tests (worker.js), not just the helpers: a refactor that breaks
// the entrypoint's own wiring (e.g. a dropped destructure) must fail here even when every
// helper-level test still passes. 'cloudflare:workers' is stubbed via tests/register-stubs.mjs.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Billing } from '../worker.js';
import { createD1Repo } from '../economy.js';

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

// Distinct user ids per test: identity.js caches centralStatus for 60s per user.
function setup(userId, { frozen, identityUnreachable = false } = {}) {
  const db = new DatabaseSync(':memory:');
  for (const file of readdirSync('migrations').sort()) db.exec(readFileSync('migrations/' + file, 'utf8'));
  db.prepare('INSERT INTO users (id, email, name, created_at, updated_at) VALUES (?, NULL, NULL, 0, 0)').run(userId);
  db.prepare("INSERT INTO accounts (user_id, balance, updated_at, status) VALUES (?, 10000, 0, 'active')").run(userId);
  const env = {
    DB: d1Shim(db),
    IDENTITY_INTERNAL_SECRET: 'bsec',
    IDENTITY_ORIGIN: 'http://identity.test',
    FREEZE_FEE_SECRET: 'fee-tok',
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    if (identityUnreachable) throw new Error('connection refused');
    return new Response(JSON.stringify({ frozen }), { status: 200 });
  };
  const billing = new Billing();
  billing.env = env;
  billing.ctx = { waitUntil() {} };
  return { db, env, billing, restore: () => { globalThis.fetch = originalFetch; } };
}

const feeInput = userId => ({
  userId,
  amount: 4995,
  product: 'Southbag Identity',
  idempotencyKey: `identity|review|${userId}|1700000100000`,
  feeToken: 'fee-tok',
});

test('entrypoint charge: frozen account pays the Identity unfreeze fee exactly once', async () => {
  const { db, billing, restore } = setup('ep-u1', { frozen: true });
  try {
    const result = await billing.charge(feeInput('ep-u1'));
    assert.equal(result.balance, 5005);
    const row = db.prepare('SELECT amount, idempotency_key FROM transactions WHERE user_id = ?').get('ep-u1');
    assert.equal(row.amount, -4995);
    assert.equal(row.idempotency_key, 'identity|review|ep-u1|1700000100000');
    const retry = await billing.charge(feeInput('ep-u1'));
    assert.equal(retry.duplicate, true);
    assert.equal(retry.balance, 5005);
    assert.equal(db.prepare('SELECT COUNT(*) c FROM transactions WHERE user_id = ?').get('ep-u1').c, 1);
  } finally { restore(); }
});

test('entrypoint charge: frozen account with a spoofed identity key and no credential is refused', async () => {
  const { db, billing, restore } = setup('ep-u2', { frozen: true });
  try {
    const spoof = feeInput('ep-u2');
    delete spoof.feeToken;
    await assert.rejects(() => billing.charge(spoof), /frozen pending review/);
    const ordinary = { userId: 'ep-u2', amount: 500, product: 'Southbag Social Verified' };
    await assert.rejects(() => billing.charge(ordinary), /frozen pending review/);
    assert.equal(db.prepare('SELECT balance FROM accounts WHERE user_id = ?').get('ep-u2').balance, 10000);
  } finally { restore(); }
});

test('entrypoint charge: unknown central status fails closed on the mutation', async () => {
  const { billing, restore } = setup('ep-u3', { identityUnreachable: true });
  try {
    await assert.rejects(() => billing.charge({ userId: 'ep-u3', amount: 4995, product: 'Southbag Identity' }),
      /status cannot be checked/);
  } finally { restore(); }
});

test('entrypoint charge: unfrozen account charges an ordinary product', async () => {
  const { billing, restore } = setup('ep-u4', { frozen: false });
  try {
    const result = await billing.charge({ userId: 'ep-u4', amount: 500, product: 'Southbag Social Verified' });
    assert.equal(result.balance, 9500);
  } finally { restore(); }
});

test('entrypoint recovery fee never calls Identity back from the service RPC', async () => {
  const { db, billing, restore } = setup('ep-recovery-rpc', { identityUnreachable: true });
  try {
    let callbacks = 0;
    globalThis.fetch = async () => { callbacks++; throw new Error('recursive Identity callback'); };
    const input = feeInput('ep-recovery-rpc');
    const charged = await billing.charge(input);
    assert.equal(charged.balance, 5005);
    const repeated = await billing.charge(input);
    assert.equal(repeated.duplicate, true);
    assert.equal(callbacks, 0);
    assert.equal(db.prepare('SELECT COUNT(*) c FROM transactions WHERE user_id = ?').get('ep-recovery-rpc').c, 1);
    // A wrong or missing credential is not Identity: those charges still need a fresh central
    // answer and fail closed while Identity is unreachable.
    for (const changed of [{ feeToken: 'wrong' }, { feeToken: undefined }]) {
      await assert.rejects(() => billing.charge({ ...input, ...changed }), /status cannot be checked/);
    }
    assert.equal(callbacks, 2);
    // With the credential, Identity vouches and no callback happens for any of its charges on an
    // account the local mirror shows active - arbitrary amounts, products and key shapes included.
    for (const changed of [
      { amount: 1, idempotencyKey: 'identity|adj|ep-recovery-rpc|1' },
      { amount: 1, product: 'Southbag Social', idempotencyKey: 'identity|adj|ep-recovery-rpc|2' },
      { amount: 1, idempotencyKey: 'spoofed-fee-key' }
    ]) {
      const ok = await billing.charge({ ...input, ...changed });
      assert.equal(typeof ok.balance, 'number');
    }
    assert.equal(callbacks, 2);
    assert.equal(db.prepare('SELECT balance FROM accounts WHERE user_id = ?').get('ep-recovery-rpc').balance, 5002);
  } finally { restore(); }
});

test('entrypoint charge: an Identity-vouched MCP fee never calls Identity back from the service RPC', async () => {
  const { db, billing, restore } = setup('ep-mcp-vouch', { identityUnreachable: true });
  try {
    let callbacks = 0;
    globalThis.fetch = async () => { callbacks++; throw new Error('recursive Identity callback'); };
    // Identity's own /mcp request fee: not an unfreeze-fee amount, but Identity already refused
    // frozen accounts upstream and vouches with the credential only it holds.
    const input = {
      userId: 'ep-mcp-vouch',
      amount: 100,
      product: 'Southbag Identity',
      description: 'MCP request fee',
      idempotencyKey: 'identity-mcp|ep-mcp-vouch|e2e-key',
      feeToken: 'fee-tok',
    };
    const charged = await billing.charge(input);
    assert.equal(charged.balance, 9900);
    assert.equal(callbacks, 0);
    const repeated = await billing.charge(input);
    assert.equal(repeated.duplicate, true);
    assert.equal(db.prepare('SELECT COUNT(*) c FROM transactions WHERE user_id = ?').get('ep-mcp-vouch').c, 1);
    // Without the credential the same charge still needs a fresh central answer and fails closed.
    await assert.rejects(() => billing.charge({ ...input, idempotencyKey: 'identity-mcp|ep-mcp-vouch|other', feeToken: 'wrong' }),
      /status cannot be checked/);
    assert.equal(callbacks, 1);
  } finally { restore(); }
});
