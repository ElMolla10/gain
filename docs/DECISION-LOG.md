# Decision log screen (Step 7)

Status: unit-tested only, NOT device-verified.

- Settings > Decision log, and a button at the top of the History tab.
- One row per stored decision (every target written at finish): date, lift, gym, the workout it was written for, the suggested load x reps (or "no number"), what the lifter did (not answered / accepted / changed to X / declined), the sentence, rule version, path (fixed rule or model), confidence.
- Filter by lift; newest first; 40 at a time.
- Tap "Why this weight?" to open the stored inputs (the same screen as from the finish flow). Every listed row has them (tested for every decision in a seeded history).
- Planned targets that were rewritten (new rack, imported history, corrected history) are soft-deleted and not listed; only the live decision for each target shows.
- Old rule versions: a decision stored under another rule version, with a reason key or inputs this build cannot read, still shows its stored sentence, rule version and path with a note. It never crashes (tested with a fake `rule-v0.1`). Real rule versioning and a rule changelog come with Step 16.
- Not here: filtering by date, exporting the log (Step 12 exports data).
