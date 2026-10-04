# GAIN master plan

Rewritten 2026-10-03 (Cairo time) from the code on `main` at `cd97b06` (v0.18.0). Product spec: [PRODUCT.md](PRODUCT.md). Rules: [PROGRESSION-RULES.md](PROGRESSION-RULES.md). Backtest: [BACKTEST-HEVY.md](BACKTEST-HEVY.md). Roadmap (one-page version of this plan): [ROADMAP.md](ROADMAP.md). Everything that already shipped, release by release, with the old milestone map and older test runs: [RELEASE-HISTORY.md](RELEASE-HISTORY.md).

**GAIN is completely free** (Android first; Arabic and English). The single authoritative statement of what that means is "Free for everyone" in [PRODUCT.md](PRODUCT.md); this plan does not restate it or add to it. Nothing in this plan is gated, priced or tiered, and no billing work is planned.

**Honesty rule: the repo contains no device-test evidence.** No release (v0.1.0 to v0.19.0) has a recorded run on an Android phone or emulator in this repo; only the first three onboarding screens of v0.4.0 were ever seen on a software-emulated device ([DEVICE-TEST-0.4.md](DEVICE-TEST-0.4.md)). **Update 2026-10-04: Mohamed reports that he completed all five "Now" priorities below (installed v0.18.0 on his phone, ran the device checks, stored the signing key, approved the pilot templates and thresholds, arranged reviewers and pilot people) and that the Device verified gate (G1) passed. This is reported by Mohamed 2026-10-04, not independently verified: no results file, issue list or screenshots have been committed, so the builder has not seen the evidence.** Everything marked "done" below that is not covered by that report means code written and unit-tested on Node, nothing more. Anything marked **unknown** has not been checked. 

Conventions: `[ ]` open, `[x]` done (code + tests only), `[~]` partly. Sizes are S (days), M (1-2 weeks), L (several weeks) of focused work. No calendar dates; nothing here is a forecast.

---

## Now: the next five priorities (all five reported done by Mohamed on 2026-10-04, not independently verified)

Sequencing rule: **no new features until the core loop works on a real Android phone.** The plan is organised as four gates (section 3): Device verified, Pilot ready, Pilot validated, Store ready. Work that does not move the next gate is on the freeze list below. Bug fixes for what a gate finds are always allowed.

1. [x] (reported by Mohamed 2026-10-04, not independently verified: phone install of v0.18.0 and the core loop) **Install the current signed APK on a real Android phone and complete the core loop: onboarding, import, log, finish, next target.**
   - Build: the latest GitHub release (v0.18.0, `gain-v0.18.0-arm64.apk`, SHA-256 `fc21d0f9626a8b28a1b69a20f6d57bcf17a0a753608f8f4254c5b94def8db1f0`, signer SHA-256 `571bc5a8...c5b2`; check the hash on the phone side too). Test the signed release APK, not an Expo dev build.
   - Walk: first run (Welcome, set up my plan or Just start logging) -> import Mohamed's real Hevy export (1,049 rows) -> Today -> Start -> log a full session with kg and reps -> Finish -> read and accept/edit/reject the next targets -> Today shows the next session with its target -> open Why.
   - Record: phone model, Android version, build, date, pass/fail per line in [NATIVE-CHECKLIST.md](NATIVE-CHECKLIST.md) (result column) and a short dated device-test file next to [DEVICE-TEST-0.4.md](DEVICE-TEST-0.4.md); every failure becomes an issue with a screenshot.
   - Done when: the whole loop completes with no crash and no lost set, and the results are committed. Until then, nothing else in this plan counts as working.
   - Needs: Mohamed and a phone (not available to the builder; the build box cannot run an emulator, see DEVICE-TEST-0.4.md).
2. [x] (reported by Mohamed 2026-10-04, not independently verified: device checks (keyboard, screen lock, rest alerts, force-stop recovery, update-over-install)) **Verify the parts that fail on phones: keyboard, screen lock, rest alerts, force-stop recovery, update-over-install without data loss.**
   - NATIVE-CHECKLIST rows: 2 (keyboard never hides the row being typed in), 7-8 (rest timer in foreground, then with the screen locked and the app in the background), 24 (rest alert and a training-day reminder arrive; Android 13+ permission prompt), 9-10 (background then resume; force-stop mid-workout reopens with exactly the sets that were ticked), 1 (update over the previous release keeps history), 22-23 (file picker, export and share still work after v0.17.0 removed the legacy storage permissions), 25-26.
   - Update-over-install: install an older signed APK first (v0.17.0 is enough for the first pass), log real sessions, install the current one over it, compare session and set counts before and after (Settings > Your data JSON backup). Also try Settings > Check for updates once (download, hash check, installer prompt); it has never run.
   - Try at least two phone makers if possible (battery savers differ); say which.
   - Done when: every row above is PASS or has a filed issue; no data loss anywhere.
