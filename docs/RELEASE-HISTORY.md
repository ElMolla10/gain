# GAIN release history

**History only. This file is not the plan.** The plan, the gates and the "Now" list are in [MASTER-PLAN.md](MASTER-PLAN.md). Everything below is kept as it was written at the time (the wording of each release's own status, the old milestone map, older test runs), so some of it is out of date. Where it conflicts with MASTER-PLAN.md, [PRODUCT.md](PRODUCT.md) or the code, those win.

**Nothing in this history has recorded device evidence in the repo.** (Mohamed reports on 2026-10-04 that he installed v0.18.0 and ran the device checks; that is his report, not independently verified, and no results are committed. v0.19.0 is not reported as run on a device.) Every release below was built, unit-tested on Node and published as a GitHub pre-release; no one has recorded installing any of them on a phone (see [NATIVE-CHECKLIST.md](NATIVE-CHECKLIST.md), [DEVICE-TEST-0.4.md](DEVICE-TEST-0.4.md)).

Last updated 2026-10-04 (Cairo time) at v0.21.0.

## 1. Published releases (GitHub pre-releases, Android arm64)

Dates are the GitHub publish time in Cairo time. "Schema" is the last client SQLite migration in `apps/mobile/src/db/migrations.ts` at that tag (the number `PRAGMA user_version` ends at). It matters for the upgrade tests in MASTER-PLAN.md section 5.

| Release | Published (Cairo) | versionCode | Schema | One line |
| --- | --- | --- | --- | --- |
| v0.1.0 | 2026-10-02 21:55 | (not set) | 1 | First installable build (see the release notes) |
| v0.2.0 | 2026-10-02 22:30 | 2 | 2 | rule-v0.3 engine (ACSM-based progression), thin slice (see the release notes) |
| v0.3.0 | 2026-10-02 22:56 | 3 | 3 | Onboarding, gym and programme editors, Hevy/Strong import (see the release notes) |
| v0.4.0 | 2026-10-02 23:21 | 4 | 3 | kg/lb units, onboarding without a gym step |
| v0.5.0 | 2026-10-03 00:24 | 5 | 5 | Goals + pace, weekly decision, short-week rebuild |
| v0.6.0 | 2026-10-03 00:44 | 6 | 5 | Outlier/rejection surfaces, history + trends, decision log, warm-ups |
| v0.7.0 | 2026-10-03 01:11 | 7 | 5 | 50-exercise library with draft Arabic, rest alert, export/delete, coach card PDF |
| v0.8.0 | 2026-10-03 04:07 | 8 | 5 | Gym UI removed (silent default gym), Today lists every day, self-updater |
| v0.9.0 | 2026-10-03 05:18 | 9 | 6 | Hevy-style logger redesign (the old blue logger) |
| v0.10.0 | 2026-10-03 06:16 | 10 | 7 | Logger features, safety/a11y QA, privacy drafts, local crash log, beta process docs |
| v0.11.0 | 2026-10-03 07:05 | 11 | 8 | Opt-in Back up and sync, coach links, Cloudflare Worker deployed |
| v0.12.0 | 2026-10-03 07:58 | 12 | 8 | Library 50 to 607 |
| v0.13.0 | 2026-10-03 13:06 | 13 | 9 | Timed exercises, reminders, (paywall scaffold, later removed), twin map, trainer/listing/retention docs |
| v0.14.0 | 2026-10-03 14:54 | 14 | 9 | 47 programme templates |
| v0.15.0 | 2026-10-03 16:06 | 15 | 9 | Fixes and design pass from two outside reviews (mint on charcoal) |
| v0.16.0 | 2026-10-03 18:04 | 16 | 9 | Electric-lime identity, session-first Today, compact logger |
| v0.17.0 | 2026-10-03 21:46 | 17 | 9 | Send-feedback share sheet, unused permissions removed |
| v0.18.0 | 2026-10-03 22:25 | 18 | 9 | Completely free: paywall scaffold removed |
| v0.19.0 | 2026-10-04 04:01 | 19 | 9 | New 4-day template Push / Pull / Legs / Upper (`ppl_upper_4`, 48 templates); English spelling "program" |
| v0.20.0 | 2026-10-04 04:56 (Cairo) | 20 | 9 | Build switches only (default app unchanged): `GAIN_DISTRIBUTION=play` (no self-updater, no install permission) and `GAIN_PILOT_TEMPLATES=1` (six pilot programs; published as `gain-pilot-v0.20.0-arm64.apk`). Not device-verified |
| v0.21.0 | 2026-10-04 (Cairo; exact time in RELEASE-PROCESS.md section 8) | 21 | 11 | Four changes Mohamed asked for: pilot-metrics repeat-last baseline now compares the same exercise, gym and setup (and assisted loads in effective terms); program rep range wins over the GAIN ceilings (rule-v0.4, setting "Use GAIN rep ceilings" off by default); top set + back-offs per exercise in the program editor; per-exercise available weights (kg/lb). Also published as `gain-pilot-v0.21.0-arm64.apk`. Not device-verified |

(versionCode and schema were read from `apps/mobile/app.json` and `migrations.ts` at each tag; v0.1.0 has no versionCode in `app.json`.)

## 2. Milestone bullets as they stood in ROADMAP.md (superseded by the gates)



- **v0.1-v0.3 (shipped, not yet verified on a device):** engine + gym fingerprint, thin slice (logger, finish flow, Why), onboarding + gym/programme editors, Hevy/Strong import.
- **v0.4.0 (shipped as a pre-release, not yet verified on a device):** kg/lb units (kg default), onboarding without a gym step (silent default gym). This used the number the first plan gave to goals + pace, so later milestones are one minor higher than first written.
- **v0.4.1:** real-device testing and fixes (Step 1; started on an emulator, not finished: see DEVICE-TEST-0.4.md).
- **v0.5:** goals + pace, weekly decision, short-week rebuild.
- **v0.6:** outlier/rejection surfaces, history + trends, decision-log screen, warm-ups.
- **v0.7:** reviewed library + Arabic aliases, native rest timer, export/delete, local coach card. *Shipped 2026-10-03 as a pre-release with the review and the on-phone checks still open: library is draft, rest alert and card untested on a phone.*
- **v0.8:** accessibility/RTL/performance/offline QA, trainer review, privacy + consent, crash reporting, beta APK process.
- **v0.9:** pilot with about 10 lifters at one gym. *(v0.9.0 pre-release, 2026-10-03, is the Hevy-style logger redesign, not the pilot; see docs/WORKOUT-LOG.md.)*
- **v0.10:** (milestone name, not the same as the v0.10.0 pre-release, which is a batch of logger features, safety/a11y QA, privacy drafts, local crash log and beta process docs; see MASTER-PLAN.md) backend sync (Cloudflare Workers + D1; built and deployed in v0.11.0, not device-verified), shared gyms (dropped), coach links (built in v0.11.0), Play closed testing (the planned subscription test was removed 2026-10-03: GAIN is completely free); model layer only if the pilot shows a need.
- **v0.12.0:** exercise library 50 -> 607 (Hevy-style names, draft Arabic), picker search and muscle/gear filters, stronger import matching. Not device-verified; new Arabic unreviewed. See [EXERCISE-LIBRARY.md](EXERCISE-LIBRARY.md).
- **v0.14.0:** 47 programme templates (40 new, 18 for home: dumbbells, bands, no equipment), grouped by days per week and filterable by days / Home vs Gym / equipment / goal / level; strength shapes with a per-lift rep ceiling (3x5, 5x5 style); a short-week rebuild fix found by the new template sweep. Unit-tested only, not device-verified, new templates not trainer-reviewed, Arabic names are drafts. See [TEMPLATES.md](TEMPLATES.md).
- **v0.13.0:** timed exercises (plank, dead hang, carries: seconds / metres, migration 9), opt-in training-day reminders, paywall scaffold (OFF, no billing; **removed again 2026-10-03, GAIN is completely free**), library twin map for import, trainer-review pack, Play listing drafts, pilot retention-metrics doc. All unit-tested only, not device-verified; nothing here is trainer-reviewed. See [TIMED-EXERCISES.md](TIMED-EXERCISES.md), [REMINDERS.md](REMINDERS.md). The scaffold document was deleted with the scaffold.
- **v0.17.0:** small: a "Send feedback" share-sheet message in Diagnostics and unused library permissions (overlay, shared storage, biometrics) removed from the manifest. Not device-verified. Also in the repo since then (docs/tools, no app change): pilot kit and metrics script, Play data-safety draft, live quota check, kill-switch and D1 restore rehearsal. See [PILOT-KIT.md](PILOT-KIT.md), [DATA-SAFETY-DRAFT.md](DATA-SAFETY-DRAFT.md).
- **v0.18.0:** GAIN is completely free: no subscriptions, in-app purchases or paid tiers; the v0.13.0 paywall scaffold and its Plans page were removed (PR #121). Unit-tested only, not device-verified.
- **v0.19.0:** at Mohamed's explicit request (overriding the template freeze for this one template): 4-day template `ppl_upper_4` "Push / Pull / Legs / Upper" (gym, hypertrophy; no equivalent existed among the 47), now 48 templates; English UI text, docs and comments now say "program" instead of "programme" (database names, stored values, sync tables, import/export formats, route names, i18n keys and Arabic text unchanged; this file's older entries keep the spelling they were written with); plan docs record Mohamed's report that the five "Now" priorities are done and the Device verified gate passed (reported, not independently verified). Unit-tested only, NOT device-verified, not trainer-reviewed; the Arabic template name is a draft. APK `gain-v0.19.0-arm64.apk` SHA-256 `fb61376f36e62b7f4e0aecf64fea03ce699f140f8af762ea3576df6b1990f22f` (re-downloaded from GitHub and re-hashed: identical; signer 571bc5a8...c5b2). Tests: engine 365, sync 19, mobile 747, server 90.
- **v1.0:** Play Store public launch (Arabic + English).
- **v1.x:** iOS, post-launch metrics.


## 3. Release notes and status paragraphs as they stood in MASTER-PLAN.md (written 2026-10-02 to 2026-10-03)

Original header line:

> Written 2026-10-02 from the code on `main` (v0.3.0, rule-v0.3); status rows updated through v0.18.0 (v0.18.0: GAIN made completely free, paywall scaffold removed, NOT device-verified; v0.17.0: feedback share sheet + unused permissions removed, NOT device-verified; v0.15.0: fixes and design pass from two outside reviews, NOT device-verified, see section 1; 47 programme templates with a Home/Gym picker; v0.13.0: timed exercises, training-day reminders, paywall scaffold (since removed in v0.18.0), library twin map, trainer/listing/retention docs; v0.12.0: 600-exercise library; v0.11.0: opt-in Back up and sync, private coach links, Cloudflare Worker deployed), not from intent. Product spec: [PRODUCT.md](PRODUCT.md). Rules: [PROGRESSION-RULES.md](PROGRESSION-RULES.md). Backtest: [BACKTEST-HEVY.md](BACKTEST-HEVY.md). Update the status table whenever a step ships.

Original "free" paragraph (the authoritative statement now lives in [PRODUCT.md](PRODUCT.md), "Free for everyone"):

> **GAIN is completely free. No subscriptions, in-app purchases, or paid feature tiers.** (Decision 2026-10-03.) The paywall scaffold added in v0.13.0 (`logic/plans.ts`, the hidden Plans page, `docs/PAYWALL-SCAFFOLD.md`) and the old Step 24 (subscription, paywall, pricing test) were removed in the change that made this decision. Older status paragraphs below (v0.13.0, v0.15.0, D9) still mention the scaffold or a "free" recommendation as they were written at the time; they are left as history. Every feature is available to everyone; the sync server's storage and request limits are abuse protection, not a tier.

**Hardening done without a phone (2026-10-03):** fresh-clone build and signing verified (RELEASE-PROCESS.md section 8); D1 Time Travel status checked and restore steps documented (SYNC.md); `npm audit` reviewed, 30 findings all in build/test tooling, nothing safely patchable ([DEPENDENCY-AUDIT.md](DEPENDENCY-AUDIT.md)). None of this is device verification.

**More hardening done without a phone (2026-10-03, evening Cairo time):** the live Worker's account quota was exercised (413 at 24.6M of 25M characters, throwaway account deleted, database empty after); the kill switch (`0`, `writes`, `1`) and a D1 Time Travel restore (restore, verify, undo, generation bump) were rehearsed on a throwaway Worker + throwaway D1, then deleted (SYNC.md, `apps/server/scripts/limits-smoke.mjs`); a pilot kit was written (PILOT-KIT.md, metrics script, consent drafts, bug template); a Play data-safety draft was written from the real data flows and the built APK (DATA-SAFETY-DRAFT.md), which also found that the privacy draft's permission list was wrong (see v0.17.0 below). None of this is device verification, none of the drafts is reviewed by a lawyer, trainer or native-Arabic reader.

**v0.18.0 (small; unit-tested only, NOT device-verified):** GAIN is completely free: no subscriptions, in-app purchases or paid tiers. The v0.13.0 paywall scaffold (plans logic, hidden Plans page, its strings and tests, PAYWALL-SCAFFOLD.md) was removed (PR #121) and replaced by a small test that the app has no billing or plan code. The Settings screen no longer has any plan entry. The risk is a leftover screen or setting that references the removed code, or a Settings layout regression; only a phone run can rule that out (new checklist row 26 in NATIVE-CHECKLIST.md). No engine, SQLite, migration or sync changes. **Published 2026-10-03 as pre-release v0.18.0** (https://github.com/ElMolla10/gain/releases/tag/v0.18.0), signed with the existing release key (signer SHA-256 `571bc5a8...c5b2` verified), APK SHA-256 `fc21d0f9626a8b28a1b69a20f6d57bcf17a0a753608f8f4254c5b94def8db1f0`, a re-download hashes identically. Still nobody has installed it on a phone.

**v0.17.0 (small; unit-tested only, NOT device-verified; checklist rows 21-25 in NATIVE-CHECKLIST.md):** Settings > Diagnostics > "Send feedback" opens the share sheet with an editable text message (three questions + app/Android/language/schema + the latest three crash-note lines, no stacks, no workout data; nothing is sent by the app; English with a draft Arabic version). Android permissions that libraries added but GAIN never uses were removed from the manifest (overlay `SYSTEM_ALERT_WINDOW`, `READ/WRITE_EXTERNAL_STORAGE`, `USE_BIOMETRIC`, `USE_FINGERPRINT`); the risk is that something I believe is unused (system file picker, share sheet) does need one of them on some phone, which only a device run (rows 22-23) can rule out. No engine, SQLite, migration or sync changes.

**v0.16.0 (visual identity + logger refinement, unit-tested and web-rendered only, NOT device-verified; checklist in NATIVE-CHECKLIST.md):** GAIN electric-lime-on-charcoal identity with bundled Plex fonts, session-first Today with a Change workout picker, compact logger with a status line, muted-green done ticks (lime reserved for the current set and primary actions), tighter logger spacing, and the starter-programme note on Today. No engine, SQLite, migration or sync changes. Details: DESIGN.md.

**v0.15.0 (fixes + design pass, unit-tested only, NOT device-verified):** one charcoal + mint look across navigation, logger and all screens with a fixed type scale; Today leads with "{day} · {sets} sets · ~{min} min" and a big Start button, then targets, with "Next session: X" as the signature line on Today and Finish; logger shows "Target: X" with a small Why button and a Help sheet; compact expandable Plan day cards (exposure and versions moved to secondary screens, relabelled "planned direct sets"); compact History rows; grouped Settings (Training, Display, Data, About) with an appearance choice; second-language exercise names hidden by default (a Settings switch). Fixes: jump guard, rep-range display, partial sets, empty-workout discard, error/retry states, 48dp set controls with TalkBack labels, onboarding "Just start logging"/"No goal for now"/Import path, honest session-length estimate, optional warm-ups for later isolation work, a second SQLite connection for sync/restore, verified backups before migration and restore (with an automatic before-restore copy), sync token and recovery code in secure storage, a rest-timer render fix, free next-weight recommendation, claims reworded (standard weight steps; ACSM-based with GAIN conventions; no AI claim). **Server side (correction 2026-10-03):** migration `0003_generation.sql` and the Worker with generation, quota, kill switch and the daily cron WERE deployed and smoke-tested on the live Worker the same day (see SYNC.md, "Deployment status of v0.15.0 server changes"; this paragraph wrongly said "not deployed" until now). The quota was later exercised live and the kill switch and a D1 Time Travel restore were rehearsed on throwaway resources (below). None of it is verified on a phone.

**Outside-review items P01-P32, status at v0.15.0 (all merged to `main`; every "done" is code + unit tests, NOT verified on a device).** The original review text is not stored in this repo, so the labels below come from the PR titles and commits (#91-#113); where a number appears in no PR, commit or doc it is listed as not addressed rather than guessed.
- **Done (code + tests, not on a device):** P02 (second SQLite connection for sync/restore/delete-all, #104; tested with two real connections on Linux, not under expo-sqlite), P03 and P08 (honest claims wording, #111), P04 (confirm load jumps over 10%, #95), P05 (effective rep range shown, #96), P06 (sync secrets in secure storage, #106), P09 (nav icons/labels/accent, #91), P10 (logger Help sheet, compact Next line, #92), P11 (discard empty workout, #93), P12 (error/retry states, #94), P14 and P15 (verified backups, blocked migration without a copy, #105), P18 (onboarding fast path, #108), P20 (set-control labels, #109), P22 (backtest caveat documented, #111), P23, P24, P25 (session length, "planned direct sets", optional warm-ups, #110), P28 (Android export CI job, #111), P29 (vitest 3.2.7, dev only, #113; other `npm audit` findings in tooling are not claimed fixed), P31 (next-weight recommendation stays free, #111), P32 (frozen-items note only; nothing built).
- **Partial:** P07 and P17 (server generation, quota, kill switch, cron: migration `0003_generation.sql` and the Worker ARE deployed (correction: this row used to say not deployed); the quota was exercised live (413 at 24.6M of 25M characters, 2026-10-03), the kill switch on a throwaway copy of the Worker, and the cron has not run yet (first run 03:23 UTC); the phone-side reconcile is not device-verified; #107), P19 (48dp targets and per-control labels in code; TalkBack and font-scaling never checked on a device, #109; re-reviewed 2026-10-03: no further code-only change found that I can verify without a device), P21 (partial sessions no longer earn progression; the engine supports the top-set/back-off shape but the app has no UI to create or show it, #97; re-assessed 2026-10-03 and NOT built: it needs a programme-editor control, target/logger display, Arabic strings and migration or data-shape decisions, which is a feature rather than a small change, and nothing can be device-checked), P26 (the Strong import is documented as synthetic-evidence only; no real Strong export was tested), P27 (rest-timer ticks isolated in `RestClock`; exercise sections are not memoised; no phone performance measurement, #112; memoising the logger's exercise sections was considered on 2026-10-03 and NOT done: the 1,100-line `WorkoutScreen` shares many callbacks and a stale-closure bug there would lose or mis-save sets, and no component test or device exists to catch it. Measure on a phone first).
- **Skipped (needs legal review, an outside person or a device):** anything needing lawyer review of the privacy policy/terms, trainer sign-off, native-Arabic review, Play Console, or on-device checks (TalkBack, RTL/dark, update-over-install, lock-screen timer). Those remain in the "Still blocked" list below.
- **Not addressed / unknown:** P01, P13, P16, P30 appear in no PR, commit or doc, so no work on them is recorded; check them against the original review text.
- **Design pass D1-D6 (#98-#103):** all six branches are merged (one charcoal + mint identity, fixed type scale enforced by a test, 48dp targets kept, Today/logger/Plan/History/Settings reworked, second-language exercise names hidden by default). Looks and font scaling at large sizes have not been seen on a phone.

**Still blocked after v0.14.0 (needs a real phone, an outside account, payment or Mohamed's decision):** on-device checks of everything (Step 1, update-over-install of migration 9, TalkBack, RTL/dark, reminder and screen-off timer delivery); foreground-service/lock-screen timer (native spike + phone); email sign-in (no provider); Play Console (account; and the self-updater's install permission vs a Play build); trainer sign-off, native-Arabic review and legal review (the packs are prepared, nobody has reviewed them); thresholds (D5); the pilot; screenshots/store assets (need a device); privacy-policy URL and support email; keystore backup custody; iOS.

## 4. Old "Next 5 steps" (section 0 of the pre-gates plan)

1. [~] **Step 1: put the current release on a real Android phone and an emulator** and walk the whole loop (onboard, import, log, finish, accept/reject, why). Write down everything that breaks. Fix only those bugs, ship v0.4.1. **Status 2026-10-02: PARTLY DONE, NOT device-verified.** The app (x86_64 build of v0.4.0) was launched on an Android 14 emulator and rendered onboarding steps 1-3, then the emulator became unusable (no hardware acceleration on this box; see [DEVICE-TEST-0.4.md](DEVICE-TEST-0.4.md)). The full loop has NOT been run on any device. Still needs a real phone (Mohamed).
2. [x] **Step 2: goals + pace (two clocks)** (in v0.5.0, unit-tested only, NOT device-verified; PR #25). Goals screen, weigh-ins, pace from the lifter's logs, one line on Today. Rules: [PACE-RULES.md](PACE-RULES.md).
3. [x] **Step 3: weekly one-decision review** (PR #27, rules in [WEEKLY-RULES.md](WEEKLY-RULES.md)) and **Step 4: short-week rebuild** (PR #28, rules in [SHORT-WEEK-RULES.md](SHORT-WEEK-RULES.md)). Both in v0.5.0, unit-tested only, NOT device-verified.
4. [x] **Steps 5-7: make the trust surfaces visible** (PRs #30, #31, #32; Step 9 warm-ups #33 in the same release v0.6.0): outlier confirm kept honest, rejection memory shown and undoable, history + trend per lift, decision-log screen. Unit-tested only, NOT device-verified.
5. [x] **Step 12 early: export and delete my data** (done, unit-tested only; docs/DATA-EXPORT.md). Needed before any other person installs the app (Step 20 pilot).

Rule for all steps: no step is "done" until it was run on a device (or is explicitly marked "unit-tested only").

## 5. Test counts, older runs

The current result is recorded once, in MASTER-PLAN.md section 1. Older runs, newest first:

- v0.21.0 release run: engine 391, sync 19, mobile 833, server 90.
- v0.20.0 release run: engine 365, sync 19, mobile 773, server 90.
- v0.18.0 release run (clean clone of `main` before release, RELEASE-PROCESS.md section 8): engine 365, sync 19, mobile 736, server 90.
- v0.17.0 run: engine 365, sync 19, mobile 740, server 90.
- v0.15.0 run: engine 365, sync 19, mobile 688, server 90.
- v0.14.0 run: engine 354, sync 19, mobile 613, server 83 (27 of the server tests run the real app sync engine on the real GAIN database against the real Worker code, with injected faults).
- v0.13.0 fresh-clone run (RELEASE-PROCESS.md section 8): engine 354, sync 19, mobile 565, server 83.
- The mobile count dropped by 4 from v0.17.0 to v0.18.0 because the paywall-scaffold tests were replaced by a smaller free-app test.

All of these ran on Node with SQLite standing in for D1. They are not phone tests.

## 6. Old milestone map (superseded by the gates in MASTER-PLAN.md section 3)

| Release | Steps | Exit criteria |
| --- | --- | --- |
| **v0.4.0** | (unplanned, shipped early) | kg/lb units, onboarding without a gym step. Used this number before the milestone map reached it, so every later milestone below is one minor higher than the first version of this plan. |
| **v0.4.1** | 1 | Device test file committed; the full loop passes on one real phone and the emulator; no data loss. |
| **v0.5** | 2, 3, 4 | Goal pace, weekly decision and short-week rebuild work on device and have hand-checked tests. |
| **v0.6** | 5, 6, 7, 9 | Outlier/rejection surfaces, History + trend per lift, decision-log screen, warm-ups on device. |
| **v0.7** | 8, 10, 12, 13 (11 shipped in v0.4.0) | Reviewed library and aliases, native timer, export/delete round-trip, local coach card. **Shipped as v0.7.0 pre-release, partly:** export/delete (12) built; rest alert (10) and coach card PDF (13) built; library (8) grown but all Arabic still DRAFT and unreviewed; nothing device-verified. The milestone's own bar (reviewed library, timer working screen-off on a phone) is **not met**. |
| **v0.8** | 14, 15, 16, 17, 18, 19 | A11y/RTL checklist passed, offline/perf tests passed, trainer feedback in, policy and consent live, signed APK process written. **v0.10.0 pre-release built code-level parts of 14, 15, 17 (drafts), 18 (local only), 19 (drafts); the milestone's bar is not met:** no device checks, no trainer feedback (16), no legal review or live policy. |
| **v0.9 (pilot)** | 20 | Pilot report with agreement, week 1/2/6 retention and bug list; go/no-go on paying. |
| **v0.10** | 21, 22, (23), 24, 25 | Sync, shared gyms, coach links, (paywall test purchase: removed, GAIN is free), closed testing on Play. Model layer only if the pilot shows it is needed. **Shipped as v0.11.0 pre-release, partly:** sync (21) and coach links (22) built and deployed; shared gyms dropped; email sign-in blocked; the paywall (since removed), Play closed testing and the model layer not started; nothing device-verified, so the milestone's bar is **not met**. |
| **v1.0** | 26, 27 | Public listing live (AR + EN), data safety form accurate, first hundred users plan running. |
| **v1.x** | 28, 29 | iOS via TestFlight; metrics reviewed against thresholds. |

Pilot (v0.9) deliberately comes before the backend: it tests the promise with local data only.
