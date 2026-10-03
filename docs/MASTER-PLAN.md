# GAIN master plan (A to Z)

Written 2026-10-02 from the code on `main` (v0.3.0, rule-v0.3); status rows updated through v0.11.0 (opt-in Back up and sync, private coach links, Cloudflare Worker deployed), not from intent. Product spec: [PRODUCT.md](PRODUCT.md). Rules: [PROGRESSION-RULES.md](PROGRESSION-RULES.md). Backtest: [BACKTEST-HEVY.md](BACKTEST-HEVY.md). Update the status table whenever a step ships.

Conventions: `[ ]` open, `[x]` done. Sizes are S (days), M (1-2 weeks), L (several weeks) of focused work; no calendar dates. Nothing here is a forecast. Anything marked **unknown** has not been checked.

---

## 0. Next 5 steps (follow these first)

1. [~] **Step 1: put the current release on a real Android phone and an emulator** and walk the whole loop (onboard, import, log, finish, accept/reject, why). Write down everything that breaks. Fix only those bugs, ship v0.4.1. **Status 2026-10-02: PARTLY DONE, NOT device-verified.** The app (x86_64 build of v0.4.0) was launched on an Android 14 emulator and rendered onboarding steps 1-3, then the emulator became unusable (no hardware acceleration on this box; see [DEVICE-TEST-0.4.md](DEVICE-TEST-0.4.md)). The full loop has NOT been run on any device. Still needs a real phone (Mohamed).
2. [x] **Step 2: goals + pace (two clocks)** (in v0.5.0, unit-tested only, NOT device-verified; PR #25). Goals screen, weigh-ins, pace from the lifter's logs, one line on Today. Rules: [PACE-RULES.md](PACE-RULES.md).
3. [x] **Step 3: weekly one-decision review** (PR #27, rules in [WEEKLY-RULES.md](WEEKLY-RULES.md)) and **Step 4: short-week rebuild** (PR #28, rules in [SHORT-WEEK-RULES.md](SHORT-WEEK-RULES.md)). Both in v0.5.0, unit-tested only, NOT device-verified.
4. [x] **Steps 5-7: make the trust surfaces visible** (PRs #30, #31, #32; Step 9 warm-ups #33 in the same release v0.6.0): outlier confirm kept honest, rejection memory shown and undoable, history + trend per lift, decision-log screen. Unit-tested only, NOT device-verified.
5. [x] **Step 12 early: export and delete my data** (done, unit-tested only; docs/DATA-EXPORT.md). Needed before any other person installs the app (Step 20 pilot).

Rule for all steps: no step is "done" until it was run on a device (or is explicitly marked "unit-tested only").

---

## 1. Where we are today

Verified-on-device = **none recorded** for any row (the v0.2.0 release notes say the APK was not launched; nothing in the repo records a device run of 0.3.0; Mohamed to correct me if he has run it). CI runs `typecheck` + `test` on every PR. Tests passing locally today (v0.11.0): engine 325, sync package 19, mobile 484, server 83 (of which 27 run the real app sync engine on the real GAIN database against the real Worker code, with injected faults). All run on Node; SQLite stands in for D1 there. They are not phone tests.

| Area | Status | What is really there |
| --- | --- | --- |
| Logger | Partly (v0.9.0 redesign after the Hevy reference screenshot; unit-tested logic only, the screen itself is NOT device-verified) | Hevy-style "Log Workout": dark/black (light theme follows the system) with a blue accent; top bar = collapse chevron (back to Today, workout stays open), title, rest-timer button (shows the countdown while running, opens a panel), prominent blue Finish; live **Duration / Volume / Sets** row (working sets only; warm-ups and rejected outliers never count); ONE scrolling list of ALL exercises. Per exercise: name in blue, three-dot menu (Notes / Replace for today only / Remove, with Put back), "Add notes here..." (saved on the phone), "Rest Timer: 1:30 / OFF" (tap = auto-start after a set on/off for this exercise), GAIN's **target + one-line reason** (tap = Why screen, or expands the reason when there is no stored target), then the table **SET \| PREVIOUS \| KG/LB \| REPS \| tick** (+ RIR box only for lifts that track effort). PREVIOUS = same-numbered working set of the last finished session of the same exercise/gym/setup ("90kg x 12"). KG and REPS are plain typed boxes (no steppers) whose **ghost text is today's target**: one tap on the tick logs it. Tick = saved on the phone at once (offline) and starts the rest timer; tick again = undo (set deleted, numbers kept); typing over a ticked row shows ↻ to update. Tap the set number = warm-up (W); swipe a row or long-press its number = delete. Outlier confirm, warm-up ladder, finish flow (confirm if nothing ticked or rows are filled but unticked) and next-session targets unchanged. Replace/Remove are for today only: the programme does not change; a replacement gets no next-session target yet; removing deletes that exercise's logged sets (asked first). Migration 6 (`session_exercise`) stores notes / removed / replaced / rest-off. **v0.10.0 (unit-tested only, NOT device-verified):** set types via the set-number menu (Normal / Warm-up W / Drop D / Failure F; drop sets never count toward targets, PREVIOUS or the rest timer), "+ Add exercise" for something not in today's day (today only, never changes the programme; migration 7), supersets ("Superset with...", rest only after the last member), a failed save now shows an alert instead of failing silently. Not done: muscle figures, exercise thumbnails, adding an exercise permanently to the programme from the logger. |
| Finish flow | Done (unit-tested) | Summary, records, next-session targets written at finish, accept / edit / reject, saved. |
| Targets + reasons | Done (unit-tested) | rule-v0.3 (ACSM 2009 + rep ceilings 10/12/15), currency order, confidence, Why screen. |
| Gym fingerprint | Data layer only (v0.8.0: UI removed) | A silent default gym with standard loads in the lifter's unit; the engine still snaps loads to it; planned sessions follow the rack; the standard rack swaps kg/lb automatically on a unit switch. **No Gym tab, editor or any link to one** (guarded by a test). Several gyms, copy and switch still exist in the repo but have no screen. |
| Programme editor | Done (unit-tested) | Days, exercises, versions, weekly exposure effect, exercise picker, custom exercises, 7 draft templates. **v0.8.0: "Choose a different programme"** (Programme tab): switch back to any of your programmes (versions and history stay) or start a template as a NEW programme; blocked while a workout is open. |
| Onboarding | Done (unit-tested; v0.8.0 changes NOT device-verified) | Language, units (kg preselected, lb offered), basics (days, minutes), goal, optional about-you (height, birthday, bodyweight), programme, review. **No equipment question (v0.8.0: a full gym is assumed) and no gym step (v0.4.0):** a default gym with standard loads in the chosen unit is created silently. After choosing a template the step shows only each day's title and the weekly exposure (the full split is edited later in the Programme tab); "Build my own" keeps the editor. Dates (birthday, goal date, weekly "another date") are picked with day/month/year selectors, never typed (`DateSelect`, no native module). The birthday is new in v0.8.0, optional, stored as setting `birth_date`, used for nothing yet. Re-runnable from Settings (only adds a programme). |
| Hevy/Strong import | Done (unit-tested) | Parser (Hevy kg/lb, Strong), preview, exercise mapping, dedupe, undo, hidden history programme. Tested on Mohamed's export and a synthetic file. Strong is covered by tests only: no real Strong export seen (**unknown**). |
| Goals / pace | Done (unit-tested only, v0.5.0) | Goals screen (lift, bodyweight, muscle), weigh-ins, Theil-Sen trend, pace from logs, one line on Today. Thresholds are my defaults, **Mohamed to confirm** ([PACE-RULES.md](PACE-RULES.md)). Not run on a device. |
| Weekly decision | Done (unit-tested only, v0.5.0) | Card on Today, rule `weekly-v1`, accept / edit date / skip, past reviews in Goals. Only a date move changes anything; other proposals are recorded and the card says the programme is not edited. Week start day (default Monday) and card-vs-notification are **Mohamed's call**. Not run on a device. |
| Short-week rebuild | Done (unit-tested only, v0.5.0); **v0.10.0 fixes two bugs** (also unit-tested only) | Days + minutes entry on Today, preview with the cut list, applies as a new programme version, undo, auto-return after the week, goal lifts protected ([SHORT-WEEK-RULES.md](SHORT-WEEK-RULES.md)). Rules are my defaults pending trainer review. Fixed in v0.10.0: a short week now belongs to the programme it was made for (switching programme no longer leaves the other programme short or the old short week stuck), and applying a short week is one atomic write (a kill between the two writes used to leave the short programme with no restore record). Not run on a device. |
| Rejection memory UI | Done (unit-tested only) | Settings > "Things I've stopped suggesting": every declined jump per lift and gym with count and stopped state, bring it back, undo. Finish screen says how many declines so far and when a jump stops. Not run on a device. |
| Outlier confirm UI | Done (unit-tested only) | Logger asks confirm/reject for a set far from the line; unconfirmed sets never move the next target (tested with a 100-reps typo run against a clean run), and typo cases (100 reps for 10, 100 kg for 10 kg, extra zero) are engine-tested. Edit-in-history comes with Step 6. Not run on a device. |
| Exercise library + Arabic aliases | Partly (DRAFT, unreviewed) | 20 sample exercises plus 30 more added in v0.7.0 (`libraryDraft.ts`, topped up once into existing and new installs, never overwriting or resurrecting the lifter's rows). **All Arabic names and aliases are my drafts, never reviewed by a native Egyptian lifter**; no cues, setup text or media. Picker search by English or Arabic alias (letters ة/ه, أ/ا unified). Generated review sheet: [ARABIC-REVIEW-SHEET.md](ARABIC-REVIEW-SHEET.md). Reviewers, target size (**D4**) and import-alias matching still open. |
| History / trends | Done (unit-tested only) | History tab: sessions (imported labelled), lifts, session detail with edit / delete a set, trend per lift (top working set, plain bars, direction in words). Rules: [HISTORY-TREND.md](HISTORY-TREND.md). The measure is my default (**Mohamed to choose**). No chart library, no phone timing yet. |
| Rest timer | Partly (compiles, unit-tested only; **no change in v0.10.0**) | In-app timer plus Settings: default rest, vibrate, optional end-of-rest notification (permission flow). Screen-off delivery, killed-app delivery and battery-saver behaviour are **untested**; no lock-screen countdown, no reminders ([REST-ALERT.md](REST-ALERT.md)). |
| Warm-ups | Done (unit-tested only) | "Add warm-ups" in the logger: preview of the engine's ladder on gym-real loads, logged as warm-ups, once, never change the next target. Scheme is the engine default, **Mohamed to confirm** ([WARMUPS.md](WARMUPS.md)). Not run on a device. |
| Notifications | Partly | expo-notifications installed; only the rest-timer alert uses it. No training-day reminders, no weekly-review notification. Not run on a device. |
| Export / delete | Done (unit-tested only) | Settings > Your data: JSON backup, CSV of sets in Hevy columns (re-imports), restore (checked, all-or-nothing, replaces), delete everything (back to first run). Share sheet / picker not run on a phone. Android auto-backup still on: **Mohamed to decide** ([DATA-EXPORT.md](DATA-EXPORT.md)). |
| Settings | Partly | Language, RTL override, rep ceilings, import, set-up-again, version. Unit switch kg/lb, rest timer settings, Your data (v0.10.0: also shows the pre-update safety copy), **Check for updates (v0.8.0)**, **Diagnostics** and **Privacy and safety** (v0.10.0, DRAFT text, unit-tested only). No theme choice (follows system). |
| Today / schedule | Done (v0.8.0, unit-tested only, NOT device-verified) | Today lists every day of the active programme with the rotation's suggestion marked ★; the lifter picks any day. The chosen day gets its own planned session and targets; planned sessions of other days are voided, so missed workouts never stack. The rotation continues from the day actually finished. An open workout is resumed, not duplicated. |
| Self-update | Partly (v0.8.0, unit-tested logic only, NOT device-verified) | Settings > Check for updates: GitHub releases API (public, no token, pre-releases included), compares with the installed version, shows version + notes, downloads the arm64 APK, verifies SHA-256 (GitHub digest or release notes) and opens the Android installer (same signing key = update in place). Never run on a phone: the file-provider URI, the unknown-sources prompt and the install-over are unverified ([UPDATES.md](UPDATES.md)). |
| Dark mode / RTL | Partly (v0.10.0: code-level QA done, nothing looked at on a device; [A11Y-RTL-CHECKLIST.md](A11Y-RTL-CHECKLIST.md)) | Dark palette follows system; RTL flips via `direction`. Arabic strings are drafts, including everything added in v0.8.0 and the v0.9.0 logger (workout list, Today day choice, programme switch, date selectors and month names, updates; in `strings.workout/date/update/programme.ts`). The v0.9.0 logger has a light palette and uses start/end layout (RTL flips rows, swipe direction and the target bar), but neither theme nor RTL has been looked at on a device. |
| Coach card | Partly (unit-tested only) | Finish screen: share a one-page PDF (session, next targets, pace line for lift/muscle goals, no bodyweight, not-a-doctor line) in English or Arabic. No image version. **v0.11.0:** also "Share as a link" (consent card, private random link, 7 days, stop sharing; server deployed, no account for the coach; unit/e2e-tested, not on a phone). PDF layout, Arabic rendering and share sheet never run on a phone ([COACH-CARD.md](COACH-CARD.md)). |
| Decision log screen | Done (unit-tested only) | Settings > Decision log (and a button in History): every stored decision with lift, gym, suggested number, what you did, sentence, rule version, path; filter by lift; tap for the stored inputs. Old/unknown rule formats fall back to the stored sentence. [DECISION-LOG.md](DECISION-LOG.md). Not run on a device. |
| Backend / sync | **Server deployed and smoke-tested; app side built (v0.11.0), NOT device-verified; email sign-in BLOCKED** | Cloudflare Worker `gain-sync` + D1 `gain-sync` (free tier) at https://gain-sync.elmolla10.workers.dev: anonymous account + recovery code, event push / cursor pull, idempotent client event UUIDs, tombstones, last write wins per row, rate limits, delete-account. App: Settings > Back up and sync (OFF by default, plain privacy text, recovery code, turn off / delete backup), auto-sync only when on, restore-first first sync (no merge of two populated phones), parked rows reported. Email code sign-in implemented but **BLOCKED: no email provider** (Resend path is only tested with a mock; the deployed Worker answers 501). D3 default adapted: anonymous + recovery code works now, email later. Never run on a phone; D1 free-tier limits unmeasured; data region unknown. [SYNC.md](SYNC.md), [SYNC-CLIENT.md](SYNC-CLIENT.md). |
| Shared gyms | **DROPPED** | The gym UI was removed in v0.8.0 (a silent default gym), so there is nothing to share. Not built; D8 is moot. Can come back only if gyms return as a feature. |
| Subscription / paywall | Not started | Nothing is gated. |
| Model layer | Seam + guardrails (tests only) | `ModelAdvisor` interface + `needsModel` flag, and since v0.10.0 pure guardrail code (`modelGuard.ts`: fixed rationale keys, gym-real loads within one step, rep range, no invented history, flagged-only, offline = rule, `path=model` log); nothing implements or calls a model ([MODEL-GUARDRAILS.md](MODEL-GUARDRAILS.md)). |
| Analytics / privacy | Partly (v0.10.0, drafts) | No analytics and no third-party crash reporting. A local-only crash log with an opt-in share (Settings > Diagnostics, [DIAGNOSTICS.md](DIAGNOSTICS.md)); privacy policy and terms are **DRAFTS needing legal review** ([PRIVACY-POLICY-DRAFT.md](PRIVACY-POLICY-DRAFT.md), [TERMS-DRAFT.md](TERMS-DRAFT.md)) with an in-app Privacy and safety page and health notes; tests guard that only the update check, the opt-in sync transport and the coach link use the network (v0.11.0: the draft policy and privacy page now describe Back up and sync and coach links). Native crashes are not logged; no event analytics (needs D7). |
| Store release | Not started | Sideload APKs only (v0.1.0 to v0.11.0, arm64, own keystore; process in [RELEASE-PROCESS.md](RELEASE-PROCESS.md)). `app.gain.mobile` id. iOS config exists in `app.json`, nothing built or tested. |

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
- **Test:** engine/logic tests over all 7 templates; device check.
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
- [~] **Status: content drafted, review NOT done (v0.7.0, unit-tested only).** Library grew from 20 to 50 exercises with draft Arabic names and aliases (only spellings and short forms of my own names, no slang I cannot source; no cues or media). Review sheet generated ([ARABIC-REVIEW-SHEET.md](ARABIC-REVIEW-SHEET.md)); a test keeps it in sync. **Not done:** native sign-off (blocked on Mohamed recruiting two reviewers), the reviewers' 20 search terms, alias-aware import matching, short cues, equipment/setup text, D4 target size. "Draft" labels stay. **Goal:** a library people will find their lifts in, in Egyptian gym language.
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
- [~] **Status: partly done (unit-tested only, NOT device-verified):** rest default / vibrate / notify settings, end-of-rest local notification with permission flow ([REST-ALERT.md](REST-ALERT.md)). Not done: reminders, foreground-service countdown, any real-phone check. **Skipped in the v0.10.0 batch:** the foreground-service/lock-screen countdown needs a native module spike and a real phone to mean anything, and training-day reminders need a decision (the rotation is not tied to weekdays, so which days?) and a phone to test delivery. **Goal:** the timer works with the screen off.
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
- [ ] **Goal:** a qualified person has reviewed what we say before it is a public claim.
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
- [~] **Status (v0.10.0, partly, NOT device-verified):** local-only crash log and error boundary, opt-in share, no third-party service ([DIAGNOSTICS.md](DIAGNOSTICS.md)). Not done: native crashes and unhandled promise rejections, analytics events (needs D7 and the event list). **Goal:** see crashes and the few numbers that decide the product, without surveillance.
- **Deliver:** crash reporter (choice D7), opt-in; event list written down first (e.g. session finished, target accepted/edited/rejected, weekly review answered); no set-level content, no free text; no third-party ad SDKs.
- **Done means:** event list matches the privacy policy; user can turn it off; no events before consent.
- **Test:** network-capture check.
- **Size:** S-M.
- **Mohamed:** tool choice and budget.
- **Risks:** the free tier or hosting location of a tool may conflict with the policy text.

### Step 19. Beta distribution (APK first)
- [~] **Status (v0.10.0, drafts):** [RELEASE-PROCESS.md](RELEASE-PROCESS.md), [INSTALL-GUIDE.md](INSTALL-GUIDE.md), [BETA-FEEDBACK.md](BETA-FEEDBACK.md) written from the process actually used. Not done: keystore backup (unknown, Mohamed), feedback channel, a clean-clone build, install/upgrade on two phones, a non-technical lifter following the guide. **Goal:** a repeatable way to put builds on pilot phones.
- **Deliver:** documented release process (version bump, signed arm64 APK, checksum, notes); update-over-install check each time (v0.2.0 was signed with the same keystore as v0.1.0 per its release notes; keep using it; whether it is backed up is **unknown**); a one-page install guide; a feedback channel (WhatsApp group or form).
- **Done means:** a non-technical lifter installs and updates from the guide without help.
- **Test:** install and upgrade on two phones; build from a clean clone.
- **Size:** S.
- **Mohamed:** keystore custody; non-arm64 phones (x86/armv7) are not covered by current APKs.
- **Risks:** losing the keystore blocks updates for sideloaded users and, depending on Play App Signing choices, Play uploads.

### Step 20. Pilot: about 10 real lifters, one gym
- [ ] **Goal:** find out if Thursday's number is right and people come back.
- **Deliver:** protocol doc: recruit ~10 lifters who already log; import or retype a month; for each target, record the number the lifter would have picked next to the app target and which they loaded; weekly check-ins; retention checked at weeks 1, 2 and 6; bug log; interviews; consent for using their data.
- **Done means:** a written pilot report: agreement rate, why the app was overridden, retention at weeks 1/2/6, top bugs, what to change. No numbers are assumed beforehand; success thresholds are set by Mohamed before the pilot starts (D5).
- **Test:** the pilot is the test.
- **Size:** L (mostly elapsed time, six weeks of observation).
- **Mohamed:** the gym, the lifters, the trainer, the thresholds.
- **Risks:** small sample; friendly users; the rule vs "repeat last" gap (Hevy backtest) may repeat. Do not tune the rule to ten people without trainer review.

### Step 21. Backend: Cloudflare Workers + D1, auth, sync
- [~] **Status (v0.11.0, NOT device-verified):** server deployed to Mohamed's Cloudflare (free tier) and smoke-tested; client built and tested with fault injection against the real server code; delete-account wired into Delete everything (online copy first). Not done: two real phones, airplane-mode on a phone, email magic link (BLOCKED: no email provider; code path exists, dev mode only), server-side backups (no scheduled export; D1 Time Travel not checked), D1 free-tier limits and region. Details: [SYNC.md](SYNC.md), [SYNC-CLIENT.md](SYNC-CLIENT.md).
- **Goal:** data survives a lost phone and works on a second device.
- **Deliver:** Workers API + D1 schema mirroring local tables; sync on `updated_at` / `deleted_at` with client UUIDs; conflict rule written down (default: last write wins per row, no deletes resurrected); rate limits; backups; auth (decision D3); delete-account endpoint wired to Step 12; sync is optional: the app stays fully usable offline and signed out.
- **Done means:** two devices converge after offline edits; replaying a sync twice creates no duplicate sessions; delete-account removes server rows.
- **Test:** sync property tests on a local D1; two-device manual test; airplane-mode test.
- **Size:** L.
- **Mohamed:** Cloudflare account and budget limits; auth choice; where the data lives (region constraints are **unknown**).
- **Risks:** sync bugs destroy trust faster than any other bug; free vs paid D1/Workers limits need checking at the time.

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

### Step 24. Subscription, paywall, pricing test
- [ ] **Goal:** find out if people pay, and what for.
- **Deliver:** free vs paid split from PRODUCT.md: free = logging, history, one template, basic charts, own-data export, records stay after cancel; paid = next-session targets, gym-aware increments, goal pace, short-week rebuild, weekly decision. Limit shown before purchase. Play Billing (via a library or RevenueCat: D9), server-checked entitlement, trial that covers several real sessions with renewal stated up front, annual shown first, restore purchases; price page experiments.
- **Done means:** a test purchase, cancel and restore work on a licensed test account; cancelling keeps all records; prices are set only after fees and tax are confirmed.
- **Test:** Play test tracks, licence testers.
- **Size:** L.
- **Mohamed:** prices to test (PRODUCT.md only says "near a local coaching snack"; the 149-249 EGP figure is explicitly unproven), payment method availability in Egypt (**unknown**), store fees/tax/VAT (**to confirm**).
- **Risks:** many Egyptian users lack cards for Play billing (**unknown**, check carrier billing and other options); paywalling the core promise too early hurts the pilot, so gate only after Step 20.

### Step 25. Play internal and closed testing
- [ ] **Goal:** install via the store, with signed AAB.
- **Deliver:** Play developer account; app signing choice; AAB builds; internal track; closed track with testers; pre-launch report fixes. Check current Play requirements for new accounts and testing tracks (**unknown**, they change).
- **Done means:** pilot users update through Play; pre-launch report has no crashes.
- **Test:** Play pre-launch report and device matrix.
- **Size:** M.
- **Mohamed:** the Play Console account (personal vs organisation, identity checks), payment profile.
- **Risks:** account verification delays; package id `app.gain.mobile` is fixed once published.

### Step 26. Store listing and assets
- [ ] **Goal:** a listing that is accurate in Arabic and English.
- **Deliver:** short + full descriptions (start from PRODUCT.md short description), screenshots (AR + EN, RTL and LTR, light/dark), feature graphic, icon (exists), content rating questionnaire, data safety form (must match Steps 17/18/21), privacy policy URL, support email, target countries.
- **Done means:** the listing passes review; claims contain no medical or physique promise.
- **Test:** compare each listing claim to a shipped feature.
- **Size:** M.
- **Mohamed:** final name check (trademark search is **unknown**), who writes the Arabic copy.
- **Risks:** Data safety answers wrong vs actual behaviour can cause removal.

### Step 27. Launch and growth
- [ ] **Goal:** first hundred users, reachable in person.
- **Deliver:** launch in the pilot gym plus a few coaches; coach card as the sharing loop; invite codes for shared gyms; support routine (reply time, bug triage); no paid acquisition until week-6 retention and paying users exist (PRODUCT.md rule).
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
- [ ] **Goal:** know if it is working, without vanity numbers.
- **Deliver:** weekly dashboard of: sessions logged per active user, share of targets accepted / edited / rejected, share of users on pace for a goal, week-1/2/6 retention, trial-to-paid, crash-free sessions, support issues; written success criteria taken from PRODUCT.md "Success": users log without fighting the screen, trust the next weight enough to load it, can tell if the goal is on pace, and a few pay and stay.
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
| **v0.10** | 21, 22, (23), 24, 25 | Sync, shared gyms, coach links, paywall test purchase, closed testing on Play. Model layer only if the pilot shows it is needed. **Shipped as v0.11.0 pre-release, partly:** sync (21) and coach links (22) built and deployed; shared gyms dropped; email sign-in blocked; paywall, Play closed testing and the model layer not started; nothing device-verified, so the milestone's bar is **not met**. |
| **v1.0** | 26, 27 | Public listing live (AR + EN), data safety form accurate, first hundred users plan running. |
| **v1.x** | 28, 29 | iOS via TestFlight; metrics reviewed against thresholds. |

Pilot (v0.9) deliberately comes before backend and paywall: it tests the promise with local data only.

---

## 4. Decision log for Mohamed

| # | Question | Recommended default |
| --- | --- | --- |
| D1 | Android first, iOS after v1.0? (PRODUCT.md says both in first release) | Android first; fix PRODUCT.md later. |
| D2 | Which phone(s) do you test on? | Your own plus one emulator now; add a second brand before v0.8. |
| D3 | Auth for sync: anonymous device id + optional email magic link, Google sign-in, or phone number? | Email magic link, optional; the app works without an account. |
| D4 | Library size at launch? | Cover the exercises in your Hevy history and the 7 templates first, then grow from pilot misses. |
| D5 | Pilot and launch success thresholds (agreement rate, week-6 retention, paying users)? | You set them before the pilot starts; I will not propose numbers I cannot support. |
| D6 | Who reviews privacy policy and terms? | A lawyer or reputable template service; confirm Egypt and EU needs. |
| D7 | Crash/analytics tool? | The cheapest tool that can run opt-in and avoids set-level content; decide at Step 18. |
| D8 | Who can edit a shared gym? | Moot: shared gyms dropped (gym UI removed). Creator-only edits would have applied. |
| D9 | Billing library? | Decide at Step 24 after checking Egypt payment options. |
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
- **Draft Arabic.** All Arabic is a first draft; native review is unscheduled.
- **Native timer** may be the hardest Android piece (battery savers).
- **Sync** bugs cost the most trust; keep the app fully offline-usable.
- **Payments in Egypt** and store fees/tax are unknown.
- **One person.** Scope grows faster than a single builder; keep the non-goals (chatbot, social, wearables, nutrition, video, photo progress) out.
- **Keystore** loss would block updates; keep a backup.
