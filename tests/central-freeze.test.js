// Account-level freeze support: the durable Identity report queue and the local-status mirror.
import { createD1Repo, createMemoryRepo, handleEconomy, flushFreezeReports, applyDailyAccountFees } from '../economy.js';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

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
  // D1 is single-writer: batches are serialized, never interleaved inside one transaction.
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
      // A failed batch must not poison the queue for the next one.
      queue = result.catch(() => {});
      return result;
    },
  };
}

function setup() {
  const db = new DatabaseSync(':memory:');
  for (const file of readdirSync('migrations').sort()) db.exec(readFileSync('migrations/' + file, 'utf8'));
  db.exec("INSERT INTO users (id, email, name, created_at, updated_at) VALUES ('u1', NULL, NULL, 0, 0)");
  db.prepare("INSERT INTO accounts (user_id, balance, updated_at, status) VALUES ('u1', 10000, 0, 'active')").run();
  return db;
}

test('setAccountStatus validates and mirrors', async () => {
  const db = setup();
  const repo = createD1Repo(d1Shim(db));
  assert.deepEqual(await repo.setAccountStatus('u1', 'frozen'), { found: true, previous: 'active', status: 'frozen' });
  assert.equal(db.prepare("SELECT status FROM accounts WHERE user_id='u1'").get().status, 'frozen');
  assert.deepEqual(await repo.setAccountStatus('u1', 'active'), { found: true, previous: 'frozen', status: 'active' });
  assert.deepEqual(await repo.setAccountStatus('nobody', 'frozen'), { found: false });
  await assert.rejects(() => repo.setAccountStatus('u1', 'suspicious'), /frozen or active/);
});

test('loan default queues the central freeze report durably, then flushes', async () => {
  const db = setup();
  const sent = [];
  const repo = createD1Repo(d1Shim(db), { reportFreeze: async (userId, reason) => { sent.push([userId, reason]); } });
  const user = { id: 'u1', email: null, name: null };
  await handleEconomy(repo, user, { action: 'loan', amount: '1' });
  const result = await handleEconomy(repo, user, { action: 'loan', sub: 'default' });
  assert.equal(result.ok, true);
  assert.equal(db.prepare("SELECT status FROM accounts WHERE user_id='u1'").get().status, 'frozen');
  assert.deepEqual(sent.map(([id]) => id), ['u1'], 'reported to Identity');
  assert.deepEqual(await repo.pendingFreezeReports(), [], 'queue drained after flush');
});

test('a failed report stays queued and the cron retries', async () => {
  const db = setup();
  let down = true;
  const sent = [];
  const repo = createD1Repo(d1Shim(db), {
    reportFreeze: async (userId) => { if (down) throw new Error('identity down'); sent.push(userId); },
  });
  const user = { id: 'u1', email: null, name: null };
  await handleEconomy(repo, user, { action: 'loan', amount: '1' });
  await handleEconomy(repo, user, { action: 'loan', sub: 'default' });
  assert.equal(sent.length, 0, 'nothing sent while Identity is down');
  assert.equal((await repo.pendingFreezeReports()).length, 1, 'still queued - no lost freeze');
  down = false;
  await applyDailyAccountFees(repo);
  assert.deepEqual(sent, ['u1'], 'cron retried the report');
  assert.deepEqual(await repo.pendingFreezeReports(), []);
});

test('flush without a hook is a no-op', async () => {
  const repo = createMemoryRepo();
  assert.deepEqual(await flushFreezeReports(repo), { sent: 0, failed: 0 });
});

test('billing charge with an idempotency key debits once across retries and races', async () => {
  const db = setup();
  const d1 = d1Shim(db);
  const { billingCharge } = await import('../economy.js');
  const input = { userId: 'u1', amount: 4995, product: 'Southbag Identity', description: 'Account review fee', idempotencyKey: 'review|u1|123' };
  const first = await billingCharge(d1, input);
  assert.equal(first.balance, 10000 - 4995);
  // Lost response: the caller retries with the same key.
  const retry = await billingCharge(d1, input);
  assert.equal(retry.duplicate, true);
  assert.equal(retry.balance, 10000 - 4995, 'no second debit');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM transactions WHERE idempotency_key='review|u1|123'").get().n, 1);
  // Concurrent duplicates: one wins, the other gets the same result.
  const [a, b] = await Promise.all([
    billingCharge(d1, { ...input, idempotencyKey: 'wrong|u1|1|kevin', amount: 200 }),
    billingCharge(d1, { ...input, idempotencyKey: 'wrong|u1|1|kevin', amount: 200 }),
  ]);
  assert.equal([a, b].filter(r => r.duplicate).length, 1);
  assert.equal(db.prepare("SELECT balance FROM accounts WHERE user_id='u1'").get().balance, 10000 - 4995 - 200);
  // Same key, different amount: rejected, not silently treated as paid.
  await assert.rejects(() => billingCharge(d1, { ...input, amount: 999 }), /UNIQUE/);
  // No key: charges as before.
  const plain = await billingCharge(d1, { userId: 'u1', amount: 100, product: 'X', description: 'y' });
  assert.equal(plain.duplicate, undefined);
});

