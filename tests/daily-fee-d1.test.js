// Exercises chargeDailyAccountFee against a real SQL engine (node:sqlite)
// with the real migrations, through a shim that gives db.batch the same
// all-or-nothing, in-order transaction semantics D1 has.
import { createD1Repo } from '../economy.js';
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
  return {
    prepare,
    async batch(statements) {
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
    },
  };
}

const DAY = 86400000;

function setup(status = 'active') {
  const db = new DatabaseSync(':memory:');
  for (const file of readdirSync('migrations').sort()) db.exec(readFileSync('migrations/' + file, 'utf8'));
  db.exec("INSERT INTO users (id, email, name, created_at, updated_at) VALUES ('u1', NULL, NULL, 0, 0)");
  db.prepare("INSERT INTO accounts (user_id, balance, updated_at, status) VALUES ('u1', 10000, 0, ?)").run(status);
  return { db, repo: createD1Repo(d1Shim(db)) };
}

const account = db => db.prepare('SELECT * FROM accounts WHERE user_id = ?').get('u1');
const feeTxns = db => db.prepare("SELECT * FROM transactions WHERE user_id = 'u1' AND kind = 'fee'").all();

test('daily fee charges once per UTC day, gated on both statements', async () => {
  const { db, repo } = setup();
  const at = DAY * 200 + 3600000;
  assert.equal(await repo.chargeDailyAccountFee('u1', DAY * 200, at), true);
  assert.equal(account(db).balance, 9900);
  assert.equal(account(db).last_account_fee_at, at);
  assert.equal(feeTxns(db).length, 1);
  // Same day, as a concurrent cron/interaction would see it: both the ledger
  // INSERT and the balance UPDATE must no-op.
  assert.equal(await repo.chargeDailyAccountFee('u1', DAY * 200, at + 1000), false);
  assert.equal(account(db).balance, 9900, 'no second debit');
  assert.equal(feeTxns(db).length, 1, 'no second ledger row');
  assert.equal(account(db).last_account_fee_at, at, 'claim not moved');
  // Next UTC day charges again.
  assert.equal(await repo.chargeDailyAccountFee('u1', DAY * 201, DAY * 201), true);
  assert.equal(account(db).balance, 9800);
  assert.equal(feeTxns(db).length, 2);
});

test('frozen accounts are charged $2 with the frozen description, read in-transaction', async () => {
  const { db, repo } = setup('frozen');
  const at = DAY * 200;
  assert.equal(await repo.chargeDailyAccountFee('u1', DAY * 200, at), true);
  assert.equal(account(db).balance, 9800);
  const [txn] = feeTxns(db);
  assert.equal(txn.amount, -200);
  assert.equal(txn.description, 'Daily frozen account fee');
  assert.equal(await repo.chargeDailyAccountFee('u1', DAY * 200, at + 1), false);
});

test('a failure inside the batch rolls back claim, debit and ledger row', async () => {
  const { db, repo } = setup();
  db.exec("CREATE TRIGGER abort_account_update BEFORE UPDATE ON accounts BEGIN SELECT RAISE(ABORT, 'forced failure'); END");
  await assert.rejects(() => repo.chargeDailyAccountFee('u1', DAY * 200, DAY * 200), /forced failure/);
  assert.equal(account(db).balance, 10000, 'no debit survived the failed batch');
  assert.equal(account(db).last_account_fee_at, null, 'no claim survived the failed batch');
  assert.equal(feeTxns(db).length, 0, 'no ledger row survived the failed batch');
  db.exec('DROP TRIGGER abort_account_update');
  assert.equal(await repo.chargeDailyAccountFee('u1', DAY * 200, DAY * 200), true, 'fee lands cleanly once the failure is gone');
  assert.equal(account(db).balance, 9900);
  assert.equal(feeTxns(db).length, 1);
});
