# Offline and data-safety rules (Step 15) — code-level, tested on Node only

Status: **implemented and unit-tested; NOT verified on a real phone** (Node's `node:sqlite` stands in for the phone's SQLite; a real process kill, a real full disk and real low-memory behaviour are not simulated by it).

## Rules the code follows
1. **Nothing needs the network.** The only network code is the update check, which runs only when you tap (see PRIVACY-POLICY-DRAFT.md; `test/privacyFlows.test.ts` guards it).
2. **A set is saved by one transaction.** Logging a set, saving a programme, restoring a backup, deleting everything and applying a short week each commit atomically. `test/safety.test.ts` crashes the database at every statement of those operations ("kill injection") and checks that after reopening the data is either the old state or the complete new state, never a half. This found one real bug, fixed here: applying a short week wrote the short programme and its "restore afterwards" record in two steps, so a kill between them left a short programme with no way back. Now one transaction.
3. **Updates never lose data.**
   - Migrations are numbered, each runs in a transaction, and a failing one rolls back and leaves the old database untouched (tested).
   - A database written by a *newer* app than the one running is refused, not "downgraded" (tested).
   - Before an update that changes the database layout (`0 < from < to`), the app writes `gain-before-update.json` (a full JSON backup) into its private folder. If writing it fails (disk full) the update still proceeds and a warning goes to the local crash log. Settings > Your data shows the copy and sends it through the normal, checked restore. "Delete everything" removes it.
   - Upgrade paths from every historical schema version v1..v6 to the current v7 are tested with real rows (integrity and foreign-key checks, and the app's own reads work afterwards).
4. **A failed save is visible.** If saving a set throws (for example storage is full), the tick does not stick, an alert says "This set was NOT saved", and the error goes to the local crash log.

## Known limits (honest)
- Whole-app crash during a migration on a phone: SQLite's journal should protect it; only Node-simulated here.
- Android may restore the app's data from its own cloud backup (decision D11 open); this is outside the app's control.
- Native crashes and killed-in-background processes are not logged (no native module).
