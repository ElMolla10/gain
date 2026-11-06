# Beginner flow audit — 2026-11-06

Scope: current main `3af5313` (Today layout #316 already merged), then the focused source fixes in this PR. Android launch work stays isolated and paused. **Distribution preparation, native distribution builds, TestFlight uploads and public App Store submission are paused until a new explicit instruction.** Expo authentication is setup only.

## Five highest-impact findings

These are confirmed source/test defects, not observations from running this candidate on an iPhone.

| Finding | Evidence and correction |
| --- | --- |
| Today names fragmented and gym controls overflowed | Previously reproduced in Chromium component renders at 320 px. The nonshrinking empty-target column, unbounded gym label and duplicate bottom inset were fixed in merged #316 (`TodayHeader.tsx`, `RackRow.tsx`, `ui.tsx`). No unfinished dependency. |
| Leaving/resuming could lose typed numbers or restore older ones | `useWorkoutSession.ts` previously snapshotted only on background; `draftPersist.ts` skipped added rows beyond the planned count. Cleanup, save-completion and restoration now coordinate snapshots, retain extra typed rows and avoid recreating drafts after finish/discard. Delayed-write/remount regressions exercise the ordering. |
| Typing while a save was pending could overwrite the newer edit | `persistRow` previously marked the current row saved without checking the submitted values. `acknowledgeSavedRow` now acknowledges the submitted snapshot; later edits remain visible and dirty. Deferred-save tests reproduce the old data loss. |
| Resuming after switching gyms used the wrong weight grid | Real SQLite reproduction: the active gym changed, the session retained its original gym, but the hook loaded the active gym's fingerprint. `openWorkoutContext` now uses the stored session gym for loads and saves, including when no active gym is selected. Tests assert the session and exercise-line gym stay consistent. |
| A history read failure could spin forever; failed deletion could be invisible | `SessionDetailScreen.tsx` did not catch initial refresh rejection and hid delete errors when closing confirmation. It now offers retry, preserves last good content on a failed refresh and keeps failed deletion visible and retryable. Three behavioral error/recovery tests cover this. |

## Beginner presentation changes

- Onboarding uses one accessible progress indicator instead of announcing/showing the step twice.
- Existing setup routes and program-generation rules stay the same. Welcome names the simple starter-program option; unit guidance explains what to choose rather than how values are stored internally. Review copy explains starting from Today and saving each set.
- The logger shows one brief instruction before any set has been saved and only when the loaded workout has no exercise history. It does not add a confirmation step or change logging.
- Finish keeps saved status, suggestions, basic totals, personal bests, the explicitly optional effort question, Done and Share available. Secondary muscle breakdown, improvement details and the duplicate achievement card are grouped under a closed **Workout details** disclosure. Effort uses Easy / About right / Hard; stored values and behavior are unchanged.
- Details remain accessible, including the achievement share callback while collapsed. English and Arabic copy are updated together.

## Verification boundaries

Automated verification uses Node/Vitest, real SQLite repository tests, controlled delayed promises, and mocked native adapters. It includes onboarding save/retry, logger rows/drafts, original-gym resume, Finish/share callback and history error recovery. Typechecking is separate from those tests. Final local results: `npm run typecheck` passed; `npm test` passed all **2,700 tests** (636 engine, 20 sync, 1,946 mobile, 98 server). The independent reviewer’s loading/untick timing findings were fixed, tested and re-reviewed with no remaining actionable findings.

Browser QA renders the actual onboarding and Finish components with react-native-web, bundled fonts, synthetic repositories and native adapters. It checks 320/375/430 px widths, 1×/1.5×/2× text, Arabic RTL and disclosure/setup interactions. All five renders had no runtime errors or horizontal page overflow; setup advanced to units and Finish details opened from the collapsed state. Local captures/results are in `/private/tmp/gain-ios-evidence/browser/` and are not committed. Browser captures are not simulator or device evidence and do not validate native SQLite, keyboards, VoiceOver or view-shot pixels.

A paired iPhone was inspected read-only: installed GAIN is 1.0.0 (8), bundle `com.mohamedehabelmolla.gain`. The candidate was not installed there. An empty simulator was booted for tooling inspection and shut down; GAIN did not run in it. No existing app was uninstalled or replaced. Native clean-install-to-Finish, upgrade retention, force-quit timing and image sharing from collapsed details remain unverified on this candidate.

The user's pre-existing `apps/mobile/tsconfig.json` edit remains in the original checkout; it is not part of this PR.

## Larger changes for review

Not implemented: making a specific starter plan the default primary route, shortening/reordering the setup wizard, or automatically regenerating a plan after earlier answers change. Those choices affect program suitability and can discard deliberate edits; they need an agreed design rather than an automatic reset.
