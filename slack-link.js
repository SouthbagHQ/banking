const MAX_CENTS = Number.MAX_SAFE_INTEGER;
const slackAuthorize = 'https://slack.com/openid/connect/authorize';
const slackToken = 'https://slack.com/api/openid.connect.token';
const slackUserInfo = 'https://slack.com/api/openid.connect.userInfo';

export function centsFromDollars(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(cents)) return 0;
  return Math.max(-MAX_CENTS, Math.min(MAX_CENTS, cents));
}

export function slackConfigured(env) {
  return Boolean(env?.SLACK_CLIENT_ID && env?.SLACK_CLIENT_SECRET);
}

export function slackUserIdFromProfile(profile) {
  return profile?.['https://slack.com/user_id'] || profile?.sub || null;
}

export function decodeJwtPayload(token) {
  const payload = String(token || '').split('.')[1];
  if (!payload) return null;
  const padded = payload.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - payload.length % 4) % 4);
  try {
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function remapIds(value, slackUserId, userId) {
  if (value === slackUserId) return userId;
  if (Array.isArray(value)) return value.map(item => remapIds(item, slackUserId, userId));
  return value;
}

export function overwriteStatements(db, userId, slackUserId, legacy, now = Date.now()) {
  const status = legacy.status || 'active';
  return [
    db.prepare(`UPDATE accounts SET
      balance = ?, updated_at = ?, account_number = ?, status = ?, tier = ?, inventory = ?,
      last_daily_at = ?, last_beg_at = ?, last_fee_at = ?, notifications = ?, strikes = ?
      WHERE user_id = ?`).bind(
      legacy.balance, now, legacy.account_number, status, legacy.tier, legacy.inventory,
      legacy.last_daily_at, legacy.last_beg_at, legacy.last_fee_at, legacy.notifications, legacy.strikes, userId,
    ),
    db.prepare('DELETE FROM transactions WHERE user_id = ?').bind(userId),
    db.prepare(`INSERT INTO transactions (user_id, amount, kind, description, created_at)
      SELECT ?, amount, kind, description, created_at FROM slack_legacy_transactions WHERE slack_user_id = ?`)
      .bind(userId, slackUserId),
    db.prepare('DELETE FROM jobs WHERE user_id = ?').bind(userId),
    db.prepare(`INSERT INTO jobs (user_id, title, salary, hired_at, last_worked_at)
      SELECT ?, title, salary, hired_at, last_worked_at FROM slack_legacy_jobs WHERE slack_user_id = ?`)
      .bind(userId, slackUserId),
    db.prepare('DELETE FROM loans WHERE user_id = ?').bind(userId),
    db.prepare(`INSERT INTO loans (user_id, principal, interest_rate, total_owed, taken_at, last_interest_at, status)
      SELECT ?, principal, interest_rate, total_owed, taken_at, last_interest_at, status
      FROM slack_legacy_loans WHERE slack_user_id = ?`)
      .bind(userId, slackUserId),
    db.prepare('DELETE FROM insurance WHERE user_id = ?').bind(userId),
    db.prepare(`INSERT INTO insurance (user_id, plan, premium, covered_until, created_at)
      SELECT ?, plan, premium, covered_until, created_at FROM slack_legacy_insurance WHERE slack_user_id = ?`)
      .bind(userId, slackUserId),
    db.prepare('DELETE FROM crypto_holdings WHERE user_id = ?').bind(userId),
    db.prepare(`INSERT INTO crypto_holdings (user_id, coin, amount, bought_at, created_at)
      SELECT ?, coin, amount, bought_at, created_at FROM slack_legacy_crypto WHERE slack_user_id = ?`)
      .bind(userId, slackUserId),
    db.prepare('DELETE FROM investments WHERE user_id = ?').bind(userId),
    db.prepare(`INSERT INTO investments (user_id, amount, multiplier, matures_at, status, created_at)
      SELECT ?, amount, multiplier, matures_at, status, created_at FROM slack_legacy_investments WHERE slack_user_id = ?`)
      .bind(userId, slackUserId),
    db.prepare('DELETE FROM lottery_tickets WHERE user_id = ?').bind(userId),
    db.prepare(`INSERT INTO lottery_tickets (lottery_id, user_id, numbers, created_at)
      SELECT lotteries.id, ?, tickets.numbers, tickets.created_at
      FROM slack_legacy_lottery_tickets tickets
      JOIN lotteries ON lotteries.legacy_id = tickets.lottery_legacy_id
      WHERE tickets.slack_user_id = ?`)
      .bind(userId, slackUserId),
  ];
}

async function remapSlackIds(db, userId, slackUserId) {
  const heists = ((await db.prepare('SELECT id, started_by, participants FROM heists').all()).results) || [];
  const lotteryRows = ((await db.prepare('SELECT id, created_by, winner_id FROM lotteries').all()).results) || [];
  const updates = [];
  for (const heist of heists) {
    let participants = [];
    try { participants = JSON.parse(heist.participants || '[]'); } catch { participants = []; }
    const next = remapIds(participants, slackUserId, userId);
    const startedBy = remapIds(heist.started_by, slackUserId, userId);
    if (startedBy !== heist.started_by || JSON.stringify(next) !== JSON.stringify(participants)) {
      updates.push(db.prepare('UPDATE heists SET started_by = ?, participants = ? WHERE id = ?')
        .bind(startedBy, JSON.stringify(next), heist.id));
    }
  }
  for (const lottery of lotteryRows) {
    const createdBy = remapIds(lottery.created_by, slackUserId, userId);
    const winnerId = remapIds(lottery.winner_id, slackUserId, userId);
    if (createdBy !== lottery.created_by || winnerId !== lottery.winner_id) {
      updates.push(db.prepare('UPDATE lotteries SET created_by = ?, winner_id = ? WHERE id = ?')
        .bind(createdBy, winnerId, lottery.id));
    }
  }
  if (updates.length) await db.batch(updates);
}

export async function linkSlackAccount(db, { userId, slackUserId, slackName }) {
  if (!userId || !slackUserId) return { ok: false, error: 'missing_ids', imported: false };
  const taken = await db.prepare('SELECT id FROM users WHERE slack_user_id = ?').bind(slackUserId).first();
  if (taken && taken.id !== userId) {
    return { ok: false, error: 'linked_elsewhere', imported: false };
  }
  const current = await db.prepare('SELECT slack_user_id, slack_imported FROM users WHERE id = ?').bind(userId).first();
  if (current?.slack_user_id && current.slack_user_id !== slackUserId) {
    return { ok: false, error: 'already_linked', imported: false };
  }
  if (current?.slack_user_id === slackUserId) {
    return { ok: true, imported: Boolean(current.slack_imported), alreadyLinked: true };
  }

  const legacy = await db.prepare('SELECT * FROM slack_legacy_accounts WHERE slack_user_id = ?').bind(slackUserId).first();
  const now = Date.now();
  if (legacy) {
    const items = ((await db.prepare('SELECT item_id, name, bought_at FROM slack_legacy_inventory WHERE slack_user_id = ? ORDER BY id')
      .bind(slackUserId).all()).results) || [];
    legacy.inventory = JSON.stringify(items.map(item => ({
      itemId: item.item_id,
      name: item.name,
      boughtAt: item.bought_at,
    })));
  }
  const stmts = [
    db.prepare(`UPDATE users SET slack_user_id = ?, slack_name = ?, slack_linked_at = ?, slack_imported = ?, updated_at = ?
      WHERE id = ?`).bind(slackUserId, slackName || legacy?.name || null, now, legacy ? 1 : 0, now, userId),
  ];
  if (legacy) stmts.push(...overwriteStatements(db, userId, slackUserId, legacy, now));
  await db.batch(stmts);
  if (legacy) await remapSlackIds(db, userId, slackUserId);
  return { ok: true, imported: Boolean(legacy), alreadyLinked: false };
}

export function slackAuthorizeUrl({ clientId, redirectUri, state, nonce }) {
  const target = new URL(slackAuthorize);
  target.search = new URLSearchParams({
    response_type: 'code',
    scope: 'openid profile email',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    nonce,
  });
  return target.toString();
}

export async function exchangeSlackCode({ clientId, clientSecret, code, redirectUri }) {
  const response = await fetch(slackToken, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok || !body.access_token) {
    throw new Error(body.error || 'Slack token exchange failed');
  }
  return body;
}

export async function loadSlackProfile(accessToken) {
  const response = await fetch(slackUserInfo, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const profile = await response.json().catch(() => ({}));
  if (!response.ok || !profile.ok) throw new Error(profile.error || 'Slack profile lookup failed');
  return profile;
}
