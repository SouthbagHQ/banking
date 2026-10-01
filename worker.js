import { WorkerEntrypoint } from 'cloudflare:workers';
import { createD1Repo, handleEconomy } from './economy.js';
import {
  decodeJwtPayload,
  exchangeSlackCode,
  linkSlackAccount,
  loadSlackProfile,
  slackAuthorizeUrl,
  slackConfigured,
  slackUserIdFromProfile,
} from './slack-link.js';
import { handleSlackRequest, slackBotConfigured } from './slack-bot.js';
import { aiConfigured, chat } from './ai.js';
import { capture, tracker } from './palantir.js';

const slackBotPaths = new Set(['/slack/events', '/slack/commands', '/slack/interactive']);

const issuer = 'https://identity.southbag.cc';
const oauth = {
  authorize: issuer + '/api/auth/oauth2/authorize',
  token: issuer + '/api/auth/oauth2/token',
  register: issuer + '/api/auth/oauth2/register',
  userinfo: issuer + '/api/auth/oauth2/userinfo',
};
const sessionCookie = 'southbag_session';
const stateCookie = 'southbag_oauth_state';
const returnToCookie = 'southbag_oauth_return';
const slackStateCookie = 'southbag_slack_state';
const slackLinkPath = '/auth/slack/link';
const dashboardPath = '/real.html';

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json', ...headers },
});
const redirect = (url, ...cookies) => {
  const headers = new Headers({ location: String(url) });
  for (const value of cookies) if (value) headers.append('set-cookie', value);
  return new Response(null, { status: 302, headers });
};
const cookie = (name, value, maxAge) =>
  `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const getCookie = (request, name) => request.headers.get('cookie')
  ?.split(';').map(value => value.trim().split('=')).find(([key]) => key === name)?.[1];
const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
const base64url = value => {
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};
const hash = async value => base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));

// Origins allowed to call /api/* cross-origin with an Identity bearer token: Southbag Mobile's
// UI on GitHub Pages (the Android WebView loads it from there) and `cordova run browser`.
const apiOrigins = new Set(['https://southbaghq.github.io', 'http://localhost:8000']);
// Bearer-authenticated callers get a short-lived banking session so we only ask Identity once
// per token every few minutes instead of on every request.
const bearerSessionMs = 10 * 60 * 1000;
const corsHeaders = request => {
  const origin = request.headers.get('origin');
  if (!apiOrigins.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': request.headers.get('access-control-request-headers') || 'authorization, content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
};
const bearerToken = request => request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
// Only same-origin paths may be used as a post-login destination; anything else falls back to the dashboard.
const safeReturnTo = value => (typeof value === 'string' && /^\/(?![\/\\])/.test(value) ? value : null);
const readReturnTo = request => {
  try { return safeReturnTo(decodeURIComponent(getCookie(request, returnToCookie) || '')); } catch { return null; }
};

async function getClient(env, origin) {
  let client = await env.DB.prepare('SELECT * FROM oauth_clients WHERE origin = ?').bind(origin).first();
  if (client) return client;

  const redirectUri = origin + '/auth/callback';
  const response = await fetch(oauth.register, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Southbag Online Banking',
      redirect_uris: [redirectUri],
      post_logout_redirect_uris: [origin + '/'],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: 'openid profile email',
    }),
  });
  const registered = await response.json();
  if (!response.ok || !registered.client_id)
    throw new Error(registered.error_description || registered.error || 'Identity client registration failed');

  await env.DB.prepare(`INSERT OR IGNORE INTO oauth_clients
    (origin, client_id, client_secret, redirect_uri, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(origin, registered.client_id, registered.client_secret || '', redirectUri, Date.now()).run();
  client = await env.DB.prepare('SELECT * FROM oauth_clients WHERE origin = ?').bind(origin).first();
  return client;
}

