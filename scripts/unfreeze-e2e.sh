#!/usr/bin/env bash
# End-to-end unfreeze fee check against REAL local Workers (identity + banking at current tips):
#   Leg A: frozen account -> identical wrong answer twice (charged once) -> 3 questions ->
#          review fee charged EXACTLY ONCE -> downstream (banking /api/account) active again;
#          retry/double-submit cannot charge again.
#   Leg B: bank refusing the charge (bad fee token) leaves the account FROZEN; after fixing the
#          token, retryPayment charges exactly once more (same cycle key, banking idempotency).
# A real user is created through Identity's own sign-up API. Identity calls Banking's Billing
# entrypoint over the BANKING service binding (dev registry). workerd->workerd loopback fetch
# dies in this sandbox, so banking's status checks reach identity through a dumb TCP relay
# (real HTTP both ends, same as rollout-check.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IDENTITY="${IDENTITY_REPO:-$ROOT/../identity}"
BPORT="${BPORT:-8790}"
IPORT="${IPORT:-5175}"
RPORT="${RPORT:-5598}"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/southbag-unfreeze.XXXXXX")"
BSTATE="$TMP/bstate"
BPID=""; IPID=""; RELAY_PID=""
cleanup() { for p in "$BPID" "$IPID" "$RELAY_PID"; do [ -n "$p" ] && { kill -- -"$p" 2>/dev/null || kill "$p" 2>/dev/null || true; }; done; [ -n "$BPID" ] && wait "$BPID" 2>/dev/null || true; [ -n "$IPID" ] && wait "$IPID" 2>/dev/null || true; [ "${KEEP:-}" = 1 ] && echo "kept $TMP" || rm -rf "$TMP"; }
trap cleanup EXIT
step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
fail() { printf '\033[31mFAIL: %s\033[0m\n' "$*"; exit 1; }
ok() { printf '\033[32mok\033[0m %s\n' "$*"; }

step "clear stale dev servers"
pkill -f "wrangler dev" 2>/dev/null || true
pkill -f workerd 2>/dev/null || true
for port in "$BPORT" "$IPORT" "$RPORT"; do fuser -k "${port}/tcp" 2>/dev/null || true; done
sleep 1

start_banking() {
  (cd "$ROOT" && exec setsid npx wrangler dev --port "$BPORT" --inspector-port 9335 --persist-to "$BSTATE" \
    --var FREEZE_FEE_SECRET:fee-tok ACCOUNT_STATUS_SECRET:status-tok IDENTITY_INTERNAL_SECRET:bsec IDENTITY_ORIGIN:"http://127.0.0.1:$RPORT" >"$TMP/banking.log" 2>&1) &
  BPID=$!
  for i in $(seq 1 60); do curl -s -o /dev/null "http://127.0.0.1:$BPORT/login" && break; sleep 1; [ "$i" = 60 ] && fail "banking did not start: $(tail -3 "$TMP/banking.log")"; done
}
start_identity() { # $1 = FREEZE_FEE_TOKEN value ('' = unset, the failure leg)
  [ -n "$IPID" ] && { kill -- -"$IPID" 2>/dev/null || kill "$IPID" 2>/dev/null || true; wait "$IPID" 2>/dev/null || true; sleep 1; }
  local feevar=()
  [ -n "$1" ] && feevar=(--var "FREEZE_FEE_TOKEN:$1")
  (cd "$IDENTITY" && exec setsid npx wrangler dev --port "$IPORT" --inspector-port 9446 \
    --var ORIGIN:http://localhost:$IPORT BETTER_AUTH_SECRET:dev-secret BETTER_AUTH_URL:http://localhost:$IPORT \
    ACCOUNT_STATUS_TOKEN:status-tok 'INTERNAL_API_SECRETS:{"southbag-online-banking":"bsec"}' "${feevar[@]}" >"$TMP/identity.log" 2>&1) &
  IPID=$!
  for i in $(seq 1 90); do curl -s -o /dev/null "http://127.0.0.1:$IPORT/" && break; sleep 1; [ "$i" = 90 ] && fail "identity did not start: $(tail -3 "$TMP/identity.log")"; done
}

start_identity fee-tok

step "drop any leftover test user + stale jwks (encrypted under a previous BETTER_AUTH_SECRET)"
(cd "$IDENTITY" && npx wrangler d1 execute DB --local --command "DELETE FROM user WHERE email='alice@example.com'; DELETE FROM jwks;" >/dev/null) || true

step "real sign-up through /api/auth/sign-up/email"
resp=$(curl -s -i -X POST -H 'content-type: application/json' -H "origin: http://127.0.0.1:$IPORT" \
  -d '{"name":"Alice","email":"alice@example.com","password":"correct horse battery staple"}' \
  "http://127.0.0.1:$IPORT/api/auth/sign-up/email")
