# Offline and data-safety rules (Step 15) — code-level, tested on Node only

Status: **implemented and unit-tested; NOT verified on a real phone** (Node's `node:sqlite` stands in for the phone's SQLite; a real process kill, a real full disk and real low-memory behaviour are not simulated by it).

## Rules the code follows
1. **Nothing needs the network.** The only network code is the update check, which runs only when you tap (see PRIVACY-POLICY-DRAFT.md; `test/privacyFlows.test.ts` guards it).
2. **A set is saved by one transaction.** Logging a set, saving a programme, restoring a backup, deleting everything and applying a short week each commit atomically. `test/safety.test.ts` crashes the database at every statement of those operations ("kill injection") and checks that after reopening the data is either the old state or the complete new state, never a half. This found one real bug, fixed here: applying a short week wrote the short programme and its "restore afterwards" record in two steps, so a kill between them left a short programme with no way back. Now one transaction.
3. **Updates never lose data.**
   - Migrations are numbered, each runs in a transaction, and a failing one rolls back and leaves the old database untouched (tested).
   - A database written by a *newer* app than the one running is refused, not "downgraded" (tested).
   - Before an update that changes the database layout (`0 < from < to`), the app writes `gain-before-update.json` (a full JSON backup) into its private folder. If writing it fails (disk full) the update still proceeds and a warning goes to the local crash log. Settings > Your data shows the copy and sends it through the normal, checked restore. "Delete everything" removes it.
   - Upgrade paths from every historical schema version v1..v8 to the current v9 are tested with a small invented history (integrity and foreign-key checks, and the app's own reads work afterwards). They are not yet tested with a real release's own database or a real user's data: see MASTER-PLAN.md section 5.
4. **A failed save is visible.** If saving a set throws (for example storage is full), the tick does not stick, an alert says "This set was NOT saved", and the error goes to the local crash log.

## Known limits (honest)
- Whole-app crash during a migration on a phone: SQLite's journal should protect it; only Node-simulated here.
- Android may restore the app's data from its own cloud backup (decision D11 open); this is outside the app's control.
- Native crashes and killed-in-background processes are not logged (no native module).


## Two database connections (fixes release)

expo-sqlite transactions on one connection are not exclusive: a statement issued while a transaction is open (a tap that logs a set, a screen loading) runs inside it, is rolled back with it, and sees half-applied rows. `PRAGMA foreign_keys = OFF` (needed by restore, delete-everything and the sync "take the backup" swap) would also apply to every other statement on that connection.

What changed: the sync engine, restore-from-backup and delete-everything now use a second connection to the same file (`openExpoMaintenanceDb`). SQLite itself isolates the two (WAL: readers see the last committed state, writers take turns for up to the busy timeout), and the maintenance transactions start with `BEGIN IMMEDIATE`. The foreign-key switch is therefore local to that connection.

What did not change, honestly: on the everyday connection a short transaction (starting a workout, saving a programme) can still absorb a statement issued at the very same moment by another screen. Those transactions take milliseconds and the app has one user, and the existing mutex already stops two transactions interleaving. Moving every repo to a transaction-scoped handle would remove it; that is a larger change left for later. The second connection is tested on Linux with two real connections to one file (`test/maintenanceDb.test.ts`); it has NOT been run under real expo-sqlite on a phone.

## Backups are verified (fixes release)

- **Before an update changes the database layout** a full copy is written to the app's private folder and read back; it must be identical and parse as a backup. If that fails (storage full, write error) the migration does **not** run: the app shows "Update paused to protect your data" with *Try again* and, as a deliberate choice, *Update without a safety copy*. Before this release a failed copy only went to the crash log and the update went ahead.
- **A backup file only counts as made when it is complete:** every table has exactly as many rows in the file as in the database, the file parses as a backup, and for a shared/exported file the saved file reads back identical before "exported" is shown.
- **A restore** first keeps an automatic copy of what is on the phone now (`gain-before-restore.json`, read back; if it cannot be kept nothing is replaced), then replaces everything in one transaction on the maintenance connection, checks foreign keys, and checks that every table has exactly the rows the file had before it commits. Any mismatch rolls back. "Delete everything" removes both private copies.
- Tests: `test/safety.test.ts`, `test/backupVerify.test.ts`. Not verified on a phone.
