# Weekly review rules (weekly-v1, Step 3)

Code: `packages/engine/src/weekly.ts` (rule), `apps/mobile/src/db/weeklyRepo.ts` (reads logs, stores, applies a date move), `apps/mobile/src/db/weeklyPlanRepo.ts` (applies and reverts a program change), `apps/mobile/src/components/WeeklyReviewCard.tsx` (card on Today). Table `weekly_review` (migration 4; program-change columns in migration 18).

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

- Move the date: edits the goal's target date. The lifter may type another date instead.
- Keep / new goal: the decision is recorded; nothing changes.
- Easier week, one more exposure, two-week variation: **Do it** opens a preview sheet first (for example "This week: + Bench press on Lower A (3 × 8 @ 80 kg)") with **Apply** and **Cancel**. The program changes only on Apply. The change is saved as a NEW, temporary program version, the same way as the deload "fewer sets" mode:
  - easier week: one set fewer on every exercise (at least 1), loads unchanged, until the end of this training week;
  - one more exposure: one session's worth of the goal lift (the sets, rep range and settings of its slot in the program; the preview shows its current target) is added at the end of the next program day in the rotation that does not already have it, until the end of this training week;
  - two-week variation: the goal lift is swapped in every slot for its highest-ranked substitution at the active gym (one not in the program yet first, never one already on a day that has the goal lift), until the end of next training week. The variation is another exercise, so it has its own line and history.
- `weekly_review` keeps `original_version_id` and `applied_version_id` (plus `ends_at`, `ended_at`, `ended_how`). While the change is on, Today shows it with an **Undo** chip. At `ends_at`, or on Undo, the original version's days and exercises come back as another new version. No version is ever deleted, so sessions logged on any version stay readable. A workout in progress postpones the revert to the next time Today opens.
- If the lifter saved their own program edit after the change was applied, nothing is reverted on its own: a two-option sheet asks **keep my edits** or **restore original**.
- The decision is only recorded (the program is not edited, and the card says why) when: a short week is on; a deload is on (an easier week is never stacked on a deload, and any change is refused while a deload "fewer sets" version is on, because that version would lose its own way back); an earlier weekly change is still on; the goal lift is not in the program (or the goal is not a lift); every program day already has the goal lift; no substitution fits the gym; or the change would not alter the program. While an easier week from the review is on, the deload card does not suggest a deload.

Decisions are kept in `weekly_review` (inputs, proposal, what was applied, status, time) and listed in the Goals screen under "Past weekly reviews". They are not in `decision_log` because that table is keyed to a target.

## Defaults awaiting Mohamed

Which day the week starts (Monday default, changeable); whether the review should be a notification (there are no notifications yet, it is a card on Today); the 28-day slip and the 2% fall thresholds.
