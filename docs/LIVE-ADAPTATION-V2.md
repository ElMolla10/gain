# Live Workout Adaptation v2

Integrated into the normal offline workout logger; PR #148 merged into `main` on user instruction. The real Universal Performance Model `2.0.0-experimental` is bundled. No account, opt-in, paid feature, network inference or native ML dependency is added. SQLite schema and next-workout deterministic progression are unchanged.

## Logger behavior

After a set is successfully persisted and re-read, GAIN shows a localized next-set card beneath the exercise. The card uses actual XGBoost inference, the user's rep range and the next row's planned load. Applying changes only the next unlogged normal row's ghost load; a manually entered load wins. Keeping the plan dismisses the card until confirmed performance changes. Neither action changes a logged set.

Only confirmed ordinary weighted rep sets in a free setup are supported. Warm-ups, drop/failure sets, time/distance exercises, bodyweight/assisted setups and unconfirmed/rejected outliers do not trigger ML. The latest saved exercise set must be eligible, and the next unlogged row must be normal. Missing/off-grid next loads retain the existing deterministic plan. A dirty saved row suppresses the card until updated successfully.

Session resume reconstructs context from SQLite. Edits, outlier confirmation, deletion and changes to the next row invalidate old cards. Scheduled work is cancelled on dependency changes or unmount; the rendered card also checks the saved-performance key and row snapshot before allowing application. Inference errors are recorded diagnostically and leave the existing plan available. The rest timer and save flow run independently.

## Feature contract

The exact 20-feature order comes from the bundled `schema.json` and is tested against the feature builder. Inputs concern the *next* set: history includes the just-completed confirmed set, `set_index` is one-based, and load ratios use the candidate load in kilograms.

- The workout-wide count excludes warm-ups, drop/failure sets, timed sets, known bodyweight/assisted exercises and unconfirmed/rejected outliers. Exercise aggregates use trusted normal weighted rep sets: previous/first reps, cumulative prior reps, average prior volume and working-set count.
- Target reps use the next row's effective reps, falling back to the user's target minimum. Policy uses both target minimum and maximum.
- Dumbbells encode per-dumbbell load `1`; barbells total load `2`; cable/machine displayed load `0`; unknown convention `-1`.
- Last trusted first set of the same exercise/gym/setup line supplies previous-workout load and reps. Equipment-wide history is not historically recorded, so equipment-workout count and days since equipment use remain missing.
- Actual rest duration, planned RIR, sleep, readiness and previous-set RPE remain missing. The configured rest timer is **not** an actual rest measurement; logged RIR is **not** converted to RPE.
- Numeric absence remains `null`/`undefined`, converted to XGBoost missing traversal rather than zero. Real zero values remain zero.

No exercise ID enters the model; unseen ordinary exercises use their observed sets and convention. Unsupported setups retain deterministic guidance.

## Separate decision policy

The regression model predicts `delta_reps`; next reps are clipped to `[0, 50]`. It does not assess pain, dizziness or injury risk.

Maintain the current selectable next load within the target range. Increase only when current prediction exceeds the upper target by more than one rep, the nearest heavier load is at most 5% higher, and its own prediction stays above the target minimum without increasing predicted reps paradoxically. A known RPE of 9 or above blocks increase; missing RPE is not replaced with zero.

When below range, evaluate up to three actual lower equipment rungs. Search stops beyond a 20% reduction after the nearest lighter rung. Choose the nearest load that recovers the target; otherwise choose the best improving prediction, preferring the nearer load on ties. If no tested lighter load improves predicted reps, retain the plan and explain that no suitable lighter suggestion is available. No placeholder 5% decrease is used.

Performance-based Stop requires a normal target minimum of at least four reps, prediction below that target, and unusually severe **observed** deterioration: at least two prior working sets, first set at least six reps, latest set at most two reps and at most half of the first set. Explicit consecutive very-low-set input is also supported. A low prediction alone never establishes concerning symptoms or automatically stops an exercise. The card also offers an explicit pain/dizziness report: choosing Severe pain or Dizziness displays Stop guidance without calling the model, and hides weight application and predicted reps. This report remains active while the logger screen is mounted; it is not persisted across screen/session resume. Keeping the plan dismisses it until confirmed performance changes. All guidance remains manually overridable.