async function login(request, env, returnTo = null, ctx = null) {
  const url = new URL(request.url);
  const origin = url.origin;
  tracker(request, ctx).capture('banking_login_started', { return_to: returnTo || dashboardPath });
  const client = await getClient(env, origin);
  const state = random();
  const verifier = random();
  const nonce = random();
  const challenge = await hash(verifier);
  await env.DB.prepare('DELETE FROM oauth_states WHERE expires_at < ?').bind(Date.now()).run();
  await env.DB.prepare(`INSERT INTO oauth_states (state, origin, verifier, nonce, expires_at, kind, user_id)
    VALUES (?, ?, ?, ?, ?, 'identity', NULL)`)
    .bind(state, origin, verifier, nonce, Date.now() + 10 * 60 * 1000).run();
  const target = new URL(oauth.authorize);
  target.search = new URLSearchParams({
    response_type: 'code',
    client_id: client.client_id,
    redirect_uri: client.redirect_uri,
    scope: 'openid profile email',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return redirect(target, cookie(stateCookie, state, 600),
    returnTo ? cookie(returnToCookie, encodeURIComponent(returnTo), 600) : cookie(returnToCookie, '', 0));
}

async function callback(request, env, ctx = null) {
  const url = new URL(request.url);
  const track = tracker(request, ctx);
  const state = url.searchParams.get('state');
  if (!state || state !== getCookie(request, stateCookie)) {
    track.capture('banking_login_failed', { reason: 'invalid_state' });
    return json({ error: 'Invalid OAuth state' }, 400);
  }
  const pending = await env.DB.prepare('SELECT * FROM oauth_states WHERE state = ?').bind(state).first();
  await env.DB.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run();
  if (!pending || pending.expires_at < Date.now() || url.searchParams.get('iss') !== issuer) {
    track.capture('banking_login_failed', { reason: 'expired' });
    return json({ error: 'Expired or invalid OAuth response' }, 400);
  }
  if (url.searchParams.get('error')) {
    track.capture('banking_login_failed', { reason: url.searchParams.get('error') });
    return json({ error: url.searchParams.get('error') }, 400);
  }

  const client = await env.DB.prepare('SELECT * FROM oauth_clients WHERE origin = ?').bind(pending.origin).first();
  const code = url.searchParams.get('code');
  if (!client || !code) return json({ error: 'Missing OAuth code or client' }, 400);
  const tokenHeaders = { 'content-type': 'application/x-www-form-urlencoded', origin: issuer };
  if (client.client_secret) tokenHeaders.authorization = 'Basic ' + btoa(client.client_id + ':' + client.client_secret);
  const tokenResponse = await fetch(oauth.token, {
    method: 'POST',
    headers: tokenHeaders,
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: client.client_id,
      redirect_uri: client.redirect_uri,
      code_verifier: pending.verifier,
    }),
  });
  const tokenBody = await tokenResponse.text();
  let tokens = {};
  try { tokens = JSON.parse(tokenBody); } catch {}
  if (!tokenResponse.ok || !tokens.access_token) {
    track.capture('banking_login_failed', { reason: 'token_exchange', error: tokens.error || null });
    return json({ error: tokens.error_description || tokens.error || tokenBody || 'Token exchange failed' }, 502);
  }
  const userResponse = await fetch(oauth.userinfo, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  const user = await userResponse.json();
  if (!userResponse.ok || !user.sub) {
    track.capture('banking_login_failed', { reason: 'userinfo' });
    return json({ error: 'Could not load identity profile' }, 502);
  }

  const now = Date.now();
  const opened = await openAccount(env, user, now);
  track.identify(user.sub, { email: user.email || null, name: user.name || null });
  track.capture('banking_login_completed', { new_account: opened.created, return_to: readReturnTo(request) || dashboardPath });
  if (opened.created) track.capture('banking_account_opened', { via: 'web' });
  const token = random();
  await env.DB.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)')
    .bind(await hash(token), user.sub, now + 7 * 86400000, now).run();
  const returnTo = readReturnTo(request) || dashboardPath;
  return redirect(pending.origin + returnTo, cookie(sessionCookie, token, 7 * 86400),
    cookie(stateCookie, '', 0), cookie(returnToCookie, '', 0));
}

const accountNumber = () => [
  Math.floor(Math.random() * 9000 + 1000),
  'SBAG',
  Math.floor(Math.random() * 90000 + 10000),
  String.fromCharCode(65 + Math.floor(Math.random() * 26)),
].join('-');

