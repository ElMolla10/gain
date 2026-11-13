# Two-Question First-Install Program Builder

Base: `feat/two-question-first-install` branching from `main` (`90f1c15`).
Preserves local untracked QA files and `apps/mobile/tsconfig.json`.

## Summary of Changes

1. **Welcome Screen (`FirstInstallScreen.tsx`)**:
   - Single action: **Build my program** (`first.build` / `برمج لي تدريبي`).
   - Clean headline (`ob.welcome`) and one sentence explaining the user will review their program before activating it (`first.welcomeBody`).
   - Responsive layout adapting to small screens (320 pt width) and large Dynamic Type (> 1.3x font scale joins the scrollable area).

2. **Two-Question Screen**:
   - **Question 1: Training days**: Explicit choice of 2, 3, 4, 5, or 6 days (`DAYS_OPTIONS`). Neither is preselected (`days: null`).
   - **Question 2: Training environment**: Explicit choice between **Gym** (`first.env.gym`, equipment includes barbell, dumbbell, machine, cable) and **Dumbbells at home** (`first.env.dumbbell`, dumbbell only). Neither is preselected (`environment: null`).
   - **Validation**: Attempting to generate before selecting both days and environment prompts the user clearly (`first.answers`) without inventing exercises or guessing selections.

3. **Change Preferences**:
   - Displays starting defaults clearly when collapsed: `Defaults: Beginner · General · 45 min` (`first.preferences.defaults` / `الافتراضي: مبتدئ · عام · ٤٥ دقيقة`).
   - Exposes editable starting defaults when expanded:
     - Experience: Beginner (default) / Intermediate
     - Goal: General (default) / Hypertrophy / Strength
     - Duration: 30 / 45 (default) / 60 minutes
     - Skip leg training toggle (`coach.skipLegs`)
     - Exercise exclusions / avoid text field (`first.avoid`)
     - Language selection (English / Egyptian Arabic)
     - Units selection (kg / lb)
     - Import workout history (`ob.importFirst`)
     - Custom program builder access (`ob.programme.own`)

4. **Review & Activation Screen**:
   - Shows summary badges for all chosen answers and active defaults directly alongside every day, exercise, and prescription.
   - **Use this program** (`first.use` / `استخدم هذا البرنامج`) is the sole activation action.
   - Secondary action: **Change my answers** (`first.edit` / `تعديل إجاباتي`) returns to the question screen and clears the preview.
   - Restarts mid-setup restore saved answers without an unconfirmed or intermediate program.
   - Activation saves the exact reviewed draft and configures the lifter's gym equipment matching the selected environment.

5. **No Unsupported Claims**:
   - Does not make claims about soreness or exact weekly set limits. Focuses entirely on equipment compatibility, user frequency, session duration, and exercise selection.

## Generator Compatibility Matrix

All 10 combinations of Days (2, 3, 4, 5, 6) × Environment (Gym, Dumbbells at home) at Beginner, General, 45 min were verified:

| Days | Environment | Program Split | Exercises Compatible | Invented Exercises |
|---|---|---|---|---|
| 2 | Gym | Full Body | Yes (Gym equipment) | None (0) |
| 2 | Dumbbell | Full Body | Yes (Dumbbell only) | None (0) |
| 3 | Gym | Full Body | Yes (Gym equipment) | None (0) |
| 3 | Dumbbell | Full Body | Yes (Dumbbell only) | None (0) |
| 4 | Gym | Upper / Lower | Yes (Gym equipment) | None (0) |
| 4 | Dumbbell | Upper / Lower | Yes (Dumbbell only) | None (0) |
| 5 | Gym | Push / Pull / Legs / Upper / Lower | Yes (Gym equipment) | None (0) |
| 5 | Dumbbell | Push / Pull / Legs / Upper / Lower | Yes (Dumbbell only) | None (0) |
| 6 | Gym | Push / Pull / Legs × 2 | Yes (Gym equipment) | None (0) |
| 6 | Dumbbell | Push / Pull / Legs × 2 | Yes (Dumbbell only) | None (0) |

Full parameter sweep across 600 combinations (days 2–6, gym/dumbbell, goals, experience levels, durations, skip-legs settings) confirmed 0 generation failures and 0 invented exercises.

## Automated Verification

- `npm run typecheck`: PASS across all workspaces (`@gain/engine`, `@gain/sync`, `@gain/mobile`, `@gain/server`).
- `apps/mobile/test/firstProgramSetup.test.ts`: 22/22 PASS (compatibility matrix, EN/AR preview and activation, restart persistence, preference change invalidation, SQLite roundtrip).
- `apps/mobile/test/firstInstallScreen.test.ts`: 9/9 PASS (single-button welcome, two questions unselected, preferences expansion, answer badges in EN/AR, font scale footer adaptation).
- `apps/mobile/test/onboarding.test.ts`: 32/32 PASS.
- Full repo tests: PASS.
