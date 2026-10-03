# Short-week rebuild rules (Step 4)

Code: `apps/mobile/src/logic/shortWeek.ts` (pure rule), `apps/mobile/src/db/shortWeekRepo.ts` (preview, save, undo, auto-return), `apps/mobile/src/screens/ShortWeekScreen.tsx`. Table `short_week` (migration 5).

Entry: Today > "Short week? Rebuild this week". The lifter picks the days they can train (1 .. programme days) and optionally minutes per session (30-90, estimated at 3 minutes per set like the rest of the app). **The preview shows every cut and the weekly-sets-per-muscle change before anything is saved.**

## Rule

1. **Which days stay:** the days with the most goal lifts, then the most sets of priority muscles, then original order.
2. **Goal lifts are never removed while any accessory can go.** A goal lift on a dropped day moves to the lightest kept day.
3. **Priority muscles** = the muscle of each goal lift, plus the muscle of a muscle goal. They keep a floor: at least `min(original, 6)` sets and `min(original, 2)` sessions in the week. Accessories of that muscle move from dropped days to keep it. If the floor cannot be kept, the preview says which muscle.
4. Everything else on a dropped day is cut and listed.
5. **Time budget** (per kept day), in this order until it fits: remove the last accessory of a non-priority muscle; trim an accessory with more than 2 sets (last first) while its muscle's floor holds; remove the last priority-muscle accessory only if the floor holds; as a last resort trim a goal lift's sets, never below 3. If it still does not fit, the preview says **over budget** and nothing else is cut. Goal lifts are never removed for time.
6. **Rest is not crushed:** the rebuild never merges a dropped day into a kept day beyond the time budget, and it does not touch rest times between sets.

## Saving, undo, return

Saving writes a **new programme version** of the active programme (old sessions stay readable) and records the original version in `short_week` with the cut list. The original returns as another new version when a new training week starts (checked when Today opens) or when the lifter taps Undo. If the lifter edited the programme during the short week, their edit is kept and nothing is overwritten. An open workout blocks both saving and returning (returning is retried next time Today opens). The programme version list therefore shows: normal (n), short week (n+1), normal again (n+2).

## What is not built

No calendar scheduling of which weekday each kept day lands on; the existing "next day" rotation continues. No per-session minutes entered by the lifter beyond the five choices. The rule is a plain description of common practice, not trainer-reviewed advice (a 2026-10-03 report that a trainer liked the workouts/templates does not confirm these short-week rules were reviewed).

## Switching programme during a short week (fixed after v0.9.0)

A short week belongs to the programme it was applied to. If the lifter switches to (or creates) another programme, the banner and the short-week screen do not show the old one, a preview/apply on the new programme is built from the NEW programme's own version (before the fix it was rebuilt from the old programme's original and saved into the new programme), and the old short week stays recorded. Switching back shows it again. When its week ends it is closed in the background: the old programme gets its normal version back without voiding or replanning today's plan on the active programme. Tests: `shortWeekRepo.test.ts` ("short week + programme switch").

## Fix in v0.14.0: a priority floor that cannot be met
A priority muscle's floor is at least min(original, 2) sessions. With 1 kept day that can never hold (found with the new templates, e.g. a back goal on `hypertrophy_ul_4`). The cut tiers used to ask "does every floor still hold?" and so refused to cut that muscle's accessories at all, and the time budget was then met by trimming the goal lift's sets while 3-set accessories remained (breaking rule 1). Now a floor that is already unmet only has to not get worse (sets and sessions no lower than now, capped at the floor). Floors that hold behave exactly as before. Hand test: `shortWeek.test.ts` "a priority floor that cannot be met...". A floor that cannot be met is still reported in `floorMissed`.

## Tests

`apps/mobile/test/shortWeek.test.ts`: hand-computed cases, and an invariant sweep over all templates (47 in v0.14.0) x 3 goal lifts x every day count x 5 time budgets (goal lifts kept, sets trimmed only when accessories have no spare sets, floors, every cut listed, budget met or flagged). `apps/mobile/test/shortWeekRepo.test.ts`: preview writes nothing, apply/undo/auto-return, edited programme kept, open workout refused, past sessions still readable.
