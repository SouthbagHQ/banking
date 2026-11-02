// Production deploys must have the central freeze wired: without these secrets the central
// check silently turns off (or the internal API stays closed) and frozen accounts could act.
import { execSync } from 'node:child_process';
const out = execSync('npx wrangler secret list --format json 2>/dev/null || echo "[]"', { encoding: 'utf8' });
const names = JSON.parse(out).map(s => s.name);
const missing = ['IDENTITY_INTERNAL_SECRET', 'ACCOUNT_STATUS_SECRET', 'FREEZE_FEE_SECRET'].filter(n => !names.includes(n));
if (missing.length) {
  console.error(`Missing secrets: ${missing.join(', ')}. IDENTITY_INTERNAL_SECRET = banking's INTERNAL_API_SECRETS entry (key "southbag-online-banking"); ACCOUNT_STATUS_SECRET = the status-mirror token only Identity holds; FREEZE_FEE_SECRET = the freeze-fee exception credential only Identity holds. Refusing to deploy with the account freeze off.`);
  process.exit(1);
}
console.log('deploy check ok: account freeze is wired');
