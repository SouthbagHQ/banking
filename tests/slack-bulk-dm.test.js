import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../economy.js';
import { handleBulkDmRequest, renderTemplate, selectAudience } from '../slack-bulk-dm.js';

const ADMIN_TOKEN = 'test-admin-token';

function fakeSlack({ bots = new Set(), failFor = new Set() } = {}) {
  const calls = [];
  return {
    calls,
    find: method => calls.filter(call => call.method === method),
    authTest: async () => ({ ok: true, user_id: 'UBOT' }),
    usersInfo: async user => {
      calls.push({ method: 'users.info', payload: { user } });
      if (bots.has(user)) return { ok: true, user: { is_bot: true, profile: { display_name: 'Botty' } } };
      return { ok: true, user: { profile: { display_name: `Human ${user}` } } };
    },
    postMessage: async payload => {
      calls.push({ method: 'chat.postMessage', payload });
      if (failFor.has(payload.channel)) throw new Error('Slack chat.postMessage failed: user_not_found');
      return { ok: true };
    },
  };
}

function seed(repo) {
  // Shadow (unlinked) user created by a bot interaction.
  repo.seedUser({ id: 'slack:U1', email: null, name: 'Shadow One', slack_user_id: 'U1' });
  // Linked web user.
  repo.seedUser({ id: 'web-user-2', email: 'two@example.com', name: 'Linked Two', slack_user_id: 'U2' });
  // Unlinked user who is actually a bot in Slack.
  repo.seedUser({ id: 'slack:U3', email: null, name: 'Botty', slack_user_id: 'U3' });
  // The app's own bot user somehow has a shadow row too.
  repo.seedUser({ id: 'slack:UBOT', email: null, name: 'Southbag Support', slack_user_id: 'UBOT' });
  // Web user with no Slack at all: never in any audience.
  repo.seedUser({ id: 'web-user-4', email: 'four@example.com', name: 'Web Only' });
}

