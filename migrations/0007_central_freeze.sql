-- Account-level freeze support: idempotent Billing charges and the durable Identity report queue.
ALTER TABLE transactions ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX transactions_idempotency_key ON transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TABLE identity_freeze_outbox (
  user_id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  reported_at INTEGER
);
