# Experimental real-world ML accuracy

Settings > ML Accuracy reports on-device Live Workout Adaptation v2 forecasts for the current model version (`schema.json.model_version`). It starts with zero evaluations. Training metrics, reference predictions, benchmarks, imported workouts and synthetic test fixtures never populate it. No evaluation data is uploaded: `ml_prediction` is absent from the sync allowlist. Full local JSON backups include it; CSV workout exports do not.

## What is recorded

When the logger generates a next-set card after eligible saved working sets, it stores a pending record with model version, session/exercise IDs, the target draft's stable set ID, the raw predicted repetitions, the policy's suggested weight in kg, generation time, feature snapshot for that weight and source set IDs. The first forecast for each target/model wins. Renders, retries, typing achieved reps and policy candidate searches do not add records or rewrite its prediction. Stop/symptom cards, failed inference and targets with already typed reps are excluded. Capture failures do not change progression or prevent workout logging.

The chosen prediction can be for a different weight from the original planned load. Its feature snapshot uses the same chosen weight; it does not pair a heavier/lighter forecast with the original weight. No model or progression rule is changed.

Capture uses the existing separate maintenance database connection. Its transaction cannot roll back a concurrent workout save on the UI connection. Matching triggers remain part of the set write itself.

## Matching and lifecycle

- SQLite triggers resolve the pending record atomically with the corresponding `workout_set` write. Session, exercise and stable set ID must match. Load must match exactly in stored kg and the existing load convention; nearby weights are not treated as equivalent.
- The result must be a reps-based, positive-load working set, on a free setup without assisted equipment, warm-up/drop/failure tags, deletion or rejection. Ordinary `none` outlier status is trusted; `unconfirmed` stays pending and only counts after confirmation of unchanged numbers. Confirmation can occur after finishing the workout.
- Changed result load/reps/type, deletion, loss of confirmation, or corrections/deletions to source history permanently invalidate a record. Editing a result never makes a forecast look better. No-op saves and repeated confirmations preserve the evaluation.
- Logging another set while an unlogged forecast is pending changes its context and invalidates that forecast. Removing an unsaved row, removing/replacing its exercise, or finishing without logging it marks it skipped. Skipping/deleting the whole session excludes its records.
- On resume, an unlogged pending target's ID is rebound to the next unsaved normal row. Its numbers are not restored or invented. Result matching never uses set position. If all planned rows are already logged, there is no new target to bind; finishing closes it as skipped.
- Full JSON backup/restore preserves evaluated, pending and invalid records; older backups have none and restore to zero scores. Delete-all removes them. Cloud backup replacement does not import evaluations and clears records whose local parent history is replaced. Corrections arriving through optional workout sync can invalidate local evaluations, but evaluation records themselves never sync.

## Calculations

For each valid matched record, `signed_error = actual_reps - predicted_reps` (positive means underprediction) and `absolute_error = abs(signed_error)`. The model's raw fractional prediction is used, not the rounded card text.

For N valid evaluations of the current model:

- Mean absolute error = sum of absolute errors / N, in repetitions.
- Within ±1 rep = 100 × count(absolute error ≤ 1) / N.
- Within ±2 reps = 100 × count(absolute error ≤ 2) / N.

Thresholds are inclusive. Missing/invalid/skipped predictions never enter any denominator and are not counted as zero-error successes. With N = 0, the app shows an empty state instead of percentages or a fabricated accuracy. Settings reloads metrics whenever it receives focus. The UI rounds MAE for display and percentages to one decimal; stored errors and aggregation retain their precision.

## Limits

These metrics compare a forecast with self-reported logged repetitions, not measured maximal capacity, training benefit, injury risk or causal model improvement. A lifter may stop at the program's target while capable of more. Small samples and repeated sets from the same lifter/session are not independent and cannot establish general population accuracy. Only users/sets that remain eligible and perform the suggested weight contribute: mismatched, skipped and edited outcomes are excluded, creating selection bias. N is essential context; this foundation does not report confidence intervals or a baseline comparison.

The first forecast is frozen to reduce outcome leakage. If weights, source performance or context later change, that target may be excluded rather than reforecast and counted. Historical source invalidation is deliberately conservative (all existing sets of the exercise, plus the current session's saved sets). Exact load equality may exclude tiny unit-conversion differences. The logger does not persist every unsaved row edit across process death; the evaluation restores target identity only, and a resumed set counts only if its performed weight still matches. Captures racing a save are refused if the result already exists; there is no retrospective forecasting. Clock timestamps are an audit aid, not the matching key.

Node SQLite tests, model parity and platform exports validate the implementation without measuring real-world accuracy. Native device testing and real workouts remain necessary, including a force-close/resume, a changed-weight set, an outlier confirmation, an edited/deleted result, and a backup/restore.
