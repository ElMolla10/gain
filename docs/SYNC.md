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
| `GET /health` | none | `{ok:true}` |

## Sign-in (decision D3)
- **Anonymous account + recovery code** is the default, so sync works with **no email provider**: the code (20 characters) is the only way to restore on a new phone. Lose the phone *and* the code and the backup is unreachable. The server stores only hashes of tokens and codes.
- **Email sign-in (optional):** implemented as a one-time 8-digit **code** typed into the app (not a clickable link: a deep link back into the app is unverified without a device). **BLOCKED on an email provider**: nothing is configured, so the endpoint answers 501. Two ways to unblock, both untested against a real mail service: set the `RESEND_API_KEY` secret (`wrangler secret put RESEND_API_KEY`) and the `EMAIL_FROM` var (a Resend-verified sender), or point the code at another provider in `src/email.ts`. `DEV_EMAIL_CODES="1"` returns the code in the response for local testing and **must never be set on a deployed Worker** (a test checks `wrangler.toml`).

## Limits and cost (free tier)
Workers free: 100k requests/day. D1 free: 5 GB, 100k rows written/day, 5M rows read/day. A first upload writes ~1 row per event. Push batches are 100 events. These limits are from Cloudflare's docs as I remember them, **not measured**; re-check before relying on them.

## Deploy
`apps/server/scripts/deploy.sh` (needs `wrangler login` done; creates D1 `gain-sync` if missing, applies migrations, deploys Worker `gain-sync`). Then `node apps/server/scripts/smoke.mjs <worker url>`. Nothing secret is written into the repo.

## Region and backups
D1 data lives in the Cloudflare region D1 picks (automatic); **where exactly is unknown**, and Egyptian/EU residency rules are **unknown** (Step 17). D1 Time Travel gives point-in-time restore but no separate backup was set up.

## Not done / unverified
See the status section appended after the first deploy, and the client side in SYNC-CLIENT.md when it lands.
