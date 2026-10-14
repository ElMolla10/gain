# External audit follow-up

Source: external repository review supplied on 14 October 2026. Its visual scores were provisional: it did not run a device, and its full tests were blocked by Node 20. Work below was checked against main commit `8a16db8` using Node 24.

## First batch: workout reliability and model transparency

- `logSet` now uses one transaction for the idempotency check, exercise-line creation, outlier calculation, position allocation and insertion. Simultaneous retries cannot both insert the same draft or allocate the same position through this repository.
- Fault injection after the set insert verifies rollback of both the set and any new exercise line. A retry with the same draft ID inserts once. A file-backed SQLite test verifies committed sets survive closing and reopening, with the same session resumed.
- English and Arabic live cards explicitly label the model experimental. PRODUCT.md now distinguishes deterministic next-session progression from experimental offline next-set inference.
- RestClock, LiveDuration and Stat moved into WorkoutStats; LiveSuggestion is a presentation component. Persistence, stale-card checks and explicit acceptance remain in the screen. The screen is still large: this is the first extraction, not a completed logger redesign.

## Audit findings that need qualification

The code already has model-failure fallback, manual-load protection, an opt-in local evaluation repository and tests, symptom overrides, and isolated timer ticks. Those should be validated rather than implemented a second time. Missing optional model inputs remain missing; requiring every input would suppress suggestions for essentially all current sessions. The original model increase policy is retained.

## Next work, in order

1. Real-phone logger checks: English and Arabic, keyboard overlap, a saved set followed by force-stop/resume, unsaved input behavior, supersets and mid-workout reordering, rest alerts after backgrounding, large text and TalkBack. Record device/OS/build and results in the existing device checklist. Node SQLite reopen/fault tests do not establish Expo or OS force-stop behavior.
2. Extract exercise sections and set rows with behavior checks; use phone measurements to decide memoization. Avoid a line-count target that only relocates complexity.
3. Use the existing opt-in evaluation flow to compare real next-set predictions with simple baselines, by exercise and history availability. Synthetic evaluation does not establish real-user accuracy. Do not claim superior results without evidence.
4. Native Arabic review of core workout, finish, onboarding and error flows.
5. Review sync authorization and rate limiting; verify import edge cases against real exports. Confirm problems before widening scope.

No device performance, accessibility, Arabic pilot, iOS device or real-world model evaluation is claimed by this batch.
