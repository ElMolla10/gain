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
| Warm-up | Tap the set number: W (amber) instead of a number; working sets keep counting 1, 2, 3. |
| Delete a set | Swipe the row toward the end edge (direction flips in RTL), then tap Delete; or long-press the set number and confirm. |
| Target bar | "Today's target: 62.5 kg x 8 . reason" on one line. Tap: Why screen when the target was stored at the last finish, otherwise the reason expands. |
| Menu | Notes (focuses the field), **Replace exercise** (today only, only before sets are logged for it), **Remove exercise** (deletes its logged sets after asking; listed at the bottom with "Put back"). The programme is never changed. |
| Finish | Asks first if rows are filled in but not ticked (they are left out) or no set is ticked. Then the same finish flow as before: summary and next-session targets. |

## Limits (honest)
- A replacement exercise has no next-session target yet (targets are written per programme exercise). Its sets still count in history and the finish summary.
- No "add an exercise that is not in the day", no supersets, no muscle figures or exercise thumbnails, no drop/failure tags.
- Icons are drawn shapes (no icon font). The ghost-tick, swipe, menu, RTL mirroring and both palettes have not been seen on a device; the logic behind them is unit-tested.
