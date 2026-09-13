import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo, resolveSlackUser, handleEconomy, banUser } from '../economy.js';
import { signSlackRequest, verifySlackRequest } from '../slack-api.js';
import { parseCommands } from '../slack-commands.js';
import {
  createBot,
  handleEvent,
  handleInteraction,
  handleSlackRequest,
  handleSlashCommand,
  publishHome,
} from '../slack-bot.js';

const SECRET = 'shhh-signing-secret';

function fakeSlack() {
  const calls = [];
  const record = method => async payload => {
    calls.push({ method, payload });
    if (method === 'auth.test') return { ok: true, user_id: 'UBOT' };
    if (method === 'users.info') return { ok: true, user: { profile: { display_name: 'Testy', title: 'Chief Vibes' }, tz_label: 'Canberra' } };
    if (method === 'conversations.replies') return { ok: true, messages: [{ text: 'hello <@UBOT>' }] };
    return { ok: true };
  };
  return {
    calls,
    find: method => calls.filter(call => call.method === method),
    call: (method, payload) => record(method)(payload),
    postMessage: record('chat.postMessage'),
    postEphemeral: record('chat.postEphemeral'),
    addReaction: record('reactions.add'),
    viewsOpen: record('views.open'),
    viewsPush: record('views.push'),
    viewsPublish: record('views.publish'),
    usersInfo: user => record('users.info')({ user }),
    authTest: () => record('auth.test')({}),
    conversationsReplies: record('conversations.replies'),
    respond: (url, payload) => record('respond')({ url, ...payload }),
    fetchFile: async () => { throw new Error('no files in tests'); },
  };
}

function makeBot(extraEnv = {}) {
  const repo = createMemoryRepo();
  const slack = fakeSlack();
  const pending = [];
  const bot = createBot({ SLACK_BOT_TOKEN: 'xoxb', SLACK_SIGNING_SECRET: SECRET, SLACK_ALLOWED_CHANNEL: 'CLOBBY', ...extraEnv }, {
    repo,
    slack,
    waitUntil: promise => { pending.push(promise); return promise; },
  });
  return { bot, repo, slack, settle: () => Promise.all(pending) };
}

function command(name, text = '', user_id = 'U1', extra = {}) {
  return { command: name, text, user_id, user_name: 'testy', channel_id: 'CLOBBY', response_url: 'https://hooks.slack.test/respond', trigger_id: 'trig', ...extra };
}

async function openAccount(bot, user_id = 'U1') {
  await handleSlashCommand(bot, command('/south-open-account', '', user_id));
  return (await resolveSlackUser(bot.repo, user_id)).user;
}

test('verifies Slack request signatures and rejects stale ones', async () => {
  const body = 'command=%2Fsouth-balance&user_id=U1';
  const now = Math.floor(Date.now() / 1000);
  const signature = await signSlackRequest(SECRET, String(now), body);
  const headers = new Headers({ 'x-slack-request-timestamp': String(now), 'x-slack-signature': signature });
  assert.equal(await verifySlackRequest(SECRET, headers, body), true);
  assert.equal(await verifySlackRequest(SECRET, headers, body + 'x'), false);
  assert.equal(await verifySlackRequest('wrong', headers, body), false);
  assert.equal(await verifySlackRequest(SECRET, headers, body, now + 600), false);
});

test('parses the AI command tags out of replies', () => {
  const { cleanText, commands } = parseCommands('Go away. [FEE:0.25:Attitude adjustment] [TICKET:4521] [DISCONNECT]');
  assert.equal(cleanText, 'Go away.');
  assert.deepEqual(commands.map(cmd => cmd.type), ['disconnect', 'ticket', 'fee']);
  assert.equal(commands.find(cmd => cmd.type === 'fee').amount, 0.25);
});

test('HTTP entry answers url_verification and rejects bad signatures', async () => {
  const env = { SLACK_BOT_TOKEN: 'xoxb', SLACK_SIGNING_SECRET: SECRET };
  const body = JSON.stringify({ type: 'url_verification', challenge: 'abc' });
  const now = String(Math.floor(Date.now() / 1000));
  const signed = new Request('https://banking.test/slack/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-slack-request-timestamp': now, 'x-slack-signature': await signSlackRequest(SECRET, now, body) },
    body,
  });
  const ok = await handleSlackRequest(signed, env, { waitUntil() {} }, { repo: createMemoryRepo(), slack: fakeSlack() });
  assert.deepEqual(await ok.json(), { challenge: 'abc' });

  const forged = new Request('https://banking.test/slack/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-slack-request-timestamp': now, 'x-slack-signature': 'v0=nope' },
    body,
  });
  assert.equal((await handleSlackRequest(forged, env, { waitUntil() {} })).status, 401);
  assert.equal((await handleSlackRequest(forged, {}, { waitUntil() {} })).status, 503);
});

