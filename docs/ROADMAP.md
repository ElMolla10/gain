# Roadmap

The full A-to-Z plan (honest status, numbered steps to public launch, milestone map v0.4.1 to v1.x, open decisions, risks) lives in **[MASTER-PLAN.md](MASTER-PLAN.md)**. Start with its "Next 5 steps" section.

Milestones in one line each (details and exit criteria in the master plan):

- **v0.1-v0.3 (shipped, not yet verified on a device):** engine + gym fingerprint, thin slice (logger, finish flow, Why), onboarding + gym/programme editors, Hevy/Strong import.
- **v0.4.0 (shipped as a pre-release, not yet verified on a device):** kg/lb units (kg default), onboarding without a gym step (silent default gym). This used the number the first plan gave to goals + pace, so later milestones are one minor higher than first written.
- **v0.4.1:** real-device testing and fixes (Step 1; started on an emulator, not finished: see DEVICE-TEST-0.4.md).
- **v0.5:** goals + pace, weekly decision, short-week rebuild.
- **v0.6:** outlier/rejection surfaces, history + trends, decision-log screen, warm-ups.
- **v0.7:** reviewed library + Arabic aliases, native rest timer, export/delete, local coach card. *Shipped 2026-10-03 as a pre-release with the review and the on-phone checks still open: library is draft, rest alert and card untested on a phone.*
- **v0.8:** accessibility/RTL/performance/offline QA, trainer review, privacy + consent, crash reporting, beta APK process.
- **v0.9:** pilot with about 10 lifters at one gym. *(v0.9.0 pre-release, 2026-10-03, is the Hevy-style logger redesign, not the pilot; see docs/WORKOUT-LOG.md.)*
- **v0.10:** (milestone name, not the same as the v0.10.0 pre-release, which is a batch of logger features, safety/a11y QA, privacy drafts, local crash log and beta process docs; see MASTER-PLAN.md) backend sync (Cloudflare Workers + D1; built and deployed in v0.11.0, not device-verified), shared gyms (dropped), coach links (built in v0.11.0), subscription test, Play closed testing; model layer only if the pilot shows a need.
- **v0.12.0:** exercise library 50 -> 607 (Hevy-style names, draft Arabic), picker search and muscle/gear filters, stronger import matching. Not device-verified; new Arabic unreviewed. See [EXERCISE-LIBRARY.md](EXERCISE-LIBRARY.md).
- **v1.0:** Play Store public launch (Arabic + English).
- **v1.x:** iOS, post-launch metrics.

Not planned for first releases: chatbot, social feed, wearables, nutrition, video scoring, trainer dashboard, photo progress.
