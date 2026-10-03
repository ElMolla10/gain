# GAIN

An Arabic + English lifting app that ends every workout by deciding the next one.
Product spec: [docs/PRODUCT.md](docs/PRODUCT.md). Master plan (status + steps to launch): [docs/MASTER-PLAN.md](docs/MASTER-PLAN.md). First-slice plan (historical): [docs/PLAN.md](docs/PLAN.md).

Status: Android-first app, sideloaded pre-release APKs only (see the status table in the master plan for what is and is not verified on a device). Public repo.

**GAIN is completely free. No subscriptions, in-app purchases, or paid feature tiers.** Every feature is available to everyone. Nothing is gated, and there are no ads or donation prompts either.

## Layout

- `packages/engine` — pure TypeScript progression engine (no UI, no DB), tested with vitest.
- `packages/sync` — the sync protocol shared by the app and the Worker (pure code).
- `apps/mobile` — Expo + React Native app, `expo-sqlite` as the local source of truth.
- `apps/server` — optional sync + coach-link Cloudflare Worker with a D1 database ([docs/SYNC.md](docs/SYNC.md)).

## Principles

- Offline first: everything is saved locally with client-generated UUIDs; `updated_at` / `deleted_at` on every row for later sync.
- A rule calculates the number. A model (later) only handles cases the rule flags as low confidence. Nothing changes the plan until the user accepts.
- Missing data is said out loud. No invented history. Training aid only: no medical advice.

## Develop

```bash
npm ci                   # from the repo root; installs every workspace from package-lock.json
npm run typecheck        # engine + sync + mobile + server
npm test                 # all four workspaces (vitest; mobile and server use Node's built-in SQLite, no device needed)
cd apps/mobile && npx expo start --android   # needs an Android emulator or device
npm run export:android -w @gain/mobile       # bundles the Android JS without a device (compile check)
npm run backtest:hevy -w @gain/engine        # runs the rule over fixtures/hevy-export.csv
```

Platform: Android first. Node 22+ is required (tests use `node:sqlite`); CI uses Node 22.

Building and publishing a signed APK is a separate, longer procedure that needs JDK 17 and the Android SDK: [docs/RELEASE-PROCESS.md](docs/RELEASE-PROCESS.md). A clean clone was checked end to end on 2026-10-03 (`npm ci`, typecheck, tests, export bundle, prebuild, Gradle `assembleRelease`, signing).

This repo is public. `fixtures/hevy-export.csv` is Mohamed's own real Hevy export, committed with his permission.