SETC=$(printf '%s' "$resp" | tr -d '\r' | sed -n 's/^[Ss]et-[Cc]ookie: \(better-auth\.session_token=[^;]*\).*/\1/p' | head -1)
[ -n "$SETC" ] || fail "no session cookie from sign-up: $(printf '%s' "$resp" | head -5)"
ICK="Cookie: $SETC"
# first page hit can race wrangler's cold bundling (transient esbuild EPIPE): retry
code=""
for i in $(seq 1 10); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -H "$ICK" "http://127.0.0.1:$IPORT/unfreeze")
  [ "$code" = 200 ] && break; sleep 2
done
[ "$code" = 200 ] || fail "GET /unfreeze with real session: $code"
E2EUSER=$(cd "$IDENTITY" && npx wrangler d1 execute DB --local --json \
  --command "SELECT id FROM user WHERE email='alice@example.com'" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s)[0].results[0].id))")
[ -n "$E2EUSER" ] || fail "no user row after sign-up"
ok "signed up as $E2EUSER"

step "banking migrate + seed (\$10,000.00 for $E2EUSER)"
(cd "$ROOT" && npx wrangler d1 migrations apply DB --local --persist-to "$BSTATE" >/dev/null)
now=$(date +%s)000
thash=$(node -e "console.log(Buffer.from(require('crypto').createHash('sha256').update('btok').digest()).toString('base64url'))")
(cd "$ROOT" && npx wrangler d1 execute DB --local --persist-to "$BSTATE" --command "
INSERT INTO users (id, email, name, created_at, updated_at) VALUES ('$E2EUSER', 'alice@example.com', 'Alice', $now, $now);
INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES ('$thash', '$E2EUSER', 9999999999999, $now);
INSERT INTO accounts (user_id, balance, updated_at) VALUES ('$E2EUSER', 1000000, $now);
" >/dev/null)
CK="Cookie: southbag_session=btok"
ACCT="http://127.0.0.1:$BPORT/api/account"
start_banking
node "$ROOT/test-fixtures/tcp-relay.mjs" "$RPORT" "$IPORT" >"$TMP/relay.log" 2>&1 &
RELAY_PID=$!
sleep 0.5
s=$(curl -s -o /dev/null -w '%{http_code}' -H "$CK" "$ACCT")
[ "$s" = 200 ] || fail "banking /api/account $s, want 200 pre-freeze"
ok "banking up, 200 active"

balance() { (cd "$ROOT" && npx wrangler d1 execute DB --local --persist-to "$BSTATE" --json \
  --command "SELECT balance FROM accounts WHERE user_id='$E2EUSER'" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s)[0].results[0].balance))"); }
txcount() { (cd "$ROOT" && npx wrangler d1 execute DB --local --persist-to "$BSTATE" --json \
  --command "SELECT COUNT(*) AS n FROM transactions WHERE idempotency_key LIKE 'identity|%'" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s)[0].results[0].n))"); }
iuser() { (cd "$IDENTITY" && npx wrangler d1 execute DB --local --json \
  --command "SELECT frozen, security_question, created_at FROM user WHERE id='$E2EUSER'" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s)[0].results[0];console.log(r.frozen+' '+r.security_question+' '+r.created_at)})"); }
charge_rows() { (cd "$IDENTITY" && npx wrangler d1 execute DB --local --json \
  --command "SELECT kind, amount, status, COUNT(*) AS n FROM freeze_charge WHERE user_id='$E2EUSER' GROUP BY kind, amount, status ORDER BY kind, status" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.stringify(JSON.parse(s)[0].results)))"); }

answer_q() { # $1 = 'right' or a literal answer
  local qid created ans
  read -r _ qid created < <(iuser)
  if [ "$1" = right ]; then
    case "$qid" in
      ceo|pile|merge_conflicts) ans="kevin";;
      phone) ans="IP355";;
      briefcase) ans="\$250";;
      chair|parking) ans="nobody";;
      light) ans="on";;
      issue_year) ans="2019";;
      lake) ans="lake burley griffin";;
      rack) ans="there is no floor 3";;
      arrival) ans="he was already there";;
      signup_day) ans=$(node -e "console.log(new Date(Number('$created')).toLocaleDateString('en-US',{weekday:'long',timeZone:'Australia/Sydney'}))");;
      null) ans="already unfrozen: any answer is a no-op";; # post-unfreeze double-submit
      *) fail "unknown question id $qid";;
    esac
  else ans="$1"; fi
  curl -s -X POST -H "$ICK" -H "origin: http://127.0.0.1:$IPORT" --data-urlencode "answer=$ans" \
    "http://127.0.0.1:$IPORT/unfreeze?/answer" >/dev/null
}
retry_payment() { curl -s -X POST -H "$ICK" -H "origin: http://127.0.0.1:$IPORT" -H 'content-type: application/x-www-form-urlencoded' -d '' "http://127.0.0.1:$IPORT/unfreeze?/retryPayment"; }
freeze_now() { curl -s -X POST -H "authorization: Bearer bsec" -H 'content-type: application/json' \
  -d "{\"userId\":\"$E2EUSER\",\"reason\":\"e2e check\",\"origin\":\"unfreeze-e2e\"}" "http://127.0.0.1:$IPORT/api/internal/freeze"; }

