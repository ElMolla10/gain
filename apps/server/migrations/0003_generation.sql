-- Generation: a number per account that changes whenever the server's copy of the account's rows is replaced or rewound
-- (wipe-and-reupload, or an operator restoring D1 from a backup / Time Travel). A phone that sees a generation different from the one
-- it last synced against knows its cursor no longer means the same thing, and reconciles (re-sends its rows, re-reads the server's)
-- instead of silently missing changes.
ALTER TABLE account ADD COLUMN generation INTEGER NOT NULL DEFAULT 1;

-- Storage accounting for the per-account quota: characters of synced row data held for the account (kept up to date by every push).
ALTER TABLE account ADD COLUMN bytes_used INTEGER NOT NULL DEFAULT 0;
UPDATE account SET bytes_used = (SELECT COALESCE(SUM(LENGTH(data)), 0) FROM sync_row WHERE sync_row.account_id = account.id);