test('billing charge opens an account for a new customer once, even with a key retry', async () => {
  const db = setup();
  const d1 = d1Shim(db);
  const { billingCharge } = await import('../economy.js');
  const input = { userId: 'new1', amount: 4995, product: 'Southbag Identity', description: 'Account review fee', idempotencyKey: 'review|new1|1' };
  const first = await billingCharge(d1, input);
  assert.equal(first.opened, true);
  assert.equal(first.balance, 1000000 - 4995);
  const retry = await billingCharge(d1, input);
  assert.equal(retry.duplicate, true);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM accounts WHERE user_id='new1'").get().n, 1);
});

test('billing charge validates input', async () => {
  const db = setup();
  const { billingCharge } = await import('../economy.js');
  await assert.rejects(() => billingCharge(d1Shim(db), { userId: '', amount: 100 }), /userId/);
  await assert.rejects(() => billingCharge(d1Shim(db), { userId: 'u1', amount: -5 }), /amount/);
  await assert.rejects(() => billingCharge(d1Shim(db), { userId: 'u1', amount: 100, idempotencyKey: 'short' }), /idempotencyKey/);
});

// ── Central status checks (per-request enforcement) ──
import { centralStatus, freezeFeeException } from '../identity.js';

const fetchJson = body => async () => ({ ok: true, status: 200, json: async () => body });
const secretEnv = { IDENTITY_INTERNAL_SECRET: 's', IDENTITY_ORIGIN: 'https://identity.test' };

test('centralStatus: off without a secret, frozen answer, NO cache, unknown on outage or rejected secret', async () => {
  assert.equal(await centralStatus({}, 'u1'), 'off', 'no secret: central check off');

  let calls = 0;
  const frozen = async () => { calls++; return { ok: true, status: 200, json: async () => ({ frozen: true }) }; };
  assert.deepEqual(await centralStatus(secretEnv, 'u2', frozen), { frozen: true });
  await centralStatus(secretEnv, 'u2', frozen);
  assert.equal(calls, 2, 'every check is fresh - a cached active answer is an authorization window');

  const down = async () => { throw new Error('connection refused'); };
  assert.equal(await centralStatus(secretEnv, 'u4', down), 'unknown', 'configured but unreachable: unknown, fail closed');
  assert.deepEqual(await centralStatus(secretEnv, 'u5', fetchJson({ frozen: false })), { frozen: false });

  // A wrong/rotated secret is observable (loud distinct log) and still fails closed.
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  try {
    const rejected = async () => ({ ok: false, status: 403, json: async () => ({}) });
    assert.equal(await centralStatus(secretEnv, 'u6', rejected), 'unknown', 'rejected secret: fail closed');
  } finally { console.error = originalError; }
  assert.ok(errors.some(line => /REJECTED the configured secret/.test(line)), 'secret rejection logged distinctly');
});

test('frozen charge exception: credential + exact fee, spoofs denied', () => {
  const env = { FREEZE_FEE_SECRET: 'only-identity-knows-this' };
  const legit = { product: 'Southbag Identity', amount: 4995, idempotencyKey: 'identity|review|u1|7', feeToken: 'only-identity-knows-this' };
  assert.equal(freezeFeeException(legit, env), true);
  assert.equal(freezeFeeException({ ...legit, amount: 200, idempotencyKey: 'identity|wrong|u1|7|nonsense' }, env), true);
  // A malicious ordinary caller spoofing the namespace WITHOUT the credential:
  assert.equal(freezeFeeException({ ...legit, feeToken: undefined }, env), false, 'no token');
  assert.equal(freezeFeeException({ ...legit, feeToken: 'wrong' }, env), false, 'wrong token');
  // With the token but off-allowlist parameters:
  assert.equal(freezeFeeException({ ...legit, amount: 999 }, env), false, 'arbitrary amount');
  assert.equal(freezeFeeException({ ...legit, product: 'Southbag Social' }, env), false, 'other product');
  assert.equal(freezeFeeException({ ...legit, idempotencyKey: 'other|key' }, env), false, 'wrong namespace');
  assert.equal(freezeFeeException(legit, {}), false, 'secret unconfigured: no exception at all');
});
