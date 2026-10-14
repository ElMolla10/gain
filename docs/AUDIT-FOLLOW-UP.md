# External audit follow-up

Source: external repository review supplied on 14 October 2026. Its visual scores were provisional: it did not run a device, and its full tests were blocked by Node 20. Work below was checked against main commit `8a16db8` using Node 24.

## First batch: workout reliability and model transparency

- `logSet` now uses one transaction for the idempotency check, exercise-line creation, outlier calculation, position allocation and insertion. Simultaneous retries cannot both insert the same draft or allocate the same position through this repository.
- Fault injection after the set insert verifies rollback of both the set and any new exercise line. A retry with the same draft ID inserts once. A file-backed SQLite test verifies committed sets survive closing and reopening, with the same session resumed.
- English and Arabic live cards explicitly label the model experimental. PRODUCT.md now distinguishes deterministic next-session progression from experimental offline next-set inference.
- RestClock, LiveDuration and Stat moved into WorkoutStats; LiveSuggestion is a presentation component. Persistence, stale-card checks and explicit acceptance remain in the screen. The screen is still large: this is the first extraction, not a completed logger redesign.

## Batch 2: logger component boundaries

- Exercise headers, target/reason presentation, set tables, warm-up offers, outlier notices and live cards now live in `WorkoutExerciseSection`.
- `WorkoutSetRow` owns input and action presentation. The screen retains saved-set mutations, draft state, timers, supersets, reordering, navigation and live-card validity checks. No AI increase policy or model changes are included.
- Each exercise computes the current row, row labels and previous working-set indexes once before mapping its rows. No phone performance improvement is claimed.
- Row checkbox accessibility now reports the same disabled state as the actual button during saving and incomplete input.
- Eleven presentation-tree/callback tests cover save/untick/update routing, ghost inputs, disabled controls, set deletion, pounds conversion, timed quantities, Arabic labels, previous-set alignment, header actions and large-text layouts. Native keyboard, gestures and screen-reader delivery remain unverified.
- The screen shrank from 1,177 to 915 lines. There is no artificial line-count gate; state/lifecycle extraction should follow measured problems and phone checks.

## Batch 3: evaluation and explanations

- Settings compares model error with repeat-previous-reps at the same load and a bounded constant-Epley-capacity benchmark. Each baseline and model use exactly the same eligible sets; unavailable baselines do not become zeros.
- Reports include captured/pending/excluded counts, exercise cohorts, availability of a previous-workout first set, missing-feature counts, paired wins/ties/losses, overprediction bias and reproducible forecast samples. Unknown history is not labeled "never trained".
- Manual JSON export uses the native share sheet, including iOS; no automatic upload is added. Samples omit raw session/set identifiers, with export-local session grouping for inspection but contain fitness observations and exercise IDs.
- Live cards identify the last saved set and say that sleep, readiness and rest are unknown. Reported symptoms remain explicit stop messages, not model forecasts.
- Documentation now accurately says capture is automatic and local. Earlier wording incorrectly called this path opt-in.
- No model, training data, increase policy, inference or SQLite schema changes. Real-data superiority, calibration, safety and iPhone delivery are not established by code checks.

## Six-batch working plan

| Batch | Scope | Status |
| --- | --- | --- |
| 1 | Atomic saves, recovery tests, experimental labels and accurate docs | Implemented; draft PR #162 |
| 2 | Logger exercise/set boundaries and behavior checks | Implemented; phone verification pending |
| 3 | Paired baseline comparisons, report export and model explanations | Implemented; real-user observations still needed |
| 4 | Core Arabic copy, accessibility and empty/error flows | Planned; native-speaker/device checks required |
| 5 | Import edge cases, sync security and backup/restore hardening | Planned; confirm defects before changes |
| 6 | Device/release validation, onboarding polish and store readiness | Planned; native builds and real devices required |

The six batches are a working division of the audit, not an estimate that all findings can be resolved without user/device evidence. Keep the original AI increase policy unless a later change is explicitly requested.

## Audit findings that need qualification

The code already has model-failure fallback, manual-load protection, an automatic local evaluation repository and tests, symptom overrides, and isolated timer ticks. Those should be validated rather than implemented a second time. Missing optional model inputs remain missing; requiring every input would suppress suggestions for essentially all current sessions. The original model increase policy is retained.

## Next work, in order

1. Real-phone logger checks: English and Arabic, keyboard overlap, a saved set followed by force-stop/resume, unsaved input behavior, supersets and mid-workout reordering, rest alerts after backgrounding, large text and TalkBack. Record device/OS/build and results in the existing device checklist. Node SQLite reopen/fault tests do not establish Expo or OS force-stop behavior.
2. Extract exercise sections and set rows with behavior checks; use phone measurements to decide memoization. Avoid a line-count target that only relocates complexity.
3. Use the existing local evaluation flow to compare real next-set predictions with simple baselines, by exercise and history availability. Synthetic evaluation does not establish real-user accuracy. Do not claim superior results without evidence.
4. Native Arabic review of core workout, finish, onboarding and error flows.
5. Review sync authorization and rate limiting; verify import edge cases against real exports. Confirm problems before widening scope.

No device performance, accessibility, Arabic pilot, iOS device or real-world model evaluation is claimed by this batch.
