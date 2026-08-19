const issuer = 'https://identity.southbag.cc';
const oauth = {
  authorize: issuer + '/api/auth/oauth2/authorize',
  token: issuer + '/api/auth/oauth2/token',
  register: issuer + '/api/auth/oauth2/register',
  userinfo: issuer + '/api/auth/oauth2/userinfo',
};
const sessionCookie = 'southbag_session';
const stateCookie = 'southbag_oauth_state';

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json', ...headers },
});
const redirect = (url, cookie) => new Response(null, {
  status: 302,
  headers: { location: url, ...(cookie ? { 'set-cookie': cookie } : {}) },
});
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

async function login(request, env) {
  const url = new URL(request.url);
  const origin = url.origin;
  const client = await getClient(env, origin);
  const state = random();
  const verifier = random();
  const nonce = random();
  const challenge = await hash(verifier);
  await env.DB.prepare('DELETE FROM oauth_states WHERE expires_at < ?').bind(Date.now()).run();
  await env.DB.prepare('INSERT INTO oauth_states VALUES (?, ?, ?, ?, ?)')
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
  return redirect(target, cookie(stateCookie, state, 600));
}

async function callback(request, env) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  if (!state || state !== getCookie(request, stateCookie)) return json({ error: 'Invalid OAuth state' }, 400);
  const pending = await env.DB.prepare('SELECT * FROM oauth_states WHERE state = ?').bind(state).first();
  await env.DB.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run();
  if (!pending || pending.expires_at < Date.now() || url.searchParams.get('iss') !== issuer)
    return json({ error: 'Expired or invalid OAuth response' }, 400);
  if (url.searchParams.get('error')) return json({ error: url.searchParams.get('error') }, 400);

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
  if (!tokenResponse.ok || !tokens.access_token)
    return json({ error: tokens.error_description || tokens.error || tokenBody || 'Token exchange failed' }, 502);
  const userResponse = await fetch(oauth.userinfo, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  const user = await userResponse.json();
  if (!userResponse.ok || !user.sub) return json({ error: 'Could not load identity profile' }, 502);

  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO users (id, email, name, picture, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
      email = excluded.email, name = excluded.name, picture = excluded.picture, updated_at = excluded.updated_at`)
      .bind(user.sub, user.email || null, user.name || null, user.picture || null, now, now),
    env.DB.prepare('INSERT OR IGNORE INTO accounts (user_id, balance, updated_at) VALUES (?, 1000000, ?)')
      .bind(user.sub, now),
  ]);
  const token = random();
  await env.DB.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)')
    .bind(await hash(token), user.sub, now + 7 * 86400000, now).run();
  return redirect(pending.origin + '/real.html', cookie(sessionCookie, token, 7 * 86400));
}

async function session(request, env) {
  const token = getCookie(request, sessionCookie);
  if (!token) return null;
  const tokenHash = await hash(token);
  const value = await env.DB.prepare(`SELECT users.id, users.email, users.name, users.picture, accounts.balance,
    sessions.expires_at FROM sessions JOIN users ON users.id = sessions.user_id
    JOIN accounts ON accounts.user_id = users.id WHERE sessions.token_hash = ?`).bind(tokenHash).first();
  if (!value || value.expires_at < Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }
  return { ...value, tokenHash };
}

async function accountApi(request, env, user) {
  if (request.method === 'GET') {
    const transactions = await env.DB.prepare(`SELECT id, amount, kind, description, created_at
      FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`).bind(user.id).all();
    return json({ user: { id: user.id, email: user.email, name: user.name, picture: user.picture }, balance: user.balance, transactions: transactions.results });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount);
  const kinds = ['transfer', 'loan', 'investment_loss', 'deposit'];
  if (!Number.isSafeInteger(amount) || Math.abs(amount) > 100000000 || !kinds.includes(body.kind))
    return json({ error: 'Invalid transaction' }, 400);
  const description = String(body.description || body.kind).slice(0, 200);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO transactions (user_id, amount, kind, description, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(user.id, amount, body.kind, description, now),
    env.DB.prepare('UPDATE accounts SET balance = balance + ?, updated_at = ? WHERE user_id = ?')
      .bind(amount, now, user.id),
  ]);
  const account = await env.DB.prepare('SELECT balance FROM accounts WHERE user_id = ?').bind(user.id).first();
  return json({ balance: account.balance });
}

async function chatApi(request, env, user) {
  if (request.method === 'GET') {
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
  if (!env.HCAI) return json({ error: 'Chat is not configured' }, 503);
  const response = await fetch('https://ai.hackclub.com/proxy/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.HCAI}` },
    body: JSON.stringify({ model: 'google/gemini-3-flash-preview', messages: body.messages }),
  });
  return new Response(response.body, { status: response.status, headers: { 'content-type': 'application/json' } });
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname === '/auth/login') return await login(request, env);
      if (url.pathname === '/auth/callback') return await callback(request, env);
      if (url.pathname === '/auth/logout') {
        const token = getCookie(request, sessionCookie);
        if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await hash(token)).run();
        return redirect(url.origin + '/', cookie(sessionCookie, '', 0));
      }

      const user = await session(request, env);
      if (url.pathname === '/api/session') return json(user ? { authenticated: true, user: { id: user.id, email: user.email, name: user.name, picture: user.picture } } : { authenticated: false });
      const protectedPage = ['/real', '/real.html', '/secureportal.html'].includes(url.pathname);
      if (protectedPage && !user)
        return redirect(url.origin + '/?login=required');
      if (url.pathname === '/secureportal.html') return redirect(url.origin + '/real.html');
      if (url.pathname.startsWith('/api/')) {
        if (!user) return json({ error: 'Authentication required' }, 401);
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && request.headers.get('origin') !== url.origin)
          return json({ error: 'Invalid origin' }, 403);
        if (url.pathname === '/api/account') return await accountApi(request, env, user);
        if (url.pathname === '/api/chat') return await chatApi(request, env, user);
        return json({ error: 'Not found' }, 404);
      }
      return await env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return json({ error: error.message || 'Internal server error' }, 500);
    }
  },
};
