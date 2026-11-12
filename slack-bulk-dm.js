import { createSlackClient } from './slack-api.js';
import { createD1Repo } from './economy.js';

// Admin bulk-DM tool for Southbag Support: DM a selected audience of Slack users
// (e.g. accounts that never linked to web banking). Deliberately dormant:
//   - the API answers 503 until SLACK_ADMIN_TOKEN is set (wrangler secret);
//   - previews (dry runs) work with the token alone and never send anything;
//   - sending additionally requires SLACK_BULK_DM_ENABLED === 'true' AND a confirm
//     token from a preview of the exact same target + message. The confirm is bound
//     to the resolved recipient list, so if the audience changes between preview and
//     send the send is refused and a fresh preview is required.
// Bots and the app's own bot user are always excluded from the audience.

const MAX_AUDIENCE = 200;
const MAX_MESSAGE_LENGTH = 3000;
const SEND_DELAY_MS = 250;
const TARGETS = ['unlinked', 'linked', 'all', 'slack_ids'];

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json' },
});

function safeEqual(a, b) {
  const encoder = new TextEncoder();
  const xa = encoder.encode(String(a));
  const xb = encoder.encode(String(b));
  if (xa.length !== xb.length) return false;
  let diff = 0;
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ xb[i];
  return diff === 0;
}

export function bulkDmConfigured(env) {
  return Boolean(env?.SLACK_ADMIN_TOKEN && env?.SLACK_BOT_TOKEN);
}

export function bulkDmEnabled(env) {
  return env?.SLACK_BULK_DM_ENABLED === 'true';
}

// Binds a send to exactly what was previewed: target, resolved recipients and message.
async function confirmToken(secret, target, ids, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const body = ['v1', target, [...ids].sort().join(','), message].join('\n');
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

// `{name}` becomes the recipient's Slack display name (or "there").
export function renderTemplate(template, recipient) {
  return template.replaceAll('{name}', recipient?.name || 'there');
}

// Resolve a target selection to candidate recipients. `unlinked` is Slack users with no
// web/Identity account: shadow users created by bot interactions plus legacy accounts that
// never linked. `slack_ids` targets an explicit list; ids with no banking record are kept
// (they may exist in Slack anyway) with linked = null.
export async function selectAudience(repo, target, slackIds = []) {
  const audience = await repo.listSlackAudience();
  if (target === 'slack_ids') {
    const wanted = [...new Set(slackIds)];
    const known = new Map(audience.map(row => [row.slack_user_id, row]));
    return wanted.map(id => known.get(id) || { slack_user_id: id, name: null, linked: null });
  }
  if (target === 'unlinked') return audience.filter(row => !row.linked);
  if (target === 'linked') return audience.filter(row => row.linked);
  return audience;
}

export async function handleBulkDmRequest(request, env, ctx, overrides = {}) {
  if (!bulkDmConfigured(env)) return json({ error: 'Bulk DM is not configured' }, 503);
  const bearer = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer || !safeEqual(bearer, env.SLACK_ADMIN_TOKEN)) return json({ error: 'Unauthorized' }, 401);
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  const target = typeof body?.target === 'string' ? body.target : '';
  if (!TARGETS.includes(target)) return json({ error: `target must be one of: ${TARGETS.join(', ')}` }, 400);
  const slackIds = Array.isArray(body.slack_ids) ? [...new Set(body.slack_ids.filter(id => typeof id === 'string' && id))] : [];
  if (target === 'slack_ids' && !slackIds.length) return json({ error: 'target slack_ids requires a non-empty slack_ids array' }, 400);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message) return json({ error: 'message is required' }, 400);
  if (message.length > MAX_MESSAGE_LENGTH) return json({ error: `message must be at most ${MAX_MESSAGE_LENGTH} characters` }, 400);

  const repo = overrides.repo || createD1Repo(env.DB);
  const slack = overrides.slack || createSlackClient(env.SLACK_BOT_TOKEN);
  const sleep = overrides.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));

  const candidates = await selectAudience(repo, target, slackIds);
  if (candidates.length > MAX_AUDIENCE) {
    return json({ error: `audience of ${candidates.length} exceeds the ${MAX_AUDIENCE} recipient cap; narrow the target` }, 400);
  }

  // Drop bots, deleted accounts and the app's own bot user; refresh display names from Slack.
  const self = await slack.authTest().catch(() => null);
  const recipients = [];
  for (const candidate of candidates) {
    if (self?.user_id && candidate.slack_user_id === self.user_id) continue;
    const info = await slack.usersInfo(candidate.slack_user_id).catch(() => null);
    if (info?.user?.is_bot || info?.user?.deleted) continue;
    const name = info?.user?.profile?.display_name || info?.user?.real_name || candidate.name || null;
    recipients.push({ slack_user_id: candidate.slack_user_id, name, linked: candidate.linked });
  }

  const confirm = await confirmToken(env.SLACK_ADMIN_TOKEN, target, recipients.map(row => row.slack_user_id), message);

  // No confirm token: this is a dry run. Nothing is sent, ever, on this path.
  if (!body?.confirm) {
    return json({
      dry_run: true,
      target,
      count: recipients.length,
      recipients,
      message,
      confirm,
      note: 'Preview only - no DMs were sent. Re-POST the same body plus this confirm value to send (requires SLACK_BULK_DM_ENABLED=true).',
    });
  }

  if (!bulkDmEnabled(env)) {
    return json({ error: 'Bulk DM sending is disabled. Set SLACK_BULK_DM_ENABLED=true to enable it.' }, 403);
  }
  if (!safeEqual(body.confirm, confirm)) {
    return json({ error: 'confirm does not match this target, audience and message; run a fresh preview first' }, 409);
  }

  const sent = [];
  const failed = [];
  for (const recipient of recipients) {
    try {
      await slack.postMessage({ channel: recipient.slack_user_id, text: renderTemplate(message, recipient) });
      sent.push(recipient.slack_user_id);
    } catch (error) {
      failed.push({ slack_user_id: recipient.slack_user_id, error: error.message });
    }
    await sleep(SEND_DELAY_MS);
  }
  return json({ dry_run: false, target, count: recipients.length, sent: sent.length, failed });
}
