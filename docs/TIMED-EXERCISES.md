# Timed and distance exercises (v0.13.0)

Status: **built and unit-tested; NOT verified on a phone; the rule is a DRAFT that no trainer has reviewed.**

## What it is
Some exercises are counted in seconds (plank, dead hang, wall sit, L-sit) or metres (farmer's walk, suitcase carry, sandbag carry), not reps.
Each exercise has a *measure*: `reps` (everything that existed before), `time` or `distance`.

## Data (migration 9)
- `exercise.measure` (`reps|time|distance`, default `reps`).
- `workout_set.duration_s` (1..3600) and `workout_set.distance_m` (>0, up to 5000). A timed set stores `reps = 1` (one hold / one carry), so every reps-based query keeps working.
- `target.duration_s`, `target.distance_m` (the next-session target; `reps` is empty for them).
- Library rows that are holds or carries (list in `apps/mobile/src/db/library/measures.ts`) become timed **only** when the phone has no logged set, no program slot and no session reference for that row. Rows a lifter already uses keep counting reps; they can be switched in the program editor ("Count this exercise in") until the first set is logged. After the first set it is locked (a line never mixes two kinds of numbers).
- The backfill does not change `updated_at`, so it does not trigger a sync push by itself.
- Sync: a phone on an older app version that receives timed sets parks them as `newer_app` (existing behaviour for newer schema), they apply once it updates.

## Rule `timed-v0.1` (DRAFT)
Implemented in `packages/engine/src/timed.ts`; reasons have EN and AR templates (Arabic is a draft).
1. One session of history: repeat it, low confidence.
2. Below the range minimum: rebuild up to it (no load change).
3. Below the top of the range: next target = last seconds/metres rounded down to a multiple of 5, plus a step (about 10%, at least 5, multiple of 5), capped at the top.
4. At the top of the range for 2 sessions in a row: go up one real gym load step and restart at the range minimum. If no heavier load exists, or that jump was declined 3 times, hold at the top.
5. Caps: 3600 s, 5000 m. A set far (3x, and at least 15 away) from the lifter's own recent line is held for confirmation, same as reps lines.
Warm-up ladders and RIR are not offered for timed exercises. Timed sets add nothing to workout volume.

## Import / export
- Hevy: rows with duration/distance and no reps are kept (distance_km x 1000; miles x 1609.344 in a pounds file). Strong: the "Seconds" column. Before v0.13 those rows were skipped.
- A row the chosen exercise cannot count (seconds for a metres exercise, or a hold under a reps exercise) is **not** converted: the preview shows it as "unfit" and it is counted in `skippedSets`. The lifter can map the title to another exercise.
- CSV export writes `duration_seconds` and `distance_km` with an empty `reps` cell; GAIN's own importer reads it back. JSON backups need nothing special.

## Not done / not verified
- Not run on a device: set rows, keyboard input (`45` or `1:30`), RTL layout of "45 ث", TalkBack labels.
- No stopwatch / countdown for the hold. The lifter types the time.
- Custom exercises are created counted in reps; switch them in the program editor.
- A trainer has not reviewed the step size, the 2-sessions-at-top rule or the caps.
