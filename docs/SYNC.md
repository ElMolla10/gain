# Backup and sync (Step 21): server design and API

Status: **server built and unit-tested (Node, in-memory SQLite standing in for D1) and smoke-tested on local workerd + local D1.** See the end of this file for what was deployed and what is not verified. Plan: [MASTER-PLAN.md](MASTER-PLAN.md) Step 21; decisions D3 (auth) and D8 (creator-only edits).

## What it is, in one paragraph
An OPTIONAL backup/sync of the lifter's data to a small Cloudflare Worker with a D1 (SQLite) database. The app works fully without it (no account, nothing leaves the phone). When the lifter turns it on, every changed row is sent as an event; other phones pull what changed. Conflicts are decided per row by last write wins.

## Where the code is
- `packages/sync` (`@gain/sync`): the protocol both sides share (event shape, validation, conflict comparison, synced-table list). Pure code.
- `apps/server` (`@gain/server`): the Worker (`src/`), D1 migrations (`migrations/`), tests (`test/`), deploy and smoke scripts (`scripts/`).

## Data model
- Every local table row is one JSON object (all columns, keys sorted = "canonical"). The local tables already have `id` (client UUID), `updated_at`, `deleted_at`.
- **Synced tables** (parents first): see `SYNC_TABLES`. `setting` syncs only the keys in `SYNCED_SETTING_KEYS` (units, active programme/gym, onboarding state, ...). Language, RTL, rest-timer, update-check and any sync credentials never sync.
- Server table `sync_row` keeps the winning version per (account, table, row id) plus `seq`, a per-account counter that grows with every accepted change. Phones pull "everything after seq N".
- Server keeps **no event log**: idempotency comes from the row's last `event_id` (replaying it is a `duplicate`) and from the conflict rule (replaying an older version is `stale`).