function setup(env = {}, slackOptions) {
  const repo = createMemoryRepo();
  seed(repo);
  const slack = fakeSlack(slackOptions);
  const fullEnv = { SLACK_ADMIN_TOKEN: ADMIN_TOKEN, SLACK_BOT_TOKEN: 'xoxb-test', SLACK_SIGNING_SECRET: 'x', ...env };
  const call = body => handleBulkDmRequest(new Request('https://banking.southbag.cc/slack/admin/bulk-dm', {
    method: 'POST',
    headers: { authorization: `Bearer ${ADMIN_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }), fullEnv, null, { repo, slack, sleep: async () => {} });
  return { repo, slack, call, env: fullEnv };
}

async function preview(setup_) {
  const response = await setup_.call({ target: 'unlinked', message: 'Hi {name}, link up.' });
  assert.equal(response.status, 200);
  return response.json();
}

test('answers 503 until the admin token is configured', async () => {
  const { call } = setup();
  const request = new Request('https://banking.southbag.cc/slack/admin/bulk-dm', { method: 'POST' });
  const response = await handleBulkDmRequest(request, { SLACK_BOT_TOKEN: 'x' }, null, {});
  assert.equal(response.status, 503);
});

test('rejects missing and wrong bearer tokens', async () => {
  const repo = createMemoryRepo();
  const slack = fakeSlack();
  const env = { SLACK_ADMIN_TOKEN: ADMIN_TOKEN, SLACK_BOT_TOKEN: 'x' };
  const make = auth => new Request('https://banking.southbag.cc/slack/admin/bulk-dm', {
    method: 'POST', headers: { ...(auth ? { authorization: auth } : {}), 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal((await handleBulkDmRequest(make(null), env, null, { repo, slack })).status, 401);
  assert.equal((await handleBulkDmRequest(make('Bearer wrong'), env, null, { repo, slack })).status, 401);
});

test('preview resolves the unlinked audience, excludes bots and self, and sends nothing', async () => {
  const setup_ = setup({}, { bots: new Set(['U3']) });
  const body = await preview(setup_);
  assert.equal(body.dry_run, true);
  assert.deepEqual(body.recipients.map(row => row.slack_user_id), ['U1']);
  assert.equal(body.recipients[0].name, 'Human U1');
  assert.ok(!body.recipients[0].linked);
  assert.ok(body.confirm);
  assert.equal(setup_.slack.find('chat.postMessage').length, 0);
});

test('linked and all targets select the matching rows', async () => {
  const repo = createMemoryRepo();
  seed(repo);
  assert.deepEqual((await selectAudience(repo, 'linked')).map(row => row.slack_user_id), ['U2']);
  assert.deepEqual((await selectAudience(repo, 'unlinked')).map(row => row.slack_user_id).sort(), ['U1', 'U3', 'UBOT']);
  assert.equal((await selectAudience(repo, 'all')).length, 4);
});

test('slack_ids target keeps unknown ids and requires a non-empty list', async () => {
  const setup_ = setup();
  const missing = await setup_.call({ target: 'slack_ids', message: 'hi' });
  assert.equal(missing.status, 400);
  const response = await setup_.call({ target: 'slack_ids', slack_ids: ['U2', 'U999'], message: 'hi' });
  const body = await response.json();
  assert.deepEqual(body.recipients.map(row => row.slack_user_id).sort(), ['U2', 'U999']);
  assert.equal(body.recipients.find(row => row.slack_user_id === 'U999').linked, null);
});

test('validates target and message', async () => {
  const setup_ = setup();
  assert.equal((await setup_.call({ target: 'everybody', message: 'hi' })).status, 400);
  assert.equal((await setup_.call({ target: 'all', message: '  ' })).status, 400);
  assert.equal((await setup_.call({ target: 'all', message: 'x'.repeat(3001) })).status, 400);
});

test('sending stays disabled without SLACK_BULK_DM_ENABLED even with a valid confirm', async () => {
  const setup_ = setup({}, { bots: new Set(['U3']) });
  const { confirm } = await preview(setup_);
  const response = await setup_.call({ target: 'unlinked', message: 'Hi {name}, link up.', confirm });
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /disabled/);
  assert.equal(setup_.slack.find('chat.postMessage').length, 0);
});

test('a mismatched confirm is refused and sends nothing', async () => {
  const setup_ = setup({ SLACK_BULK_DM_ENABLED: 'true' }, { bots: new Set(['U3']) });
  const response = await setup_.call({ target: 'unlinked', message: 'Hi {name}, link up.', confirm: 'deadbeef' });
  assert.equal(response.status, 409);
  assert.equal(setup_.slack.find('chat.postMessage').length, 0);
});

test('enabled send with a valid confirm DMs each recipient with the rendered template', async () => {
  const setup_ = setup({ SLACK_BULK_DM_ENABLED: 'true' }, { bots: new Set(['U3']) });
  const { confirm } = await preview(setup_);
  const response = await setup_.call({ target: 'unlinked', message: 'Hi {name}, link up.', confirm });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.dry_run, false);
  assert.equal(body.sent, 1);
  assert.deepEqual(body.failed, []);
  const posts = setup_.slack.find('chat.postMessage');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].payload.channel, 'U1');
  assert.equal(posts[0].payload.text, 'Hi Human U1, link up.');
});

test('a per-recipient Slack failure is reported, not fatal', async () => {
  const setup_ = setup({ SLACK_BULK_DM_ENABLED: 'true' }, { bots: new Set(['U3']), failFor: new Set(['U1']) });
  const { confirm } = await preview(setup_);
  const response = await setup_.call({ target: 'unlinked', message: 'Hi {name}, link up.', confirm });
  const body = await response.json();
  assert.equal(body.sent, 0);
  assert.equal(body.failed.length, 1);
  assert.equal(body.failed[0].slack_user_id, 'U1');
  assert.match(body.failed[0].error, /user_not_found/);
});

test('renderTemplate substitutes {name} with a fallback', () => {
  assert.equal(renderTemplate('Hey {name}!', { name: 'Ingo' }), 'Hey Ingo!');
  assert.equal(renderTemplate('Hey {name}!', { name: null }), 'Hey there!');
});
