ALTER TABLE accounts ADD COLUMN account_number TEXT;
ALTER TABLE accounts ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE accounts ADD COLUMN tier TEXT;
ALTER TABLE accounts ADD COLUMN inventory TEXT NOT NULL DEFAULT '[]';
ALTER TABLE accounts ADD COLUMN last_daily_at INTEGER;
ALTER TABLE accounts ADD COLUMN last_beg_at INTEGER;
ALTER TABLE accounts ADD COLUMN last_fee_at INTEGER;
ALTER TABLE accounts ADD COLUMN notifications INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN strikes INTEGER NOT NULL DEFAULT 0;

CREATE TABLE jobs (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  salary INTEGER NOT NULL,
  hired_at INTEGER NOT NULL,
  last_worked_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  principal INTEGER NOT NULL,
  interest_rate REAL NOT NULL,
  total_owed INTEGER NOT NULL,
  taken_at INTEGER NOT NULL,
  last_interest_at INTEGER NOT NULL,
  status TEXT NOT NULL
);

CREATE INDEX loans_user_status ON loans(user_id, status);

CREATE TABLE insurance (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  premium INTEGER NOT NULL,
  covered_until INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE crypto_holdings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coin TEXT NOT NULL,
  amount REAL NOT NULL,
  bought_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX crypto_holdings_user ON crypto_holdings(user_id);

CREATE TABLE heists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,
  started_by TEXT NOT NULL,
  participants TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX heists_channel_status ON heists(channel_id, status);

CREATE TABLE investments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  multiplier REAL NOT NULL,
  matures_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX investments_user_status ON investments(user_id, status);

CREATE TABLE lotteries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  ticket_price INTEGER NOT NULL,
  max_number INTEGER NOT NULL,
  pick_count INTEGER NOT NULL,
  jackpot INTEGER NOT NULL,
  status TEXT NOT NULL,
  winning_numbers TEXT,
  created_at INTEGER NOT NULL,
  drawn_at INTEGER
);

CREATE TABLE lottery_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lottery_id INTEGER NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  numbers TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX lottery_tickets_lottery ON lottery_tickets(lottery_id);
CREATE INDEX lottery_tickets_user ON lottery_tickets(user_id);
