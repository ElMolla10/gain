# Skip leg training: continued verification

Feature baseline: main `ee4cf0d` / PR #332. When this test continuation started, GitHub already recorded #332 merged by ElMolla10 at 2026-11-08 19:24:47 UTC. The former worktree was gone. This continuation uses a new isolated branch and does not merge, build a native app, upload, or release anything. Uncommitted simulator QA work remains in the original checkout.

## Tests and follow-up changes

- Existing generator coverage: 21 tests cover 2/3/4/5/6 days across all goals/experience levels; distinct nonempty workouts; metadata exclusions; dumbbell, machine, bodyweight and cable limits; 30-minute caps; lower/upper priorities; avoids; impossible combinations; default-off equivalence; and English/Arabic SQLite preview/save equality without rewriting the previous program.
- New screen-handler coverage: eight tests exercise default-off English/Arabic copy, the exact preview object passed to save, explicit 3/6-day screen choices, invalidation in both directions, invalidation of an already-running asynchronous build, and impossible equipment without any partial save/navigation.
- New preview component coverage: four English/Arabic render contracts verify every day, exercise and prescription, localized counts, and stacking names/prescriptions at font scale 2.14 with a mocked 320-point viewport. Three failed before the follow-up: Arabic counts stayed English, and both language variants retained a horizontal exercise row at large text. Counts are now localized and the row stacks above font scale 1.3. Font sizes are not reduced and names are not truncated.
- Regression coverage includes `draftPersist.test.ts`, `workoutSession.test.ts`, `programme.test.ts`, and `i18n.test.ts`: 92 tests passed in the targeted run. The draft-loss regression files were not edited.

These are code, component-tree and Node SQLite tests. **No simulator or physical phone run was performed for this feature or follow-up.** Mocking a narrow viewport/font scale is not pixel-layout, touch-target, VoiceOver or native RTL verification. Arabic strings retain the project's draft-translation status. No distribution build was prepared.

## Verification result

Workspace typecheck passed. Full mobile suite: **227 files / 2,053 tests passed** with two workers. This includes all 39 generator/screen/preview feature checks and the existing persistence regressions. An initial full run passed 2,051 tests and failed two older native mocks because the preview now reads screen dimensions; their normal-size dimension mocks and localized-count stubs were updated, keeping their behavioral assertions. The complete rerun passed.

`git diff --check` passed. No native, simulator, browser, TestFlight or device run was performed for this feature. Existing uncommitted QA reports, screenshots and automation were not staged or modified.

## Representative exact output

Generated from the real generator using: skip legs on; hypertrophy; intermediate; all `GYM_EQUIPMENT`; 75 minutes; no avoided exercises; no muscle priorities; English; default upper/lower/lateral ceilings 10/12/15. These lists are generated output, not manually written templates. Changing constraints can produce different selections or an explicit failure. Both examples have 36 weekly sets; six days distributes the work rather than doubling it.

### 3 days — 36 weekly sets

| Day | Exact exercises and prescriptions |
|---|---|
| Push | Barbell Bench Press — 3 × 6–10; Seated Dumbbell Shoulder Press — 3 × 6–10; Cable Triceps Pushdown — 3 × 6–10; Incline Dumbbell Press — 3 × 6–10 |
| Pull | Lat Pulldown — 3 × 6–10; Dumbbell Biceps Curl — 3 × 6–10; Face Pull — 3 × 6–10; Seated Cable Row — 3 × 6–10 |
| Upper | Machine Chest Press — 3 × 6–10; One-Arm Dumbbell Row — 3 × 6–10; Dumbbell Lateral Raise — 3 × 6–15; Hammer Curl — 3 × 6–10 |

### 6 days — 36 weekly sets

| Day | Exact exercises and prescriptions |
|---|---|
| Push A | Barbell Bench Press — 2 × 6–10; Cable Triceps Pushdown — 2 × 6–10; Seated Dumbbell Shoulder Press — 2 × 6–10 |
| Pull A | Lat Pulldown — 2 × 6–10; Dumbbell Biceps Curl — 2 × 6–10; Face Pull — 2 × 6–10 |
| Shoulders & Arms | Dumbbell Lateral Raise — 2 × 6–15; Hammer Curl — 2 × 6–10; Dip (bodyweight + added) — 2 × 6–10 |
| Push B | Barbell Overhead Press — 2 × 6–10; Incline Dumbbell Press — 2 × 6–10; Lying Triceps Extension (skullcrusher) — 2 × 6–10 |
| Pull B | Seated Cable Row — 2 × 6–10; Dumbbell Rear Delt Fly — 2 × 6–10; Barbell Biceps Curl — 2 × 6–10 |
| Upper | Machine Chest Press — 2 × 6–10; One-Arm Dumbbell Row — 2 × 6–10; Machine Shoulder Press — 2 × 6–10 |

## Reproducible checks

```sh
npm run typecheck
npm run test -w @gain/mobile -- test/skipLegTraining.test.ts test/programGenerator.test.ts test/programGenerateScreen.test.ts test/generatedProgrammePreview.test.ts --maxWorkers=2
npm run test -w @gain/mobile -- --maxWorkers=2
```

No schemas, generator prescriptions, existing programs, history or progression policy are changed by this follow-up. Production changes are limited to preview copy and responsive presentation. `apps/mobile/tsconfig.json` remains unchanged, SHA256 `bcb95d7c391e324cc4f866348843492de3062a0012f616b108962b925b141289`.
