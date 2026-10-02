# History and trend rules (Step 6)

Status: unit-tested only, NOT device-verified. These are my defaults. Mohamed can change the measure.

## The one trend measure: top set
For each finished session of a line, the **top working set**:

- Free weight or stack, and added-load bodyweight: the heaviest load. Ties go to more reps.
- Assisted: the least assistance (lower is harder). Ties go to more reps.
- Not counted: warm-ups, drop sets, sets waiting for an outlier confirm, rejected sets.
- It is what was lifted, shown with its reps. It is **not** an estimated 1RM (Goals/pace uses e1RM; the trend does not).

A **line** is exercise + gym + setup. Lines are never merged, so assisted and bodyweight lines never mix with free weights, and two gyms are two lines.

## Direction
- Theil-Sen slope (median of pairwise slopes) over the last 10 sessions of the line, so one odd day does not swing it.
- Needs at least 3 sessions spanning at least 14 days; otherwise it says "not enough yet".
- A change of less than 1% of the latest load per 30 days is "about flat".
- Assisted lines are read the other way round (less assistance = better).

## Screens
- History tab: Sessions (newest first, 30 at a time, imported ones labelled) and Lifts (one card per line).
- Session detail: every set; edit load / reps / RIR, or delete a set (two taps). A set waiting for a confirm counts once saved.
- Lift trend: bars for the last 30 sessions, oldest left, always left-to-right (also in Arabic), imported sessions outlined, plus latest and best.
- Editing or deleting a set re-works planned (not started) sessions, same as after an import. Kept accepted / edited targets stay.
- Deleted sets are soft-deleted.

## Not done / open
- No chart library: plain bars. No zoom, no axis numbers.
- Performance: a 25-session lift is computed in a few milliseconds on Node (test). No number from a phone exists yet (Step 15).
- Which measure (top set vs e1RM vs volume) is Mohamed's call.
