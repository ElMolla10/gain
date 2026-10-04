# Pilot runbook: setup day, weeks 0 to 6, week-6 report (DRAFT)

Status: **DRAFT, nothing has been run.** The protocol and stop rules are in [PILOT-KIT.md](../PILOT-KIT.md); the definitions are in [PILOT-RETENTION-METRICS.md](../PILOT-RETENTION-METRICS.md); this page is the order of work for the person running it. Pilot is **local-only** (sync off, not offered). Counts, not percentages.

## 0. Before anyone is invited (all Mohamed's; none can be done by the builder)
- [ ] Criteria copied into the "Written before the pilot" table in PILOT-RETENTION-METRICS.md **with a date**, before the first install (D5). Proposed values: MASTER-PLAN "Now 5".
- [ ] Consent text accepted (or sent to a lawyer, D6): [CONSENT.md](CONSENT.md). Fill `[RUNNER]`, `[CONTACT]`, retention days.
- [ ] Gym, ~10 lifters (Android, arm64, 18+, 2+ days/week), who runs it day to day, whether a trainer sees numbers.
- [ ] Which build: normal APK + "tell them" or the pilot APK ([PILOT-TEMPLATES.md](PILOT-TEMPLATES.md)); write the version in the sheet.
- [ ] A private place for backups (a folder on one computer, never a group chat or the repo) and a rule for deletion dates.
- [ ] A phone that is not a lifter's own, or the runner's, for a dry run of the guide; and one non-technical person who installs from [GUIDE.md](GUIDE.md) without help (G2 requirement).
- [ ] Support email set on the hosted pages ([../site/README.md](../site/README.md)) if the pages are to be shared with lifters.
- [ ] Dry run of the numbers: `npm run pilot-metrics -w @gain/mobile -- --tz-minutes 180 $PWD/docs/pilot/sample/P00-synthetic.json` (synthetic, see [sample/README.md](sample/README.md)). It has **not** been run on a real pilot file.

## 1. Setup day, per lifter (~20 minutes, in person)
1. Consent read, questions answered; record in [consent-log-template.csv](consent-log-template.csv) (code, date, yes/no for taking part, yes/no for sending the file). Name stays on paper with the runner.
2. Install from the GitHub release following [GUIDE.md](GUIDE.md); **let the lifter do it** and note whether you had to touch the phone (`setup_without_help`) and how long it took.
3. Language and units; import their Hevy/Strong export (main path) or pick one of the six programs ([PILOT-TEMPLATES.md](PILOT-TEMPLATES.md)); check the gym's real weights.
4. Rest alert and reminders: switch on if wanted; confirm a notification arrives with the screen locked (some phones' battery savers block it; write the phone model).
5. Record phone model, Android version, GAIN version (Settings, bottom). Make sure they know how to report ([GUIDE.md](GUIDE.md) section 5) and that Back up and sync stays OFF.
6. Send the "after setup" message ([ONBOARDING-MESSAGES.md](ONBOARDING-MESSAGES.md) #4).

## 2. Each week (week 0 starts the day of the lifter's first finished, non-imported workout)
- End of weeks 1 to 6: send the check-in (#5). Same weekday, same words, never suggest an answer.
- Fill the pilot sheet row (`days_planned`, `app_version`, `on_pace_status`, `bugs_quotes`) from the answers.
- For each target the lifter did **not** load as the app wrote: one row in [override-sheet-template.csv](override-sheet-template.csv): `pilot_code, week, exercise, app_target (load x reps), loaded (load x reps), direction (more/less/same), reason in their words, tag, source (check-in/interview)`. A change with no stated reason is written "no reason given", never guessed. Tag afterwards with the six tags (too heavy / too light / equipment / felt bad / forgot / other).
- Bugs: triage with [BETA-FEEDBACK.md](../BETA-FEEDBACK.md). **Lost set, clearly unsafe target or a broken update = stop rule** (PILOT-KIT 1.7): pause, announce to everyone the same day (message #9), fix first.
- Quiet lifter after 7 days: message #7 once; ask before calling it churn.

## 3. Numbers (weeks 1, 2, 6, and whenever someone leaves)
1. Ask for the export (message #6) only from lifters who agreed to send the file. Save as `P01.json` (code only) in the private folder.
2. `npm ci` once, then from the repo root: `npm run pilot-metrics -w @gain/mobile -- --tz-minutes 180 /full/path/P01.json /full/path/P02.json > sheet.csv` (Cairo is 180 in summer time and 120 in winter; use **absolute paths**, the npm script runs inside `apps/mobile`).
3. stdout is the sheet rows; stderr prints retention ("week N: retained X of Y who reached it"), the total of targets compared with what was loaded, and a **like-for-like** line: among targets that also have a previous load, how many times the lifter loaded the app's number versus how many times "repeat last load" would have matched. Columns `both_comparable`, `both_app_same`, `both_repeat_same` per row.
4. Report counts: "6 of 9", never a bare percentage, never a significance claim. Do not tune the rule to ten people; changes go through the trainer review.
5. Delete each file when its numbers are in the sheet, unless the lifter agreed to keep it longer; record `files_deleted_date`.

## 4. Why override reasons are collected this way
The app stores accept / edit / reject and the edited load, but no reason. The reason has to come from the lifter in their words, asked the same way every week. That is why the check-in question 2 is fixed and why the override sheet is a second sheet, not a cell in the weekly row.

## 5. Week 6 / exit
Exit conversation (message #10, five questions in PILOT-KIT 1.6), final export, deletion confirmation (#11). The written pilot report (G3) is: agreement next to "repeat last load" (counts), override reasons in their words, retention weeks 1/2/6 (counts), top bugs, what to change; missed thresholds stated plainly.

## 6. What this runbook does not do
It does not recruit, store signed paper consent, run analytics (none exist), or replace a lawyer, a trainer, or a device test.
