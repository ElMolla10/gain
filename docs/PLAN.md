# Plan: first thin vertical slice

## Stack
- Platform: **Android first**. iOS is out of scope for now (no iOS work, builds or tests).
- Name: GAIN.
- npm workspaces monorepo.
- `packages/engine`: pure TypeScript, no UI/DB, vitest.
- `apps/mobile`: Expo + React Native + TypeScript, `expo-sqlite` local source of truth, i18n with real RTL (Arabic + English, English default for now).
- Offline first. Client-generated UUIDs. Every row has `id`, `updated_at`, `deleted_at` (soft delete). No backend yet.

## Data model (slice subset, schema-ready for the rest)
gym, gym_load (equipment type: dumbbell/barbell/plate/cable/machine/assisted; real loads list or increment/jump), exercise (en + ar names, ar aliases, pattern, equipment type, setup type free/assisted/bodyweight_plus_added), exercise_line (history stream per exercise + gym + setup), programme + programme_version, session, set (load, reps, optional rir, warmup flag, tags, outlier_status), goal, bodyweight_entry, target (currency spent, rule_version, path rule|model, status proposed|accepted|edited|rejected), decision_log (JSON inputs), rejection_memory.

## PR plan (draft PRs, small, never merged by the agent)
1. PR1: scaffold monorepo + docs + CI (install, typecheck, engine tests).
2. PR2: `packages/engine`: gym-aware load rounding; progression currency order (reps, effort, quality, load); result `{load, reps, currency, reason key + params, confidence, rule_version, inputs}`; outlier check; rejection memory (3 rejections); warm-up generator; assisted/bodyweight lines never compared with free weights; `needsModel` flag, no model call.
3. PR3: `apps/mobile` skeleton: Expo, SQLite schema + migrations, labelled sample seed data, i18n + RTL toggle, navigation + Today screen.
4. PR4: Active workout / offline logger.
5. PR5: Finish flow: what counted, records, next-session targets via engine with visible reason; accept / edit / reject; decision_log + rejection_memory; "Why this weight?".

## Rules
- Never merge, never publish, no secrets in repo.
- Sample data labelled as sample. No medical/physique claims, no streak shaming, no pain treatment advice.
- Run tests + typecheck before each push. Say honestly what is not verified (no iOS/device here).
