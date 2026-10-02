# Roadmap

Milestones, in order. Each is a decision to test with real lifters, not a promise of dates.

1. **Engine + gym fingerprint**: pure TypeScript progression engine (gym-aware loads, progression currency, outlier check, rejection memory, warm-ups), versioned rules, heavy unit tests.
2. **Thin slice**: Expo app with local SQLite, Today, offline logger, finish flow that writes the next session's targets with a visible reason (accept / edit / reject), decision log.
3. **Onboarding + gym/programme editors**: language, units, minimum questions; edit the gym's real loads; edit programmes and see the weekly exposure effect; programme versions.
4. **Hevy / Strong CSV import**: bring history on day one so the engine is not guessing.
5. **Goals / pace + weekly decision + short-week**: goal clock from exposures, one weekly decision (keep / small change / easier), short-week rebuild around goal lifts.
6. **Arabic polish, library, export / delete**: Egyptian-gym aliases, exercise library search, cues, own-data export and delete, dark mode.
7. **Backend sync, shared gyms, coach card, subscriptions, store**: sync on top of `updated_at` / `deleted_at`, shared gym fingerprints, coach card, subscriptions, store release. A trainer reviews rules and cues before public coaching claims.

Not planned for first releases: chatbot, social feed, wearables, nutrition, video scoring, trainer dashboard, photo progress.
