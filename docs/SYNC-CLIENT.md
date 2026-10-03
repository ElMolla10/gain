# Back up and sync: the app side (Step 21, v0.11)

Status: **built and tested against the real server code with fault injection; NOT verified on a phone.** Server and wire protocol: [SYNC.md](SYNC.md).

## What the lifter sees
Settings > **Back up and sync**. Off by default. The screen says in plain words what is uploaded (all training data except the crash log and the app's own sync bookkeeping), where (a GAIN server on Cloudflare), what stays local, that it is **not end-to-end encrypted**, and that without the recovery code the backup cannot be reached again. Turning it on is a button on that screen; nothing is sent before it.

- **No account is needed.** Turning on creates an anonymous account and shows a 20-character **recovery code** once. Writing it down is how a new phone gets the backup. (Email sign-in is built on the server but BLOCKED on an email provider, see SYNC.md.)
- **Turn off**: stops syncing and keeps the phone's data. Optional "also delete the backup on the server".
- **Delete everything** (Settings > Your data): if an online backup or coach link exists it is deleted on the server FIRST; if the server cannot be reached the lifter sees that and can choose "Delete only on this phone".
- **Coach link** (Finish screen): "Share coach card as a link" shows a consent card first, uploads that one card only, and the lifter can "Stop sharing" at once. Works without turning sync on.

## When it syncs
Only when it is ON: at app start, when the app returns to the front, and after a workout is finished (throttled to once per 5 minutes unless forced by finishing a workout). When off, the only thing that runs is one local database read. Failures never reach the training screens.

## How (apps/mobile/src/sync)
- `schema.ts` / migration 8: `sync_state` (token, cursor, status), `sync_row_state` (what the server last saw per row), `sync_outbox` (events with stable UUIDs), `sync_parked` (rows that cannot be applied yet).
- `engine.ts`: scan dirty rows (compare `updated_at:deleted_at` with the stored row state) into the outbox, push in batches with per-event acks, pull pages and apply them with the cursor in ONE transaction, last write wins by `updated_at` (tie: a deletion wins, then the larger canonical JSON).
- Idempotency: every event keeps its UUID until acknowledged, so a retry after a lost response, a crash, or a timeout cannot make a second copy of a session. The server remembers the last event id per row.
- `transport.ts`: the only file that talks to the network (`fetch`, one host).

## First sync rules ("restore-first")
- Fresh phone + existing backup (recovery code): the phone takes the backup.
- Phone with data + empty account: the phone's data is uploaded.
- Both have data: **no merge**. The lifter must choose "use the backup" (this phone's data is replaced) or cancel. To keep this phone's data instead, delete the backup first and connect again.
- A phone is never wiped for an empty backup (guarded in `takeBackup`).

## Parked rows (reported, never silently dropped)
`waiting_parent` (a child row arrived before its parent; retried each sync), `conflict` (an older edit lost to a newer one; counted), `newer_app` (the row comes from a newer app version; applied after updating). The screen shows counts.

## Known limits
- Row-level last-write-wins: two phones editing the same set offline keep the later edit.
- Restoring a local JSON backup, or "Delete everything", clears the sync bookkeeping, so sync turns itself off (the data is safe; turn it on again with the recovery code). "Delete only on this phone" leaves an orphaned server account that the server's cleanup does not yet remove.
- Lost recovery code = backup unreachable (by design: no email provider).
- `DELETE /v1/sync/data` exists on the server but the app only uses account deletion.

## Tests
`apps/server/test/e2e/sync.e2e.test.ts` runs the real engine on the real GAIN database against the real Worker code (SQLite standing in for D1) with faults: lost responses, crashes mid-push and mid-pull, duplicated and reordered pages, offline, 401, clock skew, two phones. `apps/mobile/test/syncSchema.test.ts`, `syncUi.test.ts` guard the schema, opt-in wiring, throttling, consent and delete order.

## NOT verified on a device
The Sync screen, Settings entry, Finish link buttons, Android share sheet for the link, AppState-triggered sync, delete-everything flow with a real network, Arabic text (draft), the real Cloudflare D1 under load (the deployed Worker passed a scripted smoke test only).
