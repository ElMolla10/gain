# Backtest of rule-v0.3 on a Hevy export

Rows: 1049, workouts: 70, 2025-09-22 to 2026-09-29. Parser warnings: 0.

**What this measures:** for each session of a lift, the rule proposes from everything *before* that session; we compare with what the lifter actually did. This is agreement with the lifter, not proof that the rule is right.

**Assumptions (a Hevy export has neither):** the load grid per equipment class is inferred as the greatest common divisor of every logged load in that class; the top of the rep range is each lift's rep ceiling (10 / 12 / 15, sensitivity below) and the bottom is assumed 6; no effort data (RPE is empty), so the effort currency never fires; no rejection history. Compared on the hardest working load of the session and the minimum reps at it; warm-ups are not in the export, drop sets are excluded.

## Headline: default rule (rule-v0.3) vs "repeat the last load"

Default = ACSM 2009 (2-10% load step, snapped to real loads) with the lifter's rep ceilings: **10 reps upper body, 12 reps legs, 15 reps lateral raises** (classified from the exercise name). Load goes up only when the weakest working set at the current load reaches the ceiling, once. Until then: one more rep.

| | Same load as lifter | Same load and reps | Lifter met or beat it | Rule proposed heavier | Lifter went heavier | Rule held/lowered while he went up | Rule went up while he held/lowered |
|---|---|---|---|---|---|---|---|
| **Default: ACSM 2009 + ceilings 10 / 12 / 15** | 59% (202/343) | 13% | 51% | 1% (3) | 26% (90) | 26% | 1% |
| **Baseline: repeat last load** | 60% (207/343) | n/a | n/a | 0% | 26% (90) | 26% | 0% |
| Reference: opt-in `coaching_conventions` (the earlier rule-v0.2 draft), range 6-10 | 55% (190/343) | 13% | 54% | 0% (0) | 26% (90) | 26% | 0% |

Verdict on the one number that matters most: same load as the lifter 59% vs 60% for repeating the last load. The rule does NOT beat the baseline.

## By kind of lift

| Kind (ceiling) | Lifts | Next sessions | Same load as lifter | Baseline: repeat last load | Rule proposed heavier | Lifter went heavier |
|---|---|---|---|---|---|---|
| upper body (10) | 22 | 287 | 61% | 62% | 1% (3) | 25% (71) |
| legs (12) | 4 | 28 | 46% | 46% | 0% (0) | 39% (11) |
| lateral raise (15) | 2 | 28 | 54% | 54% | 0% (0) | 29% (8) |

Classification used (by name): Back Extension (Weighted Hyperextension) -> 10; Bench Press (Barbell) -> 10; Bicep Curl (Barbell) -> 10; Bicep Curl (Cable) -> 10; Bicep Curl (Dumbbell) -> 10; Butterfly (Pec Deck) -> 10; Chest Press (Machine) -> 10; Concentration Curl -> 10; Face Pull -> 10; Hammer Curl (Dumbbell) -> 10; Incline Bench Press (Dumbbell) -> 10; Lat Pulldown (Cable) -> 10; Lateral Raise (Dumbbell) -> 15; Leg Extension (Machine) -> 12; Leg Press Horizontal (Machine) -> 12; Overhead Triceps Extension (Cable) -> 10; Rear Delt Reverse Fly (Machine) -> 10; Reverse Curl (Barbell) -> 10; Seated Cable Row - V Grip (Cable) -> 10; Seated Calf Raise -> 12; Seated Leg Curl (Machine) -> 12; Seated Palms Up Wrist Curl -> 10; Seated Shoulder Press (Machine) -> 10; Shoulder Press (Dumbbell) -> 10; Single Arm Lateral Raise (Cable) -> 15; Single Arm Tricep Extension (Dumbbell) -> 10; T Bar Row -> 10; Triceps Pushdown -> 10.

## Did he raise the load when he reached the ceiling?

In 19 of 343 next-sessions his previous session's weakest set had already reached the ceiling. In 9 of those he went heavier next time (47%); the rule proposed heavier in 3 (16%). Where the ceiling had NOT been reached he still went heavier 81 times, which is where the rule (correctly, by this instruction) says "one more rep" instead.

