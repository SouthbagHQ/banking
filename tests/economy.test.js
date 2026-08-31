import { createMemoryRepo, handleEconomy, parseCommand } from '../economy.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

function user(id = 'user-1') {
  return { id, email: id + '@southbag.cc', name: 'Customer ' + id };
}

async function setup(balance = 1000000) {
  const repo = createMemoryRepo();
  const me = user();
  const other = user('user-2');
  repo.seedUser(me);
  repo.seedUser(other);
  await repo.updateAccount(me.id, { balance, status: 'active', inventory: [], updated_at: Date.now() });
  await repo.updateAccount(other.id, { balance, status: 'active', inventory: [], updated_at: Date.now() });
  return { repo, me, other };
}

test('parses slash commands like the Slack bot', () => {
  assert.deepEqual(parseCommand('/south-balance'), { action: 'balance', text: '' });
  assert.deepEqual(parseCommand('/south-transfer 12.50 user-2@southbag.cc'), {
    action: 'transfer',
    text: '12.50 user-2@southbag.cc',
  });
});

test('balance inquiry charges fees', async () => {
  const { repo, me } = await setup(10000);
  const result = await handleEconomy(repo, me, { action: 'balance' });
  assert.equal(result.ok, true);
  const account = await repo.getAccount(me.id);
  assert.equal(account.balance, 9993);
});

test('mystery fee takes money for a Kevin reason', async () => {
  const { repo, me } = await setup(500);
  const result = await handleEconomy(repo, me, { command: '/south-mystery-fee' });
  assert.equal(result.ok, true);
  const account = await repo.getAccount(me.id);
  assert.ok(account.balance < 500);
  assert.match(result.text, /Charged/);
});

test('transfers apply the famous fee pile', async () => {
  const { repo, me, other } = await setup(20000);
  const result = await handleEconomy(repo, me, { command: '/south-transfer 10 user-2@southbag.cc' });
  assert.equal(result.ok, true);
  const sender = await repo.getAccount(me.id);
  const recipient = await repo.getAccount(other.id);
  assert.equal(recipient.balance, 21000);
  assert.ok(sender.balance < 19000);
});

test('shop sells Blahaj and inventory remembers', async () => {
  const { repo, me } = await setup(100000);
  const result = await handleEconomy(repo, me, { action: 'shop', item: 'blahaj' });
  assert.equal(result.ok, true);
  const account = await repo.getAccount(me.id);
  assert.equal(account.inventory[0].itemId, 'blahaj');
  assert.equal(account.balance, 100000 - 4999);
});

test('jobs hire, work, and quit with fees', async () => {
  const { repo, me } = await setup(100000);
  const hired = await handleEconomy(repo, me, { action: 'job' });
  assert.equal(hired.ok, true);
  const worked = await handleEconomy(repo, me, { action: 'work' });
  assert.equal(worked.ok, true);
  const quit = await handleEconomy(repo, me, { action: 'quit' });
  assert.equal(quit.ok, true);
  assert.equal(await repo.getJob(me.id), null);
});

test('support fee command charges during chat', async () => {
  const { repo, me } = await setup(1000);
  const result = await handleEconomy(repo, me, { action: 'fee', amount: 1.5, reason: 'Asking a stupid question' });
  assert.equal(result.ok, true);
  assert.equal((await repo.getAccount(me.id)).balance, 850);
});