// Upserts the Identity profile and opens a banking account for it if there is none yet.
async function openAccount(env, user, now = Date.now()) {
  const number = accountNumber();
  const existing = await env.DB.prepare('SELECT 1 AS present FROM accounts WHERE user_id = ?').bind(user.sub).first();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO users (id, email, name, picture, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
      email = excluded.email, name = excluded.name, picture = excluded.picture, updated_at = excluded.updated_at`)
      .bind(user.sub, user.email || null, user.name || null, user.picture || null, now, now),
    env.DB.prepare(`INSERT OR IGNORE INTO accounts
      (user_id, balance, updated_at, account_number, status, inventory) VALUES (?, 1000000, ?, ?, 'active', '[]')`)
      .bind(user.sub, now, number),
  ]);
  return { created: !existing };
}

// The website sends the banking session cookie. Southbag Mobile has no cookie: it sends the
// Identity access token it obtained itself (OAuth code + PKCE) as a bearer token, and we ask
// Identity who that is. The answer is cached as a short-lived session keyed by the token hash.
async function session(request, env) {
  const cookieToken = getCookie(request, sessionCookie);
  if (cookieToken) return loadSession(env, await hash(cookieToken));

  const bearer = bearerToken(request);
  if (!bearer) return null;
  const tokenHash = await hash(bearer);
  const cached = await loadSession(env, tokenHash);
  if (cached) return { ...cached, bearer: true };

  const userResponse = await fetch(oauth.userinfo, { headers: { authorization: `Bearer ${bearer}` } });
  const user = await userResponse.json().catch(() => ({}));
  if (!userResponse.ok || !user.sub) return null;
  const now = Date.now();
  const opened = await openAccount(env, user, now);
  if (opened.created) capture('banking_account_opened', user.sub, { via: 'mobile' });
  await env.DB.prepare('INSERT OR REPLACE INTO sessions VALUES (?, ?, ?, ?)')
    .bind(tokenHash, user.sub, now + bearerSessionMs, now).run();
  const value = await loadSession(env, tokenHash);
  return value ? { ...value, bearer: true } : null;
}

async function loadSession(env, tokenHash) {
  const value = await env.DB.prepare(`SELECT users.id, users.email, users.name, users.picture,
    users.slack_user_id, users.slack_name, users.slack_linked_at, users.slack_imported,
    accounts.balance, sessions.expires_at FROM sessions JOIN users ON users.id = sessions.user_id
    JOIN accounts ON accounts.user_id = users.id WHERE sessions.token_hash = ?`).bind(tokenHash).first();
  if (!value || value.expires_at < Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }
  return { ...value, tokenHash };
}

async function accountApi(request, env, user, ctx) {
  const track = tracker(request, ctx, user);
  if (request.method === 'GET') {
    track.capture('banking_account_viewed', { via: user.bearer ? 'mobile' : 'web' });
    const transactions = await env.DB.prepare(`SELECT id, amount, kind, description, created_at
      FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`).bind(user.id).all();
    return json({ user: { id: user.id, email: user.email, name: user.name, picture: user.picture }, balance: user.balance, transactions: transactions.results });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount);
  const kinds = ['transfer', 'loan', 'investment_loss', 'deposit'];
  if (!Number.isSafeInteger(amount) || Math.abs(amount) > 100000000 || !kinds.includes(body.kind)) {
    track.capture('banking_transaction_rejected', { kind: body.kind || null, amount: Number.isFinite(amount) ? amount : null });
    return json({ error: 'Invalid transaction' }, 400);
  }
  const description = String(body.description || body.kind).slice(0, 200);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO transactions (user_id, amount, kind, description, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(user.id, amount, body.kind, description, now),
    env.DB.prepare('UPDATE accounts SET balance = balance + ?, updated_at = ? WHERE user_id = ?')
      .bind(amount, now, user.id),
  ]);
  const account = await env.DB.prepare('SELECT balance FROM accounts WHERE user_id = ?').bind(user.id).first();
  track.capture('banking_transaction_posted', { kind: body.kind, amount, description, balance: account.balance, via: user.bearer ? 'mobile' : 'web' });
  return json({ balance: account.balance });
}

async function chatApi(request, env, user, ctx) {
  const track = tracker(request, ctx, user);
  if (request.method === 'GET') {
    track.capture('banking_chat_history_loaded');
    const row = await env.DB.prepare('SELECT messages FROM chat_history WHERE user_id = ?').bind(user.id).first();
    return json({ messages: row ? JSON.parse(row.messages) : [] });
  }
  const body = await request.json().catch(() => ({}));
  if (!Array.isArray(body.messages)) return json({ error: 'Missing messages array' }, 400);
  if (request.method === 'PUT') {
    const messages = body.messages.slice(-100).map(message => ({
      role: ['system', 'user', 'assistant'].includes(message.role) ? message.role : 'user',
      content: String(message.content || '').slice(0, 10000),
    }));
    await env.DB.prepare(`INSERT INTO chat_history VALUES (?, ?, ?) ON CONFLICT(user_id)
      DO UPDATE SET messages = excluded.messages, updated_at = excluded.updated_at`)
      .bind(user.id, JSON.stringify(messages), Date.now()).run();
    return json({ ok: true });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!aiConfigured(env)) {
    track.capture('banking_chat_unavailable');
    return json({ error: 'Chat is not configured' }, 503);
  }
  const lastUser = [...body.messages].reverse().find(message => message?.role === 'user');
  track.capture('banking_chat_message_sent', { message_count: body.messages.length, length: String(lastUser?.content || '').length });
  try {
    const content = await chat(body.messages, env);
    track.capture('banking_chat_reply_received', { length: String(content || '').length });
    return json({ choices: [{ message: { role: 'assistant', content } }] });
  } catch (error) {
    console.error(error);
    track.capture('banking_chat_reply_failed', { error: error?.message || String(error) });
    return json({ error: 'Every AI we know refused to talk to you.' }, 502);
  }
}

async function economyApi(request, env, user, ctx) {
  const repo = createD1Repo(env.DB);
  const track = tracker(request, ctx, user);
  if (request.method === 'GET') {
    track.capture('banking_economy_overview');
    return json(await handleEconomy(repo, user, { action: 'overview' }));
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const body = await request.json().catch(() => ({}));
  const result = await handleEconomy(repo, user, body);
  const action = String(body.action || body.command || '').replace(/^\/south-/, '').toLowerCase();
  const { text, ...details } = body;
  track.capture('banking_economy_action', {
    action, sub: body.sub || null, ok: result.ok, error: result.ok ? null : result.error || null,
    amount: body.amount ?? null, item: body.item ?? null, via: user.bearer ? 'mobile' : 'web',
    ...(details.target ? { target: String(details.target) } : {}),
  });
  return json(result);
}

function slackRedirect(origin, params, clearState = true) {
  const target = new URL('/south/slack.html', origin);
  target.search = new URLSearchParams(params);
  return redirect(target.toString(), clearState ? cookie(slackStateCookie, '', 0) : undefined);
}

function slackSummary(env, user) {
  return {
    configured: slackConfigured(env),
    bot: slackBotConfigured(env),
    linked: Boolean(user?.slack_user_id),
    slackUserId: user?.slack_user_id || null,
    slackName: user?.slack_name || null,
    imported: Boolean(user?.slack_imported),
    linkedAt: user?.slack_linked_at || null,
  };
}

async function slackLinkStart(request, env, user, ctx) {
  const origin = new URL(request.url).origin;
  const track = tracker(request, ctx, user);
  if (!slackConfigured(env)) {
    track.capture('banking_slack_link_failed', { reason: 'not_configured' });
    return slackRedirect(origin, { error: 'not_configured' }, false);
  }
  track.capture('banking_slack_link_started');
  const state = random();
  const nonce = random();
  const redirectUri = origin + '/auth/slack/callback';
  await env.DB.prepare('DELETE FROM oauth_states WHERE expires_at < ?').bind(Date.now()).run();
  await env.DB.prepare(`INSERT INTO oauth_states (state, origin, verifier, nonce, expires_at, kind, user_id)
    VALUES (?, ?, '', ?, ?, 'slack', ?)`)
    .bind(state, origin, nonce, Date.now() + 10 * 60 * 1000, user.id).run();
  return redirect(slackAuthorizeUrl({
    clientId: env.SLACK_CLIENT_ID,
    redirectUri,
    state,
    nonce,
  }), cookie(slackStateCookie, state, 600));
}

async function slackCallback(request, env, ctx) {
  const url = new URL(request.url);
  const origin = url.origin;
  let track = tracker(request, ctx);
  const failed = error => { track.capture('banking_slack_link_failed', { reason: error }); return slackRedirect(origin, { error }); };
  const state = url.searchParams.get('state');
  if (!state || state !== getCookie(request, slackStateCookie))
    return failed('invalid_state');
  const pending = await env.DB.prepare("SELECT * FROM oauth_states WHERE state = ? AND kind = 'slack'")
    .bind(state).first();
  await env.DB.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run();
  if (!pending || pending.expires_at < Date.now() || !pending.user_id)
    return failed('expired');
  track = tracker(request, ctx, { id: pending.user_id });
  if (url.searchParams.get('error'))
    return failed(url.searchParams.get('error'));
  if (!slackConfigured(env)) return failed('not_configured');

  const code = url.searchParams.get('code');
  if (!code) return failed('missing_code');
  try {
    const tokens = await exchangeSlackCode({
      clientId: env.SLACK_CLIENT_ID,
      clientSecret: env.SLACK_CLIENT_SECRET,
      code,
      redirectUri: pending.origin + '/auth/slack/callback',
    });
    const claims = decodeJwtPayload(tokens.id_token);
    if (!claims || claims.nonce !== pending.nonce) return failed('invalid_nonce');
    const profile = await loadSlackProfile(tokens.access_token);
    const slackUserId = slackUserIdFromProfile(profile) || slackUserIdFromProfile(claims);
    if (!slackUserId) return failed('missing_slack_user');
    const result = await linkSlackAccount(env.DB, {
      userId: pending.user_id,
      slackUserId,
      slackName: profile.name || claims.name || null,
    });
    if (!result.ok) return failed(result.error);
    track.capture('banking_slack_linked', { already_linked: Boolean(result.alreadyLinked), imported: Boolean(result.imported) });
    if (result.alreadyLinked) return slackRedirect(origin, { linked: '1' });
    return slackRedirect(origin, result.imported ? { imported: '1' } : { linked: '1', empty: '1' });
  } catch (error) {
    console.error(error);
    return failed('slack_exchange');
  }
}

const app = {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      // Slack Events API, slash commands and interactivity all point here (signature-verified, no session).
      if (slackBotPaths.has(url.pathname)) return await handleSlackRequest(request, env, ctx);
      if (url.pathname === '/auth/login') return await login(request, env, safeReturnTo(url.searchParams.get('next')), ctx);
      if (url.pathname === '/auth/callback') return await callback(request, env, ctx);
      if (url.pathname === '/auth/slack/callback') return await slackCallback(request, env, ctx);
      if (url.pathname === '/auth/logout') {
        const token = getCookie(request, sessionCookie);
        const current = token ? await loadSession(env, await hash(token)) : null;
        if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await hash(token)).run();
        tracker(request, ctx, current).capture('banking_logout', { had_session: Boolean(current) });
        return redirect(url.origin + '/', cookie(sessionCookie, '', 0));
      }

      const user = await session(request, env);
      // Entry points for southbag.cc/onboarding: sign in through Identity if there is no banking
      // session yet (automatic — the onboarding form already left an Identity cookie on .southbag.cc,
      // and the callback opens the account), then land on the dashboard. The slack-banking flow
      // goes straight into the Sign in with Slack handshake instead.
      if (url.pathname === '/auth/onboard' || url.pathname === '/auth/slack/onboard') {
        const destination = url.pathname === '/auth/onboard' ? dashboardPath : slackLinkPath;
        tracker(request, ctx, user).capture('banking_onboard', { flow: url.pathname === '/auth/onboard' ? 'banking' : 'slack', signed_in: Boolean(user) });
        if (user) return redirect(url.origin + destination);
        return await login(request, env, destination, ctx);
      }
      if (url.pathname === slackLinkPath) {
        if (!user) return redirect(url.origin + '/?login=required');
        return await slackLinkStart(request, env, user, ctx);
      }
      if (url.pathname === '/api/session') {
        return json(user
          ? { authenticated: true, user: { id: user.id, email: user.email, name: user.name, picture: user.picture }, slack: slackSummary(env, user) }
          : { authenticated: false, slack: { configured: slackConfigured(env), bot: slackBotConfigured(env), linked: false } });
      }
      if (url.pathname === '/api/slack') {
        if (!user) return json({ error: 'Authentication required' }, 401);
        return json(slackSummary(env, user));
      }
      const protectedPage = ['/real', '/real.html', '/secureportal.html'].includes(url.pathname)
        || url.pathname.startsWith('/south/');
      if (protectedPage && !user) {
        tracker(request, ctx).capture('banking_login_required', { path: url.pathname });
        return redirect(url.origin + '/?login=required');
      }
      if (url.pathname === '/secureportal.html') return redirect(url.origin + dashboardPath);
      if (url.pathname.startsWith('/api/')) {
        if (!user) return json({ error: 'Authentication required' }, 401);
        // Cookie sessions need the same-origin check against CSRF; a bearer token is proof by itself.
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && !user.bearer
          && request.headers.get('origin') !== url.origin)
          return json({ error: 'Invalid origin' }, 403);
        if (url.pathname === '/api/account') return await accountApi(request, env, user, ctx);
        if (url.pathname === '/api/chat') return await chatApi(request, env, user, ctx);
        if (url.pathname === '/api/economy') return await economyApi(request, env, user, ctx);
        return json({ error: 'Not found' }, 404);
      }
      return await env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return json({ error: error.message || 'Internal server error' }, 500);
    }
  },
};

// Other Southbag products bill customers through a service binding to this entrypoint (RPC; it is
// not reachable from the internet). Southbag Social takes Southbag Verified from here:
//   env.BANKING.charge({ userId, email, name, amount, product, description }) -> { balance, opened }
// userId is the Identity `sub`. Customers without an account get one first (never overwriting an
// existing profile). The money is taken whatever the balance; overdrafts are the customer's problem.
export class Billing extends WorkerEntrypoint {
  async charge({ userId, email = null, name = null, amount, product, description }) {
    if (typeof userId !== 'string' || !userId) throw new Error('userId is required');
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100000000) throw new Error('Invalid amount');
    const env = this.env;
    const now = Date.now();
    const text = `${String(product || 'Southbag').slice(0, 60)}: ${String(description || 'Charge').slice(0, 120)}`;
    const existing = await env.DB.prepare('SELECT 1 AS present FROM accounts WHERE user_id = ?').bind(userId).first();
    await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO users (id, email, name, picture, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)`)
        .bind(userId, email, name, now, now),
      env.DB.prepare(`INSERT OR IGNORE INTO accounts
        (user_id, balance, updated_at, account_number, status, inventory) VALUES (?, 1000000, ?, ?, 'active', '[]')`)
        .bind(userId, now, accountNumber()),
      env.DB.prepare('INSERT INTO transactions (user_id, amount, kind, description, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(userId, -amount, 'subscription', text, now),
      env.DB.prepare('UPDATE accounts SET balance = balance - ?, updated_at = ? WHERE user_id = ?')
        .bind(amount, now, userId),
    ]);
    const account = await env.DB.prepare('SELECT balance FROM accounts WHERE user_id = ?').bind(userId).first();
    const waitUntil = promise => this.ctx.waitUntil(promise);
    if (!existing) capture('banking_account_opened', userId, { via: 'billing', product: product || null }, { waitUntil });
    capture('banking_billing_charged', userId, { product: product || null, amount, balance: account.balance }, { waitUntil });
    return { balance: account.balance, opened: !existing };
  }
}

export default {
  // /api/* answers CORS for Southbag Mobile; everything else is served as before.
  async fetch(request, env, ctx) {
    if (!new URL(request.url).pathname.startsWith('/api/')) return app.fetch(request, env, ctx);
    const cors = corsHeaders(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const response = await app.fetch(request, env, ctx);
    for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
    return response;
  },
};