Why the rule did not propose heavier in the other 16: 5 had too little history (low confidence repeats, never jumps), 11 had a smallest real load step bigger than the 10% ACSM ceiling (light loads on the inferred grid), so the rule spent a quality change (pause / slow eccentric) first, as the currency order requires. 0 other.

Of his 90 load increases, 9 (10%) came right after a session at or above the ceiling for that lift; 81 came earlier. Median reps before an increase: 7.

## Sensitivity: what if the ceilings were different? (app-wide defaults edited)

| Ceilings upper / legs / lateral | Same load as lifter | Rule proposed heavier | Lifter went heavier | Baseline: repeat last load |
|---|---|---|---|---|
| 6 / 8 / 10 | 43% | 27% | 26% | 60% |
| 8 / 10 / 12 | 54% | 9% | 26% | 60% |
| 10 / 12 / 15 (default) | 59% | 1% | 26% | 60% |
| 12 / 15 / 20 | 59% | 0% | 26% | 60% |

This table is a sanity check on how much the ceilings matter, not a search for better numbers: the ceilings are Mohamed's instruction, not tuned.

### Other triggers on the same ceilings (all use the same policy code; only the trigger differs)

| Preset | Same load as lifter | Rule proposed heavier | Lifter went heavier | Baseline: repeat last load |
|---|---|---|---|---|
| acsm_2009 (default) | 59% | 1% | 26% | 60% |
| acsm_2009_strict | 59% | 0% | 26% | 60% |
| two_for_two | 59% | 0% | 26% | 60% |
| coaching_conventions | 55% | 0% | 26% | 60% |

### Reps he had just done before each time he raised the load

90 load increases. Reps (weakest set at his top load, previous session): 10th percentile 5, median 7, 90th percentile 10. If these sit below the top of the assumed range, he progresses load before filling the range, which usually means his real per-lift ranges are lower than the default; the per-lift rep range setting exists for that reason.

## Rep distribution of the logged working sets

1012 sets: 10th percentile 5, 25th 6, median 8, 75th 10, 90th 12 reps.

## Inferred load grids (assumption, per equipment class)

- barbell: step 5 kg (from 9 distinct logged loads)
- machine: step 2.5 kg (from 18 distinct logged loads)
- cable: step 2.5 kg (from 18 distinct logged loads)
- dumbbell: step 2 kg (from 9 distinct logged loads)
- title:Triceps Pushdown: step 2.5 kg (from 8 distinct logged loads)
- title:Dumbbell Row: step 2 kg (from 3 distinct logged loads)
- title:T Bar Row: step 5 kg (from 7 distinct logged loads)
- title:Concentration Curl: step 2.5 kg (from 2 distinct logged loads; too few, default 2.5 kg used)
- title:Seated Calf Raise: step 2.5 kg (from 7 distinct logged loads)
- title:inclined flight machine: step 2.5 kg (from 1 distinct logged loads; too few, default 2.5 kg used)
- title:lateral raises machine: step 2.5 kg (from 2 distinct logged loads; too few, default 2.5 kg used)
- title:Single Arm Lat Pulldown: step 2.5 kg (from 1 distinct logged loads; too few, default 2.5 kg used)
- title:Seated wrist curl barbell palm up: step 2.5 kg (from 1 distinct logged loads; too few, default 2.5 kg used)
- title:Seated wrist barbell palm down: step 2.5 kg (from 1 distinct logged loads; too few, default 2.5 kg used)
- title:Seated Palms Up Wrist Curl: step 0.5 kg (from 5 distinct logged loads)
- title:Low machine shrug: step 2.5 kg (from 2 distinct logged loads; too few, default 2.5 kg used)
- title:Face Pull: step 2.5 kg (from 3 distinct logged loads)
- title:Triceps Rope Pushdown: step 2.5 kg (from 2 distinct logged loads; too few, default 2.5 kg used)
- title:Hack Squat: step 2.5 kg (from 1 distinct logged loads; too few, default 2.5 kg used)
- title:Cable Forearm (palms up): step 2.5 kg (from 2 distinct logged loads; too few, default 2.5 kg used)

Skipped (no reps logged): Dead Hang, Farmers walk.

## By currency spent (default rule)

| Currency | Proposals | Same load as lifter | Lifter met or beat it |
|---|---|---|---|
| reps | 329 | 60% | 50% |
| quality | 11 | 55% | 64% |
| load | 3 | 0% | 33% |
| effort | 0 | n/a | n/a |

