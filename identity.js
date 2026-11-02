// Reporting freezes to Southbag Identity, which owns the account-level freeze. Banking keeps its
// local accounts.status (the daily fee reads it) and Identity mirrors central state back through
// Billing.setStatus. Reports are durable: callers enqueue into identity_freeze_outbox first, then
// flush - a down Identity loses nothing, the cron retries.
//
// Deploy config: `wrangler secret put IDENTITY_INTERNAL_SECRET` with this service's entry from
// Identity's INTERNAL_API_SECRETS (key "southbag-online-banking"). Without it reporting is off
// and rows stay queued.

export const IDENTITY_ORIGIN = 'https://identity.southbag.cc';

async function postFreeze(env, userId, reason) {
  const secret = env.IDENTITY_INTERNAL_SECRET;
  if (!secret) throw new Error('IDENTITY_INTERNAL_SECRET is not set');
  const origin = env.IDENTITY_ORIGIN || IDENTITY_ORIGIN;
  const response = await fetch(origin + '/api/internal/freeze', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: JSON.stringify({ userId, reason, origin: 'banking-loan-default' }),
  });
  if (!response.ok) throw new Error(`identity freeze report failed: ${response.status}`);
}

/** Hooks for createD1Repo: how one freeze report reaches Identity. Throws on failure. */
export function identityHooks(env) {
  return { reportFreeze: (userId, reason) => postFreeze(env, userId, reason) };
}

// ── Central status checks (enforcement side) ──
// Availability policy: no secret configured -> 'off', the central check is skipped (development
// only; scripts/check-deploy.mjs fails the deploy without it). Every check is FRESH - no cache:
// a cached 'active' answer is an authorization window a just-frozen user could keep using.
// Configured but Identity unreachable (or rejecting our secret) -> 'unknown', and callers fail
// CLOSED: no private reads, no mutations, until Identity answers again. Identity being down
// blocking every Southbag service is the price of a freeze that covers ALL services.

export async function centralStatus(env, userId, fetcher = fetch) {
  const secret = env.IDENTITY_INTERNAL_SECRET;
  if (!secret) return 'off';
  try {
    const origin = env.IDENTITY_ORIGIN || IDENTITY_ORIGIN;
    const response = await fetcher(`${origin}/api/internal/freeze?userId=${encodeURIComponent(userId)}`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    if (response.status === 401 || response.status === 403) {
      // Loud and distinct: the secret is wrong or rotated, which a presence-only deploy guard
      // cannot catch. The answer still fails closed, but this is the log line to page on.
      console.error(`identity status REJECTED the configured secret (HTTP ${response.status}) - check IDENTITY_INTERNAL_SECRET`);
      return 'unknown';
    }
    if (!response.ok) throw new Error(`identity status ${response.status}`);
    return { frozen: !!(await response.json()).frozen };
  } catch (error) {
    console.error('identity status failed', error);
    return 'unknown';
  }
}

export const FROZEN_TEXT = 'Your account is frozen pending review. Unfreeze at https://identity.southbag.cc/unfreeze';
export const STATUS_UNKNOWN_TEXT = 'Southbag Identity is unavailable, so your account status cannot be checked. Try again shortly.';

// The frozen-account charge exception is an EXACT allowlist, authorized by a credential only
// Southbag Identity holds (FREEZE_FEE_SECRET) - the 'identity|' key prefix alone is just a
// caller-supplied string and proves nothing. Amounts are Identity's unfreeze-flow fees
// (identity's src/lib/server/freeze.ts: review $49.95, wrong answer $2.00).
export const IDENTITY_FEE_AMOUNTS = [4995, 200];
export function freezeFeeException({ product, amount, idempotencyKey, feeToken }, env) {
  if (!env.FREEZE_FEE_SECRET || feeToken !== env.FREEZE_FEE_SECRET) return false;
  if (product !== 'Southbag Identity') return false;
  if (!IDENTITY_FEE_AMOUNTS.includes(amount)) return false;
  return typeof idempotencyKey === 'string' && idempotencyKey.startsWith('identity|');
}
