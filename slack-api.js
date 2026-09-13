const SLACK_API = 'https://slack.com/api/';
const SIGNATURE_VERSION = 'v0';
const MAX_SKEW_SECONDS = 5 * 60;

const encoder = new TextEncoder();

function hex(buffer) {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSlackRequest(secret, timestamp, body) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${SIGNATURE_VERSION}:${timestamp}:${body}`));
  return `${SIGNATURE_VERSION}=${hex(signature)}`;
}

// https://api.slack.com/authentication/verifying-requests-from-slack
export async function verifySlackRequest(secret, headers, body, nowSeconds = Math.floor(Date.now() / 1000)) {
  const timestamp = headers.get('x-slack-request-timestamp');
  const signature = headers.get('x-slack-signature');
  if (!secret || !timestamp || !signature) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > MAX_SKEW_SECONDS) return false;
  return timingSafeEqual(await signSlackRequest(secret, timestamp, body), signature);
}

export function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

// Thin Slack Web API client. Write methods take JSON; read methods take form params.
export function createSlackClient(token, fetchImpl = fetch) {
  const call = async (method, payload = {}, { form = false } = {}) => {
    const response = await fetchImpl(SLACK_API + method, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json; charset=utf-8',
      },
      body: form ? new URLSearchParams(payload) : JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!data.ok) throw new Error(`Slack ${method} failed: ${data.error || response.status}`);
    return data;
  };
  return {
    call,
    postMessage: payload => call('chat.postMessage', payload),
    postEphemeral: payload => call('chat.postEphemeral', payload),
    addReaction: payload => call('reactions.add', payload),
    viewsOpen: payload => call('views.open', payload),
    viewsPush: payload => call('views.push', payload),
    viewsPublish: payload => call('views.publish', payload),
    usersInfo: user => call('users.info', { user }, { form: true }),
    authTest: () => call('auth.test', {}, { form: true }),
    conversationsReplies: params => call('conversations.replies', params, { form: true }),
    async respond(responseUrl, payload) {
      const response = await fetchImpl(responseUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Slack response_url failed: ${response.status}`);
    },
    async fetchFile(url) {
      const response = await fetchImpl(url, { headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(`Slack file fetch failed: ${response.status}`);
      return response;
    },
  };
}
