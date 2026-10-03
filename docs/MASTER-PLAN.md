# GAIN master plan (A to Z)

Written 2026-10-02 from the code on `main` (v0.3.0, rule-v0.3); status rows updated through v0.18.0 (v0.18.0: GAIN made completely free, paywall scaffold removed, NOT device-verified; v0.17.0: feedback share sheet + unused permissions removed, NOT device-verified; v0.15.0: fixes and design pass from two outside reviews, NOT device-verified, see section 1; 47 programme templates with a Home/Gym picker; v0.13.0: timed exercises, training-day reminders, paywall scaffold (since removed in v0.18.0), library twin map, trainer/listing/retention docs; v0.12.0: 600-exercise library; v0.11.0: opt-in Back up and sync, private coach links, Cloudflare Worker deployed), not from intent. Product spec: [PRODUCT.md](PRODUCT.md). Rules: [PROGRESSION-RULES.md](PROGRESSION-RULES.md). Backtest: [BACKTEST-HEVY.md](BACKTEST-HEVY.md). Update the status table whenever a step ships.

**GAIN is completely free. No subscriptions, in-app purchases, or paid feature tiers.** (Decision 2026-10-03.) The paywall scaffold added in v0.13.0 (`logic/plans.ts`, the hidden Plans page, `docs/PAYWALL-SCAFFOLD.md`) and the old Step 24 (subscription, paywall, pricing test) were removed in the change that made this decision. Older status paragraphs below (v0.13.0, v0.15.0, D9) still mention the scaffold or a "free" recommendation as they were written at the time; they are left as history. Every feature is available to everyone; the sync server's storage and request limits are abuse protection, not a tier.

Conventions: `[ ]` open, `[x]` done. Sizes are S (days), M (1-2 weeks), L (several weeks) of focused work; no calendar dates. Nothing here is a forecast. Anything marked **unknown** has not been checked.

---

## 0. Next 5 steps (follow these first)

