# Backtest of rule-v0.2 on a Hevy export

Rows: 1049, workouts: 70, 2025-09-22 to 2026-09-29. Parser warnings: 0.

**What this measures:** for each session of a lift, the rule proposes from everything *before* that session; we compare with what the lifter actually did. This is agreement with the lifter, not proof that the rule is right.

**Assumptions (a Hevy export has neither):** the load grid per equipment class is inferred as the greatest common divisor of every logged load in that class; the rep range is a single default per run (sensitivity below); no effort data (RPE is empty), so the effort currency never fires; no rejection history. Compared on the hardest working load of the session and the minimum reps at it; warm-ups are not in the export, drop sets are excluded.

## Sensitivity to the assumed rep range

| Range | Proposals | Same load as lifter | Same load and reps | Lifter met or beat it | Proposed heavier than lifter did | Proposed lighter | Baseline: repeat last load |
|---|---|---|---|---|---|---|---|
| 4-8 | 343 | 56% | 16% | 60% | 15% | 29% | 60% |
| 6-10 | 343 | 55% | 13% | 54% | 13% | 31% | 60% |
| 8-12 | 343 | 51% | 8% | 48% | 13% | 36% | 60% |
| 10-15 | 343 | 45% | 2% | 47% | 11% | 43% | 60% |

## Does the load advance as often as the lifter's? (sanity check, not a tuning target)

His history is one lifter's behaviour, not a standard; he may under- or over-progress. This only shows where the evidence-based rule is more conservative or more aggressive than he was.

| Range | Rule proposed a heavier load | Lifter actually went heavier | Rule held/lowered while he went up (rule more conservative) | Rule went up while he held/lowered (rule more aggressive) | Rule proposed lighter | Lifter went lighter |
|---|---|---|---|---|---|---|
| 4-8 | 2% | 26% | 26% | 2% | 3% | 13% |
| 6-10 | 0% | 26% | 26% | 0% | 8% | 13% |
| 8-12 | 0% | 26% | 26% | 0% | 15% | 13% |
| 10-15 | 0% | 26% | 26% | 0% | 28% | 13% |

Reference, rule-v0.1 on the same data (recomputed on main before this change). Same load as lifter: 54% (4-8), 54% (6-10), 42% (8-12), 32% (10-15). Rule proposed a heavier load: 6%, 1%, 0%, 0%. Rule proposed lighter: 3%, 8%, 29%, 48%. Repeat-last-load baseline: 60%.

### Which published trigger? (all use the same policy code; only the trigger differs)

| Preset | Range | Same load as lifter | Rule proposed heavier | Lifter went heavier | Baseline: repeat last load |
|---|---|---|---|---|---|
| default (2 sessions at top) | 4-8 | 56% | 2% | 26% | 60% |
| default (2 sessions at top) | 6-10 | 55% | 0% | 26% | 60% |
| default (2 sessions at top) | 8-12 | 51% | 0% | 26% | 60% |
| double_progression | 4-8 | 53% | 6% | 26% | 60% |
| double_progression | 6-10 | 55% | 1% | 26% | 60% |
| double_progression | 8-12 | 51% | 0% | 26% | 60% |
| acsm_2009 | 4-8 | 56% | 0% | 26% | 60% |
| acsm_2009 | 6-10 | 55% | 0% | 26% | 60% |
| acsm_2009 | 8-12 | 51% | 0% | 26% | 60% |
| two_for_two | 4-8 | 57% | 0% | 26% | 60% |
| two_for_two | 6-10 | 55% | 0% | 26% | 60% |
| two_for_two | 8-12 | 51% | 0% | 26% | 60% |

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

## By currency spent (range 6-10)

| Currency | Proposals | Same load as lifter | Lifter met or beat it |
|---|---|---|---|
| reps | 318 | 59% | 51% |
| quality | 3 | 33% | 67% |
| load | 22 | 5% | 86% |
| effort | 0 | n/a | n/a |

## By confidence (range 6-10)

| Confidence | Proposals | Same load | Met or beat |
|---|---|---|---|
| low | 41 | 34% | 71% |
| medium | 86 | 49% | 50% |
| high | 216 | 62% | 52% |