test('slash commands need an account, then open-account creates a shadow user', async () => {
  const { bot, repo, slack } = makeBot();
  await handleSlashCommand(bot, command('/south-balance'));
  assert.match(slack.find('respond')[0].payload.text, /south-open-account/);

  await handleSlashCommand(bot, command('/south-open-account', 'Testy McTest'));
  const user = await repo.getUserBySlackId('U1');
  assert.equal(user.id, 'slack:U1');
  assert.equal(user.name, 'Testy McTest');
  const account = await repo.getAccount(user.id);
  assert.ok(account.balance >= 0 && account.balance < 500, 'pathetic starting balance');
  assert.match(slack.find('respond')[1].payload.blocks[0].text.text, /Welcome/);

  await handleSlashCommand(bot, command('/south-balance'));
  const reply = slack.find('respond')[2].payload;
  assert.equal(reply.response_type, 'ephemeral');
  assert.equal(reply.blocks[0].text.text, 'Southbag Account Summary');
  assert.equal((await repo.getAccount(user.id)).balance, account.balance - 7);
});

test('transfers resolve Slack mentions and DM balance changes when notifications are on', async () => {
  const { bot, repo, slack } = makeBot();
  const me = await openAccount(bot, 'U1');
  const them = await openAccount(bot, 'U2');
  await repo.updateAccount(me.id, { balance: 100000 });
  await repo.updateAccount(them.id, { notifications: 1 });
  await handleSlashCommand(bot, command('/south-transfer', '5 <@U2|them>'));
  const reply = slack.find('respond').at(-1).payload;
  assert.equal(reply.blocks[0].text.text, 'Transfer Complete (somehow)');
  const theirs = await repo.getAccount(them.id);
  assert.ok(theirs.balance >= 500);
  const dm = slack.find('chat.postMessage').find(call => call.payload.channel === 'U2');
  assert.match(dm.payload.text, /Balance Update/);
  const txn = (await repo.listTxns(them.id, 1))[0];
  assert.equal(txn.description, 'Transfer from testy');
});

test('leaderboard is public and mentions Slack users', async () => {
  const { bot, slack } = makeBot();
  await openAccount(bot, 'U1');
  await handleSlashCommand(bot, command('/south-leaderboard', 'bottom', 'U9'));
  const reply = slack.find('respond').at(-1).payload;
  assert.equal(reply.response_type, 'in_channel');
  assert.match(reply.text, /WALL OF SHAME/);
  assert.match(reply.text, /<@U1>/);
});

test('deposit is admin only and lands in the target account', async () => {
  const { bot, repo, slack } = makeBot({ SLACK_ADMIN_IDS: 'UADMIN' });
  const victim = await openAccount(bot, 'U1');
  await openAccount(bot, 'UADMIN');
  await handleSlashCommand(bot, command('/south-deposit', '<@U1> 10', 'U1'));
  assert.match(slack.find('respond').at(-1).payload.text, /permission/);
  const before = (await repo.getAccount(victim.id)).balance;
  await handleSlashCommand(bot, command('/south-deposit', '<@U1> 10', 'UADMIN'));
  assert.equal((await repo.getAccount(victim.id)).balance, before + 730 - 25);
  assert.equal(slack.find('respond').at(-1).payload.blocks[0].text.text, 'Deposit Processed');
});

test('banned customers are turned away', async () => {
  const { bot, slack } = makeBot();
  const user = await openAccount(bot, 'U1');
  await banUser(bot.repo, user.id, { reason: 'Looking at Kevin wrong' });
  await handleSlashCommand(bot, command('/south-balance'));
  assert.match(slack.find('respond').at(-1).payload.text, /suspended/);
});

