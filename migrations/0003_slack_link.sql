PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN slack_user_id TEXT;
ALTER TABLE users ADD COLUMN slack_name TEXT;
ALTER TABLE users ADD COLUMN slack_linked_at INTEGER;
ALTER TABLE users ADD COLUMN slack_imported INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX users_slack_user_id ON users(slack_user_id) WHERE slack_user_id IS NOT NULL;

ALTER TABLE oauth_states ADD COLUMN kind TEXT NOT NULL DEFAULT 'identity';
ALTER TABLE oauth_states ADD COLUMN user_id TEXT;

ALTER TABLE lotteries ADD COLUMN legacy_id TEXT;
ALTER TABLE lotteries ADD COLUMN created_by TEXT;
ALTER TABLE lotteries ADD COLUMN winner_id TEXT;
CREATE UNIQUE INDEX lotteries_legacy_id ON lotteries(legacy_id) WHERE legacy_id IS NOT NULL;

CREATE TABLE slack_legacy_accounts (
  slack_user_id TEXT PRIMARY KEY,
  name TEXT,
  account_number TEXT,
  balance INTEGER NOT NULL,
  status TEXT NOT NULL,
  tier TEXT,
  inventory TEXT NOT NULL DEFAULT '[]',
  last_daily_at INTEGER,
  last_beg_at INTEGER,
  last_fee_at INTEGER,
  notifications INTEGER NOT NULL DEFAULT 0,
  strikes INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE slack_legacy_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slack_user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  kind TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX slack_legacy_transactions_user ON slack_legacy_transactions(slack_user_id);

CREATE TABLE slack_legacy_jobs (
  slack_user_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  salary INTEGER NOT NULL,
  hired_at INTEGER NOT NULL,
  last_worked_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE slack_legacy_loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slack_user_id TEXT NOT NULL,
  principal INTEGER NOT NULL,
  interest_rate REAL NOT NULL,
  total_owed INTEGER NOT NULL,
  taken_at INTEGER NOT NULL,
  last_interest_at INTEGER NOT NULL,
  status TEXT NOT NULL
);
CREATE INDEX slack_legacy_loans_user ON slack_legacy_loans(slack_user_id);

CREATE TABLE slack_legacy_insurance (
  slack_user_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL,
  premium INTEGER NOT NULL,
  covered_until INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE slack_legacy_crypto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slack_user_id TEXT NOT NULL,
  coin TEXT NOT NULL,
  amount REAL NOT NULL,
  bought_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX slack_legacy_crypto_user ON slack_legacy_crypto(slack_user_id);

CREATE TABLE slack_legacy_investments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slack_user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  multiplier REAL NOT NULL,
  matures_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX slack_legacy_investments_user ON slack_legacy_investments(slack_user_id);

CREATE TABLE slack_legacy_lottery_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slack_user_id TEXT NOT NULL,
  lottery_legacy_id TEXT NOT NULL,
  numbers TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX slack_legacy_lottery_tickets_user ON slack_legacy_lottery_tickets(slack_user_id);

CREATE TABLE slack_legacy_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slack_user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  bought_at INTEGER
);
CREATE INDEX slack_legacy_inventory_user ON slack_legacy_inventory(slack_user_id);
