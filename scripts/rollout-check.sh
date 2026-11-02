#!/usr/bin/env bash
# Rollout dependency check for the account-level freeze: proves the two deploy-order properties
# against real local Workers (staging shape, all dependencies up where required):
#   1. banking deployable BEFORE identity answers: central status unknown -> /api fails CLOSED (503).
#   2. identity up with all dependencies: banking resolves it at runtime (fresh per request) ->
#      active 200, frozen 423 with no caching lag; the internal endpoint enforces its bearer.
# Deploy order this supports: identity -> banking -> freeze backfill (scripts/backfill-freeze.mjs)
# -> every other service. Banking first is SAFE (fails closed), just unavailable.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IDENTITY="${IDENTITY_REPO:-$ROOT/../identity}"
BPORT="${BPORT:-8788}"
IPORT="${IPORT:-5174}"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/southbag-rollout.XXXXXX")"
BSTATE="$TMP/bstate"
BPID=""; IPID=""; RELAY_PID=""
cleanup() { for p in "$BPID" "$IPID" "$RELAY_PID"; do [ -n "$p" ] && { kill -- -"$p" 2>/dev/null || kill "$p" 2>/dev/null || true; }; done; [ -n "$BPID" ] && wait "$BPID" 2>/dev/null || true; [ "${KEEP:-}" = 1 ] && echo "kept $TMP" || rm -rf "$TMP"; }
trap cleanup EXIT
step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
fail() { printf '\033[31mFAIL: %s\033[0m\n' "$*"; exit 1; }
ok() { printf '\033[32mok\033[0m %s\n' "$*"; }

step "clear any stale dev servers on our ports"
pkill -f "wrangler dev" 2>/dev/null || true
pkill -f workerd 2>/dev/null || true
for port in "$BPORT" 8789 "$IPORT" 5599; do fuser -k "${port}/tcp" 2>/dev/null || true; done
sleep 1

step "banking migrate + seed"
(cd "$ROOT" && npx wrangler d1 migrations apply DB --local --persist-to "$BSTATE" >/dev/null)
now=$(date +%s)000
thash=$(node -e "console.log(Buffer.from(require('crypto').createHash('sha256').update('btok').digest()).toString('base64url'))")
(cd "$ROOT" && npx wrangler d1 execute DB --local --persist-to "$BSTATE" --command "
INSERT INTO users (id, email, name, created_at, updated_at) VALUES ('dev-alice', 'alice@example.com', 'Alice', $now, $now);
INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES ('$thash', 'dev-alice', 9999999999999, $now);
INSERT INTO accounts (user_id, balance, updated_at) VALUES ('dev-alice', 1000000, $now);
" >/dev/null)
ok "ready"

start_banking() { # $1 = identity origin, $2 = port (restart needs a fresh port: workerd's
  # internal sockets linger briefly after kill)
  local port="${2:-$BPORT}"
  (cd "$ROOT" && exec setsid npx wrangler dev --port "$port" --inspector-port 9333 --persist-to "$BSTATE" \
    --var FREEZE_FEE_SECRET:fee-tok ACCOUNT_STATUS_SECRET:status-tok IDENTITY_INTERNAL_SECRET:bsec IDENTITY_ORIGIN:"$1" >"$TMP/banking.log" 2>&1) &
  BPID=$!
  for i in $(seq 1 60); do curl -s -o /dev/null "http://127.0.0.1:$port/login" && break; sleep 1; [ "$i" = 60 ] && fail "banking did not start: $(tail -3 "$TMP/banking.log")"; done
  ACCT="http://127.0.0.1:$port/api/account"
}
CK="Cookie: southbag_session=btok"

step "1/3 banking before identity (origin dead): fails closed"
start_banking "http://127.0.0.1:59999"
s=$(curl -s -o /dev/null -w '%{http_code}' -H "$CK" "$ACCT")
[ "$s" = 503 ] || fail "banking /api/account $s, want 503 with Identity unreachable"
ok "503 (fail closed, deployable first)"

step "2/3 identity up (real worker, all deps): banking resolves it fresh"
(cd "$IDENTITY" && exec setsid npx wrangler dev --port "$IPORT" --inspector-port 9444 \
  --var ORIGIN:http://localhost:$IPORT BETTER_AUTH_SECRET:dev-secret BETTER_AUTH_URL:http://localhost:$IPORT \
  FREEZE_FEE_TOKEN:fee-tok ACCOUNT_STATUS_TOKEN:status-tok 'INTERNAL_API_SECRETS:{"southbag-online-banking":"bsec"}' >"$TMP/identity.log" 2>&1) &
IPID=$!
for i in $(seq 1 90); do curl -s -o /dev/null "http://127.0.0.1:$IPORT/" && break; sleep 1; [ "$i" = 90 ] && fail "identity did not start: $(tail -3 "$TMP/identity.log")"; done
# workerd->workerd loopback fetch dies in this sandbox ("Network connection lost"); bridge it
# with a dumb TCP relay (workerd->node and node->workerd both work). Real HTTP end to end.
node "$ROOT/test-fixtures/tcp-relay.mjs" 5599 "$IPORT" >"$TMP/relay.log" 2>&1 &
RELAY_PID=$!
sleep 0.5
# identity knows the user (row in its own auth schema)
now_ms=$(date +%s)000
(cd "$IDENTITY" && npx wrangler d1 execute DB --local --command "
INSERT OR IGNORE INTO user (id, email, name, email_verified, created_at, updated_at, frozen) VALUES ('dev-alice', 'alice@example.com', 'Alice', 1, $now_ms, $now_ms, 0);
" >/dev/null) || fail "identity user seed failed"
# kill the whole process GROUP: killing the npx wrapper alone orphans workerd, whose internal
# socket name then blocks the next banking start ("Address already in use (socket ...)").
kill -- -"$BPID" 2>/dev/null || kill "$BPID" 2>/dev/null || true
wait "$BPID" 2>/dev/null || true
for i in $(seq 1 40); do pgrep -g "$BPID" >/dev/null 2>&1 || break; sleep 0.5; done
start_banking "http://127.0.0.1:5599" 8789
s=$(curl -s -o /dev/null -w '%{http_code}' -H "$CK" "$ACCT")
[ "$s" = 200 ] || fail "banking /api/account $s, want 200 with Identity active"
ok "200 active through real identity"
u=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$IPORT/api/internal/freeze?userId=dev-alice")
[ "$u" = 401 ] || fail "internal freeze endpoint without secret: $u, want 401"
ok "internal endpoint enforces its bearer (401 unauthenticated)"

step "3/3 frozen centrally: banking 423 with no caching lag"
(cd "$IDENTITY" && npx wrangler d1 execute DB --local --command "UPDATE user SET frozen=1, frozen_reason='rollout check', frozen_at=$now_ms WHERE id='dev-alice';" >/dev/null)
s=$(curl -s -o /dev/null -w '%{http_code}' -H "$CK" "$ACCT")
[ "$s" = 423 ] || fail "banking /api/account $s, want 423 after central freeze"
ok "423 immediately (fresh check, no cache window)"

printf '\n\033[32mRollout order verified: identity -> banking -> backfill -> rest (banking-first is safe: fail closed).\033[0m\n'