test('shop modal opens, overflow buys, and closing without buying costs money', async () => {
  const { bot, repo, slack, settle } = makeBot();
  const user = await openAccount(bot, 'U1');
  await repo.updateAccount(user.id, { balance: 100000 });
  await handleSlashCommand(bot, command('/south-shop'));
  const view = slack.find('views.open')[0].payload.view;
  assert.equal(view.callback_id, 'shop_browse');
  assert.ok(view.blocks.some(block => block.accessory?.action_id === 'shop_action_blahaj'));

  await handleInteraction(bot, {
    type: 'block_actions', user: { id: 'U1' }, trigger_id: 't', view: { id: 'V1', callback_id: 'shop_browse', private_metadata: view.private_metadata },
    actions: [{ action_id: 'shop_action_blahaj', selected_option: { value: 'buy_blahaj' } }],
  });
  await settle();
  const account = await repo.getAccount(user.id);
  assert.equal(account.inventory[0].itemId, 'blahaj');
  assert.equal(account.balance, 100000 - 4999);
  const updated = slack.find('views.update')[0].payload.view;
  assert.equal(JSON.parse(updated.private_metadata).bought, true);

  await handleInteraction(bot, { type: 'view_closed', user: { id: 'U1' }, view: { callback_id: 'shop_browse', private_metadata: view.private_metadata } });
  await settle();
  assert.equal((await repo.getAccount(user.id)).balance, 100000 - 4999 - 15);
  await handleInteraction(bot, { type: 'view_closed', user: { id: 'U1' }, view: { callback_id: 'shop_browse', private_metadata: updated.private_metadata } });
  await settle();
  assert.equal((await repo.getAccount(user.id)).balance, 100000 - 4999 - 15, 'no fee after buying');
});

test('gift modal validates and hands the item to the recipient', async () => {
  const { bot, repo, slack, settle } = makeBot();
  const me = await openAccount(bot, 'U1');
  const them = await openAccount(bot, 'U2');
  await repo.updateAccount(me.id, { balance: 100 });
  const view = { callback_id: 'gift_modal', root_view_id: 'V1', private_metadata: JSON.stringify({ itemId: 'kevins_arm', userId: me.id, slackId: 'U1' }), state: { values: { recipient_block: { recipient: { selected_user: 'U2' } } } } };
  const broke = await handleInteraction(bot, { type: 'view_submission', user: { id: 'U1' }, view });
  assert.match((await broke.json()).errors.recipient_block, /afford/);

  await repo.updateAccount(me.id, { balance: 10000 });
  view.private_metadata = JSON.stringify({ itemId: 'blahaj', userId: me.id, slackId: 'U1' });
  const ok = await handleInteraction(bot, { type: 'view_submission', user: { id: 'U1' }, view });
  assert.equal(await ok.text(), '');
  await settle();
  const theirs = await repo.getAccount(them.id);
  assert.equal(theirs.inventory[0].itemId, 'blahaj');
  assert.equal(theirs.inventory[0].giftedBy, me.id);
  assert.match(slack.find('chat.postMessage').at(-1).payload.text, /gifted a \*Blahaj\* to <@U2>/);
});

test('lottery buy modal validates numbers and buys a ticket', async () => {
  const { bot, repo, slack } = makeBot();
  const user = await openAccount(bot, 'U1');
  await repo.updateAccount(user.id, { balance: 10000 });
  await handleSlashCommand(bot, command('/south-lottery', 'buy'));
  const view = slack.find('views.open').at(-1).payload.view;
  assert.equal(view.callback_id, 'lottery_buy_modal');
  const submit = numbers => handleInteraction(bot, { type: 'view_submission', user: { id: 'U1' }, view: { ...view, state: { values: { numbers_block: { numbers: { value: numbers } } } } } });
  assert.match((await (await submit('1 2')).json()).errors.numbers_block, /exactly/);
  assert.match((await (await submit('1 1 2')).json()).errors.numbers_block, /duplicate/);
  assert.equal(await (await submit('1 2 3')).text(), '');
  const lottery = await repo.getOpenLottery();
  const tickets = await repo.listLotteryTickets(lottery.id, user.id);
  assert.equal(tickets.length, 1);
});

test('App Home shows the banking overview and the admin panel for admins', async () => {
  const { bot, slack } = makeBot({ SLACK_ADMIN_IDS: 'UADMIN' });
  await publishHome(bot, 'U1');
  let view = slack.find('views.publish').at(-1).payload.view;
  assert.match(JSON.stringify(view.blocks), /do not have a Southbag account/);

  await openAccount(bot, 'U1');
  await publishHome(bot, 'U1');
  view = slack.find('views.publish').at(-1).payload.view;
  assert.match(JSON.stringify(view.blocks), /Account Overview/);
  assert.doesNotMatch(JSON.stringify(view.blocks), /Admin Panel/);

  await publishHome(bot, 'UADMIN');
  view = slack.find('views.publish').at(-1).payload.view;
  assert.match(JSON.stringify(view.blocks), /Southbag Admin Panel/);
});

