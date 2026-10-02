# Your data: export, restore, delete (Step 12)

Status: unit-tested only (SQLite on Node), NOT device-verified. The share sheet, file picker and file writes use Expo modules and have never run on a phone.

Settings > "Your data: export, restore, delete".

- **Full backup (JSON):** every row of every table, soft-deleted rows included, plus the schema version and export time. File `gain-backup-YYYY-MM-DD.json`.
- **Sets as CSV:** one row per set of finished workouts, in Hevy's columns, weights in kg, local time like Hevy writes it, RIR written as RPE (10 minus RIR), warm-ups as `warmup`, drop sets as `dropset`. Cells starting with `=`, `+`, `-` or `@` get a leading `'` so Excel does not run them as formulas. GAIN's own Import reads this file back (tested: same workouts, same sets, nothing doubles on a second import). The dedupe key is start time (minute) + title.
- **Restore:** the file is checked first (it is a GAIN backup, not from a newer GAIN, every table and column exists here, values are plain). Then one transaction replaces everything and foreign keys are verified before it commits. Any failure leaves the phone untouched (tested with 7 kinds of bad file). Restore replaces, it does not merge.
- **Delete everything:** two taps, clear warning, erases every table (schema stays), then `VACUUM`, then the app reloads at first run (tested: all tables empty, no onboarding state, first run works again).
- Round trips tested: export -> restore into an empty phone gives identical tables and identical history, targets, decisions and rejection memory; export -> wipe -> restore gives the identical state.

## Limits and open points
- Files you export or share are outside GAIN's control. The delete screen says so.
- Android auto-backup is currently ON (the Expo default, `allowBackup=true`): Android may keep its own copy of the database in the user's Google backup. This is a decision for Mohamed (D11 in MASTER-PLAN): leave it (data survives a phone change) or turn it off (more private, but a lost phone loses data unless exported). The delete screen tells the user this honestly.
- There is no server yet, so nothing to delete there (Step 21 adds that).
- Large history on a real phone has not been timed. A backup holds everything in memory as one string; fine for years of one lifter's logs, not tested at 100k sets.
- JSON restore needs a backup from this version or older of the database layout.
