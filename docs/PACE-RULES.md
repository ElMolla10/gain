# Goal pace rules (v0.5, Step 2)

Code: `packages/engine/src/pace.ts` (pure functions), `apps/mobile/src/db/goalRepo.ts` (reads the logs), `apps/mobile/src/logic/paceText.ts` (sentences).

Pace is an **estimate from the lifter's own logs**. It is not a prediction, not a promise, and says nothing about physique or health. Every result carries the numbers it used and the Goals screen prints them. The thresholds below are **defaults chosen by the builder and not yet confirmed by Mohamed** (MASTER-PLAN Step 2 asks him what "on pace" should mean).

## Two clocks

- **Calendar clock:** the target date the lifter typed (optional).
- **Exposure clock:** how often the lifter really trained the lift (or muscle) in the last 28 days. A missed week lowers the exposures per week. That moves the projected date later, or raises the rate needed to hit a fixed date. Nothing is rescheduled for the lifter.

Exposures per week = sessions in the last 28 days (the first session of a short history is not counted, so a weekly lifter reads 1.0) divided by the weeks covered, at least one week.

## Lift goal (target load x reps)

1. One **exposure** per finished session: the best Epley estimate (`load x (1 + reps/30)`) over working sets with 1-12 reps. Warm-ups, rejected sets and sets still waiting for an outlier confirm are left out. Imported history counts. All gyms/setups of the exercise count (pace is about the lift, not one rack).
2. Target = Epley of the goal (load x reps).
3. Current = median of the last 3 exposures.
4. Rate = Theil-Sen slope (median of pairwise slopes) of the last 8 exposures, in kg of estimated 1RM per session. A single odd session cannot move it.
5. Status:
   - `reached`: current >= target.
   - `too_thin`: fewer than 4 exposures (or none). Says so, no number is invented.
   - With a date: needed rate = remaining / (weeks left x exposures per week). ratio = rate / needed. `ahead` >= 1.25, `on_pace` >= 0.85, otherwise `behind`. Flat or falling rate = `behind`. Date passed and not reached = `behind` (flagged).
   - Without a date: `on_pace` if the rate is positive, else `behind`.
6. Projected date = now + remaining / rate / exposures per week (only when the rate is positive).

## Bodyweight goal

1. Trend = median of the weigh-ins in the last 7 days (last 14 if none that recent). One heavy day (water, a big meal) moves it by at most one rank position.
2. `reached` when the trend is within 0.3 kg of the goal. `too_thin`: no entries, none in 14 days (`stale`), or fewer than 3 entries spread over under 7 days.
3. Slope = Theil-Sen over the last 28 days, kg per week. Direction is toward the goal if it has the same sign as (goal - trend).
4. With a date: needed = (goal - trend) / weeks left; same ratio thresholds (1.25 / 0.85) on the rate toward the goal. Moving away = `behind`.

## Muscle goal

Sessions per week that trained the muscle (a working set on an exercise of that muscle group) over the last 28 days, compared with a **default floor of 2 per week**. `on_pace` at or above the floor, `behind` below, `too_thin` in the first week. The floor is a default, not a finding.

## Tests

`packages/engine/src/pace.test.ts` (hand-computed cases: steady lifter ahead/on/behind by date, missed fortnight, flat, thin, outlier session; bodyweight losing/gaining, heavy day, thin, stale, reached; muscle), `apps/mobile/test/goals.test.ts` (database round-trip, words in English/Arabic/lb, replay of Mohamed's Hevy export).
