// The Slack bot funnels every economy call through economy()/freezeGate so a centrally frozen
// account cannot read or move money over Slack. Linked users carry their Identity id; legacy
// shadow users ('slack:<id>') have no Identity account and are out of the freeze's reach.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBot, freezeGate } from '../slack-bot.js';

const linked = id => ({ id, slack_user_id: 'S-' + id });
const explodingRepo = new Proxy({}, { get: () => () => { throw new Error('repo must not be touched'); } });

function botFor(userId, { frozen, unreachable = false, configured = true } = {}) {
  const env = configured
    ? { IDENTITY_INTERNAL_SECRET: 'bsec', IDENTITY_ORIGIN: 'http://identity.test' }
    : {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    if (unreachable) throw new Error('connection refused');
    return new Response(JSON.stringify({ frozen }), { status: 200 });
  };
  return { bot: createBot(env, { repo: explodingRepo }), restore: () => { globalThis.fetch = originalFetch; } };
}

test('slack: known-frozen linked user is blocked entirely, reads included', async () => {
  const { bot, restore } = botFor('sf-u1', { frozen: true });
  try {
    for (const body of [{ action: 'fee' }, { action: 'overview' }, { action: 'transactions' }, { action: 'lottery', sub: 'info' }]) {
      const gate = await freezeGate(bot, linked('sf-u1'), body);
      assert.equal(gate?.error, 'frozen');
      assert.match(gate.text, /frozen pending review/);
    }
  } finally { restore(); }
});

test('slack: unknown central status fails closed - reads and mutations both wait', async () => {
  const { bot, restore } = botFor('sf-u2', { unreachable: true });
  try {
    for (const body of [{ action: 'overview' }, { action: 'leaderboard' }, { action: 'fee', amount: 1 }, { action: 'lottery', sub: 'info' }]) {
      const gate = await freezeGate(bot, linked('sf-u2'), body);
      assert.equal(gate?.error, 'unavailable');
      assert.match(gate.text, /status cannot be checked/);
    }
  } finally { restore(); }
});

test('slack: legacy shadow users have no Identity account and are not gated', async () => {
  const { bot, restore } = botFor('sf-u3', { frozen: true });
  try {
    assert.equal(await freezeGate(bot, { id: 'slack:U123', slack_user_id: 'U123' }, { action: 'fee' }), null);
  } finally { restore(); }
});

test('slack: gate is off when the central check is unconfigured (local dev)', async () => {
  const { bot, restore } = botFor('sf-u4', { configured: false });
  try {
    assert.equal(await freezeGate(bot, linked('sf-u4'), { action: 'fee' }), null);
  } finally { restore(); }
});
