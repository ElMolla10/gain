# Experimental next-set evaluation

The current offline model predicts repetitions for a proposed next-set load. It does not prove that the lifter could have done more reps, assess injury risk or replace deterministic next-session progression. The model remains unchanged; live increase eligibility was tightened in the phase-1 follow-up below.

## Live increase eligibility — phase 1 follow-up

A high next-set forecast alone is insufficient to recommend an increase. Both decision entry points now apply the same observed-performance checks:

- Reported RPE must be finite, between 1 and below 9, with observed reps at least at the target maximum.
- Missing RPE is not a blanket veto, but requires observed reps at least two above the target maximum.
- Any decline from the first working set vetoes an increase, even if the model predicts a rebound. This is deliberately conservative when set loads differ.
- The existing high-forecast threshold, available-equipment step, maximum 5% increase, and heavier-candidate inference checks still apply. Explicit symptom stops take precedence.

For a 6–10 range, 8 or 10 observed reps with missing RPE cannot trigger an increase solely because the model predicts 13. Twelve observed reps without a decline can remain eligible. These thresholds are conservative product rules, not calibrated probabilities or proof of safety. An unreported failure cannot be reliably inferred from rep count; real-session review remains required.

## Observed fatigue — phase 3 follow-up

A drop from at least six first-set reps to at most two reps after two or more working sets can trigger the existing reassessment/stop message for a target minimum of four or more. Two consecutive sets of at most two reps at comparable loads can also trigger it when the target minimum is at least four. The phone counts these from logged rows. The check now runs before inference: an optimistic forecast or unavailable model cannot suppress it. The mobile context supplies both observed loads; a deliberately heavier later set is not treated as the same-load collapse. Legacy callers without load metadata retain the earlier comparability assumption.

Observed-only stops carry `predictionAvailable: false`: their numeric compatibility field is not a forecast and is neither shown as an estimate nor captured for model scoring. Explicit symptom stops also bypass inference. Low-rep targets remain supported. These are conservative product rules, not a diagnosis or a validated injury-risk model.

## Collection and matching

Eligible forecasts are captured automatically and kept locally in `ml_prediction`, outside cloud sync. There is no opt-in capture toggle. A full backup includes local evaluation records; a dedicated export is available in Settings > Developer Mode > ML Accuracy. Export opens the native share sheet and sends nothing automatically. To reveal Developer Mode, touch and hold the version in Settings > About, or tap it seven times within five seconds. Hiding these tools does not stop local forecast capture.

The first pre-outcome forecast for each target set/model is frozen. Set identity, confirmed working-set eligibility and actual load must match. Edited/deleted/skipped/special sets and corrected source histories are invalidated. Pending outlier results wait for confirmation. No replay or historical import creates pre-outcome forecasts. Headline and report eligibility use one shared SQL filter.

## Paired benchmarks

| Benchmark | Prediction | Eligible inputs |
| --- | --- | --- |
| Repeat previous | Previous observed reps | Frozen previous reps 1–50 and unchanged load |
| Load-adjusted | `clamp(30 × (Epley(1, previous reps) / load ratio − 1), 0, 50)`; unchanged load returns previous reps | Previous reps 1–30; next/previous load ratio 0.8–1.05 |

`Epley` is the engine's existing within-line yardstick (`line.ts`), not a capacity claim. The load-adjusted benchmark assumes unchanged estimated capacity and ignores rest and between-set fatigue. These are transparent rule benchmarks, not a tuned personalized model. No benchmark is used to change a workout.

Model and benchmark MAE use exactly the same observations within each comparison. Positive `maeImprovement` is baseline MAE minus model MAE. The model-wide MAE can have a different denominator. Preserve fractional predictions; ±1 and ±2 thresholds are inclusive. `meanOverprediction` is predicted minus logged reps (positive means overprediction); the existing database `signed_error` uses the opposite sign.

JSON includes eligible forecast samples with export-local session group labels (no raw session IDs), paired wins/ties/losses, exercise breakdowns, known prior-first-set availability, and feature missingness. Missing prior history is not proof of a first-ever exercise. Coverage refers to captured forecasts for this model, not all suggestions or all workout sets. Excluded current-state records are stored evaluated rows that no longer pass current eligibility checks.

## Reproduce an export

From the repo root after `npm ci`:

```bash
node --import tsx apps/mobile/scripts/ml-evaluation-report.ts /path/to/gain-ml-evaluation.json
```

This recomputes summaries from frozen inputs and outcomes. It does not call inference, retrain the model, or access the network. Exports are overlapping snapshots: use one latest export per device rather than appending repeated exports. Session group labels are local to each export and do not identify sessions across devices.

The file contains fitness observations and exercise IDs even though raw session/set identifiers are omitted; inspect it before sharing.

## Real-data validation still required

1. Run the existing build on an iPhone and verify forecast capture before logging, confirm/unconfirm, edit, skip, restart, and share-sheet export. Record device/OS/build.
2. Gather voluntary exports from normal training, preserve per-device separation, and inspect exclusion rates. Do not pool correlated sets as independent people.
3. Compare paired MAE and overprediction by exercise, load-change band, history availability and feature coverage. Report counts and missing benchmark coverage. Use session/user-level uncertainty intervals before general claims.
4. Compare to more personalized rules using chronological held-out sessions if enough real history exists. Avoid tuning on the evaluation set.
5. Assess usefulness separately: chosen rep targets can censor actual performance. These metrics score logged reps only; they do not establish measured capacity, calibration, recommendation acceptance, safety or strength gains.

No real-user accuracy numbers are claimed by the tests. Empty or missing cohorts yield null errors, not perfect accuracy. There is no confidence badge without a calibrated method.
