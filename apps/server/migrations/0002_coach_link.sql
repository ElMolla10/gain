-- Coach links: a private, expiring, revocable page that shows one coach card. The token is shown once and only its hash is stored.
CREATE TABLE coach_link (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  views INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX coach_link_account ON coach_link(account_id);
