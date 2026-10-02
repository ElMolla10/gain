# GAIN

An Arabic + English lifting app that ends every workout by deciding the next one.
Product spec: [docs/PRODUCT.md](docs/PRODUCT.md). Build plan: [docs/PLAN.md](docs/PLAN.md).

Status: first thin vertical slice (Android first), built as small stacked draft PRs. Public repo.

## Layout (after PR1)

- `packages/engine` — pure TypeScript progression engine (no UI, no DB), tested with vitest.
- `apps/mobile` — Expo + React Native app, `expo-sqlite` as the local source of truth.

## Principles

- Offline first: everything is saved locally with client-generated UUIDs; `updated_at` / `deleted_at` on every row for later sync.
- A rule calculates the number. A model (later) only handles cases the rule flags as low confidence. Nothing changes the plan until the user accepts.
- Missing data is said out loud. No invented history. Training aid only: no medical advice.

## Develop

```bash
npm install
npm run typecheck        # engine + mobile
npm test                 # engine (vitest) + mobile DB/i18n tests (vitest, Node built-in SQLite)
cd apps/mobile && npx expo start --android   # needs an Android emulator or device
npm run export:android -w @gain/mobile       # bundles the Android JS without a device (compile check)
npm run backtest:hevy -w @gain/engine        # runs the rule over fixtures/hevy-export.csv
```

Platform: Android first. Node 22+ is required (tests use `node:sqlite`).

This repo is public. `fixtures/hevy-export.csv` is Mohamed's own real Hevy export, committed with his permission.
