import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  centsFromDollars,
  decodeJwtPayload,
  linkSlackAccount,
  overwriteStatements,
  slackAuthorizeUrl,
  slackConfigured,
  slackUserIdFromProfile,
} from '../slack-link.js';

test('converts Slack dollars to web cents and clamps Kevin money', () => {
  assert.equal(centsFromDollars(0.05), 5);
  assert.equal(centsFromDollars(-3000), -300000);
  assert.equal(centsFromDollars(14499.45), 1449945);
  assert.equal(centsFromDollars(3.2857903286234975e+141), Number.MAX_SAFE_INTEGER);
  assert.equal(centsFromDollars('nope'), 0);
});

test('reads Slack user ids from OpenID claims', () => {
  assert.equal(slackUserIdFromProfile({ 'https://slack.com/user_id': 'U09KKMHLS15', sub: 'Uother' }), 'U09KKMHLS15');
  assert.equal(slackUserIdFromProfile({ sub: 'U05APP82JMR' }), 'U05APP82JMR');
  assert.equal(slackUserIdFromProfile({}), null);
});

test('decodes a JWT payload enough to check nonce', () => {
  const payload = btoa(JSON.stringify({ nonce: 'abcd', sub: 'U123' }))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  assert.deepEqual(decodeJwtPayload('aaa.' + payload + '.sig'), { nonce: 'abcd', sub: 'U123' });
});

test('builds the Sign in with Slack authorize URL', () => {
  const url = new URL(slackAuthorizeUrl({
    clientId: '123.456',
    redirectUri: 'https://banking.southbag.cc/auth/slack/callback',
    state: 'state-1',
    nonce: 'nonce-1',
  }));
  assert.equal(url.origin + url.pathname, 'https://slack.com/openid/connect/authorize');
  assert.equal(url.searchParams.get('scope'), 'openid profile email');
  assert.equal(url.searchParams.get('client_id'), '123.456');
});

test('slackConfigured needs both client values', () => {
  assert.equal(slackConfigured({}), false);
  assert.equal(slackConfigured({ SLACK_CLIENT_ID: 'x' }), false);
  assert.equal(slackConfigured({ SLACK_CLIENT_ID: 'x', SLACK_CLIENT_SECRET: 'y' }), true);
});

function fakeDb({ users = [], legacy = null, inventory = [], heists = [], lotteries = [] } = {}) {
  const runs = [];
  const results = { heists, lotteries, inventory };
  const db = {
    runs,
    prepare(sql) {
      const stmt = {
        sql,
        args: [],
        bind(...args) {
          stmt.args = args;
          return stmt;
        },
        async first() {
          if (sql.includes('FROM users WHERE slack_user_id'))
            return users.find(user => user.slack_user_id === stmt.args[0]) || null;
          if (sql.includes('FROM users WHERE id'))
            return users.find(user => user.id === stmt.args[0]) || null;
          if (sql.includes('FROM slack_legacy_accounts'))
            return stmt.args[0] === legacy?.slack_user_id ? legacy : null;
          return null;
        },
        async all() {
          if (sql.includes('FROM slack_legacy_inventory')) return { results: results.inventory };
          if (sql.includes('FROM heists')) return { results: results.heists };
          if (sql.includes('FROM lotteries')) return { results: results.lotteries };
          return { results: [] };
        },
        async run() {
          runs.push({ sql, args: stmt.args });
          return {};
        },
      };
      return stmt;
    },
    async batch(stmts) {
      for (const stmt of stmts) await stmt.run();
    },
  };
  return db;
}

test('linkSlackAccount overwrites live rows from the Slack dump', async () => {
  const db = fakeDb({
    users: [{ id: 'oidc-user', slack_user_id: null, slack_imported: 0 }],
    legacy: {
      slack_user_id: 'U09KKMHLS15',
      name: 'hostage',
      account_number: '8951-SBAG-70502-R',
      balance: -664317167,
      status: 'active',
      tier: null,
      inventory: '[]',
      last_daily_at: null,
      last_beg_at: 1,
      last_fee_at: 2,
      notifications: 0,
      strikes: 0,
    },
    inventory: [{ item_id: 'blahaj', name: 'Blahaj', bought_at: 1 }],
    heists: [{ id: 1, started_by: 'U09KKMHLS15', participants: '["U09KKMHLS15","U079QLTJZ7H"]' }],
    lotteries: [{ id: 9, created_by: 'U091KE59H5H', winner_id: 'U09KKMHLS15' }],
  });
  const result = await linkSlackAccount(db, { userId: 'oidc-user', slackUserId: 'U09KKMHLS15', slackName: 'hostage' });
  assert.deepEqual(result, { ok: true, imported: true, alreadyLinked: false });
  assert.equal(db.runs[0].sql.includes('UPDATE users SET slack_user_id'), true);
  assert.equal(db.runs.some(run => run.sql.includes('UPDATE accounts') && run.args.includes('[{"itemId":"blahaj","name":"Blahaj","boughtAt":1}]')), true);
  assert.equal(db.runs.some(run => run.sql.includes('FROM slack_legacy_transactions')), true);
  assert.equal(db.runs.some(run => run.sql.includes('UPDATE heists')), true);
  const heistUpdate = db.runs.find(run => run.sql.includes('UPDATE heists'));
  assert.equal(heistUpdate.args[0], 'oidc-user');
  assert.equal(heistUpdate.args[1], '["oidc-user","U079QLTJZ7H"]');
});

test('linkSlackAccount refuses a Slack id already held hostage elsewhere', async () => {
  const db = fakeDb({
    users: [
      { id: 'oidc-user', slack_user_id: null, slack_imported: 0 },
      { id: 'other', slack_user_id: 'U09KKMHLS15', slack_imported: 1 },
    ],
  });
  const result = await linkSlackAccount(db, { userId: 'oidc-user', slackUserId: 'U09KKMHLS15' });
  assert.deepEqual(result, { ok: false, error: 'linked_elsewhere', imported: false });
});

test('overwriteStatements copies every per-user Slack table', () => {
  const db = fakeDb();
  const stmts = overwriteStatements(db, 'oidc-user', 'U123', {
    balance: 1, account_number: 'x', status: 'active', tier: null, inventory: '[]',
    last_daily_at: null, last_beg_at: null, last_fee_at: null, notifications: 0, strikes: 0,
  });
  const sql = stmts.map(stmt => stmt.sql).join('\n');
  for (const table of ['transactions', 'jobs', 'loans', 'insurance', 'crypto_holdings', 'investments', 'lottery_tickets']) {
    assert.match(sql, new RegExp('DELETE FROM ' + table));
  }
});