step "1/7 freeze via real internal endpoint (bearer bsec) -> banking 423"
f=$(freeze_now)
echo "$f" | grep -q '"frozen":true' || fail "freeze endpoint: $f"
sleep 1
if grep -q 'banking status sync failed' "$TMP/identity.log"; then
  fail "BANKING binding RPC failed (dev registry not resolving in this sandbox): $(grep -m1 -A2 'banking status sync failed' "$TMP/identity.log")"
fi
s=$(curl -s -o /dev/null -w '%{http_code}' -H "$CK" "$ACCT")
[ "$s" = 423 ] || fail "banking /api/account $s, want 423 after freeze"
ok "frozen centrally, banking 423, banking mirror synced over RPC"

# Banking applies its pre-existing $1 daily maintenance fee on first account read (product
# behavior, unrelated to the freeze); all assertions below are DELTAS from this baseline.
BASE=$(balance)
want() { # $1 = expected balance
  local b; b=$(balance)
  [ "$b" = "$1" ] || fail "balance $b, want $1 (delta $((b - BASE)) from baseline $BASE)"
}

step "2/7 identical wrong answer twice -> exactly ONE \$2.00 fee"
answer_q "definitelywrong"
answer_q "definitelywrong"
sleep 1
want $((BASE - 200))
ok "one 200-cent debit ($(charge_rows))"

step "3/7 three correct answers -> review fee -> unfrozen -> downstream active"
answer_q right; answer_q right; answer_q right
sleep 1
read -r fr _ _ < <(iuser); [ "$fr" = 0 ] || fail "still frozen after 3 correct answers"
want $((BASE - 200 - 4995))
[ "$(txcount)" = 2 ] || fail "banking identity| tx rows: $(txcount), want 2 (200 + 4995)"
s=$(curl -s -o /dev/null -w '%{http_code}' -H "$CK" "$ACCT")
[ "$s" = 200 ] || fail "banking /api/account $s, want 200 after unfreeze"
ok "review fee 4995 charged once, downstream active ($(charge_rows))"

step "4/7 retry/double-submit cannot charge again"
r=$(retry_payment); echo "$r" | grep -q '"status":400' || fail "retryPayment after unfreeze: $r (want 400)"
answer_q right
sleep 1
want $((BASE - 200 - 4995))
ok "no extra charge"

step "5/7 failed payment stays frozen (bank refuses: bad fee token)"
f=$(freeze_now)
echo "$f" | grep -q '"frozen":true' || fail "re-freeze: $f"
start_identity WRONG-token
code=$(curl -s -o /dev/null -w '%{http_code}' -H "$ICK" "http://127.0.0.1:$IPORT/unfreeze")
[ "$code" = 200 ] || fail "session lost across identity restart: $code"
answer_q right; answer_q right; answer_q right
sleep 1
read -r fr _ _ < <(iuser); [ "$fr" = 1 ] || fail "UNFROZEN despite failed payment"
want $((BASE - 200 - 4995))
charge_rows | grep -q '"status":"failed"' || fail "no failed freeze_charge row: $(charge_rows)"
ok "frozen, no debit, failed row recorded"

step "6/7 fixed token + retryPayment -> exactly one more review fee"
start_identity fee-tok
r=$(retry_payment)
# the action response is devalue-encoded; assert on resulting state instead of the payload
sleep 1
read -r fr _ _ < <(iuser); [ "$fr" = 0 ] || fail "still frozen after retryPayment: $r"
want $((BASE - 200 - 4995 - 4995))
[ "$(txcount)" = 3 ] || fail "banking identity| tx rows: $(txcount), want 3"
s=$(curl -s -o /dev/null -w '%{http_code}' -H "$CK" "$ACCT")
[ "$s" = 200 ] || fail "banking /api/account $s after retry"
ok "charged once more, active again ($(charge_rows))"

step "7/7 final retry is a no-op"
r=$(retry_payment); echo "$r" | grep -q '"status":400' || fail "final retryPayment: $r (want 400)"
sleep 1
want $((BASE - 200 - 4995 - 4995))
ok "no further charge"

printf '\n\033[32mUnfreeze fee path verified end to end: exactly-once success, no recharge on retry, failed payment stays frozen.\033[0m\n'