## Model integrity and inference

Assets copied byte-for-byte from `gain-universal-v2.zip`:

- `packages/engine/assets/live-adaptation-v2/model.json`: 3,505,214 bytes, 1,000 trees; SHA-256 `1ec18ce24ca5af8f5ebd40e0a932231ca4838983019ad2b1a82a10f8e6e64308`.
- `schema.json`: exact order, encoding, model version and missing/clipping contract.
- `reference-predictions.json`: all ten exported Python references.

Static Metro requires live inside the prediction function, so model initialization is deferred until an eligible recommendation; the module's parsed object and validation result are cached. No repeated model parsing per set occurs. Numerical thresholds, feature values, base score and tree accumulation use float32 behavior. Scalar and singleton vector base scores are supported. Single-output `reg:squarederror` / `gbtree` is required. Unsupported objective, version, categorical tree split, mismatched feature order, corrupt topology and nonfinite scores fail safely. Numerically encoded load convention is supported; native categorical tree splits are deliberately rejected rather than evaluated incorrectly.

Reference tests execute unconditionally and fail if any required asset is absent. All ten exported deltas and clipped reps match exactly (absolute error **0**); rounded displays also match. This verifies interpreter parity, not real-world prediction accuracy.

The validation/interpreter contract follows [XGBoost model IO](https://xgboost.readthedocs.io/en/stable/tutorials/saving_model.html) and [intercept documentation](https://xgboost.readthedocs.io/en/stable/tutorials/intercept.html).

## Reproduce validation

```bash
npm ci
npm run typecheck
npm test
npm run export:android -w @gain/mobile
npm run test:engine -- -- src/liveAdaptationParity.test.ts
node --expose-gc --import tsx scripts/benchmark-live-adaptation.mjs
```

To reinstall the provided export, extract it first and run `node scripts/install-live-adaptation-model.mjs /path/to/extracted/model-directory`. This copies the three real assets, not replacements. Commit them together.

Tests cover exact feature order/missing encoding, float32 comparisons/accumulation, corrupt/categorical models, candidate equipment rungs, bounded increase, low-target handling, observed deterioration, explicit symptom policy, real bundled inference and SQLite save/resume/edit/confirmation/delete paths. Existing progression, unit conversion, rest timer and persistence suites remain required regression checks.

Verified local gates: `npm ci`, all workspace typechecks, **1,440 tests** across **117 files** (engine 451, mobile 880, sync 19, server 90), exact trained-model parity, and Android export. The focused live-adaptation coverage is 60 engine tests and 12 mobile tests. An explicit negative check temporarily withheld `schema.json`: parity exited 1 with ENOENT; restoring the original asset restored exact parity. All three bundled files have the same SHA-256 hashes as the extracted supplied ZIP.

## Performance and validation limits

Reproducible host measurements are saved in `LIVE-ADAPTATION-V2-BENCHMARK.json`: Node 22.23.2, macOS ARM64, 10,000 warmed predictions. Inference median **0.076 ms**, p95 **0.083 ms**; cold JSON load median **15.18 ms**, p95 **15.88 ms**; first validation **7.36 ms**; retained model heap about **5.63 MB**, RSS delta about **20.09 MB**. A recommendation performs at most five predictions. These numbers are host measurements, **not Android/Hermes latency or memory guarantees**. Lazy initialization avoids eager tree construction but increases the bundle size; first-use device responsiveness must still be measured.

Android bundle export succeeds with the trained model included. No Android SDK/device/emulator is available in this workspace. This is bundle validation, not device-level validation. Native card layout, Arabic/large-font wrapping, touch interaction and cold first-use logger responsiveness need a release Android smoke test. PR #148 was merged on explicit user instruction after green CI; those device checks remain outstanding.

All training/evaluation used one synthetic simulator. The supplied MAE 1.0487 / RMSE 1.3876 and held-out lifter/exercise results do not establish real-world accuracy and are not shown in the logger. The model remains experimental; missing readiness/rest inputs, historically unrecorded equipment context and unsupported setups limit applicability.
