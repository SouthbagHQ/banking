PRAGMA foreign_keys = ON;

-- Slack bot moderation state (ported from the Convex accounts table).
ALTER TABLE accounts ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN ban_expiry INTEGER;
ALTER TABLE accounts ADD COLUMN ban_reason TEXT;

-- Per-channel / per-thread support chat history for the Slack bot.
CREATE TABLE slack_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,
  thread_ts TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  user_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX slack_messages_conversation ON slack_messages(channel_id, thread_ts, created_at);

-- Slack events are retried; remember what we already processed.
CREATE TABLE slack_events (
  event_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
