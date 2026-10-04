# Weekly review rules (weekly-v1, Step 3)

Code: `packages/engine/src/weekly.ts` (rule), `apps/mobile/src/db/weeklyRepo.ts` (reads logs, stores, applies a date move), `apps/mobile/src/components/WeeklyReviewCard.tsx` (card on Today). Table `weekly_review` (migration 4).

## What it does

Once a training week is over, Today shows one card: **what the logs show** (sessions finished of planned, goal pace status) kept visually apart from **one proposed change** and its reason. The lifter taps **do it**, **use another date** (date moves only) or **skip**. Nothing changes without a tap. At most one review per week; it is created on first view and kept unchanged until decided; a decided week is not shown again.

The week starts on Monday unless the lifter picks another day in Settings. Weeks are computed in the phone's local time.

## Rule (first match wins)

1. Under 14 days of logged history, or nothing logged in the week and the two before: **keep**, marked "too little data".
2. No goal: keep. Goal reached: propose a new goal. Goal pace too thin: keep, marked thin.
3. Two full weeks (planned sessions done this week and the week before) and the goal lift's estimated 1RM fell by at least 2% in each of the last two sessions: **easier week** as one option. The text says the app cannot tell why the numbers fell. No claim about fatigue or recovery.
4. On pace or ahead: keep.
5. Behind pace:
   - a short week (fewer than planned minus one): keep (a missed week is not a plan failure);
   - the projected date is more than 28 days after the goal date, or the date has passed, and there is a projection: **move the goal date** to the projected date;
   - lift goal, full week, flat or falling rate: **two-week variation**;
   - lift or muscle goal otherwise: **one more exposure** of the goal next week;
   - bodyweight goal: keep.

## What accepting does

- Move the date: edits the goal's target date (the only automatic change). The lifter may type another date instead.
- Everything else (extra exposure, variation, easier week, new goal): the decision is recorded and the card says plainly that the program is NOT edited; the lifter makes the change in the Program tab. (An automatic program edit is not built.)

Decisions are kept in `weekly_review` (inputs, proposal, what was applied, status, time) and listed in the Goals screen under "Past weekly reviews". They are not in `decision_log` because that table is keyed to a target.

## Defaults awaiting Mohamed

Which day the week starts (Monday default, changeable); whether the review should be a notification (there are no notifications yet, it is a card on Today); the 28-day slip and the 2% fall thresholds.