## By confidence (default rule)

| Confidence | Proposals | Same load | Met or beat |
|---|---|---|---|
| low | 41 | 34% | 71% |
| medium | 86 | 53% | 47% |
| high | 216 | 66% | 49% |

## Per exercise (default rule, lifts with 4+ sessions)

| Exercise | Next sessions checked | Same load | Same load and reps | Met or beat | Proposed heavier | Repeat-last baseline | Last proposal vs what was done |
|---|---|---|---|---|---|---|---|
| Lat Pulldown (Cable) | 32 | 72% | 19% | 44% | 9% | 72% | 75x6 vs 75x4 |
| T Bar Row | 25 | 68% | 12% | 48% | 8% | 68% | 45x6 vs 45x6 |
| Triceps Pushdown | 24 | 58% | 13% | 50% | 13% | 58% | 37.5x8 vs 37.5x7 |
| Chest Press (Machine) | 22 | 59% | 5% | 41% | 14% | 64% | 60x7 vs 65x6 |
| Seated Cable Row - V Grip (Cable) | 22 | 59% | 23% | 50% | 18% | 59% | 50x9 vs 55x7 |
| Bench Press (Barbell) | 21 | 71% | 5% | 24% | 10% | 71% | 70x6 vs 70x5 |
| Bicep Curl (Barbell) | 21 | 67% | 10% | 62% | 10% | 67% | 25x10 vs 25x8 |
| Reverse Curl (Barbell) | 20 | 65% | 10% | 55% | 10% | 65% | 25x6 vs 25x5 |
| Butterfly (Pec Deck) | 18 | 67% | 17% | 44% | 11% | 67% | 25x6 vs 25x5 |
| Single Arm Lateral Raise (Cable) | 18 | 61% | 17% | 56% | 17% | 61% | 7.5x9 vs 7.5x8 |
| Single Arm Tricep Extension (Dumbbell) | 18 | 56% | 22% | 56% | 22% | 56% | 10x6 vs 10x3 |
| Hammer Curl (Dumbbell) | 15 | 47% | 7% | 53% | 20% | 47% | 16x7 vs 16x7 |
| Incline Bench Press (Dumbbell) | 12 | 67% | 8% | 33% | 8% | 67% | 24x6 vs 24x5 |
| Lateral Raise (Dumbbell) | 10 | 40% | 20% | 60% | 20% | 40% | 10x9 vs 12x10 |
| Seated Calf Raise | 9 | 33% | 22% | 67% | 22% | 33% | 20x9 vs 15x13 |
| Leg Extension (Machine) | 8 | 50% | 13% | 50% | 13% | 50% | 50x9 vs 50x9 |
| Seated Leg Curl (Machine) | 7 | 43% | 14% | 57% | 14% | 43% | 50x7 vs 47.5x8 |
| Rear Delt Reverse Fly (Machine) | 5 | 60% | 0% | 20% | 20% | 60% | 15x10 vs 15x8 |
| Seated Shoulder Press (Machine) | 5 | 20% | 0% | 60% | 40% | 20% | 30x7 vs 25x7 |
| Seated Palms Up Wrist Curl | 5 | 40% | 20% | 80% | 0% | 40% | 12.5x10 vs 12.5x6 |
| Leg Press Horizontal (Machine) | 4 | 75% | 25% | 100% | 0% | 75% | 90x11 vs 90x12 |
| Concentration Curl | 4 | 0% | 0% | 100% | 0% | 100% | 12.5x8 vs 14x10 |
| Shoulder Press (Dumbbell) | 3 | 67% | 33% | 67% | 33% | 67% | 12x6 vs 12x6 |
| Bicep Curl (Dumbbell) | 3 | 67% | 0% | 33% | 33% | 67% | 14x6 vs 14x7 |
| Overhead Triceps Extension (Cable) | 3 | 0% | 0% | 67% | 33% | 0% | 62.5x6 vs 15x18 |
| Face Pull | 3 | 67% | 33% | 100% | 0% | 67% | 15x10 vs 17.5x8 |
| Back Extension (Weighted Hyperextension) | 3 | 100% | 0% | 33% | 0% | 100% | 10x9 vs 10x8 |
| Bicep Curl (Cable) | 3 | 0% | 0% | 67% | 33% | 0% | 30x7 vs 25x7 |

