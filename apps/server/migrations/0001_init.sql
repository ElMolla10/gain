-- GAIN sync server schema (Cloudflare D1). Applied with `wrangler d1 migrations apply`.
-- Nothing here stores a plain secret: device tokens, recovery codes, email codes and coach-link tokens are kept as SHA-256 hashes.

CREATE TABLE account (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  recovery_hash TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  email_verified_at INTEGER
);

CREATE TABLE device (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX device_account ON device(account_id);

-- The winning version of every synced row, per account. seq grows with every accepted change; phones pull "everything after seq N".
CREATE TABLE sync_row (
  account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  tbl TEXT NOT NULL,
  row_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  data TEXT NOT NULL,
  seq INTEGER NOT NULL,
  event_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, tbl, row_id)
);
CREATE UNIQUE INDEX sync_row_seq ON sync_row(account_id, seq);

-- One pending email sign-in code per address.
CREATE TABLE email_code (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Fixed-window counters for the public endpoints.
CREATE TABLE rate_limit (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