3. [x] (reported by Mohamed 2026-10-04, not independently verified: signing key stored off the build box) **Back up the signing key and confirm it is recoverable.**
   - Known today (2026-10-03): the release keystore lives at `~/keystores/gain-release.jks` + `.pw` on the build box. A copy of the `.jks` is in `/workspace/keybackup/` on **the same box** (SHA-256 of the file `7de82ca9...e023c`, identical to the live one, checked 2026-10-03; its README says the password is kept "in a separate message"). That is a second file on the same machine, not custody: one box failure loses both, and where the password is kept is not recorded here.
   - Do: put the `.jks` and the password in two places Mohamed controls that are not this box (for example a password manager and an offline USB), stored apart from each other; write down who holds them (not the secrets) in RELEASE-PROCESS.md section 7.
   - Prove it: from the off-box copy, sign a throwaway APK and confirm `apksigner verify --print-certs` shows signer SHA-256 `571bc5a8ce699054ae7bffe0fc912fd1faf9de7dfd3d3eb962b1b8578315c5b2`; record the date. Without that test it is a copy, not a recovery.
   - Done when: the restore test is recorded. Losing the key means sideloaded users cannot update in place (see RELEASE-PROCESS.md section 7).
4. [x] (reported by Mohamed 2026-10-04, not independently verified: pilot templates and thresholds approved, reviewers arranged) **Review Arabic, TalkBack, large text, and the small set of programs offered to pilot users.**
   - Arabic: a native Egyptian reader goes through every screen in Arabic on the phone (NATIVE-CHECKLIST row 13, [A11Y-RTL-CHECKLIST.md](A11Y-RTL-CHECKLIST.md), strings listed in [ARABIC-REVIEW-SHEET.md](ARABIC-REVIEW-SHEET.md)); verdicts are written in the repo. Today only Mohamed's unrecorded report exists, and it predates the 557 library rows added in v0.12.0.
   - TalkBack: rows 12 and 17 on the main loop (Today, logger set row, Finish, Plan, Progress, Settings). Large text: row 11 at the largest system font and display size.
   - **Pilot program subset (proposal, Mohamed to accept or change).** The picker offers 47 templates (see [TEMPLATES.md](TEMPLATES.md)); a pilot of ten lifters at one gym needs fewer, and only ones whose layout can be explained and checked. Proposed six, all from the **original 7** (the ones a trainer was reported to have called good; the 40 added in v0.14.0 are not reviewed):
     | Template id | Days/week | Why it is in |
     | --- | --- | --- |
     | `full_body_2` | 2 | Fewest-days case; the pilot requires 2+ days |
     | `full_body_3` | 3 | The common beginner/returning case |
     | `ppl_3` | 3 | Intermediate lifters who want a split with three days |
     | `upper_lower_4` | 4 | The most common intermediate split |
     | `mix_4` | 4 | A body-part split (a different exposure pattern) |
     | `ppl_6` | 6 | Highest frequency; stress-tests short-week and logging volume |

     Left out on purpose: the 40 unreviewed templates, the 18 home templates (the pilot is at one gym), the "bulking phase" shapes, and the 5x5/3x5 strength shapes. Lifters who already run a program **import it** (Hevy/Strong) instead of using any template; that is the main path. The in-app picker is not changed (that would be an app release and a feature); the pilot runner tells lifters which six to pick from.
   - Done when: Arabic verdicts and TalkBack/large-text results are committed, every failing item on the main loop has a fix or an issue, and Mohamed has confirmed (or replaced) the six.
