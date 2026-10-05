# Active workout screen (v0.9.0)

Modelled on the Hevy "Log Workout" screen, keeping what makes GAIN different. Code: `screens/WorkoutScreen.tsx`, `components/LogParts.tsx`, pure rules in `logic/workoutRows.ts` and `logic/liveSummary.ts`, per-workout state in `db/workoutRepo.ts` (migration 6).

## Layout
- **Top bar:** collapse chevron (back to Today; the workout stays open and Today offers Resume), "Log Workout", rest-timer button (countdown while running; opens the timer panel with -15 / +15 / Start / Stop), blue **Finish**.
- **Summary row:** Duration (live, blue), Volume (working sets, load x reps, in kg or lb), Sets (working sets). Warm-ups and sets rejected as typos never count.
- **One list of all exercises.** Per exercise: name (blue), three-dot menu, "Add notes here...", "Rest Timer: 1:30 / OFF", target bar, set table, outlier cards, warm-up ladder link, wide **+ Add Set**.
- **Table:** SET | PREVIOUS | KG (LB) | REPS | tick (RIR box only for lifts that track effort).

## Behaviour
| Thing | Rule |
|---|---|
| Ghost target | KG / REPS boxes stay empty and show today's target (or the previous set's numbers on a new row) as placeholder text. Tick = log exactly those numbers. Typing in one box keeps the other box's ghost. Clearing a box brings the ghost back. |
| Tick | Saves the set on the phone at once (offline). Starts the rest timer unless it is off for this exercise or the row is a warm-up. Outlier check as before: a set far from the line is saved as unconfirmed and a card asks "It is right" / "Not right, remove it". |
| Un-tick | Deletes the saved set, keeps the numbers, row goes back to not done (new set id so the retry is not ignored as a duplicate). |
| Edit a ticked row | Row shows an update mark (arrow); tick to save the change. |
| PREVIOUS | Same-numbered working set of the last finished session of the same line (exercise + gym + setup). Warm-up rows and rows past the last session's sets show a dash. Unit follows the kg/lb setting. |
| Set type (v0.10.0) | Tap the set number: a sheet offers Normal / Warm-up (W, amber) / Drop set (D) / Failure (F). W and D are not numbered; F is a working set and keeps its slot in the numbering. Stored as the set's `is_warmup` flag and `tags_json` (`drop`, `failure`; the same tags the Hevy/Strong import writes). A drop set is not compared with the line (no outlier prompt), does not drive the next target (the engine already ignores `drop` as a working set), does not start the rest timer, and is not counted as a "working set" for PREVIOUS. Failure sets count as normal working sets and are only labelled. Volume and Sets in the top row count drop and failure sets, never warm-ups. History shows "Drop set" / "To failure". |
| Delete a set | Swipe the row toward the end edge (direction flips in RTL), then tap Delete; or long-press the set number and confirm. |
| Target bar | "Today's target: 62.5 kg x 8 . reason" on one line. Tap: Why screen when the target was stored at the last finish, otherwise the reason expands. |
| Menu | Notes (focuses the field), **Move up / Move down** when that direction is valid, **Replace exercise** (today only, only before sets are logged for it), **Remove exercise** (deletes its logged sets after asking; listed at the bottom with "Put back"). The program is never changed. Move rows are 56 dp buttons. TalkBack says the exercise name and the action. In Arabic the action words stay in the Arabic sentence; only the exercise name is direction-isolated. |
| Reorder exercise | An exercise is complete when its prescribed number of ordinary/failure working sets is saved; warm-ups, drop sets and rejected typos do not complete it. An uncompleted exercise, including one with a partial set, moves one place up or down. A superset moves as one block and is locked once any member is complete. The whole visible order is saved immediately in the existing `session_exercise.position` field, so backgrounding and resume keep it. Sets, notes, exercise ids, progression lines and permanent program positions are untouched. |
| Add exercise (v0.10.0) | "+ Add exercise" under the list opens the exercise picker (same search, Arabic aliases and "my own exercise" as the program editor). The exercise is added for today only, after the program's own, with plain defaults (3 sets, rep range 8 up to the rep ceiling of its kind of lift, not a goal lift, no effort box). It gets a live target from its own history when it has one; no stored next-session target is written for it (targets are per program exercise). Its sets count in History, trends, Volume/Sets and the finish summary. An exercise already in the workout (in the day, swapped in, or added) is refused; removing an added exercise lists it under "Removed today" with "Put back". Migration 7 (`session_exercise.added`, `.position`). |
| Superset (v0.10.0) | Menu > "Superset with ..." > pick another exercise of today's list (a third one can join the same way). Members are shown together at the first member's place with a "SUPERSET A" label and a bar on the start edge; "Remove from superset" in the menu. The rest timer starts after the LAST exercise of the round only (no rest between members); a group left with one member stops being a superset. Stored as `session_exercise.superset_group` (migration 7), today only; the program is not changed. CSV export writes it as Hevy's `superset_id` (and failure sets as `set_type=failure`). |
| Finish | Asks first if rows are filled in but not ticked (they are left out) or no set is ticked. Then the same finish flow as before: summary and next-session targets. |

## Limits (honest)
- A replacement exercise has no next-session target yet (targets are written per program exercise). Its sets still count in history and the finish summary.
- No muscle figures or exercise thumbnails.
- Icons are drawn shapes (no icon font). The ghost-tick, swipe, menu, reordering controls, RTL mirroring and both palettes have not been seen on a device; the logic behind them is unit-tested.
