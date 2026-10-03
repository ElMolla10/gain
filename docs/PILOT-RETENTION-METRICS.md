# Pilot retention and agreement metrics, without analytics (Steps 20 and 29)

Status: **DOC ONLY. No pilot has started. No threshold is set** (thresholds are Mohamed's, D5, and must be written down BEFORE the pilot).

GAIN has no analytics SDK, no event tracking and no server-side usage counting (the sync server stores a lifter's data only if the lifter turned sync on, and is not used for metrics). So pilot numbers come from three honest sources:
1. The lifter's own export, handed over with consent (Settings > Your data: JSON backup or CSV).
2. A short weekly check-in (a message or a form the lifter answers).
3. The pilot sheet kept by the person running the pilot.

Do not add event analytics for the pilot. If one is ever added (Step 18 says opt-in only), the privacy policy, the in-app page and the Play data-safety form change first.

## Consent
Before taking any export: say what is taken (workouts, sets, targets and the accept/edit/reject status; no name needed), why, who sees it, how long it is kept, that it can be deleted on request. Record the yes in the pilot sheet. Use a pilot code (P01, P02...) instead of a name in files.

## Definitions (use exactly these, so weeks are comparable)
- **Week 0** = the 7 days starting the day the lifter first logs a finished workout in GAIN (imported history does not count; imported sessions have `import_key` set in the JSON backup table `session`).
- **Active in week N** = at least 1 finished session (not imported) whose `finished_at` falls in days 7N to 7N+6 after week 0 starts. Local time of the phone.
- **Retained at week 1 / 2 / 6** = active in that week N. Report the count of lifters retained out of the number who reached that week's calendar date (a lifter who has not yet reached week 6 is not counted as lost). Also report "returned after a gap" separately; do not average it away.
- **Sessions per active week** = finished sessions in the week, per lifter, then the median across lifters.
- **Planned vs done** = finished sessions divided by the programme days the lifter said they could train that week (from the check-in).
- **Target outcome** (per next-session target of a rule-written target, from the JSON backup table `target`, column `status`): accepted / edited / rejected / proposed (never acted on). Share of each. `edited_load` holds the lifter's own load for an edit.
- **Agreement with the app** = share of targets where the load actually logged for that exercise in the next session equals the target load (accepted), or the lifter's edit is within one real gym step. Report separately the share where the lifter loaded MORE than the target and LESS than the target. This is the number to compare against "repeat last load" computed from the same data (the Hevy backtest did 58% vs 60% for one lifter; see BACKTEST-HEVY.md).
- **Override reason** = the lifter's answer to "why not the app's number?" asked in the weekly check-in, in their words, tagged afterwards (too heavy / too light / equipment / felt bad / forgot / other). Not collected in-app.
- **On pace** = the `pace` status the Goals screen showed on the check-in day (the lifter reads it out or screenshots it); count ahead / on pace / behind / too thin.

Tooling: `npm run pilot-metrics -w @gain/mobile -- --tz-minutes 180 P01.json ...` computes these from backups (see [PILOT-KIT.md](PILOT-KIT.md) section 5); synthetic-tested, not yet run on a real pilot file.

## Weekly check-in (3 questions, sent at the end of weeks 1, 2, 3, 4, 5, 6)
1. How many days could you train this week, and how many did you? (number, number)
2. For each exercise where you did NOT load the app's number: what did you load and why? (free text)
3. Did anything break or confuse you? (free text; also record the app version shown in Settings)

## Pilot sheet (one row per lifter per week)
| Pilot code | App version | Week | Days planned | Sessions done (from export) | Targets accepted | edited | rejected | never acted on | Loaded more than target | Loaded less | On-pace status | Bugs / quotes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

## How to read the numbers
- About 10 lifters, all friendly, one gym: percentages move by 10 points when one person drops. Report counts ("6 of 9"), not only percentages. No significance claims.
- Do not tune the rule to ten people. Any rule change goes through the trainer review (TRAINER-REVIEW-PACK.md) first.
- A lifter who stops logging may still be training (on paper, in another app). Ask before calling it churn.
- Imported history inflates "sessions per week" if mixed in; always filter `import_key IS NULL`.
- Retention at week 6 needs 6 weeks of elapsed time; there is no shortcut.

## Written before the pilot (Mohamed fills in; the builder does not choose these)
| Question | Threshold set by Mohamed | Date set |
|---|---|---|
| Week-1 retention counts as good at | | |
| Week-6 retention counts as good at | | |
| Agreement with the app counts as good at | | |
| Share of targets rejected that makes the rule suspect | | |

## Later (Step 29, after launch)
The same definitions hold. Trial-to-paid and crash-free sessions need billing and a crash service that do not exist yet; they are not part of this document.
