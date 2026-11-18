# Current-set workout logger verification

Historical PR #372 captures. The current compact table presentation and verification are documented in [compact-workout-table](../compact-workout-table/README.md).

Base: `d14d314c6144b53be35aa520f26b0ff303914456` (current `origin/main` when work began).

The real React Native logger now presents one editable set, compact completed/upcoming rows, and one pinned Log set action. Workout details lists the complete active session with jump, add, remove, and the existing drag reorderer. Recommendation, repository logging, rest timers, and Finish remain the existing implementations. Exercise changes are session-only; the explicit replacement “Update program” choice remains separate.

## Automated coverage

Repository-backed hook tests cover switching mid-exercise with edits, background/cold restoration of cursor and drafts, completed-set corrections, exact saved values, rapid double taps, adding/reordering/removing exercises, both removal cases, saved program isolation, and restoring changed lists. Snapshot tests cover blank added/deleted rows, stable IDs, edits to saved sets, committed-ID crash recovery, and legacy data.

Editor/model tests cover barbell, dumbbell, machine, bodyweight-only and added-weight, assisted, seconds and distance inputs, persisted invalid input, missing history, and trusted comparable Previous. Repository import tests cover matched imported history. Existing Ease In, manual override, progression, timers, workout recovery, input parsing and Finish tests remain in the full suite.

## Native method and limits

Screenshots are captures of the **running native iOS app**, not web renders or mockup images. The QA host is an existing unsigned simulator app with the current production JavaScript and bundled offline assets. Its source matches the PR except for an isolated FinishScreen rating-module shim: the older host lacks ExpoStoreReview, so the QA copy makes rating requests unavailable. That shim is outside this repository and is not shipped.

This verifies the React Native logger on simulators; it does not verify a fresh signed native archive, physical-device integrations, or Apple's rating prompt. The native Finish/rating flow was not completed during these captures; repository tests cover Finish persistence. No TestFlight build, App Store submission, or release workflow was triggered.

Native interaction evidence includes actual dragging, exercise switching, completed-set correction, set addition, logging the displayed 20 kg × 6 and advancing, and cancellation of the logged-exercise removal confirmation. Database reads confirmed the stored values and session order. The wider mutation/recovery matrix is exercised by repository-backed automated tests.

All simulator databases were backed up before fixtures; synthetic data and original backups were kept outside the repository, and original data was restored after verification. Unrelated local files were recorded separately for preservation checks.

## Results

- All workspace typechecks passed.
- **3,007 tests passed:** engine 695, sync 20, mobile 2,194, server 98. Local final command: `npm run test --workspaces --if-present -- --maxWorkers=2`. An earlier concurrent-simulator run timed out in four existing safety/setup-script tests; the bounded rerun passed without changing those tests or their timeouts.
- Standard CI on code commit `ed0d7736cb12b1804df9a14459cc3ead65b87231` passed `check` (normal `npm test` and typechecks), `android-export`, and `ios-config` (iOS export, prebuild and native project settings). [CI run](https://github.com/ElMolla10/gain/actions/runs/44136305000).
- Independent review findings addressed: undo/delete remain reachable in set options, persisted invalid load/reps/RIR stays visibly invalid, and completed-set progress remains counted while a correction is pending.

## Native screenshots

iPhone SE (3rd generation), 375 × 667 points, iOS 26.3. These are unedited native screenshots. The regular-size first editable set is visible without scrolling. Keyboard captures show the active input above the pinned action and keyboard.

| State | English, dark | Arabic RTL, light |
|---|---|---|
| Current set | [Logger](logger-en-dark-se.png) | [Logger](logger-ar-light-se.png) |
| Keyboard open | [Keyboard](keyboard-en-dark-se.png) | [Keyboard](keyboard-ar-light-se.png) |
| Complete workout list | [Workout details](details-en-dark-se.png) | [Workout details](details-ar-light-se.png) |


Interaction captures: [dragged session order](session-reordered-se.png), [20 kg × 6 before logging](dumbbell-before-log-se.png), [bodyweight-only](bodyweight-se.png), [assistance](assisted-se.png), [machine](machine-se.png), and [logged-exercise removal confirmation](remove-confirmation-se.png).

**Native verification gap:** the full Xcode application was removed during the final accessibility-text/theme-matrix checks. A surviving CoreSimulator binary allowed database/text-size cleanup, but the XCTest UI driver could no longer restart. Large-text logger/keyboard validation, English/light and Arabic/dark native captures were therefore not completed. English/dark and Arabic/light at regular text size were completed on the small SE, including keyboard and details. This limitation is not a claim of passing large-text native QA.