## Per exercise (range 6-10, lifts with 4+ sessions)

| Exercise | Next sessions checked | Same load | Same load and reps | Met or beat | Proposed heavier | Repeat-last baseline | Last proposal vs what was done |
|---|---|---|---|---|---|---|---|
| Lat Pulldown (Cable) | 32 | 69% | 19% | 47% | 9% | 72% | 75x6 vs 75x4 |
| T Bar Row | 25 | 60% | 12% | 52% | 8% | 68% | 45x6 vs 45x6 |
| Triceps Pushdown | 24 | 58% | 13% | 50% | 13% | 58% | 37.5x8 vs 37.5x7 |
| Chest Press (Machine) | 22 | 64% | 5% | 41% | 9% | 64% | 60x7 vs 65x6 |
| Seated Cable Row - V Grip (Cable) | 22 | 59% | 23% | 50% | 18% | 59% | 50x9 vs 55x7 |
| Bench Press (Barbell) | 21 | 52% | 5% | 48% | 5% | 71% | 70x6 vs 70x5 |
| Bicep Curl (Barbell) | 21 | 62% | 5% | 62% | 10% | 67% | 25x10 vs 25x8 |
| Reverse Curl (Barbell) | 20 | 60% | 10% | 55% | 10% | 65% | 25x6 vs 25x5 |
| Butterfly (Pec Deck) | 18 | 56% | 17% | 50% | 11% | 67% | 25x6 vs 25x5 |
| Single Arm Lateral Raise (Cable) | 18 | 56% | 17% | 61% | 17% | 61% | 7.5x9 vs 7.5x8 |
| Single Arm Tricep Extension (Dumbbell) | 18 | 56% | 22% | 56% | 22% | 56% | 10x6 vs 10x3 |
| Hammer Curl (Dumbbell) | 15 | 47% | 7% | 53% | 20% | 47% | 16x7 vs 16x7 |
| Incline Bench Press (Dumbbell) | 12 | 58% | 8% | 42% | 8% | 67% | 22x6 vs 24x5 |
| Lateral Raise (Dumbbell) | 10 | 40% | 20% | 60% | 20% | 40% | 10x9 vs 12x10 |
| Seated Calf Raise | 9 | 33% | 22% | 67% | 22% | 33% | 20x9 vs 15x13 |
| Leg Extension (Machine) | 8 | 50% | 13% | 50% | 13% | 50% | 50x9 vs 50x9 |
| Seated Leg Curl (Machine) | 7 | 43% | 14% | 57% | 14% | 43% | 50x7 vs 47.5x8 |
| Rear Delt Reverse Fly (Machine) | 5 | 60% | 0% | 20% | 20% | 60% | 15x10 vs 15x8 |
| Seated Shoulder Press (Machine) | 5 | 20% | 0% | 60% | 40% | 20% | 30x7 vs 25x7 |
| Seated Palms Up Wrist Curl | 5 | 40% | 20% | 80% | 0% | 40% | 12.5x10 vs 12.5x6 |
| Leg Press Horizontal (Machine) | 4 | 75% | 25% | 100% | 0% | 75% | 90x10 vs 90x12 |
| Concentration Curl | 4 | 0% | 0% | 100% | 0% | 100% | 12.5x8 vs 14x10 |
| Shoulder Press (Dumbbell) | 3 | 67% | 33% | 67% | 33% | 67% | 12x6 vs 12x6 |
| Bicep Curl (Dumbbell) | 3 | 67% | 0% | 33% | 33% | 67% | 14x6 vs 14x7 |
| Overhead Triceps Extension (Cable) | 3 | 0% | 0% | 67% | 33% | 0% | 60x10 vs 15x18 |
| Face Pull | 3 | 67% | 33% | 100% | 0% | 67% | 15x10 vs 17.5x8 |
| Back Extension (Weighted Hyperextension) | 3 | 100% | 0% | 33% | 0% | 100% | 10x9 vs 10x8 |
| Bicep Curl (Cable) | 3 | 0% | 0% | 67% | 33% | 0% | 30x7 vs 25x7 |

