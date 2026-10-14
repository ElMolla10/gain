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

## Batch 4: core Arabic, accessibility and read/input failures

- History distinguishes an empty result from a failed database read, offers retry, preserves the last complete page when pagination fails, and ignores cancelled/stale reads. Refreshes publish sessions/count/lifts together.
- Swipe-delete controls are hidden from accessibility while covered. Set-number controls expose a named delete action that uses the existing confirmation; revealed swipe deletion names the exercise/set.
- Numeric fields use a minimum height rather than a fixed height so larger system text can expand them. Settings block titles have a screen-reader heading role. Native rendering remains unverified.
- Invalid numeric text is distinguished from a deliberately empty target field. It blocks new-set saves and saved-set updates, remains counted as unsaved work, and is announced on blur. Finishing also warns before discarding saved-row edits. Draft validity is not stored in SQLite.
- Core live-card/workout Arabic wording is more consistently Egyptian, including the pain/dizziness explanation. Number-input and History error/retry messages exist in both languages. Other Arabic strings remain draft; this is not an independent native-speaker review.
- No engine/model/increase-policy, migration or server changes. iPhone VoiceOver, gesture delivery, large-text layout and keyboard behavior still require native verification.

## Batch 5: import, auth and backup/restore hardening

- Hevy and Strong reject impossible dates/times before JavaScript can normalize them. Valid rows retain their local wall-clock values; invalid Hevy rows produce warnings instead of a silently shifted workout.
- Email verification consumes a code with one conditional delete. Concurrent verifies cannot both succeed; stale correct/wrong requests neither delete nor increment attempts on a replacement code. Invalid bearer authentication is checked before consuming the code, and expiry includes the exact deadline.
- Anonymous account/device creation uses an atomic D1 batch, avoiding orphan accounts when device insertion fails. Existing token/recovery hashing and rate-limit caps remain intact.
- JSON exports read all tables and completeness counts inside a maintenance transaction. Restore holds that transaction from the verified safety copy through replacement, preventing writes in the copy/replace gap. Foreign-key and row-count checks remain in place.
- Restore rejects missing schema-1 core tables and sync bookkeeping before replacement. A valid empty backup still contains empty core table arrays; an older complete backup remains supported.
- No migrations or AI/progression-policy changes. Server auth changes are source-only until the existing Worker deployment procedure is run after merge. Native iPhone backup/share/restore, lock contention and real Strong-export verification remain pending.

## Six-batch working plan

| Batch | Scope | Status |
| --- | --- | --- |
| 1 | Atomic saves, recovery tests, experimental labels and accurate docs | Implemented; draft PR #162 |
| 2 | Logger exercise/set boundaries and behavior checks | Implemented; phone verification pending |
| 3 | Paired baseline comparisons, report export and model explanations | Implemented; real-user observations still needed |
| 4 | Core Arabic copy, accessibility and empty/error flows | Code implemented; native-speaker/device checks still required |
| 5 | Import edge cases, auth races and backup/restore hardening | Code implemented; Worker deployment and native checks pending |
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