## Conflict rule (written down, as the plan asks)
Per row, the version with the **later `updated_at`** wins. At the very same millisecond: a **tombstone beats a live row**, then the larger canonical JSON string wins, so every phone and the server pick the same winner whatever order things arrive in (tested with shuffled and duplicated events). Consequences you should know:
- Two phones editing *different columns of the same row* offline: the later edit overwrites the whole row. Nothing merges inside a row.
- A delete is a tombstone (`deleted_at`). An edit made **before** the delete never brings the row back, even if it arrives later. An edit made **after** the delete (by the phone's clock) does bring it back: that is plain last write wins.
- A phone whose clock is more than 10 minutes ahead gets its events rejected (`clock_ahead`) instead of beating every honest write forever. A clock that is *behind* just loses conflicts.

## API (all JSON)
| Route | Auth | What |
| --- | --- | --- |
| `POST /v1/account` | none, 20/h per IP | New anonymous account. Returns `accountId`, `deviceToken`, `recoveryCode` (shown once). |
| `POST /v1/auth/recover {recoveryCode}` | none, 10/h per IP | New phone signs in with the recovery code. |
| `POST /v1/auth/email/start {email}` | none, 5/h per address | Sends an 8-digit code. **501 `email_not_configured` until an email provider is set.** |
| `POST /v1/auth/email/verify {email, code}` | optional | With a token: links the email to the account. Without: signs in to the account that owns the email (created on first use). 5 tries, 10 minutes. |
| `GET /v1/me`, `POST /v1/auth/logout` | token | Account info; revoke this phone's token. |
| `POST /v1/sync/push {events[<=100]}` | token, 120/min | Per-event result: `applied`, `duplicate`, `stale`, `rejected(reason)`. One bad event never blocks the rest; the batch is atomic. |
| `GET /v1/sync/pull?since=N&limit=M` | token, 240/min | Changed rows after N in order, with `next` cursor and `hasMore`. |
| `DELETE /v1/sync/data` | token | Remove the synced rows, keep the account. |
| `DELETE /v1/account` | token | Remove everything for the account (rows, phones, links, account). Wired to "Delete my backup" in the app. |
| `POST /v1/coach-links {card, expiresInDays?}` | token, 30/h | Publish one coach card (plain text blocks, validated, <= 24 KB) behind a private link. Default 7 days, max 30, max 20 active links. Returns `url` once; only the token's hash is stored. |
| `GET /v1/coach-links`, `DELETE /v1/coach-links/:id` | token | List your links (never the tokens), revoke one. Only the creator can; for anyone else the link does not exist. Revoking also erases the stored card. |
| `GET /c/:token` | none, 120/min per IP | The coach's page. See below. |
| `GET /health` | none | `{ok:true}` |

## Sign-in (decision D3)
- **Anonymous account + recovery code** is the default, so sync works with **no email provider**: the code (20 characters) is the only way to restore on a new phone. Lose the phone *and* the code and the backup is unreachable. The server stores only hashes of tokens and codes.
- **Email sign-in (optional):** implemented as a one-time 8-digit **code** typed into the app (not a clickable link: a deep link back into the app is unverified without a device). **BLOCKED on an email provider**: nothing is configured, so the endpoint answers 501. Two ways to unblock, both untested against a real mail service: set the `RESEND_API_KEY` secret (`wrangler secret put RESEND_API_KEY`) and the `EMAIL_FROM` var (a Resend-verified sender), or point the code at another provider in `src/email.ts`. `DEV_EMAIL_CODES="1"` returns the code in the response for local testing and **must never be set on a deployed Worker** (a test checks `wrangler.toml`).

## Limits and cost (free tier)
Workers free: 100k requests/day. D1 free: 5 GB, 100k rows written/day, 5M rows read/day. A first upload writes ~1 row per event. Push batches are 100 events. These limits are from Cloudflare's docs as I remember them, **not measured**; re-check before relying on them.

## Deploy
`apps/server/scripts/deploy.sh` (needs `wrangler login` done; creates D1 `gain-sync` if missing, applies migrations, deploys Worker `gain-sync`). Then `node apps/server/scripts/smoke.mjs <worker url>`. Nothing secret is written into the repo.

## Region and backups
D1 data lives in **ENAM** (eastern North America, checked 2026-10-03); Egyptian/EU residency rules are **unknown** (Step 17). D1 Time Travel is on (7 days on the free plan, 30 on paid) but no separate backup was set up. Restore steps: see "D1 backups and restore" at the end of this file.

## Not done / unverified
See the status section appended after the first deploy, and the client side in SYNC-CLIENT.md (shipped in v0.11).

## Coach links (Step 22, the part that survives the dropped shared gyms)
- The lifter taps "Share as link" on the finish screen; the app uploads the SAME card model the PDF uses (session, next targets, pace line, no bodyweight, not-a-doctor line) and gets back `https://<worker>/c/<token>`. The coach opens it in any browser: **no account, no app**.
- The token is 192 random bits; guessing is not feasible, and an unknown, expired and revoked link all return the same 404 page. The page is plain escaped text (no script, CSP `default-src 'none'`, `noindex`, `no-referrer`, `no-store`), Arabic cards render right-to-left.
- Anyone who has the link can read the card until it expires or is revoked. The app says so before uploading.
- Creating a link makes an anonymous server account if the phone has none (the card has to belong to someone who can revoke it); it does **not** turn on sync.
- Not done: image version, link preview, per-view notifications, a "live" card that updates (a link is a snapshot).

## Deployed (2026-10-03) and what exists in Mohamed's Cloudflare account
Deployed with wrangler (OAuth login already on the box as imody10@gmail.com), free tier only:
- Worker **`gain-sync`** at **https://gain-sync.elmolla10.workers.dev** (workers.dev subdomain already existed; no custom domain, no routes, no cron, no paid add-on).
- D1 database **`gain-sync`**, id `cf6d113c-a0ae-40fc-a100-28a71e693821` (an id is not a secret; it is in `wrangler.toml`), migrations 0001 and 0002 applied.
- No secrets set (`RESEND_API_KEY` absent, so email sign-in answers 501). `DEV_EMAIL_CODES="0"`.
- Existing resources (`fpl-edge`, `fpl-edge-pr57`, D1 `fpl-edge-db`) were not touched.
- `node apps/server/scripts/smoke.mjs https://gain-sync.elmolla10.workers.dev` passed against the deployed Worker (16 checks incl. push/replay/stale/tombstone/recovery/coach link/delete account). Test accounts were deleted; the database was empty afterwards.
- Redeploy: `apps/server/scripts/deploy.sh`. Roll back: `npx wrangler@4.147.0 rollback` (Workers keep previous versions).
- To remove everything: `npx wrangler@4.147.0 delete gain-sync` and `npx wrangler@4.147.0 d1 delete gain-sync`.
- Request volume is unmetered by us; nobody is rate limited globally, only per address/account (see the table). A flood from many addresses could exhaust the free daily request quota (the Worker would then answer errors until the next day): accepted risk for a pilot.

## D1 backups and restore (checked 2026-10-03)

What was checked on the live database `gain-sync` (id `cf6d113c-a0ae-40fc-a100-28a71e693821`, not a secret) with `wrangler@4.147.0` as the account owner, read-only commands only:
- **Time Travel is on.** It is always on for D1; nothing to enable and no extra cost. `wrangler d1 time-travel info gain-sync` returned a current bookmark, and `--timestamp=<an hour earlier>` returned a bookmark, so history exists.
- **Retention:** 7 days on the Workers Free plan, 30 days on Workers Paid (Cloudflare D1 limits page). I did not confirm which plan the account is on; assume **7 days** (this project is on the free tier).
- **Manual export works:** `d1 export gain-sync --remote --no-data` produced a 60-line schema file. A data export was not made (the database may hold real pilot data; this repo and these docs never contain any).
- **Region:** the database runs in **ENAM** (eastern North America), no jurisdiction set. This answers "where is the data": the US east side. Egypt/EU data-residency rules are still **not assessed** (Step 17). A jurisdiction (EU) can only be chosen when a database is created.
- Size 102 kB, 7 tables, read replication off.
- **Not set up:** any export that outlives Time Travel (no scheduled export to R2, no cron; the Worker has none by design). Anything older than 7 days is gone.
- Restore was **rehearsed on a throwaway D1 database** on 2026-10-03 (evening), not on the live one; see "Live exercise of quota, kill switch and Time Travel" at the end of this file. A restore of the live `gain-sync` has still never been needed or run.

### Restore steps (run from `apps/server`, after `wrangler login` as the account owner)
Restoring overwrites the live database in place, so write down the "before" bookmark first; it is the undo.
1. `npx wrangler@4.147.0 d1 time-travel info gain-sync` : note the current bookmark (this is your undo point).
2. Pick the target moment (UTC, inside the retention window): `npx wrangler@4.147.0 d1 time-travel info gain-sync --timestamp=2026-10-03T09:00:00Z` : prints the bookmark for that minute.
3. Optional, safer: save the current state first with `npx wrangler@4.147.0 d1 export gain-sync --remote --output=/secure/place/gain-sync-before.sql` (it contains users' synced data; keep it off the repo and delete it when done).
4. Restore: `npx wrangler@4.147.0 d1 time-travel restore gain-sync --bookmark=<bookmark from step 2>`. The command asks for a yes (it falls back to yes in a non-interactive shell) and prints the **undo bookmark**; copy it. Rehearsed on a throwaway database (see the end of this file).
5. Undo a bad restore: run the same command with the undo bookmark that step 4 printed (or the one from step 1) (old bookmarks stay valid while inside retention; limit 10 restores per 10 minutes).
5b. After ANY restore or undo, bump the generation so phones reconcile: `npx wrangler@4.147.0 d1 execute gain-sync --remote --command "UPDATE account SET generation = generation + 1"` (rehearsed).
6. Check: `node apps/server/scripts/smoke.mjs https://gain-sync.elmolla10.workers.dev` still passes (it makes and deletes its own test accounts), and `npx wrangler@4.147.0 d1 execute gain-sync --remote --command "select count(*) from account"` looks plausible.
- After a restore, a phone that synced after the target moment holds rows the server no longer has. Its next push re-sends them (event ids and last-write-wins make that safe), so phones heal the server; this is by design but **untested against a real restore**.
- Deleted-account data restored by a rollback comes back: if a lifter used "Delete my backup" after the target moment, their rows reappear. Re-run the deletion if that matters.
- Worker code is separate: `npx wrangler@4.147.0 rollback` (see Deployed above). The schema is in `apps/server/migrations`; `d1 migrations apply` on an empty database rebuilds the tables but not the data.
- Dashboard alternative: Cloudflare dashboard > Workers & Pages > D1 > gain-sync > Time Travel (not checked).

## Fixes release: rollback detection, limits, kill switch, housekeeping

**Generation (P07).** Each account has a `generation` (migration `0003_generation.sql`), returned by `/v1/me`, push and pull. It bumps when the account's synced rows are wiped (`DELETE /v1/sync/data`, used by "replace the backup"): sequence numbers restart at 1 after a wipe, so a phone's old cursor would silently skip new rows. A phone remembers the generation it last synced against; when it sees a different one, or when the server's newest change (`head`) is *behind* the phone's cursor (a restored/rewound D1), it **reconciles**: forgets what the server is known to have (every local row becomes unsent), resets its cursor to 0, re-reads the server's rows and re-sends its own (last-write-wins merges them). Nothing local is deleted. Tested against the real Worker code in `apps/server/test/e2e`.
- **Operator runbook after restoring D1 (Time Travel / backup):** run `UPDATE account SET generation = generation + 1;` straight afterwards. A rewind that is later *outgrown* (the server's head passes the phone's old cursor again with different rows under those numbers) cannot be seen from inside the database, so bumping the generation is the reliable signal. Phones then reconcile on their next sync.

**Limits (P17).** Request bodies over 9 MB are refused (413) before they are read; a single row is at most 64 KB; a push is at most 100 events and 8 MB; each account may hold `ACCOUNT_QUOTA_BYTES` characters of synced data (default 25,000,000; counted in `account.bytes_used`, updated by every push; a push that could pass it gets `413 quota_exceeded`).

**Kill switch.** Set the Worker variable `KILL_SWITCH` in the Cloudflare dashboard (no deploy): `1` = every endpoint except `/health` answers `503 service_paused`; `writes` = pull, `/v1/me` and coach-card views keep working but new accounts, pushes, sign-in codes and coach links are refused (recover, logout and DELETE still work). Anything else = normal. Phones treat 503 as a temporary server error.

**Edge rate limiting (documentation only, not configured).** The Worker already counts requests per account / IP in D1. If abuse appears, put Cloudflare's own rate limiting in front (Security > WAF > Rate limiting rules; free plans include a small number of rules): e.g. `POST /v1/account` and `POST /v1/auth/*` per IP per minute. Those rules run before the Worker is invoked, so they also protect the free request quota.

**Housekeeping.** A daily cron trigger (`[triggers] crons` in `wrangler.toml`, 03:23 UTC) deletes expired coach links, old rate-limit windows, expired sign-in codes and devices unused for 400+ days (that phone gets 401 and signs in again with its recovery code).

**Not done:** per-device token rotation and a "revoke other devices" screen (needs UI).

### Deployment status of v0.15.0 server changes (2026-10-03)
- **Deployed and migration applied** on the live Worker `gain-sync` / D1 `gain-sync` (wrangler 4.147.0, account owner). `0003_generation.sql` was the only pending migration and applied cleanly; Worker version `2e3beff2-3c98-47af-8f3c-673496b3ea05` is live with the daily cron trigger (`23 3 * * *`).
- Before the change: a Time Travel bookmark was taken (`00000002-00000000-000050f9-5366598a51c079d2583d8d1e9a676485`, 13:07 UTC) and a schema-only export saved off-repo. The database held 0 accounts, so no user data was at risk. No restore was needed or run.
- **Smoke test passed** against https://gain-sync.elmolla10.workers.dev: `scripts/smoke.mjs` (16 checks) plus a manual check that `/v1/me`, push and pull return `generation` (1), push/pull return `head`, and `DELETE /v1/sync/data` bumps generation to 2. Test accounts were deleted; the database was empty afterwards.
- **Not verified live (at that time; see "Live exercise" below for what changed):** the cron cleanup has not run yet (first run 03:23 UTC); the per-account quota (`413 quota_exceeded`) and the `KILL_SWITCH` variable were not exercised on the deployed Worker (covered by unit/e2e tests only); phone-side reconcile against this server is not device-verified; a Time Travel restore is still never rehearsed.


## Live exercise of quota, kill switch and Time Travel (2026-10-03, evening Cairo time)

Script: `apps/server/scripts/limits-smoke.mjs` (see its header for the commands). Nothing here touched real user data: the live database held 0 accounts before and after.

**Quota, on the LIVE Worker** (`https://gain-sync.elmolla10.workers.dev`, default quota 25,000,000 characters). A throwaway account pushed 60,000-character gym rows (10 per push) until the server refused: `413 quota_exceeded`, `quota` = 25000000, `used` = 24,634,330, which equals exactly the characters the script had stored (the server's `bytes_used` counter is right). The check is an upper bound (it counts every event of a push as if it would be stored), so an account stops up to one push short of the limit. At the limit: pulls still work, an edit that makes a row smaller still applies, and new rows are still refused. The account was then deleted (token dead afterwards); `smoke.mjs` passed again and the live tables were empty (0 accounts, 0 rows). About 410 rows written, well inside the free D1 daily write limit.

**Kill switch, on a THROWAWAY Worker** (`gain-sync-rehearsal`, the same `src/` code, its own throwaway D1, deleted afterwards). I did not flip `KILL_SWITCH` on the live Worker: pausing production to test it is not worth the risk when the variable is read by the same code. On the throwaway Worker, a redeploy with each value (the dashboard edit has the same effect, but was not clicked; a redeploy was used because it can be scripted) gave:
- `0`: health, `/v1/me`, push all 200.
- `writes`: `POST /v1/account`, push, coach-link create and email-code start answer `503 service_paused`; pull, `/v1/me` and `POST /v1/auth/recover` still work.
- `1`: everything except `/health` answers `503 service_paused`, **including `DELETE /v1/account`**. While the full pause is on nobody can delete their backup; say so if a pause is ever announced. Under `writes`, DELETE still works (only POST is blocked).
- Back to empty/off: normal again. Changes took effect within seconds of the deploy.
- Caveat: a variable set in the dashboard can be overwritten by the next `wrangler deploy` (the `[vars]` in `wrangler.toml` win). If you pause with the dashboard, do not redeploy until you mean to resume, or put `KILL_SWITCH` in `wrangler.toml` instead.

**Time Travel restore rehearsal, on a THROWAWAY D1** (`gain-sync-rehearsal`, created, used and deleted the same evening; the live `gain-sync` was never restored).
1. Account A pushed 3 rows. Bookmark taken (`d1 time-travel info`), 5 s later: A pushed 2 more rows and a new account B pushed 1 row (6 rows, 2 accounts).
2. `d1 time-travel restore --bookmark=<step 1>` finished in a few seconds and printed the **undo bookmark** ("To undo this operation, you can restore to the previous bookmark: ..."). Afterwards: 1 account, 3 rows. A's pull returned its 3 rows with `head` 3 (behind the 5 a phone would remember), and B's token answered **401**. B's account no longer exists, so B's recovery code cannot work either: an account created after the restore point is simply lost, and that phone keeps its local data but has no backup until a new account is made. How the app presents a 401 after a restore was not tried on a phone.
3. Phone healing: A re-sent its two newer rows (new event ids, same row ids and times) and they were `applied`, head back to 5.
4. Runbook step `UPDATE account SET generation = generation + 1` (run through `d1 execute --remote`): `/v1/me`, push and pull then report generation 2, which is what makes phones reconcile.
5. Undo: restoring the undo bookmark printed in step 2 brought B back (A 5 rows, B 1 row, generation 1 again) and printed a new undo bookmark. So a restore can be walked back **using the bookmark the restore command printed**, and that is the one to write down (not only the one from `time-travel info` beforehand).
6. Cleanup: both accounts deleted over the API, the Worker deleted (`wrangler delete`), the D1 database deleted; `d1 list` shows only `gain-sync` and the unrelated `fpl-edge-db`.
What this proves: the command sequence in "Restore steps" works as written on a D1 database in this account, the undo works, the data of accounts that existed at the restore point comes back, and the generation bump is visible to clients. What it does not prove: behaviour on a phone, behaviour with large databases, or the 7-day retention figure (only minutes of history were used).