5. [x] (reported by Mohamed 2026-10-04, not independently verified: pilot people arranged (the six-week pilot itself has not been reported as run)) **Run a local-only pilot with retention and usability criteria written down first, and record why users override targets.**
   - Local-only: Back up and sync stays OFF and is not offered (this overrides the "ask, do not push" line in PILOT-KIT.md section 2); nothing leaves a phone except the export a lifter chooses to send. About 10 lifters, one gym, six weeks; protocol, consent drafts, check-ins and the metrics script are in [PILOT-KIT.md](PILOT-KIT.md) and [PILOT-RETENTION-METRICS.md](PILOT-RETENTION-METRICS.md).
   - **Criteria are written down before the first install** (D5). The values below are PROPOSED starting points, chosen so that one lifter dropping out moves a number by one person, not a percentage; they become real only when Mohamed copies them into the "Written before the pilot" table in PILOT-RETENTION-METRICS.md with a date. Report counts ("6 of 9"), not percentages.
     | Criterion | Proposed bar (of lifters who started) | How it is read |
     | --- | --- | --- |
     | Retention week 1 | at least 8 of 10 finished at least one session in week 1 | export, `finished_at`, imported sessions excluded |
     | Retention week 2 | at least 7 of 10 | same |
     | Retention week 6 | at least 5 of 10 | same; "stopped logging" is checked with the lifter before it is called churn |
     | Agreement with the app | reported next to "repeat last load" computed from the same exports; no pass/fail bar until Mohamed sets one | `pilot-metrics` script |
     | Setup without help | at least 8 of 10 reach their first finished workout from the install guide without the runner touching the phone | observed at setup |
     | Data loss | 0 lifters lose a logged set (any loss = stop rule, PILOT-KIT section 1.7) | check-in question 3, export counts |
     | Unsafe target | 0 clearly unsafe targets (stop rule) | check-ins, exit interview |
     | Crashes | every crash is traced to a Diagnostics report or a bug entry; no unexplained crash left open at week 6 | Diagnostics > Send feedback, bug sheet |
   - **Why users override targets.** The app records accept / edit / reject and the lifter's edited load, but **no reason** (confirmed: the `target` table has `status` and `edited_load` only; PILOT-RETENTION-METRICS.md says "Not collected in-app"). The reason is gathered by people, not by the app:
     - Checked against [PILOT-KIT.md](PILOT-KIT.md): it **does** cover it in prose (weekly check-in "what you loaded instead of the app's number and why", the exit interview "where did the app's number feel wrong", and the report line "override reasons in the lifters' words"), and PILOT-RETENTION-METRICS.md defines the tags (too heavy / too light / equipment / felt bad / forgot / other). It does **not** give the runner a place to write each reason: the pilot sheet row has one `bugs_quotes` cell per lifter per week. Added here, in this plan only (PILOT-KIT.md and the CSV are unchanged):
     - Keep a second sheet, one row per overridden target: `pilot_code, week, exercise, app_target (load x reps), loaded (load x reps), direction (more/less/same), reason_in_their_words, tag, source (check-in / interview)`. Fill it from the week's export plus the check-in answer; tag it afterwards using the six tags above. Ask the same question the same way every week, and never suggest an answer. A target the lifter changed with no stated reason is recorded as "no reason given", not guessed.
   - Needs before the first install (all Mohamed's): gate "Pilot ready" below.

## Freeze list (nothing here is started, promised or reviewed until Pilot validated)

- **New program templates** (the 47 stay as they are; no re-tuning; no new ones except `ppl_upper_4`, added in v0.19.0 on Mohamed's explicit request, now 48 templates in all).
- **AI / model layer** (Step 23). Nothing calls a model; the guardrail code stays as tests only.
- **Billing implementation of any kind.** There is none and none is planned; GAIN is free (PRODUCT.md).
- **Further cosmetic redesigns** (the v0.16 lime identity stays until a phone shows a real problem; fix usability bugs, do not restyle).
- Also frozen: library growth beyond the current 607 exercises, iOS, shared gyms (dropped), email sign-in work (blocked on a provider), new Settings features, new coach-card formats.

Allowed while frozen: fixes for bugs found on a device or in the pilot, data-safety and security fixes, accessibility and Arabic corrections, documentation, build and test tooling, and anything a gate below requires.

---
## 1. Where we are today

### Latest check (one result)

| What | Result |
| --- | --- |
| Commit | `cd97b06` (`main`, v0.18.0, versionCode 18) |
| Date | 2026-10-03, run in a fresh clone on the build box (Node 22.19.0, `npm ci`) |
| `npm run typecheck` | clean in all four workspaces (engine, sync, mobile, server) |
| `npm test` | **engine 365, sync 19, mobile 736, server 90; 1,210 tests, 0 failing** (test files: engine 20, sync 1, mobile 73, server 5) |
| What this is | Node unit and integration tests only; SQLite stands in for the phone's SQLite and for D1. **These are not phone tests.** |

CI runs `typecheck` and `test` on every PR. Older runs are in [RELEASE-HISTORY.md](RELEASE-HISTORY.md) section 5. Update this table (and only this table) when a new check is run.

### Status by screen (current UI: v0.16 electric-lime identity, as of v0.18.0)

**On a phone: no row below has ever been run on a device.** "Built" means code exists and the logic is unit-tested on Node; layout, keyboard, fonts, RTL, TalkBack, performance and delivery are all unseen. Screen design: [DESIGN.md](DESIGN.md) (web-rendered screenshots in `docs/design-screens/` are not phone screenshots). The four bottom tabs are **Today, Plan, Progress, Settings**; the logger and Finish open from Today.

| Screen / area | What is really there | Not verified / known gaps |
| --- | --- | --- |
| First run: onboarding + import | Welcome with logo; "Step i of n" bar; language, units (kg preselected, lb offered), days, minutes, optional goal ("No goal for now"), optional about-you, program (template picker with 47 templates, or "Build my own"), review. **Set up my plan** is primary, **Just start logging** secondary, import quiet. A silent default gym is created (no gym screen). Hevy and Strong import: parser, preview, exercise mapping, dedupe, undo, hidden history program. Dates use day/month/year selectors. | Whole flow unseen on a phone. File picker after v0.17.0 removed storage permissions (checklist 22). Mohamed's 1,049-row export imports in tests only (no phone timing). Strong is covered by synthetic files only; no real Strong export seen. |
| **Today** | One session card: "Suggested today" / "In progress" / "Your choice today", day name, program - sets - minutes, one lime **Start** / **Resume** button, starter-program note while the built-in starter is active; **Change workout** sheet (any day); exercise list with the lead exercise highlighted ("NEXT TARGET", its target, **Why**); goal-pace line and weekly-review card only when configured; quiet **Short week** button. A workout in progress is resumed, never duplicated. | Layout, 200% text, RTL, dark/light unseen. Weekly start day and card-vs-notification are Mohamed's call. |
| **Logger** | Compact header (back, title, help, rest timer, Finish), one save-status line, Duration / Volume / Sets. Per exercise: name, rest control, options menu (notes, replace for today, remove), one wrapping `Target 55 kg x 9 - Why` line, set rows Set / Previous / load / reps / tick (48 dp). Current set is lime; done ticks are muted green with a check mark. Set types (normal, warm-up, drop, failure), add exercise (today only), supersets, outlier confirm, optional warm-ups, timed exercises (seconds / metres), docked rest timer (-15 / +30 / Stop), Help sheet, visible failed-save alert. A tick saves at once, offline. | **Keyboard overlap, screen lock, background, force-stop recovery, rest alert delivery, TalkBack, large text: all unverified** (Now 2). Phone performance of the 1,100-line `WorkoutScreen` never measured. |
| **Finish** | "Saved on this phone"; counted-sets summary (an empty workout says so); collapsed records; one card per next target: large number, status, **Accept**, **Edit weight** (stepper, jump guard above 10%), Why, Reject; "Next session: X" line; coach card (PDF, and a private 7-day link); sticky **Done**. Targets are written at finish by rule-v0.3. | Share sheet, PDF layout and Arabic rendering unseen. The rule disagrees with Mohamed's own loads (backtest below). Rules not trainer-reviewed. |
| **Plan** | Program name and version, **Edit program**, compact day cards, "Program details" (weekly exposure, versions, switch program, start a template as a new program); editor with steppers, exercise picker (607 exercises, English/Arabic search, muscle and gear filters), custom exercises; template picker grouped by days with a collapsed filter panel. | Picker layout and long Arabic names unseen. **47 templates: the original 7 reported good by a trainer on Mohamed's word; the 40 added in v0.14.0 are not reviewed.** Arabic names and library entries are drafts. |
| **Progress** | Sessions / Lifts toggle; session detail with edit or delete a set; per-lift trend (top working set, bars, direction in words, text list); imported history labelled. | Chart on a phone, performance with a 2-year history: unmeasured. Trend measure is the builder's default (Mohamed to choose). |
| **Settings** | Groups: Training (rep ceilings, rest timer, week start, training-day reminders, Goals, "Things I've stopped suggesting", set up again), Display (language, units, appearance), Advanced (layout direction, both exercise names), Data (Your data: JSON backup, CSV, restore, delete everything; Back up and sync; Import; Decision log), About (Privacy and safety, Diagnostics with Send feedback, Check for updates, version). | Notification permission flow and delivery; share sheet; self-update download / installer; battery-saver behaviour. All unseen. |
| Targets + rules (engine) | rule-v0.3 (ACSM 2009-based; the 10/12/15 rep ceilings, one-session trigger and step snapping are GAIN conventions), progression currency order, confidence, rejection memory (a jump declined 3 times stops), timed-v0.1 for seconds/metres, warm-up ladder, short-week rebuild, weekly decision (`weekly-v1`), goal pace (Theil-Sen trend). Rule docs: PROGRESSION-RULES, PACE-RULES, WEEKLY-RULES, SHORT-WEEK-RULES, WARMUPS, TIMED-EXERCISES. | **Rules are NOT trainer-reviewed** ([TRAINER-REVIEW-PACK.md](TRAINER-REVIEW-PACK.md) has blank verdicts). Honest signal: the Hevy backtest says the rule matches Mohamed's loaded weight 58% of the time versus 60% for "just repeat last load", and proposed a heavier load in 4% of sessions while he went heavier in 26%. One lifter; a flag for the trainer review and the pilot, not a bug to tune away. |
| Exercise library + Arabic | 607 exercises (50 older + 557 added in v0.12.0), draft Arabic names and aliases, nine twin pairs for import ([EXERCISE-LIBRARY.md](EXERCISE-LIBRARY.md)). | No recorded native review; none at all of the 557 new rows. "Draft" labels stay. |
| Back up and sync + coach links | Cloudflare Worker `gain-sync` + D1 deployed and smoke-tested (https://gain-sync.elmolla10.workers.dev). In the app: Settings > Back up and sync, **off by default**, anonymous account + 20-character **recovery code** (D3), private coach links. | Never run on a phone, never with two phones. Email sign-in answers 501 (no provider). D1 free-tier limits unmeasured; no backup outliving Time Travel. [SYNC.md](SYNC.md), [SYNC-CLIENT.md](SYNC-CLIENT.md). |
| Privacy, diagnostics, updates | No analytics, no third-party crash reporting; local crash log with opt-in share; network use limited to the update check, opt-in sync and coach links (guarded by a test); Check for updates (GitHub releases, SHA-256 check, system installer). | Privacy policy and terms are **drafts, not legally reviewed**; no public URL. Update-over-install and the installer prompt never run. |
| Store release | Not started. Sideload APKs only (arm64, own keystore); listing and data-safety drafts exist ([PLAY-LISTING-DRAFT.md](PLAY-LISTING-DRAFT.md), [DATA-SAFETY-DRAFT.md](DATA-SAFETY-DRAFT.md)). iOS: config only, nothing built. | The self-updater's install permission conflicts with a Play build (decision needed at Store ready). |

Doc conflict resolved: PRODUCT.md used to say the first release is "native iOS and Android"; PLAN.md says Android first. Android first is the decision (D1) and PRODUCT.md now says so.

---

## 2. Steps

Each step: goal, deliverables, done means, tests, size, Mohamed, risks. Steps are in dependency order and are grouped by gate in section 3; **the sequencing is set by the gates and the "Now" list at the top, not by the numbers here.** Status text is as of v0.18.0; per-release history is in [RELEASE-HISTORY.md](RELEASE-HISTORY.md). Steps 23 and 28 and everything on the freeze list are not to be started before the gate named in section 3.

### Step 1. Real-device testing and fixes (first)
- [ ] **Goal:** know what actually works on a phone.
- **Deliver:** the checklist in [NATIVE-CHECKLIST.md](NATIVE-CHECKLIST.md) run on a real Android phone (an emulator run only if one becomes available); a dated results file; a list of bugs; fix PRs. Gate G1.
- **Done means:** a new install and an update-over-install from an older signed release both complete: onboard, import the Hevy export, log a full session with the screen locking mid-session, finish, accept/edit/reject, open Why, switch language to Arabic, restart. No crash, no lost sets. Results recorded in a dated device-test file next to [DEVICE-TEST-0.4.md](DEVICE-TEST-0.4.md) (pass/fail per line, phone model, Android version) and in the NATIVE-CHECKLIST result column.
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
- **Deliver:** entry on Today/Program; rebuild logic (accessories drop first, priority-muscle weekly floor, rest not crushed); preview showing what was cut before starting; undo; program version recorded.
- **Done means:** goal lifts are never cut before accessories; the user sees the cut list; the original program returns next week.
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
- **Deliver:** tests/scripts: kill during save, low storage, DB upgrade paths from every supported older release to the current schema on a populated DB with real user data (plan in section 5), 2-year imported history performance, many gyms; measure start time and screen times on a mid-range phone; migration safety rule (backup before migrate).
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
- [ ] **Plan:** local-only (sync off), criteria and the override-reason sheet are in "Now" item 5; gate G3. **Goal:** find out if Thursday's number is right and people come back. **Pilot kit drafted (2026-10-03):** [PILOT-KIT.md](PILOT-KIT.md) (protocol, setup checklist, EN + draft AR consent text, file handling, stop rules), a metrics script (`npm run pilot-metrics -w @gain/mobile`, tested on synthetic backups only), a pilot-sheet CSV and a bug-report issue template. Consent text has NO legal review and the Arabic NO native read; nothing was run with a lifter. **v0.13.0: retention-metrics doc written** ([PILOT-RETENTION-METRICS.md](PILOT-RETENTION-METRICS.md), no analytics: counts come from the lifter's own export and check-ins). No pilot has run; thresholds are Mohamed's (D5).
- **Deliver:** protocol doc: recruit ~10 lifters who already log; import or retype a month; for each target, record the number the lifter would have picked next to the app target and which they loaded; weekly check-ins; retention checked at weeks 1, 2 and 6; bug log; interviews; consent for using their data.
- **Done means:** a written pilot report: agreement rate, why the app was overridden, retention at weeks 1/2/6, top bugs, what to change. No numbers are assumed beforehand; success thresholds are set by Mohamed before the pilot starts (D5).
- **Test:** the pilot is the test.
- **Size:** L (mostly elapsed time, six weeks of observation).
- **Mohamed:** the gym, the lifters, the trainer, the thresholds.
- **Risks:** small sample; friendly users; the rule vs "repeat last" gap (Hevy backtest) may repeat. Do not tune the rule to ten people without trainer review.

### Step 21. Backend: Cloudflare Workers + D1, auth, sync
- [~] **Status (v0.11.0, NOT device-verified):** server deployed to Mohamed's Cloudflare (free plan) and smoke-tested; client built and tested with fault injection against the real server code; delete-account wired into Delete everything (online copy first). Not done: two real phones, airplane-mode on a phone, email magic link (BLOCKED: no email provider; code path exists, dev mode only), a backup that outlives Time Travel (no scheduled export). **Checked 2026-10-03:** D1 Time Travel is on for `gain-sync` (7 days on free, 30 on paid; plan not confirmed), region ENAM, restore steps in [SYNC.md](SYNC.md), **rehearsed 2026-10-03 on a throwaway D1 database** (restore, verify, undo, generation bump, then deleted; the live database was never restored); D1 free-tier limits still not measured. Details: [SYNC.md](SYNC.md), [SYNC-CLIENT.md](SYNC-CLIENT.md).
- **Auth (D3):** anonymous account + recovery code is what works and what the app uses; email sign-in is a deferred option, blocked on a provider (section 4, D3). Optional and off by default; not used by the pilot.
- **Goal:** data survives a lost phone and works on a second device.
- **Deliver:** Workers API + D1 schema mirroring local tables; sync on `updated_at` / `deleted_at` with client UUIDs; conflict rule written down (default: last write wins per row, no deletes resurrected); rate limits; backups; auth (decision D3); delete-account endpoint wired to Step 12; sync is optional: the app stays fully usable offline and signed out.
- **Done means:** two devices converge after offline edits; replaying a sync twice creates no duplicate sessions; delete-account removes server rows.
- **Test:** sync property tests on a local D1; two-device manual test; airplane-mode test.
- **Size:** L.
- **Mohamed:** Cloudflare account and budget limits; auth choice; where the data lives (region constraints are **unknown**).
- **Risks:** sync bugs destroy trust faster than any other bug; Cloudflare D1/Workers plan limits need checking at the time.

### Step 22. Coach-card links (shared gyms were dropped)
- [~] **Status (v0.11.0):** **shared gyms DROPPED** (the gym UI was removed in v0.8.0; there is nothing to share and no shared-gym deliverable remains). **Coach-card links built:** private random link, hash stored, expiry (7 days, max 30), revoke, same 404 for unknown/expired/revoked, no account, escaped text-only page with strict CSP, rate limits, link-guessing and abuse tests; app button with consent. Deployed; not tried on a phone or with a real coach. Arabic/English page layout unseen on a phone. Not part of any gate; verify with the pilot only if lifters use it.
- **Goal:** a coach opens a link, no account.
- **Deliver (what remains):** a real-phone and real-coach check of the link; nothing else.
- **Done means:** a revoked link stops working, on a phone, with a real recipient.
- **Test:** API tests (exist); abuse cases (link guessing, exist); a manual device test.
- **Size:** S.
- **Mohamed:** a coach willing to open one.
- **Risks:** a health-like card is shared by the user, not by us; the not-a-doctor line stays.

### Step 23. Model layer (LLM), guardrails only for flagged cases
- [ ] **FROZEN (freeze list).** **Goal:** use a model only where the rule says `needsModel` (low confidence), never as the engine.
- **Deliver:** server-side proxy on Workers (no API key in the app); input = the rule's inputs only, no free text, no personal identifiers; output must be a load that exists in the gym and a bounded change (re-checked by the rule code); user sees both rule and model suggestion and nothing applies without a tap; every call logged to the decision log with `path = model`; cost cap and kill switch; offline = rule only.
- **Done means:** the model can never change the plan silently, invent history, or give pain advice; cost per active user is measured and below a ceiling Mohamed sets.
- **Test:** replay flagged cases from the pilot with and without the model; adversarial tests (impossible loads, empty history).
- **Size:** M.
- **Mohamed:** whether to do this at all before v1.0 (default: after pilot data shows how often cases are flagged); provider and budget.
- **Risks:** cost, latency, and the model sounding confident. If pilot shows few flagged cases, skip it.

### Step 24. (Removed) Subscription, paywall, pricing test
- Removed 2026-10-03; nothing replaces it. GAIN is completely free (PRODUCT.md, "Free for everyone"). The step number is kept so older references still resolve.

### Step 25. Play internal and closed testing
- [ ] Gate G4. **Goal:** install via the store, with signed AAB.
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

### Step 27. Launch (after G4)
- [ ] **Goal:** first hundred users, reachable in person.
- **Deliver:** launch in the pilot gym plus a few coaches; the coach card as the sharing loop (word of mouth: someone on the next bench asks what the app is); a support routine (reply time, bug triage); no paid acquisition until week-6 retention is shown (PRODUCT.md rule).
- **Done means:** the first hundred installs are people Mohamed can name or reach; a weekly support log is kept.
- **Test:** counts from the lifters' own exports and check-ins (the app has no analytics; Step 18 events exist only if D7 is ever answered yes).
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
- **Risks:** nothing has been built or tested for iOS; iOS is out of the first release (D1). Frozen until after G4.

### Step 29. Post-launch metrics and success criteria
- [ ] **Goal:** know if it is working, without vanity numbers. (Pilot-stage definitions are drafted in [PILOT-RETENTION-METRICS.md](PILOT-RETENTION-METRICS.md); no dashboard exists.)
- **Deliver:** weekly dashboard of: sessions logged per active user, share of targets accepted / edited / rejected, share of users on pace for a goal, week-1/2/6 retention, crash-free sessions, support issues; written success criteria taken from PRODUCT.md "Success": users log without fighting the screen, trust the next weight enough to load it, can tell if the goal is on pace, and a few stay for months.
- **Done means:** thresholds set by Mohamed before launch (D5), reviewed monthly.
- **Test:** event counts spot-checked against raw data.
- **Size:** S-M, then ongoing.
- **Mohamed:** the thresholds.
- **Risks:** small numbers; read them with care.

---

---

## 3. Gates (replace the old release-by-release milestone map)

The old map of future releases (v0.4.1 ... v1.x) is gone: it kept promising versions while nothing was device-verified. Past releases and that old map are in [RELEASE-HISTORY.md](RELEASE-HISTORY.md). From here the plan moves in four gates. A gate is passed by evidence in the repo, not by a version number. **Only fixes for what the current gate finds ship in the meantime** (as pre-release APKs, listed in RELEASE-HISTORY.md); no feature work (see the freeze list in "Now").

| Gate | Means | Exit criteria (all must hold, each with evidence committed) | Steps behind it |
| --- | --- | --- | --- |
| **G1. Device verified** | **Status: reported passed by Mohamed 2026-10-04 (not independently verified; no evidence committed to the repo).** The core loop works on real Android phones and nothing is lost. | Now 1-3 done. NATIVE-CHECKLIST rows 1-26 each PASS, or FAIL with an issue and a fix, on at least one real phone (two makers preferred) with model and Android version recorded; update-over-install from an older signed APK keeps all sessions and sets; force-stop mid-workout loses nothing; rest alert arrives with the screen locked (or is documented as not working, with the battery-saver tip); signing key restored from an off-box copy and verified. | 1, 10, 14 (device part), 15 (device part), 19 (key), section 5 upgrade tests |
| **G2. Pilot ready** | It is safe and sensible to put in ten other people's hands. | G1 passed and its bugs fixed. Arabic reviewed on the phone with written verdicts; TalkBack and large-text results recorded; the six pilot programs confirmed; pilot criteria (retention, usability, stop rules) written into PILOT-RETENTION-METRICS.md with a date, by Mohamed; the override-reason sheet from Now 5 in use; consent text checked by a lawyer or accepted by Mohamed as a risk call in writing (D6); a trainer has looked at the rules the lifters will see (Step 16) or Mohamed records that they go in unreviewed; a non-technical person installs from [INSTALL-GUIDE.md](INSTALL-GUIDE.md) without help. | 8 (Arabic), 14, 16, 17 (consent), 19 |
| **G3. Pilot validated** | The promise holds with real lifters: the number is trusted and people come back. | The six-week local-only pilot ran with about 10 lifters at one gym; the written pilot report (agreement next to "repeat last load", override reasons in their words, retention at weeks 1/2/6, top bugs, what to change) exists; the pre-written thresholds are met or the report says plainly which were missed; no stop rule (lost sets, clearly unsafe target, broken update path) is left unresolved. If thresholds are missed, the next work is whatever the report says, not new features. | 20 |
| **G4. Store ready** | A public Play listing can be submitted honestly. | G3 validated. Play Console account and app-signing choice; signed AAB; internal then closed testing with the pilot group; pre-launch report with no crashes; the self-updater's install permission resolved for the Play build; privacy policy at a public URL with a controller and contact, legally reviewed; data-safety form and listing (Arabic + English, real phone screenshots) match the shipped behaviour; no medical or physique claim; native-Arabic and trainer review recorded. | 17, 18 (if events are added), 25, 26 |

After G4 (not planned in detail): launch to people Mohamed can reach (Step 27), iOS (Step 28), post-launch metrics (Step 29). Backend work that is already built (sync, coach links) is verified on devices only as part of G1/G2 if the pilot uses it; the pilot itself is local-only, so sync is **not** a gate.

---

## 4. Decision log for Mohamed

| # | Question | Recommended default / status |
| --- | --- | --- |
| D1 | Android first, iOS after launch? | **Decided: Android first.** PRODUCT.md aligned. iOS is Step 28, after G4. |
| D2 | Which phone(s) do you test on? | **Open and blocking G1.** At least one real Android phone, preferably a second maker (battery savers differ). |
| D3 | Authentication for sync | **Decision (current): anonymous account + 20-character recovery code.** Sync works with no email provider; the recovery code (shown once, kept in the phone's secure storage) is the only way to restore on a new phone, and a lost code means an unreachable backup. **Email sign-in is a separate, deferred option:** the server code exists (8-digit one-time code typed into the app, not a magic link) but it is **blocked on an email provider** (none configured; the deployed Worker answers 501), and nothing in the app or this plan depends on it. Google or phone-number sign-in: not planned. Sync is optional and off by default, and the pilot does not use it. See [SYNC.md](SYNC.md), [SYNC-CLIENT.md](SYNC-CLIENT.md). |
| D4 | Library size at launch | Answered in practice: 607 exercises. Frozen; misses will come from the pilot. |
| D5 | Pilot and launch success thresholds | **Open, blocking G2.** Mohamed writes them before the pilot; proposed starting values are in Now 5. |
| D6 | Who reviews the privacy policy, terms and pilot consent text? | A lawyer or reputable template service; confirm Egypt and EU needs. Open. |
| D7 | Crash / analytics tool | None for the pilot (no analytics, local crash log + opt-in share). Decide only if G3 shows a need. |
| D8 | Who can edit a shared gym? | Moot: shared gyms dropped. |
| D9 | Billing library | Moot: GAIN is free; no billing library (see PRODUCT.md). |
| D10 | Do the rep ceilings 10/12/15 and the one-session trigger stay default after trainer review? | Keep until the trainer and pilot say otherwise. |
| D11 | Android auto-backup of the app database (on, the Expo default): leave on or turn off? | Leave on until the privacy policy (Step 17) is final; the delete screen says it exists. |

---

## 5. Risks and what to test first

### Test first, in this order (all open; none has been run on a device)
1. [ ] The signed APK launches, opens SQLite, and the file picker works for the Hevy import (Now 1).
2. [ ] **Upgrade: older supported releases update in place to the current schema without losing real user data** (below).
3. [ ] A full session with the phone locked and the app force-stopped mid-set loses nothing (Now 2).
4. [ ] Arabic and RTL on real screens: layout, mixed numbers and names (Now 4).
5. [ ] The Hevy import of 1,049 rows on a mid-range phone, then the first finish: do the targets look sane?
6. [ ] Do real lifters agree with the target? Cheap early check before the pilot: Mohamed's own sessions for two weeks.

### Migration testing: older releases to the current schema

The old line here ("migrates 1 to 3") was written at v0.3.0 and is obsolete. **The client database is at schema version 9** (`LATEST_VERSION`, the last of nine numbered migrations in `apps/mobile/src/db/migrations.ts`; there is no `db/migrations` folder). The sync server's D1 schema is separate (`apps/server/migrations`, latest `0003_generation.sql`) and is not part of the on-phone upgrade.

Published releases by the schema they leave on a phone (from the tags; also in RELEASE-HISTORY.md): v0.1.0 = 1, v0.2.0 = 2, v0.3.0 and v0.4.0 = 3, v0.5.0 to v0.8.0 = 5, v0.9.0 = 6, v0.10.0 = 7, v0.11.0 and v0.12.0 = 8, v0.13.0 to v0.18.0 = 9. Library rows, exercise twins and settings are topped up by app code at start, not by migrations, so they must be exercised by a real update as well.

- **Supported upgrade sources (proposal, Mohamed to confirm):** every release a real phone could still have, one representative per schema: v0.4.0 (3), v0.8.0 (5), v0.9.0 (6), v0.10.0 (7), v0.12.0 (8), v0.17.0 (9), and each future release over v0.18.0. v0.1.0 and v0.2.0 (schemas 1 and 2) are not in the proposed set; if any phone still runs them, test that phone, otherwise say "not supported" in the install guide. Phones above version 9 (a newer app than the one installed) are refused by design, not downgraded.
- **What exists today (Node only):** `apps/mobile/test/safety.test.ts` builds a database at each schema 1 to 8 using the *current* code's migration list truncated, writes a tiny hand-made history (3 sessions, 9 sets, one program) and checks that migrating to 9 keeps the rows, integrity and foreign keys. That proves the SQL steps, not that a real release's database upgrades. It uses invented rows, not a real user's data. (OFFLINE-SAFETY.md's "v1..v6 to v7" line was stale and is corrected.)
- **What is still needed, in order:**
  1. **Real-release fixtures on Node.** For each supported source tag, build that tag's own app, drive it (or its repos) with Mohamed's real Hevy export (`fixtures/hevy-export.csv`, 1,049 rows) plus logged sessions, targets, a goal, a short week and settings, and save the resulting SQLite file. Commit small fixtures, or a script that regenerates them from the tags. In a test, run the current `migrate`, then assert: row counts per table equal, a JSON backup taken before and after (current exporter) are equal for the tables the old schema had, `PRAGMA integrity_check` ok, `foreign_key_check` empty, the app's own reads (Today, history, next targets) give the same answers, and the pre-update safety copy was written and verified.
  2. **On a phone, per supported source:** install the old signed APK from its GitHub release, import the real export, log two real sessions, export a JSON backup, install the current APK over it, confirm session and set counts and next targets match, export again and compare. Repeat once with low free storage to see the "Update paused to protect your data" path.
  3. **Failure cases:** force-stop during the first launch after an update; update with the sync turned on (the second connection); restore the pre-update safety copy through Settings > Your data.
- Pass means: no lost, duplicated or altered session, set, target, program, goal or setting for every supported source. Results go in the dated device-test file; any difference is a G1 blocker.

### Main risks
- **Device verification is only Mohamed's report (2026-10-04, no committed evidence).** Every "built" above can still be broken on a phone, and anything added after v0.18.0 (including v0.19.0) has not been reported as run on a device. This is why the plan stops at gates instead of shipping more.
- **Rule vs behaviour.** The rule does not beat "repeat last load" on Mohamed's history; trust is the product (Steps 16 and 20).
- **Draft Arabic.** All Arabic began as a builder's draft. Mohamed reports he reviewed it (identity and scope not recorded); draft labels stay until the Step 8 bar is met.
- **Native rest timer** may be the hardest Android piece (battery savers).
- **Sync** bugs cost the most trust; the app is fully usable offline and the pilot does not use sync.
- **One person.** Scope grows faster than a single builder; keep the non-goals (chatbot, social, wearables, nutrition, video, photo progress) out.
- **Signing key.** Mohamed reports (2026-10-04, not independently verified) that Now 3 is done and the key is stored off the build box; the two copies the builder knows of are still on the same box, and no restore test is recorded in the repo. Losing the key blocks in-place updates.
- **Store requirements and fees** (Play account checks, new-account testing rules) are unknown and change; check at G4.