test('events are deduplicated and mentions in threads trigger replies', async () => {
  const { bot, repo, slack } = makeBot({ HCAI: 'key' });
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /ai\.hackclub\.com/);
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Read the manual. [FEE:0.05:Asking a stupid question]' } }] }), { status: 200 });
  };
  try {
    const user = await openAccount(bot, 'U1');
    await repo.updateAccount(user.id, { balance: 1000 });
    const payload = {
      type: 'event_callback', event_id: 'Ev1', authorizations: [{ user_id: 'UBOT' }],
      event: { type: 'app_mention', channel: 'CLOBBY', user: 'U1', ts: '1.0', text: '<@UBOT> help me' },
    };
    await handleEvent(bot, payload);
    await handleEvent(bot, payload);
    const posts = slack.find('chat.postMessage');
    assert.equal(posts.filter(call => call.payload.text === 'Read the manual.').length, 1);
    assert.ok(posts.some(call => /charged \$0\.05/.test(call.payload.text)));
    assert.equal((await repo.getAccount(user.id)).balance, 995);
    const history = await repo.listSlackMessages('CLOBBY', '1.0', 20);
    assert.deepEqual(history.map(row => row.role), ['user', 'assistant']);

    await handleEvent(bot, { type: 'event_callback', event_id: 'Ev2', event: { type: 'message', channel: 'CLOBBY', user: 'U1', ts: '2.0', thread_ts: '1.0', text: 'still waiting' } });
    assert.equal(slack.find('chat.postMessage').filter(call => call.payload.text === 'Read the manual.').length, 2);
    await handleEvent(bot, { type: 'event_callback', event_id: 'Ev3', event: { type: 'message', channel: 'CELSEWHERE', user: 'U1', ts: '3.0', text: 'ignored' } });
    assert.equal(slack.find('chat.postMessage').filter(call => call.payload.text === 'Read the manual.').length, 2);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('web economy still works for linked users', async () => {
  const repo = createMemoryRepo();
  repo.seedUser({ id: 'oidc-1', email: 'a@southbag.cc', name: 'Web Person', slack_user_id: 'U5' });
  await repo.updateAccount('oidc-1', { balance: 5000, status: 'active', inventory: [], updated_at: Date.now() });
  const found = await resolveSlackUser(repo, 'U5');
  assert.equal(found.user.id, 'oidc-1');
  const result = await handleEconomy(repo, found.user, { command: '/south-balance' });
  assert.equal(result.ok, true);
});

test('unlinked Slack users are told to sign up and link on the web', async () => {
  const { bot, repo, slack } = makeBot();
  const url = 'https://southbag.cc/onboarding?flow=slack-banking';
  await handleSlashCommand(bot, command('/south-balance'));
  assert.match(slack.find('respond').at(-1).payload.text, new RegExp(url.replace(/[?]/g, '\\?')));

  await openAccount(bot, 'U1');
  await handleSlashCommand(bot, command('/south-balance'));
  const reply = slack.find('respond').at(-1).payload;
  assert.match(reply.text, /not linked/);
  assert.equal(reply.blocks.at(-1).type, 'context');
  assert.match(reply.blocks.at(-1).elements[0].text, /link this Slack account/);

  await publishHome(bot, 'U1');
  const home = slack.find('views.publish').at(-1).payload.view;
  assert.equal(home.blocks[0].accessory.url, url);

  repo.seedUser({ id: 'oidc-1', email: 'a@southbag.cc', name: 'Web Person', slack_user_id: 'U7' });
  await repo.updateAccount('oidc-1', { balance: 5000, status: 'active', inventory: [], updated_at: Date.now() });
  await handleSlashCommand(bot, command('/south-balance', '', 'U7'));
  const linked = slack.find('respond').at(-1).payload;
  assert.doesNotMatch(linked.text, /not linked/);
  assert.equal(linked.blocks.at(-1).elements[0].text, '_Your balance was charged for checking your balance, and then charged again for knowing about it. Classic._');
  await publishHome(bot, 'U7');
  assert.doesNotMatch(JSON.stringify(slack.find('views.publish').at(-1).payload.view.blocks), /link_web_account/);
});

test('support chat nudges unlinked users once per thread', async () => {
  const { bot, slack } = makeBot({ HCAI: 'key' });
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: 'No.' } }] }), { status: 200 });
  try {
    await openAccount(bot, 'U1');
    const event = ts => ({ type: 'event_callback', event_id: 'E' + ts, event: { type: 'app_mention', channel: 'CLOBBY', user: 'U1', ts, thread_ts: '9.0', text: '<@UBOT> hi' } });
    await handleEvent(bot, event('9.0'));
    await handleEvent(bot, event('9.1'));
    const nudges = slack.find('chat.postEphemeral').filter(call => /Sign up on the web/.test(call.payload.text));
    assert.equal(nudges.length, 1);
    assert.equal(nudges[0].payload.thread_ts, '9.0');
  } finally {
    globalThis.fetch = realFetch;
  }
});
