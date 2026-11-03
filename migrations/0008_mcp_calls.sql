-- Agent (MCP) call journal: exactly-once semantics for tools/call retries. A row starts 'pending'
-- before any fee moves and ends 'done' with the full JSON-RPC result, so a retried Idempotency-Key
-- replays the stored answer instead of charging again, and a crashed call reads as 'pending'
-- (unknown outcome) for reconciliation instead of a blind re-run.
CREATE TABLE mcp_call (
  idempotency_key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  response TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
