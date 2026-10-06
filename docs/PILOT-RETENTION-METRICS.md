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
- **Planned vs done** = finished sessions divided by the program days the lifter said they could train that week (from the check-in).
- **Target outcome** (per next-session target of a rule-written target, from the JSON backup table `target`, column `status`): accepted / edited / rejected / proposed (never acted on). Share of each. `edited_load` holds the lifter's own load for an edit.
- **Agreement with the app** (`comparable`, `loaded_same`, `loaded_more`, `loaded_less`) = compare the app's finite, non-negative numeric target with the hardest counted working set actually logged on that target's exact line in the finished, non-imported session. Counted sets have a finite, non-negative stored load and exclude warm-ups, drop sets, unconfirmed or rejected outliers, and deleted rows. The line is usable only when the backup establishes a matching exercise id, a valid stored equipment type, a non-empty gym id and a valid setup (`free`, `assisted`, or `bodyweight_plus_added`); missing or invalid metadata is excluded, never defaulted to free. Soft-deleted exercise/line rows remain usable as historical metadata. The number compared is the weight that was set: bar or machine load, added plate, or assistance pin. Bodyweight is not added or subtracted, and `bodyweight_entry` is not read. For `assisted`, the hardest set is the smallest pin and "more" means less assistance. For `free` and `bodyweight_plus_added`, a larger stored load is more. "Same" means within 0.01 kg of that stored load. Reps are not compared. Equipment `assisted` together with a non-assisted setup is excluded, so an assistance pin is never scored as ordinary lifted weight. An explicit `assisted` setup is scored as assistance even when the equipment is not `assisted`. If the session row has a gym id, it must equal the line's gym; a missing session gym leaves the line gym in place, and a non-text or different session gym drops that session's sets. Target status (accepted/edited/rejected/proposed) is reported separately: an edited target is still compared with the app's original target number. This is the number to compare against "repeat last weight" computed from the same data (the Hevy backtest did 58% vs 60% for one lifter; see BACKTEST-HEVY.md).
- **Repeat-last baseline** (`both_comparable`, `both_app_same`, `both_repeat_same`) uses a strict subset of `comparable`: the target must also have an earlier finished session (imported history counts) with a counted working set on the SAME stored line identity: exercise id, gym id, equipment and setup. The newest earlier session with a counted set on that line supplies the baseline load, which is that session's hardest stored load under the same rule. Another gym, equipment variant or setup is never substituted. A session whose stored gym disagrees with the line is not a counted session, so an older session that does agree can still be the baseline. `both_app_same` means the lifter set the app's number; `both_repeat_same` means the lifter set that previous number. Fixed in v0.21.0 for line identity and assisted direction. A later revision compared bodyweight-adjusted load and dropped non-free lines with no bodyweight; this version does not. Recompute any sheet made by an earlier tool version from the original backups. No real pilot export is in the repo. The synthetic P00 file is free-weight only, so its published counts do not move.
- **Override reason** = the lifter's answer to "why not the app's number?" asked in the weekly check-in, in their words, tagged afterwards (too heavy / too light / equipment / felt bad / forgot / other). Not collected in-app.
- **On pace** = the `pace` status the Goals screen showed on the check-in day (the lifter reads it out or screenshots it); count ahead / on pace / behind / too thin.

Tooling: `npm run pilot-metrics -w @gain/mobile -- --tz-minutes 180 /full/path/P01.json ...` computes these from backups (see [PILOT-KIT.md](PILOT-KIT.md) section 5), including the like-for-like comparison with "repeat the last weight" (`both_comparable`, `both_app_same`, `both_repeat_same`). The denominator is therefore visible: `comparable` is every usable app-vs-logged comparison; `both_comparable` is only the usable like-for-like subset that also has a previous stored load. Synthetic-tested, not yet run on a real pilot file. The override-reason sheet (one row per overridden target) is [pilot/override-sheet-template.csv](pilot/override-sheet-template.csv).

## Weekly check-in (3 questions, sent at the end of weeks 1, 2, 3, 4, 5, 6)
1. How many days could you train this week, and how many did you? (number, number)
2. For each exercise where you did NOT load the app's number: what did you load and why? (free text)
3. Did anything break or confuse you? (free text; also record the app version shown in Settings)

## Pilot sheet (one row per lifter per week)
| Pilot code | Week | Sessions done | Active | Targets accepted | edited | rejected | never acted on | Comparable | Loaded same | more | less | Both comparable | Both app same | Both repeat same | Days planned | App version | On-pace status | Bugs / quotes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

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
The same definitions hold. Crash-free sessions need a crash service that does not exist yet; they are not part of this document. GAIN is completely free, so there is no conversion or revenue metric.
