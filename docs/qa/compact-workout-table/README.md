# Compact workout table verification

Base: `c2ba25f6cf25a0512def1462574547f8854b9f16` (PR #372). Layout reference: pre-#372 `d14d314c6144b53be35aa520f26b0ff303914456`.

The native logger renders every exercise and its directly editable set table in one scroll view. Completed rows remain editable, the current row has a subtle highlight, and the pinned action logs or updates that selected row. Demo, set options, exercise options, Add Set, rest timer, duration/pause and Finish remain accessible. Workout details retains the complete session list, jump, existing drag reorderer, picker, removal confirmation and restore. Why is optional in the exercise menu.

This is a presentation change: session hooks, repositories, snapshot/persistence logic, recommendation logic, engine and schema are unchanged from #372. No version/build-number change or release workflow is included. The table additionally keeps persisted invalid fields visible, uses appropriate bodyweight/assistance inputs, and validates measure-specific Previous quantities. A formatter regression test and native round-trip confirm typed values convert when switching units while stored kilograms remain unchanged.

## Native method

All PNGs here are **unedited native iOS simulator screenshots**, not web renders. Device: iPhone SE (3rd generation), 375 × 667 points, iOS 26.3. Xcode 27.2. The QA host is an existing unsigned simulator shell with this change's production JS bundle and offline assets. Byte comparison found only an isolated QA FinishScreen shim because the older shell lacks ExpoStoreReview; that shim is outside the repo and is not shipped. A fresh signed archive, physical-device behavior and Apple's rating prompt were not verified. Native Finish confirmation/cancel was checked; Finish persistence remains covered by automated tests.

Fixtures ran in a new dedicated simulator with sync disabled. The original simulator database remained an exact logical match to its task-start backup. No real workout data was discarded. Database backups and synthetic fixture data stay outside the repository.

## Functional verification

| Scenario | Evidence |
|---|---|
| Manual edit, Log set, rapid double tap | Native double tap saved exactly one 67.5 kg × 8 set; repository/hook tests cover the duplicate guard. |
| Correct completed set | Directly edited the same saved row to 70 kg × 9 and updated it; database confirmed the same set ID and one saved row. |
| Add Set | Bench expanded from two Ease In rows to three; all rows editable. |
| Switch during unfinished exercise | Bench 65 × 7, dumbbell 20 with suggested reps, machine 25 × 10 remained intact across jumps. |
| Restart and Resume | Cold app launch restored cursor, saved set and all three unsaved drafts. |
| Reorder | Dragged Bench from first to third in the existing reorderer; saved set and drafts persisted, table scrolled to active exercise. |
| Add/remove exercise | Existing picker added 21s Curl (Barbell); removal restored a valid active exercise. |
| Remove with logged sets | Clear confirmation; Cancel retained the exercise; confirmed removal affected only this session. |
| Program/history isolation | Database comparison showed saved program rows unchanged and finished 80 × 7 baseline history unchanged after list mutations. |
| Unit switch | Native fields showed 70 kg → 154.3 lb and 65 kg → 143.3 lb, and back; stored kg unchanged. |
| Exercise-specific controls | Native Demo opened; bodyweight BW cell switched to editable added load; assisted table exposed Assistance input. |
| Finish | Pending-edits confirmation visible; Cancel kept the session open. |

Automated coverage also includes imported/missing history, seconds/distance, bodyweight/assisted exercise types, invalid persisted inputs, Ease In resolved targets, manual overrides, timers, progression, logging/history and recovery. The new Previous tests prove missing seconds/metres cannot become an invented previous quantity. Formatting tests prove partial typing survives unrelated rerenders. A stateful row regression proves the initial bodyweight added-load focus request is consumed, so a large-text layout remount cannot steal focus. The same native bodyweight-edit → jump to Bench → change text size sequence passed after the fix.

## Layout matrix

Standard text: English/Arabic RTL × light/dark. Accessibility Extra Large: English dark and Arabic RTL light. Keyboard checks keep the focused numeric field visible above the action and keyboard; header and numeric controls use bounded scaling, with Previous as an in-row caption at large text. All fields remain editable in the list. Long names wrap. No current-set card, steppers, warm-up prompt, Ease In explanation/normal-targets control, monthly goal, standalone next-set details or equipment artwork appears in the logger.

| State | English dark | Arabic RTL light |
|---|---|---|
| Table | [Native capture](table-en-dark.png) | [Native capture](table-ar-light.png) |
| Keyboard | [Native capture](keyboard-en-dark.png) | [Native capture](keyboard-ar-light.png) |
| Workout details | [Native capture](details-en-dark.png) | [Native capture](details-ar-light.png) |

Additional captures show light English, dark Arabic, large text, completed correction, unsaved edits, converted units, reordered details and logged-removal confirmation.

## Checks

All workspace typechecks passed (`npm run typecheck`). **3,014 tests passed:** engine 695, sync 20, mobile 2,201, server 98 (`npm run test --workspaces --if-present -- --maxWorkers=2`). `git diff --check` passed. The production iOS JS bundle compiled for native QA. Required CI results are recorded in the PR. Independent review verified the measure-specific Previous guard and formatter synchronization, with no remaining blocking findings.
