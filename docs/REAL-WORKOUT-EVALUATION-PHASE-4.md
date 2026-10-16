# Phase 4 — real-workout model evaluation

Status: evaluation tooling implemented; real-data collection, review and any model update remain pending. No real-workout export was available during this implementation. Automated fixtures are not evidence of real-user accuracy. The deployed model, trained features, deterministic progression and live decision policies are unchanged.

## Collect on iPhone

1. Pull the merged build, run a normal workout, and open Settings > Developer Mode > ML Accuracy (hold the About version or tap it seven times within five seconds). Capture stays local regardless of Developer Mode visibility.
2. Verify capture before logging the target set, unchanged-load matching, edits/skips, interrupted-workout recovery, outlier confirmation, and JSON sharing. Record build commit, device, OS and pass/fail separately from the export. See the native checklist; these new checks are unrun here.
3. Export the evaluation JSON through the share sheet. Inspect its fitness observations before sharing. Nothing is sent automatically. For another lifter, explain the fields and obtain their voluntary agreement; keep a separate latest export per device. Do not copy account identifiers into the evaluation files.
4. Keep raw exports immutable with access limited to the review team. Track an arbitrary participant/device alias in a private manifest, the build/model version, collection period, consent scope and whether two devices belong to the same person. Agree retention/deletion with each contributor. An export alias is not an independent lifter.
5. Record separately whether a set stopped at a chosen rep target or represented maximal effort, whether a suggestion was followed, and why it was overridden. Current exported observations cannot reliably establish these outcomes. Do not label missing RPE as failure or fabricate effort labels.

The existing capture scores only eligible working sets with frozen pre-outcome predictions at the actual logged load. It does not replay imported logs to manufacture prospective accuracy. Historical data can support later training experiments, but must not be presented as this prospective test.

## Analyze each latest export

From the repository root:

```bash
node --import tsx apps/mobile/scripts/ml-evaluation-report.ts /path/to/gain-ml-evaluation.json > /path/to/evaluation-summary.json
```

This is offline analysis, without inference, retraining or network access. It rejects invalid sample fields and inconsistent coverage totals and regenerates the scores. Summary output omits raw samples but still includes exercise IDs and aggregate fitness observations. Inspect summaries before sharing too.

Review in this order:

1. Captured, pending, invalidated and excluded counts; model version; evaluated sets and represented sessions. A low error on a selected handful of sets is weak evidence.
2. Paired model/baseline MAE and baseline coverage. Compare on identical eligible sets, never the model-wide score against a baseline with a smaller denominator.
3. Session-cluster intervals for paired MAE improvement. Positive favors the model. A null interval means insufficient grouped sessions; five sessions is only the reporting floor. Intervals crossing zero leave the direction unresolved.
4. Load changes, prior history, exercise and missing-input cohorts. Report sample counts; avoid highlighting only favorable slices.
5. Signed overprediction and the descriptive ≥3-rep tail. Review underlying cases manually; these are not validated safety events. No probability calibration can be inferred from a point forecast alone.
6. Usability evidence from the separate notes: acceptance, overrides, target-censored reps and confusing recommendations. Logging accuracy alone cannot establish utility or strength gains.

Keep participants separate in the initial report. Do not append overlapping snapshots or treat sessions/sets from one lifter as independent people. A later population study needs stable private participant grouping and participant-level analysis; the current export-local session labels cannot provide it.

## Decide before retraining

- Establish an exploratory collection period and a later untouched prospective evaluation period before changing a model. Record the cutoff, candidate definition, intended lifters/exercises, primary paired MAE comparison and acceptable regression limits before examining holdout outcomes. No fixed sample count here is claimed to guarantee adequate power.
- Diagnose missingness and input consistency first. Check equipment/load conventions, RPE meaning and changed-load coverage. Do not impute unreported effort as an observed label.
- If a candidate is justified, train only on consented development data. Split chronologically and by participant as appropriate; keep the later holdout out of preprocessing, tuning and selection. Preserve model/feature versioning and repeat the existing inference parity and policy guardrail tests.
- Compare the candidate with the current model and both baselines on identical untouched observations. Report uncertainty, exclusions, negative subgroups and descriptive error tails. Do not tune repeatedly against the holdout or promote from synthetic accuracy alone.
- Native-test any candidate in shadow evaluation before changing recommendations. Keep the live feature experimental until real evidence supports a stronger claim.

## Completion record

- Completed: reproducible offline analysis, strict shared-export validation, session-based uncertainty, descriptive cohorts and error tails, and workout count in Developer Mode.
- Pending: actual iPhone capture/export validation for this build, voluntary real-session exports, a reviewed results report, and an evidence-based decision on whether to change the model.
- No model was retrained or promoted in this phase. Real-data work remains a gate even if phase-5 release preparation proceeds.
