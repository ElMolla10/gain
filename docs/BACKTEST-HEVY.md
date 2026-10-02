# Backtest of rule-v0.1 on a Hevy export

Rows: 1049, workouts: 70, 2025-09-22 to 2026-09-29. Parser warnings: 0.

**What this measures:** for each session of a lift, the rule proposes from everything *before* that session; we compare with what the lifter actually did. This is agreement with the lifter, not proof that the rule is right.

**Assumptions (a Hevy export has neither):** the load grid per equipment class is inferred as the greatest common divisor of every logged load in that class; the rep range is a single default per run (sensitivity below); no effort data (RPE is empty), so the effort currency never fires; no rejection history. Compared on the hardest working load of the session and the minimum reps at it; warm-ups are not in the export, drop sets are excluded.

## Sensitivity to the assumed rep range

| Range | Proposals | Same load as lifter | Same load and reps | Lifter met or beat it | Proposed heavier than lifter did | Proposed lighter | Baseline: repeat last load |
|---|---|---|---|---|---|---|---|
| 4-8 | 343 | 54% | 15% | 59% | 17% | 29% | 60% |
| 6-10 | 343 | 54% | 13% | 55% | 14% | 33% | 60% |
| 8-12 | 343 | 42% | 6% | 56% | 12% | 46% | 60% |
| 10-15 | 343 | 32% | 2% | 60% | 10% | 57% | 60% |

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
| reps | 300 | 59% | 52% |
| quality | 15 | 40% | 73% |
| load | 28 | 4% | 75% |
| effort | 0 | n/a | n/a |

## By confidence (range 6-10)

| Confidence | Proposals | Same load | Met or beat |
|---|---|---|---|
| low | 41 | 34% | 71% |
| medium | 86 | 49% | 50% |
| high | 216 | 59% | 54% |

## Per exercise (range 6-10, lifts with 4+ sessions)

| Exercise | Next sessions checked | Same load | Same load and reps | Met or beat | Proposed heavier | Repeat-last baseline | Last proposal vs what was done |
|---|---|---|---|---|---|---|---|
| Lat Pulldown (Cable) | 32 | 69% | 19% | 47% | 9% | 72% | 72.5x6 vs 75x4 |
| T Bar Row | 25 | 56% | 12% | 56% | 8% | 68% | 45x6 vs 45x6 |
| Triceps Pushdown | 24 | 58% | 13% | 50% | 13% | 58% | 37.5x8 vs 37.5x7 |
| Chest Press (Machine) | 22 | 45% | 5% | 50% | 14% | 64% | 60x7 vs 65x6 |
| Seated Cable Row - V Grip (Cable) | 22 | 59% | 23% | 50% | 18% | 59% | 50x9 vs 55x7 |
| Bench Press (Barbell) | 21 | 38% | 5% | 62% | 5% | 71% | 70x6 vs 70x5 |
| Bicep Curl (Barbell) | 21 | 67% | 10% | 62% | 10% | 67% | 25x10 vs 25x8 |
| Reverse Curl (Barbell) | 20 | 65% | 10% | 55% | 10% | 65% | 25x6 vs 25x5 |
| Butterfly (Pec Deck) | 18 | 67% | 17% | 44% | 11% | 67% | 25x6 vs 25x5 |
| Single Arm Lateral Raise (Cable) | 18 | 61% | 17% | 56% | 17% | 61% | 7.5x9 vs 7.5x8 |
| Single Arm Tricep Extension (Dumbbell) | 18 | 50% | 17% | 56% | 22% | 56% | 10x6 vs 10x3 |
| Hammer Curl (Dumbbell) | 15 | 47% | 7% | 53% | 20% | 47% | 16x7 vs 16x7 |
| Incline Bench Press (Dumbbell) | 12 | 50% | 8% | 50% | 8% | 67% | 22x6 vs 24x5 |
| Lateral Raise (Dumbbell) | 10 | 40% | 20% | 60% | 20% | 40% | 10x9 vs 12x10 |
| Seated Calf Raise | 9 | 33% | 22% | 67% | 22% | 33% | 20x9 vs 15x13 |
| Leg Extension (Machine) | 8 | 50% | 13% | 50% | 13% | 50% | 50x9 vs 50x9 |
| Seated Leg Curl (Machine) | 7 | 43% | 14% | 57% | 14% | 43% | 50x7 vs 47.5x8 |
| Rear Delt Reverse Fly (Machine) | 5 | 60% | 0% | 20% | 20% | 60% | 15x10 vs 15x8 |
| Seated Shoulder Press (Machine) | 5 | 20% | 0% | 60% | 40% | 20% | 30x7 vs 25x7 |
| Seated Palms Up Wrist Curl | 5 | 40% | 20% | 80% | 0% | 40% | 12.5x10 vs 12.5x6 |
| Leg Press Horizontal (Machine) | 4 | 50% | 25% | 75% | 25% | 75% | 92.5x6 vs 90x12 |
| Concentration Curl | 4 | 0% | 0% | 100% | 0% | 100% | 12.5x8 vs 14x10 |
| Shoulder Press (Dumbbell) | 3 | 67% | 33% | 67% | 33% | 67% | 12x6 vs 12x6 |
| Bicep Curl (Dumbbell) | 3 | 67% | 0% | 33% | 33% | 67% | 14x6 vs 14x7 |
| Overhead Triceps Extension (Cable) | 3 | 0% | 0% | 67% | 33% | 0% | 62.5x6 vs 15x18 |
| Face Pull | 3 | 67% | 33% | 100% | 0% | 67% | 15x10 vs 17.5x8 |
| Back Extension (Weighted Hyperextension) | 3 | 100% | 0% | 33% | 0% | 100% | 10x9 vs 10x8 |
| Bicep Curl (Cable) | 3 | 0% | 0% | 67% | 33% | 0% | 30x7 vs 25x7 |