1. [~] **Step 1: put the current release on a real Android phone and an emulator** and walk the whole loop (onboard, import, log, finish, accept/reject, why). Write down everything that breaks. Fix only those bugs, ship v0.4.1. **Status 2026-10-02: PARTLY DONE, NOT device-verified.** The app (x86_64 build of v0.4.0) was launched on an Android 14 emulator and rendered onboarding steps 1-3, then the emulator became unusable (no hardware acceleration on this box; see [DEVICE-TEST-0.4.md](DEVICE-TEST-0.4.md)). The full loop has NOT been run on any device. Still needs a real phone (Mohamed).
2. [x] **Step 2: goals + pace (two clocks)** (in v0.5.0, unit-tested only, NOT device-verified; PR #25). Goals screen, weigh-ins, pace from the lifter's logs, one line on Today. Rules: [PACE-RULES.md](PACE-RULES.md).
3. [x] **Step 3: weekly one-decision review** (PR #27, rules in [WEEKLY-RULES.md](WEEKLY-RULES.md)) and **Step 4: short-week rebuild** (PR #28, rules in [SHORT-WEEK-RULES.md](SHORT-WEEK-RULES.md)). Both in v0.5.0, unit-tested only, NOT device-verified.
4. [x] **Steps 5-7: make the trust surfaces visible** (PRs #30, #31, #32; Step 9 warm-ups #33 in the same release v0.6.0): outlier confirm kept honest, rejection memory shown and undoable, history + trend per lift, decision-log screen. Unit-tested only, NOT device-verified.
5. [x] **Step 12 early: export and delete my data** (done, unit-tested only; docs/DATA-EXPORT.md). Needed before any other person installs the app (Step 20 pilot).

Rule for all steps: no step is "done" until it was run on a device (or is explicitly marked "unit-tested only").

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

---

## 1. Where we are today

Verified-on-device = **none recorded** for any row (the v0.2.0 release notes say the APK was not launched; nothing in the repo records a device run of 0.3.0; Mohamed to correct me if he has run it). CI runs `typecheck` + `test` on every PR. Tests passing today (v0.18.0, run on a clean clone of `main` before release: engine 365, sync 19, mobile 736, server 90; the mobile count is 4 lower than v0.17.0 because the paywall-scaffold tests were replaced by a smaller free-app test; v0.17.0 run: engine 365, sync 19, mobile 740, server 90; v0.15.0 run: engine 365, sync 19, mobile 688, server 90; the next figures are the older v0.14.0 run, kept for the record; the fresh-clone run in RELEASE-PROCESS.md section 8 was v0.13.0: engine 354, sync 19, mobile 565, server 83): engine 354, sync package 19, mobile 613, server 83 (of which 27 run the real app sync engine on the real GAIN database against the real Worker code, with injected faults). All run on Node; SQLite stands in for D1 there. They are not phone tests.

| Area | Status | What is really there |
| --- | --- | --- |
| Logger | Partly (v0.9.0 redesign after the Hevy reference screenshot; unit-tested logic only, the screen itself is NOT device-verified) | Hevy-style "Log Workout": dark/black (light theme follows the system) with a blue accent; top bar = collapse chevron (back to Today, workout stays open), title, rest-timer button (shows the countdown while running, opens a panel), prominent blue Finish; live **Duration / Volume / Sets** row (working sets only; warm-ups and rejected outliers never count); ONE scrolling list of ALL exercises. Per exercise: name in blue, three-dot menu (Notes / Replace for today only / Remove, with Put back), "Add notes here..." (saved on the phone), "Rest Timer: 1:30 / OFF" (tap = auto-start after a set on/off for this exercise), GAIN's **target + one-line reason** (tap = Why screen, or expands the reason when there is no stored target), then the table **SET \| PREVIOUS \| KG/LB \| REPS \| tick** (+ RIR box only for lifts that track effort). PREVIOUS = same-numbered working set of the last finished session of the same exercise/gym/setup ("90kg x 12"). KG and REPS are plain typed boxes (no steppers) whose **ghost text is today's target**: one tap on the tick logs it. Tick = saved on the phone at once (offline) and starts the rest timer; tick again = undo (set deleted, numbers kept); typing over a ticked row shows ↻ to update. Tap the set number = warm-up (W); swipe a row or long-press its number = delete. Outlier confirm, warm-up ladder, finish flow (confirm if nothing ticked or rows are filled but unticked) and next-session targets unchanged. Replace/Remove are for today only: the programme does not change; a replacement gets no next-session target yet; removing deletes that exercise's logged sets (asked first). Migration 6 (`session_exercise`) stores notes / removed / replaced / rest-off. **v0.10.0 (unit-tested only, NOT device-verified):** set types via the set-number menu (Normal / Warm-up W / Drop D / Failure F; drop sets never count toward targets, PREVIOUS or the rest timer), "+ Add exercise" for something not in today's day (today only, never changes the programme; migration 7), supersets ("Superset with...", rest only after the last member), a failed save now shows an alert instead of failing silently. Not done: muscle figures, exercise thumbnails, adding an exercise permanently to the programme from the logger. |
| Timed exercises (plank, dead hang, farmer's walk) | **v0.13.0, unit-tested only, NOT device-verified** | Exercises count in reps (default), seconds or metres (migration 9: `exercise.measure`, `duration_s` / `distance_m` on sets and targets). Logger box becomes Sec/Metres (accepts `45` or `1:30`), PREVIOUS and targets in s/m, no warm-ups or RIR for timed, timed sets never count toward volume. Engine rule `timed-v0.1` (draft, **not trainer-reviewed**): progress seconds or metres inside a range, keep the load. History, trend, finish, decision log, Why, coach card, JSON backup and CSV (`duration_seconds`, `distance_km`) handle them; the importer reads timed rows. A lifter's seconds-only 'Farmers walk' against the library's metres exercise is reported as not fitting, never converted. Not built: hold stopwatch/countdown, a measure choice in the custom-create form (switch it in the programme editor), Arabic review. [TIMED-EXERCISES.md](TIMED-EXERCISES.md). |
| Finish flow | Done (unit-tested) | Summary, records, next-session targets written at finish, accept / edit / reject, saved. |
| Targets + reasons | Done (unit-tested) | rule-v0.3 (based on ACSM 2009; the rep ceilings 10/12/15, one-session trigger and step snapping are GAIN conventions, not ACSM), currency order, confidence, Why screen. |
| Gym fingerprint | Data layer only (v0.8.0: UI removed) | A silent default gym with standard loads in the lifter's unit; the engine still snaps loads to it; planned sessions follow the rack; the standard rack swaps kg/lb automatically on a unit switch. **No Gym tab, editor or any link to one** (guarded by a test). Several gyms, copy and switch still exist in the repo but have no screen. |
| Programme editor | Done (unit-tested) | Days, exercises, versions, weekly exposure effect, exercise picker, custom exercises, **47 draft templates** (7 older + 40 new in **v0.14.0**: full body 2/3/4, minimal and 30-minute, machines-first, general fitness, upper/lower 2/4/5, PPL 3/5/6, PHUL-/PHAT-style, bro, Arnold 3/6, torso/limbs, 3x5 and 5x5 strength shapes, volume and "bulking phase", glute, arms/shoulders, and 18 home programmes with dumbbells, bands or no equipment; see [TEMPLATES.md](TEMPLATES.md)). Picker **grouped by days per week and filterable by days, Home vs Gym (Home = bodyweight/dumbbell/bands; Gym shows everything), equipment you have, goal and level**, in first-run setup and the programme switcher. **Unit-tested only; the picker layout, RTL and the flow are NOT device-verified; the 40 new templates are NOT trainer-reviewed** (Mohamed reports a trainer said the original 7 workouts/templates are good, 2026-10-03; identity and scope not recorded); all Arabic template names are drafts; in-app draft labels stay. GZCLP-/5-3-1-style programmes were skipped: the engine has no tiers, percent-of-max or wave state. **v0.8.0: "Choose a different programme"** (Programme tab): switch back to any of your programmes (versions and history stay) or start a template as a NEW programme; blocked while a workout is open. |
| Onboarding | Done (unit-tested; v0.8.0 changes NOT device-verified) | Language, units (kg preselected, lb offered), basics (days, minutes), goal, optional about-you (height, birthday, bodyweight), programme, review. **No equipment question (v0.8.0: a full gym is assumed) and no gym step (v0.4.0):** a default gym with standard loads in the chosen unit is created silently. After choosing a template the step shows only each day's title and the weekly exposure (the full split is edited later in the Programme tab); "Build my own" keeps the editor. Dates (birthday, goal date, weekly "another date") are picked with day/month/year selectors, never typed (`DateSelect`, no native module). The birthday is new in v0.8.0, optional, stored as setting `birth_date`, used for nothing yet. Re-runnable from Settings (only adds a programme). |
| Hevy/Strong import | Done (unit-tested) | Parser (Hevy kg/lb, Strong), preview, exercise mapping, dedupe, undo, hidden history programme. Tested on Mohamed's export and a synthetic file. Strong is covered by tests only: no real Strong export seen (**unknown**). |
| Goals / pace | Done (unit-tested only, v0.5.0) | Goals screen (lift, bodyweight, muscle), weigh-ins, Theil-Sen trend, pace from logs, one line on Today. Thresholds are my defaults, **Mohamed to confirm** ([PACE-RULES.md](PACE-RULES.md)). Not run on a device. |
| Weekly decision | Done (unit-tested only, v0.5.0) | Card on Today, rule `weekly-v1`, accept / edit date / skip, past reviews in Goals. Only a date move changes anything; other proposals are recorded and the card says the programme is not edited. Week start day (default Monday) and card-vs-notification are **Mohamed's call**. Not run on a device. |
| Short-week rebuild | Done (unit-tested only, v0.5.0); **v0.10.0 fixes two bugs** (also unit-tested only) | Days + minutes entry on Today, preview with the cut list, applies as a new programme version, undo, auto-return after the week, goal lifts protected ([SHORT-WEEK-RULES.md](SHORT-WEEK-RULES.md)). Rules are my defaults; the short-week rules are NOT confirmed as reviewed by a trainer (the 2026-10-03 report covers workouts/templates only, scope not recorded). Fixed in v0.10.0: a short week now belongs to the programme it was made for (switching programme no longer leaves the other programme short or the old short week stuck), and applying a short week is one atomic write (a kill between the two writes used to leave the short programme with no restore record). Not run on a device. |
| Rejection memory UI | Done (unit-tested only) | Settings > "Things I've stopped suggesting": every declined jump per lift and gym with count and stopped state, bring it back, undo. Finish screen says how many declines so far and when a jump stops. Not run on a device. |
| Outlier confirm UI | Done (unit-tested only) | Logger asks confirm/reject for a set far from the line; unconfirmed sets never move the next target (tested with a 100-reps typo run against a clean run), and typo cases (100 reps for 10, 100 kg for 10 kg, extra zero) are engine-tested. Edit-in-history comes with Step 6. Not run on a device. |
| Exercise library + Arabic aliases | Partly (DRAFT, unreviewed) | **v0.12.0: 607 exercises** (50 older + 557 new, Hevy-style English names, muscle / gear / rep-ceiling class per row; see [EXERCISE-LIBRARY.md](EXERCISE-LIBRARY.md) for counts, sources and licences), topped up once by `seed_key` into existing and new installs, never overwriting, renaming or resurrecting the lifter's rows. Every title in the Hevy export fixture resolves to a library row (tested; the real export previews with 0 new exercises). Picker: search by English name or Arabic name/alias (letters ة/ه, أ/ا unified), muscle and gear filters, 50 rows per page. **All Arabic names and aliases began as my drafts. Mohamed reports (2026-10-03, on his word) he reviewed the Arabic and it looks good; reviewer identity and scope not recorded, and that report predates the 557 new rows, which nobody has reviewed**, so the "draft" labels stay; no cues, setup text or media. **v0.13.0:** nine same-movement pairs (e.g. Conventional Deadlift / Deadlift (Barbell)) are recorded as twins; rows are never merged or renamed, and a file import suggests the twin the lifter already uses (unit-tested only). Names checked against Hevy's own list: **no** (not public). Generated review sheet: [ARABIC-REVIEW-SHEET.md](ARABIC-REVIEW-SHEET.md). Reviewers and the native 20-term check still open; **D4** answered in practice (large library), pilot misses will tell what is still missing. |
| History / trends | Done (unit-tested only) | History tab: sessions (imported labelled), lifts, session detail with edit / delete a set, trend per lift (top working set, plain bars, direction in words). Rules: [HISTORY-TREND.md](HISTORY-TREND.md). The measure is my default (**Mohamed to choose**). No chart library, no phone timing yet. |
| Rest timer | Partly (compiles, unit-tested only; **no change in v0.10.0**) | In-app timer plus Settings: default rest, vibrate, optional end-of-rest notification (permission flow). Screen-off delivery, killed-app delivery and battery-saver behaviour are **untested**; no lock-screen countdown, no reminders ([REST-ALERT.md](REST-ALERT.md)). |
| Warm-ups | Done (unit-tested only) | "Add warm-ups" in the logger: preview of the engine's ladder on gym-real loads, logged as warm-ups, once, never change the next target. Scheme is the engine default, **Mohamed to confirm** ([WARMUPS.md](WARMUPS.md)). Not run on a device. |
| Notifications | Partly (v0.13.0: unit-tested only, NOT device-verified) | Rest-timer alert plus **opt-in training-day reminders** (Settings; OFF by default; the lifter chooses weekdays and a time; local weekly notifications, neutral text with no streak or guilt wording, EN+AR drafts; resynced at app start; language change applies at next start). Delivery, battery-saver behaviour and the permission flow on a real phone are untested. No weekly-review notification. [REMINDERS.md](REMINDERS.md). |
| Export / delete | Done (unit-tested only) | Settings > Your data: JSON backup, CSV of sets in Hevy columns (re-imports), restore (checked, all-or-nothing, replaces), delete everything (back to first run). Share sheet / picker not run on a phone. Android auto-backup still on: **Mohamed to decide** ([DATA-EXPORT.md](DATA-EXPORT.md)). |
| Settings | Partly | Language, RTL override, rep ceilings, import, set-up-again, version. Unit switch kg/lb, rest timer settings, Your data (v0.10.0: also shows the pre-update safety copy), **Check for updates (v0.8.0)**, **Diagnostics** and **Privacy and safety** (v0.10.0, DRAFT text, unit-tested only). No theme choice (follows system). |
| Today / schedule | Done (v0.8.0, unit-tested only, NOT device-verified) | Today lists every day of the active programme with the rotation's suggestion marked ★; the lifter picks any day. The chosen day gets its own planned session and targets; planned sessions of other days are voided, so missed workouts never stack. The rotation continues from the day actually finished. An open workout is resumed, not duplicated. |
| Self-update | Partly (v0.8.0, unit-tested logic only, NOT device-verified) | Settings > Check for updates: GitHub releases API (public, no token, pre-releases included), compares with the installed version, shows version + notes, downloads the arm64 APK, verifies SHA-256 (GitHub digest or release notes) and opens the Android installer (same signing key = update in place). Never run on a phone: the file-provider URI, the unknown-sources prompt and the install-over are unverified ([UPDATES.md](UPDATES.md)). |
| Dark mode / RTL | Partly (v0.10.0: code-level QA done, nothing looked at on a device; [A11Y-RTL-CHECKLIST.md](A11Y-RTL-CHECKLIST.md)) | Dark palette follows system; RTL flips via `direction`. Arabic strings are drafts, including everything added in v0.8.0 and the v0.9.0 logger (workout list, Today day choice, programme switch, date selectors and month names, updates; in `strings.workout/date/update/programme.ts`). The v0.9.0 logger has a light palette and uses start/end layout (RTL flips rows, swipe direction and the target bar), but neither theme nor RTL has been looked at on a device. |
| Coach card | Partly (unit-tested only) | Finish screen: share a one-page PDF (session, next targets, pace line for lift/muscle goals, no bodyweight, not-a-doctor line) in English or Arabic. No image version. **v0.11.0:** also "Share as a link" (consent card, private random link, 7 days, stop sharing; server deployed, no account for the coach; unit/e2e-tested, not on a phone). PDF layout, Arabic rendering and share sheet never run on a phone ([COACH-CARD.md](COACH-CARD.md)). |
| Decision log screen | Done (unit-tested only) | Settings > Decision log (and a button in History): every stored decision with lift, gym, suggested number, what you did, sentence, rule version, path; filter by lift; tap for the stored inputs. Old/unknown rule formats fall back to the stored sentence. [DECISION-LOG.md](DECISION-LOG.md). Not run on a device. |
| Backend / sync | **Server deployed and smoke-tested; app side built (v0.11.0), NOT device-verified; email sign-in BLOCKED** | Cloudflare Worker `gain-sync` + D1 `gain-sync` (free plan) at https://gain-sync.elmolla10.workers.dev: anonymous account + recovery code, event push / cursor pull, idempotent client event UUIDs, tombstones, last write wins per row, rate limits, delete-account. App: Settings > Back up and sync (OFF by default, plain privacy text, recovery code, turn off / delete backup), auto-sync only when on, restore-first first sync (no merge of two populated phones), parked rows reported. Email code sign-in implemented but **BLOCKED: no email provider** (Resend path is only tested with a mock; the deployed Worker answers 501). D3 default adapted: anonymous + recovery code works now, email later. Never run on a phone; D1 free-tier limits unmeasured; region ENAM (checked 2026-10-03), Time Travel on (7 days if on free plan), restore rehearsed once on a throwaway D1 (SYNC.md; the live DB was never restored), quota exercised live, kill switch exercised on a throwaway Worker, no export outliving Time Travel. [SYNC.md](SYNC.md), [SYNC-CLIENT.md](SYNC-CLIENT.md). |
| Shared gyms | **DROPPED** | The gym UI was removed in v0.8.0 (a silent default gym), so there is nothing to share. Not built; D8 is moot. Can come back only if gyms return as a feature. |
| Pricing / monetisation | **None: GAIN is completely free** | No subscriptions, in-app purchases, paid feature tiers, ads or donation prompts. The v0.13.0 paywall scaffold was removed (history: Step 24 below, v0.13.0 notes). Sync-server storage and request limits remain as operational safeguards, not tiers. |
| Model layer | Seam + guardrails (tests only) | `ModelAdvisor` interface + `needsModel` flag, and since v0.10.0 pure guardrail code (`modelGuard.ts`: fixed rationale keys, gym-real loads within one step, rep range, no invented history, flagged-only, offline = rule, `path=model` log); nothing implements or calls a model ([MODEL-GUARDRAILS.md](MODEL-GUARDRAILS.md)). |
| Analytics / privacy | Partly (v0.10.0, drafts; v0.17.0 adds a text feedback share and corrects the permission list) | No analytics and no third-party crash reporting. A local-only crash log with an opt-in share (Settings > Diagnostics, [DIAGNOSTICS.md](DIAGNOSTICS.md)); privacy policy and terms are **DRAFTS needing legal review** ([PRIVACY-POLICY-DRAFT.md](PRIVACY-POLICY-DRAFT.md), [TERMS-DRAFT.md](TERMS-DRAFT.md)) with an in-app Privacy and safety page and health notes; tests guard that only the update check, the opt-in sync transport and the coach link use the network (v0.11.0: the draft policy and privacy page now describe Back up and sync and coach links). Native crashes are not logged; no event analytics (needs D7). |
| Store release | Not started (v0.13.0: listing text DRAFTS and asset checklist only, [PLAY-LISTING-DRAFT.md](PLAY-LISTING-DRAFT.md)) | Sideload APKs only (v0.1.0 to v0.13.0, arm64, own keystore; process in [RELEASE-PROCESS.md](RELEASE-PROCESS.md)). `app.gain.mobile` id. iOS config exists in `app.json`, nothing built or tested. |

Honest signals from existing evidence: the Hevy backtest says the rule agrees with Mohamed's actual load 58% of the time vs 60% for "just repeat last load", and it proposed a heavier load in 4% of sessions while he went heavier in 26%. He normally raises the load well before 10/12/15 reps. That is one lifter's history; it is a flag for the trainer review (Step 16) and the pilot (Step 20), not a bug to tune away.

Doc conflicts to resolve: PRODUCT.md says the first release is "native iOS and Android"; PLAN.md says Android first, iOS out of scope. This plan follows PLAN.md (see decision D1).

---

## 2. Steps from here to public launch

Each step: goal, deliverables, done means, tests, size, Mohamed, risks. Steps are in dependency order.

### Step 1. Real-device testing and fixes (first)
- [ ] **Goal:** know what actually works on a phone.
- **Deliver:** test script (below); emulator run (Android Studio AVD) and a real Android phone; a list of bugs; fix PRs; v0.4.1.
- **Done means:** a new install and an upgrade-over-0.2.0 install both complete: onboard, import the Hevy export, log a full session with the screen locking mid-session, finish, accept/edit/reject, open Why, switch language to Arabic, restart. No crash, no lost sets. Results recorded in `docs/DEVICE-TEST-0.3.md` (pass/fail per line, phone model, Android version).
- **Test:** manual script covering every screen; also kill-app mid-set, airplane mode, big import (1,049 rows), RTL flip, dark mode, 200% font size.
- **Size:** M.
- **Mohamed:** the phone, his Hevy export, an hour to run the script and report; tells me the phone model.
- **Risks:** first launch ever on a device may surface blocking bugs (SQLite open, import file picker, RTL restart). Release builds differ from dev builds, so test the signed APK, not only Expo dev.

### Step 2. Goals + pace (two clocks)
- [x] (unit-tested only, NOT device-verified; device check still owed) **Goal:** "Come back knowing if the goal is still on pace."
- **Deliver:** Goals screen (lift goal, bodyweight goal with rolling average, muscle-exposure goal); bodyweight logging; pure pace functions in `packages/engine` (exposures-based, not calendar-only); Today one-line pace; a missed week moves the expected date or required rate; written pace rules added to docs.
- **Done means:** with a seeded history, pace says on pace / behind / ahead with the numbers it used; one heavy bodyweight day does not move the trend; "No goal set yet" appears only when there is none.
- **Test:** engine unit tests with hand-computed cases; replay Mohamed's Hevy history; device check.
- **Size:** L.
- **Mohamed:** confirm what "on pace" means for a lift (e.g. required weekly rate toward the target); the exact wording of the pace line (Arabic + English).
- **Risks:** a pace formula can look scientific while being a guess. Say plainly it is an estimate and show inputs. No physique or rate promises (PRODUCT.md boundary).

### Step 3. Weekly one-decision review
- [x] (unit-tested only, NOT device-verified; device check still owed) **Goal:** once a week, one screen: exposures done, goal lifts up/flat, pace, and one proposed change (keep / small change / easier week).
- **Deliver:** weekly review screen; rule that picks one change (extra exposure, 2-week variation, or later date); observed numbers and interpretation visually separate; accept/edit/skip stored in the decision log.
- **Done means:** the review appears once per training week, never changes the plan without a tap, and says plainly when data is too thin.
- **Test:** engine tests across behind / on pace / short week; device walk-through.
- **Size:** M (depends on Step 2).
- **Mohamed:** which day the "week" starts; whether the review is a notification or just a card on Today.
- **Risks:** it must not claim to measure fatigue or recovery.

### Step 4. Short-week rebuild
- [x] (unit-tested only, NOT device-verified; device check still owed) **Goal:** "I can train 3 days" or "I have 35 minutes" rebuilds the week around goal lifts and priority muscles.
- **Deliver:** entry on Today/Programme; rebuild logic (accessories drop first, priority-muscle weekly floor, rest not crushed); preview showing what was cut before starting; undo; programme version recorded.
- **Done means:** goal lifts are never cut before accessories; the user sees the cut list; the original programme returns next week.
- **Test:** engine/logic tests over all templates (47 in v0.14.0: the sweep found and fixed an unmeetable-floor bug); device check.
- **Size:** M.
- **Mohamed:** the priority order of cuts if goal lifts conflict with priority muscles (default: goal lifts first).
- **Risks:** a rule that drops volume must not be presented as a coaching claim until the trainer review (Step 16).

### Step 5. Outlier confirm and rejection memory surfaces
- [x] (unit-tested only, NOT device-verified; device check with real typos still owed) **Goal:** the two "the app heard me" behaviours are visible and reversible.
- **Deliver:** outlier prompt tested with real typos and edited in history; "Things I've stopped suggesting" list (per lift, jump kind, count) with undo; plain message at finish when a jump is no longer proposed.
- **Done means:** after 3 rejections the user sees why the jump stopped and can bring it back; an unconfirmed outlier never moves the next target.
- **Test:** existing logic tests plus device runs of typo cases (e.g. 100 instead of 10).
- **Size:** S-M.
- **Mohamed:** none beyond wording.
- **Risks:** too many prompts feel naggy; check the threshold against the pilot.

### Step 6. History and trend per lift
- [x] (unit-tested only, NOT device-verified; phone performance check still owed) **Goal:** see sessions and one trend per lift.
- **Deliver:** History tab (sessions, sets, edit/delete a set), per-lift trend (best set / estimated trend; choose one measure and say which), gym/setup kept separate, imported history labelled.
- **Done means:** a lift with 20+ sessions draws a trend in under a second on the test phone; assisted/bodyweight lines never mixed with free weights.
- **Test:** unit tests for the measure; device performance check (Step 15 thresholds).
- **Size:** M.
- **Mohamed:** which single trend measure (default: top working set load at the lowest rep count that still counts, shown with reps).
- **Risks:** chart library weight on low-end phones; RTL axis labels.

### Step 7. Decision log screen
- [x] (unit-tested only, NOT device-verified) **Goal:** "Why this weight?" for any past decision.
- **Deliver:** list of decisions per lift/date with inputs, rule version, path (rule or model), user action; filter by lift.
- **Done means:** any shown target traces to its stored inputs.
- **Test:** logic tests; device.
- **Size:** S.
- **Mohamed:** none.
- **Risks:** old rule versions must still render after rules change (needs Step 16 versioning).

### Step 8. Exercise library, Arabic aliases, native review
- [~] **Status: content drafted (v0.7.0, unit-tested only); review only partly reported.** Reported OK by Mohamed 2026-10-03 (on his word); reviewer identity and scope not recorded: Mohamed says he reviewed the Arabic and it looks good. This is not the Done-means bar below (two native Egyptian lifters/trainers signed off, 20 search terms checked), so it is not counted as sign-off. Library grew from 20 to 50 exercises with draft Arabic names and aliases (only spellings and short forms of my own names, no slang I cannot source; no cues or media). Review sheet generated ([ARABIC-REVIEW-SHEET.md](ARABIC-REVIEW-SHEET.md)); a test keeps it in sync. **Not done:** recorded native sign-off (two reviewers, per-row verdicts), the reviewers' 20 search terms, alias-aware import matching, short cues, equipment/setup text, D4 target size. "Draft" labels stay in the app. **Goal:** a library people will find their lifts in, in Egyptian gym language.
- **v0.12.0 update:** library grown from 50 to 607 exercises (Hevy-style names, muscle, gear, ceiling class, draft Arabic; sources and licences in [EXERCISE-LIBRARY.md](EXERCISE-LIBRARY.md)); picker search and muscle/gear filters; import matching now resolves every title of the real Hevy export to a library row. Unit-tested only, never run on a phone. The 557 new rows have **no** Arabic review at all. Still not done: recorded native sign-off, the reviewers' 20 search terms, short cues, D4 follow-up.
- **Deliver:** library target size (decision D4); fields: Arabic name, aliases, equipment, setup, short cue (licensed or self-written, no copied media); import-matching improved with aliases; review sheet for native speakers; fixes applied; "draft" labels removed only after review.
- **Done means:** at least two native Egyptian lifters/trainers signed off the Arabic names and aliases; searching 20 typical Arabic terms they supply finds the right lift.
- **Test:** search tests from their term list; Hevy/Strong import match rate on real exports.
- **Size:** L (mostly content).
- **Mohamed:** recruit the reviewers; decide demo/media policy; confirm licences for any media.
- **Risks:** copyright on images/videos; slang varies by city.

### Step 9. Warm-ups UI
- [x] (unit-tested only, NOT device-verified) **Goal:** warm-up sets calculated from today's target on gym-real loads.
- **Deliver:** "Add warm-ups" in the logger using `generateWarmups`; logged as warm-ups; excluded from progression (already so).
- **Done means:** 100 kg target with this rack gives loads that exist here; warm-ups never change the next target.
- **Test:** existing engine tests + device.
- **Size:** S.
- **Mohamed:** the warm-up scheme (default: current engine scheme; trainer reviews in Step 16).
- **Risks:** low.

### Step 10. Native rest timer, lock-screen/notification timer, optional reminders
- [~] **Status: partly done (unit-tested only, NOT device-verified):** rest default / vibrate / notify settings, end-of-rest local notification with permission flow ([REST-ALERT.md](REST-ALERT.md)). **v0.13.0 built opt-in training-day reminders** (chosen weekdays and time, local notifications, unit-tested only, [REMINDERS.md](REMINDERS.md)). Not done: foreground-service countdown, any real-phone check (reminder delivery included). **Skipped in the v0.10.0 batch:** the foreground-service/lock-screen countdown needs a native module spike and a real phone to mean anything, and training-day reminders needed a decision (the rotation is not tied to weekdays, so which days?), answered in v0.13.0 by letting the lifter pick weekdays; a phone is still needed to test delivery. **Goal:** the timer works with the screen off.
- **Deliver:** native module choice (expo-notifications + foreground/ongoing notification, or a dev-client native module; decide after a short spike); sound/vibration setting; default rest time setting; permission flow (Android 13+ notification permission, exact-alarm limits); optional training-day reminders, no streak or shame text.
- **Done means:** start rest, lock the phone, the alert arrives within a second or two of zero on the test phone; works after the app was swiped away is a stated yes/no.
- **Test:** real-device only; try at least two phone makers because battery savers differ.
- **Size:** M-L.
- **Mohamed:** accept that this needs a custom dev build (leaves Expo Go).
- **Risks:** aggressive battery managers (OEM-specific) kill timers; may need a "keep GAIN unrestricted" tip.

### Step 11. Pounds (lb) display support
- [x] **Status (v0.4.0, unit-tested only, NOT device-verified):** shipped early. kg is the default; lb is offered in onboarding (kg preselected) and Settings. Storage and engine stay kg; `logic/units.ts` is the display/input layer (lb shown to 0.1 lb, typed lb stored at 3-decimal kg so a 5 lb step stays a 5 lb step across a bar). Logger, targets, finish, Why, engine reason sentences, gym editor (native lb entry, "fill in standard loads") and import preview use it. The silent default gym is lb-friendly in lb mode (45 lb bar, 5 lb barbell/dumbbell/cable steps, 2.5 lb plates, 10 lb machine/assist). Imported lb loads within 15 g of a gym load snap to it. Known limits: a kg gym viewed in lb shows honest but ugly decimals (22.5 kg = 49.6 lb) until the lifter fills in standard lb loads in the Gym tab; switching unit does not rewrite saved gyms.
- **Polish (v0.7.0, unit-tested only, NOT device-verified):** after a kg to lb switch, Settings offers to swap an *untouched standard* kg rack for the standard lb rack (45 lb bar with 5 lb steps, dumbbells 5-100 lb in 5 lb steps, 5 lb cable jumps, 10 lb machine jumps), so targets land on loadable lb numbers. A customised rack is never touched. History is unchanged (storage stays kg).
- **Original goal:** show and enter lb for users who want it; storage stays kg.
- **Deliver:** units setting (onboarding + Settings); conversion in logger, targets, gym editor, history; gym loads in lb plates (e.g. 2.5 lb jumps) handled; import unit stays separate.
- **Done means:** a lb user's targets are loadable in lb (not ugly decimals like 22.68).
- **Test:** unit tests for round-trip and snapping; device.
- **Size:** M.
- **Mohamed:** decide whether gym loads are edited natively in lb (default: yes).
- **Risks:** snapping in lb vs kg can produce loads that don't exist; this is the hard part.

### Step 12. Export and delete my data
- [x] (unit-tested only, NOT device-verified; share sheet and file picker never run on a phone) **Goal:** the user owns the data.
- **Deliver:** export all data (JSON + CSV of sets, readable by Excel and re-importable), share sheet; delete-everything with confirm; Settings copy updated; wipes local DB (and server data once Step 21 exists).
- **Done means:** export then wipe then re-import restores sessions and targets; after delete, the app returns to first run.
- **Test:** round-trip tests; device test on a large history.
- **Size:** M.
- **Mohamed:** export format preference (default: one CSV in Hevy-like columns + a JSON backup).
- **Risks:** deleting must also cover backups the OS makes (Android auto backup setting: decide to allow or disable).

### Step 13. Coach card (local first)
- [~] **Status: built as a PDF, unit-tested only, NOT device-verified** ([COACH-CARD.md](COACH-CARD.md)). Finish screen button, English/Arabic, shared through the share sheet; no image version. The "renders correctly in RTL and LTR on two screen sizes" check is **still open**. **Goal:** share what was done, next targets, and goal pace as an image the lifter sends in WhatsApp.
- **Deliver:** card image/PDF from the Finish screen; Arabic + English; no account for the coach. (Private links come with Step 22.)
- **Done means:** a card renders correctly in RTL and LTR and shares through the system share sheet.
- **Test:** device; visual check on two screen sizes.
- **Size:** S-M.
- **Mohamed:** what the card shows (default: session, next targets, pace line, no bodyweight).
- **Risks:** a card with health-like data is shared by the user, not by us; add the not-a-doctor line.

### Step 14. Accessibility, dark mode, RTL QA
- [~] **Status (v0.10.0, code-level only; NOT device-verified):** palettes pass WCAG AA in tests (and three real contrast bugs were fixed), 48 dp targets, roles/labels, start/end styles, no typed English, font scaling never disabled, all enforced by `a11yQa.test.ts`; checklist with pass/fail and the open device items in [A11Y-RTL-CHECKLIST.md](A11Y-RTL-CHECKLIST.md). Not done: TalkBack, 200% font, real RTL and dark passes, Arabic re-read (needs a phone and an Arabic reader). **Goal:** usable for everyone in the first hundred.
- **Deliver:** checklist run on every screen: font scale 200%, TalkBack, touch targets, contrast in light and dark, no status by colour alone, numbers/exercise names in RTL (mixed Arabic/Latin), keyboard overlap, rotated/small screens; Arabic strings re-read; fixes.
- **Done means:** checklist stored in docs with pass/fail per screen; no failing item on the main loop.
- **Test:** manual on device + emulator; where possible automated render tests.
- **Size:** M.
- **Mohamed:** an Arabic reader to read all screens (same people as Step 8).
- **Risks:** Arabic text in a few strings files was written as a first draft; layout bugs only show on device.

### Step 15. Performance, offline and sync-safety tests
- [~] **Status (v0.10.0, Node only; NOT device-verified):** 17 upgrade-path/kill-injection tests (one real bug found and fixed), 2-year history performance and statement-count tests, a pre-update safety copy (`gain-before-update.json`), visible failed-save alert; docs [OFFLINE-SAFETY.md](OFFLINE-SAFETY.md), [PERFORMANCE.md](PERFORMANCE.md). Phone thresholds are only PROPOSED and no phone timing exists; lowest-spec phone is Mohamed's decision. **Goal:** it never loses a set and stays fast.
- **Deliver:** tests/scripts: kill during save, low storage, DB migration upgrade paths 1->latest on a populated DB, 2-year imported history performance, many gyms; measure start time and screen times on a mid-range phone; migration safety rule (backup before migrate).
- **Done means:** thresholds written down (to be agreed: unknown today) and met; zero data loss in the kill tests.
- **Test:** scripted + manual.
- **Size:** M.
- **Mohamed:** the lowest-spec phone he wants to support.
- **Risks:** thresholds are currently unknown; do not claim "fast" before they exist.

### Step 16. Trainer review of templates and rules; rule versioning
- [~] **Status (2026-10-03): partly reported, not closed.** Reported OK by Mohamed 2026-10-03 (on his word); reviewer identity and scope not recorded: Mohamed reports a trainer reviewed the workouts/templates and said they are good. **Not confirmed reviewed unless stated:** rules and progression (rule-v0.3), short-week rules, warm-ups, rep ceilings, step sizes, pace rules. No written feedback is in the repo, so the Done-means bar below is NOT met; the in-app draft labels stay and no public coaching claim is cleared.
- [ ] **Goal:** a qualified person has reviewed what we say before it is a public claim. **v0.13.0: the review pack is prepared** ([TRAINER-REVIEW-PACK.md](TRAINER-REVIEW-PACK.md): rule-v0.3, timed-v0.1, short-week, warm-ups, ceilings, with verdict columns and a BLANK sign-off). **No review has happened through this pack.**
- **Deliver:** review pack (templates, cues, warm-ups, rep ceilings, step sizes, short-week cuts, pace rules) to one or two trainers; their notes; changes as `rule-v0.4`+ with the change logged in PROGRESSION-RULES.md; every stored decision keeps its rule version (already stored); old versions still render.
- **Done means:** a named trainer's written feedback in the repo (name only if they agree); open disagreements listed, not hidden.
- **Test:** rerun the backtest for each rule change; report agreement honestly.
- **Size:** M (mostly waiting).
- **Mohamed:** finds the trainers; decides how rule changes get approved; decides if the 10/12/15 ceilings stay default after the review.
- **Risks:** reviewers may disagree with ACSM-based defaults or Mohamed's configuration; the Hevy backtest already shows a gap with his own behaviour.

### Step 17. Privacy policy, terms, health disclaimers, data handling
- [~] **Status (v0.10.0, DRAFT):** policy and terms drafts with placeholders, in-app Privacy and safety page, health notes, tests comparing the code's data flows with the text. NOT reviewed by a lawyer (D6), no controller identity or contact, no public URL, no consent screen (nothing needs consent yet: no analytics). **Goal:** legal and honest copy before strangers install.
- **Deliver:** privacy policy (what is stored locally; what leaves the phone once Steps 18/21 exist), terms, in-app "training aid, not a doctor, pain means see a professional" lines, consent screen for crash/analytics (opt-in), data-retention and deletion statement.
- **Done means:** reviewed by a lawyer or a qualified template service (decision D6); public URL for the policy (needed by the Play data safety form).
- **Test:** compare actual data flows (code + network log) against the text.
- **Size:** M.
- **Mohamed:** controller identity (person or company), contact email, who reviews. Which laws apply to Egyptian users and any EU users is **unknown to me**: confirm with a lawyer; GDPR-style principles (minimal data, consent, export, delete) are the working standard until then.
- **Risks:** health-adjacent data (bodyweight, pain mentions) raises sensitivity; keep optional.

### Step 18. Crash reporting and privacy-respecting analytics
- [~] **Status (v0.10.0, partly, NOT device-verified):** local-only crash log and error boundary, opt-in share, no third-party service ([DIAGNOSTICS.md](DIAGNOSTICS.md)). **v0.17.0:** a "Send feedback" share-sheet message next to the report share. Not done: native crashes and unhandled promise rejections, analytics events (needs D7 and the event list). **Goal:** see crashes and the few numbers that decide the product, without surveillance.
- **Deliver:** crash reporter (choice D7), opt-in; event list written down first (e.g. session finished, target accepted/edited/rejected, weekly review answered); no set-level content, no free text; no third-party ad SDKs.
- **Done means:** event list matches the privacy policy; user can turn it off; no events before consent.
- **Test:** network-capture check.
- **Size:** S-M.
- **Mohamed:** tool choice and budget.
- **Risks:** the free plan or hosting location of a tool may conflict with the policy text.

### Step 19. Beta distribution (APK first)
- [~] **Status (v0.10.0, drafts):** [RELEASE-PROCESS.md](RELEASE-PROCESS.md), [INSTALL-GUIDE.md](INSTALL-GUIDE.md), [BETA-FEEDBACK.md](BETA-FEEDBACK.md) written from the process actually used. **Clean-clone build DONE 2026-10-03** (fresh clone of v0.13.0: `npm ci`, typecheck, all tests, export bundle, prebuild, Gradle release build, signing with the real key; signer SHA-256 matched; same box only, see RELEASE-PROCESS.md section 8). **Second clean-clone build DONE 2026-10-03 (v0.17.0, see RELEASE-PROCESS.md section 8).** Not done: keystore backup (unknown, Mohamed), feedback channel, a build on a second/cold machine, install/upgrade on two phones, a non-technical lifter following the guide. **Goal:** a repeatable way to put builds on pilot phones.
- **Deliver:** documented release process (version bump, signed arm64 APK, checksum, notes); update-over-install check each time (v0.2.0 was signed with the same keystore as v0.1.0 per its release notes; keep using it; whether it is backed up is **unknown**); a one-page install guide; a feedback channel (WhatsApp group or form).
- **Done means:** a non-technical lifter installs and updates from the guide without help.
- **Test:** install and upgrade on two phones; build from a clean clone.
- **Size:** S.
- **Mohamed:** keystore custody; non-arm64 phones (x86/armv7) are not covered by current APKs.
- **Risks:** losing the keystore blocks updates for sideloaded users and, depending on Play App Signing choices, Play uploads.

### Step 20. Pilot: about 10 real lifters, one gym
- [ ] **Goal:** find out if Thursday's number is right and people come back. **Pilot kit drafted (2026-10-03):** [PILOT-KIT.md](PILOT-KIT.md) (protocol, setup checklist, EN + draft AR consent text, file handling, stop rules), a metrics script (`npm run pilot-metrics -w @gain/mobile`, tested on synthetic backups only), a pilot-sheet CSV and a bug-report issue template. Consent text has NO legal review and the Arabic NO native read; nothing was run with a lifter. **v0.13.0: retention-metrics doc written** ([PILOT-RETENTION-METRICS.md](PILOT-RETENTION-METRICS.md), no analytics: counts come from the lifter's own export and check-ins). No pilot has run; thresholds are Mohamed's (D5).
- **Deliver:** protocol doc: recruit ~10 lifters who already log; import or retype a month; for each target, record the number the lifter would have picked next to the app target and which they loaded; weekly check-ins; retention checked at weeks 1, 2 and 6; bug log; interviews; consent for using their data.
- **Done means:** a written pilot report: agreement rate, why the app was overridden, retention at weeks 1/2/6, top bugs, what to change. No numbers are assumed beforehand; success thresholds are set by Mohamed before the pilot starts (D5).
- **Test:** the pilot is the test.
- **Size:** L (mostly elapsed time, six weeks of observation).
- **Mohamed:** the gym, the lifters, the trainer, the thresholds.
- **Risks:** small sample; friendly users; the rule vs "repeat last" gap (Hevy backtest) may repeat. Do not tune the rule to ten people without trainer review.

### Step 21. Backend: Cloudflare Workers + D1, auth, sync
- [~] **Status (v0.11.0, NOT device-verified):** server deployed to Mohamed's Cloudflare (free plan) and smoke-tested; client built and tested with fault injection against the real server code; delete-account wired into Delete everything (online copy first). Not done: two real phones, airplane-mode on a phone, email magic link (BLOCKED: no email provider; code path exists, dev mode only), a backup that outlives Time Travel (no scheduled export). **Checked 2026-10-03:** D1 Time Travel is on for `gain-sync` (7 days on free, 30 on paid; plan not confirmed), region ENAM, restore steps in [SYNC.md](SYNC.md), **rehearsed 2026-10-03 on a throwaway D1 database** (restore, verify, undo, generation bump, then deleted; the live database was never restored); D1 free-tier limits still not measured. Details: [SYNC.md](SYNC.md), [SYNC-CLIENT.md](SYNC-CLIENT.md).
- **Goal:** data survives a lost phone and works on a second device.
- **Deliver:** Workers API + D1 schema mirroring local tables; sync on `updated_at` / `deleted_at` with client UUIDs; conflict rule written down (default: last write wins per row, no deletes resurrected); rate limits; backups; auth (decision D3); delete-account endpoint wired to Step 12; sync is optional: the app stays fully usable offline and signed out.
- **Done means:** two devices converge after offline edits; replaying a sync twice creates no duplicate sessions; delete-account removes server rows.
- **Test:** sync property tests on a local D1; two-device manual test; airplane-mode test.
- **Size:** L.
- **Mohamed:** Cloudflare account and budget limits; auth choice; where the data lives (region constraints are **unknown**).
- **Risks:** sync bugs destroy trust faster than any other bug; Cloudflare D1/Workers plan limits need checking at the time.

### Step 22. Shared gym fingerprints and coach-card links
- [~] **Status (v0.11.0):** **shared gyms DROPPED** (gym UI removed in v0.8.0). **Coach-card links built:** private random link, hash stored, expiry (7 days, max 30), revoke, same 404 for unknown/expired/revoked, no account, escaped text-only page with strict CSP, rate limits, link-guessing and abuse tests; app button with consent. Deployed; not tried on a phone or with a real coach. Arabic/English page layout unseen on a phone.
- **Goal (original):** the second lifter in a gym skips rebuilding the rack; coaches open a link, no account.
- **Deliver:** publish/copy a gym fingerprint (no personal data in it); naming/moderation (who may edit a shared gym: D8); coach-card private links with expiry and revoke; Arabic/English web view.
- **Done means:** a user joins a shared gym in under a minute; a revoked link stops working.
- **Test:** API tests; abuse cases (vandalised gym); link-guessing test.
- **Size:** M-L.
- **Mohamed:** how shared gyms are found (invite code is the default), and whether gym names are public.
- **Risks:** bad shared data gives bad loads; a user can always edit their own copy.

### Step 23. Model layer (LLM), guardrails only for flagged cases
- [ ] **Goal:** use a model only where the rule says `needsModel` (low confidence), never as the engine.
- **Deliver:** server-side proxy on Workers (no API key in the app); input = the rule's inputs only, no free text, no personal identifiers; output must be a load that exists in the gym and a bounded change (re-checked by the rule code); user sees both rule and model suggestion and nothing applies without a tap; every call logged to the decision log with `path = model`; cost cap and kill switch; offline = rule only.
- **Done means:** the model can never change the plan silently, invent history, or give pain advice; cost per active user is measured and below a ceiling Mohamed sets.
- **Test:** replay flagged cases from the pilot with and without the model; adversarial tests (impossible loads, empty history).
- **Size:** M.
- **Mohamed:** whether to do this at all before v1.0 (default: after pilot data shows how often cases are flagged); provider and budget.
- **Risks:** cost, latency, and the model sounding confident. If pilot shows few flagged cases, skip it.

### Step 24. (Removed) Subscription, paywall, pricing test
- **Removed 2026-10-03: GAIN is completely free.** No subscriptions, in-app purchases, or paid feature tiers, so there is no billing library, entitlement check, trial, price page or restore-purchase flow to build. Nothing replaces it (no ads, no donations). The step number is kept so older references still resolve.

### Step 25. Play internal and closed testing
- [ ] **Goal:** install via the store, with signed AAB.
- **Deliver:** Play developer account; app signing choice; AAB builds; internal track; closed track with testers; pre-launch report fixes. Check current Play requirements for new accounts and testing tracks (**unknown**, they change).
- **Done means:** pilot users update through Play; pre-launch report has no crashes.
- **Test:** Play pre-launch report and device matrix.
- **Size:** M.
- **Mohamed:** the Play Console account (personal vs organisation, identity checks), payment profile.
- **Risks:** account verification delays; package id `app.gain.mobile` is fixed once published.

### Step 26. Store listing and assets
- [ ] **Goal:** a listing that is accurate in Arabic and English. **Data-safety form draft from the real data flows: [DATA-SAFETY-DRAFT.md](DATA-SAFETY-DRAFT.md) (2026-10-03, unreviewed, nothing submitted).** **v0.13.0: EN/AR text drafts, asset checklist, data-safety draft and a blockers list are in [PLAY-LISTING-DRAFT.md](PLAY-LISTING-DRAFT.md)** (drafts, no native-Arabic or legal review; no screenshots yet; privacy-policy URL and support email missing; the in-app self-updater uses the install-packages permission, which conflicts with a Play build and needs a decision).
- **Deliver:** short + full descriptions (start from PRODUCT.md short description), screenshots (AR + EN, RTL and LTR, light/dark), feature graphic, icon (exists), content rating questionnaire, data safety form (must match Steps 17/18/21), privacy policy URL, support email, target countries.
- **Done means:** the listing passes review; claims contain no medical or physique promise.
- **Test:** compare each listing claim to a shipped feature.
- **Size:** M.
- **Mohamed:** final name check (trademark search is **unknown**), who writes the Arabic copy.
- **Risks:** Data safety answers wrong vs actual behaviour can cause removal.

### Step 27. Launch and growth
- [ ] **Goal:** first hundred users, reachable in person.
- **Deliver:** launch in the pilot gym plus a few coaches; coach card as the sharing loop; invite codes for shared gyms; support routine (reply time, bug triage); no paid acquisition until week-6 retention is shown (PRODUCT.md rule).
- **Done means:** the first hundred install count is met by people Mohamed can name or reach; weekly support log kept.
- **Test:** funnel counts from Step 18 events.
- **Size:** L (elapsed).
- **Mohamed:** gym contacts, coaches, who answers support.
- **Risks:** growth depends on one person's reach; keep expectations as a hypothesis.

### Step 28. iOS (later)
- [ ] **Goal:** iPhone users.
- **Deliver:** Apple developer account decision; build and fix iOS-specific issues (notifications/timer, share sheet, file picker); TestFlight; App Store listing and privacy labels.
- **Done means:** the full device test script (Step 1) passes on an iPhone.
- **Test:** TestFlight with the pilot group.
- **Size:** L.
- **Mohamed:** whether and when; the Apple fee and a Mac or cloud build (cost **unknown** here).
- **Risks:** nothing has been built or tested for iOS; PRODUCT.md currently says iOS is in the first release (see D1).

### Step 29. Post-launch metrics and success criteria
- [ ] **Goal:** know if it is working, without vanity numbers. (Pilot-stage definitions are drafted in [PILOT-RETENTION-METRICS.md](PILOT-RETENTION-METRICS.md); no dashboard exists.)
- **Deliver:** weekly dashboard of: sessions logged per active user, share of targets accepted / edited / rejected, share of users on pace for a goal, week-1/2/6 retention, crash-free sessions, support issues; written success criteria taken from PRODUCT.md "Success": users log without fighting the screen, trust the next weight enough to load it, can tell if the goal is on pace, and a few stay for months.
- **Done means:** thresholds set by Mohamed before launch (D5), reviewed monthly.
- **Test:** event counts spot-checked against raw data.
- **Size:** S-M, then ongoing.
- **Mohamed:** the thresholds.
- **Risks:** small numbers; read them with care.

---

## 3. Milestone map

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

---

## 4. Decision log for Mohamed

| # | Question | Recommended default |
| --- | --- | --- |
| D1 | Android first, iOS after v1.0? (PRODUCT.md says both in first release) | Android first; fix PRODUCT.md later. |
| D2 | Which phone(s) do you test on? | Your own plus one emulator now; add a second brand before v0.8. |
| D3 | Auth for sync: anonymous device id + optional email magic link, Google sign-in, or phone number? | Email magic link, optional; the app works without an account. |
| D4 | Library size at launch? | Cover the exercises in your Hevy history and the 7 templates first, then grow from pilot misses. **v0.12.0:** Mohamed asked for essentially all common gym exercises; 607 shipped. Remaining misses (uncommon, machine-brand-specific, strongman, mobility) will come from the pilot. |
| D5 | Pilot and launch success thresholds (agreement rate, week-6 retention)? | You set them before the pilot starts; I will not propose numbers I cannot support. |
| D6 | Who reviews privacy policy and terms? | A lawyer or reputable template service; confirm Egypt and EU needs. |
| D7 | Crash/analytics tool? | The cheapest tool that can run opt-in and avoids set-level content; decide at Step 18. |
| D8 | Who can edit a shared gym? | Moot: shared gyms dropped (gym UI removed). Creator-only edits would have applied. |
| D9 | Billing library? | Moot: GAIN is completely free (2026-10-03); no billing library. |
| D10 | Do the rep ceilings 10/12/15 and one-session trigger stay default after the trainer review? | Keep until the trainer and pilot say otherwise. |
| D11 | Android auto-backup of the app database (currently on, the Expo default): leave on or turn off? | Default: leave on until the privacy policy (Step 17); the delete screen says it exists. |

---

## 5. Risks and what to test first

Test first, in this order:
1. [ ] The signed APK launches, opens SQLite, migrates 1 to 3 on an existing install, and the file picker works for the Hevy import (Step 1).
2. [ ] A full session with the phone locked and the app killed mid-set loses nothing.
3. [ ] Arabic + RTL on real screens (layout, mixed numbers and names).
4. [ ] The Hevy import of 1,049 rows on a mid-range phone, then the first finish: do targets look sane?
5. [ ] Do real lifters agree with the target (cheap early check before Step 20: Mohamed's own sessions for two weeks).

Main risks:
- **Nothing is device-verified.** Every "Done (unit-tested)" above can still be broken on a phone.
- **Rule vs behaviour.** The rule does not beat "repeat last load" on Mohamed's history; trust is the product (see Step 16/20).
- **Draft Arabic.** All Arabic began as a first draft. Mohamed reports he reviewed it and it looks good (2026-10-03; reviewer identity and scope not recorded); draft labels stay until the Step 8 bar is met.
- **Native timer** may be the hardest Android piece (battery savers).
- **Sync** bugs cost the most trust; keep the app fully offline-usable.
- **Payments in Egypt** and store fees/tax are unknown.
- **One person.** Scope grows faster than a single builder; keep the non-goals (chatbot, social, wearables, nutrition, video, photo progress) out.
- **Frozen until pilot evidence (P32):** catalogue expansion beyond the current library, any AI/model features (none exist in the app today), and iOS. Nothing here is started or promised before real pilot lifters show it is needed.
- **Keystore** loss would block updates; keep a backup.
