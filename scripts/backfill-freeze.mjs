// One-off backfill: report every locally-frozen account to Southbag Identity, which owns the
// account-level freeze now. Identity's setFrozen is idempotent, so re-running is safe.
//
//   node scripts/backfill-freeze.mjs [--local] [--dry-run]
//
// Reads the D1 database through wrangler (remote by default, --local for the dev database).
// Needs IDENTITY_INTERNAL_SECRET in the environment (this service's entry from Identity's
// INTERNAL_API_SECRETS, key "southbag-online-banking"); IDENTITY_ORIGIN overrides the default.
import { execSync } from 'node:child_process';

const local = process.argv.includes('--local');
const dryRun = process.argv.includes('--dry-run');
const secret = process.env.IDENTITY_INTERNAL_SECRET;
const origin = process.env.IDENTITY_ORIGIN || 'https://identity.southbag.cc';
if (!secret && !dryRun) {
  console.error('IDENTITY_INTERNAL_SECRET is required (or use --dry-run)');
  process.exit(1);
}

const sql = "SELECT user_id FROM accounts WHERE status = 'frozen'";
const out = execSync(
  `npx wrangler d1 execute DB ${local ? '--local' : '--remote'} --json --command "${sql}"`,
  { encoding: 'utf8' }
);
const rows = JSON.parse(out).flatMap(r => r.results || []);
console.log(`${rows.length} locally frozen accounts`);
let failed = 0;
for (const { user_id } of rows) {
  if (dryRun) { console.log(`would report ${user_id}`); continue; }
  const response = await fetch(`${origin}/api/internal/freeze`, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: JSON.stringify({ userId: user_id, reason: 'Account frozen (pre-existing local freeze)', origin: 'banking-backfill' }),
  });
  if (!response.ok) { failed++; console.error(`${user_id}: identity answered ${response.status}`); }
  else console.log(`${user_id}: reported`);
}
if (failed) { console.error(`${failed} reports failed - re-run to retry`); process.exit(1); }
console.log('backfill complete');
