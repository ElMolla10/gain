# Beta feedback and tester handling (Step 19) — DRAFT

Status: draft process. The channel and the people are **Mohamed's decisions** (placeholders below). Nothing here has been run with real testers.

## Channel (to decide)
- [ ] One WhatsApp group for testers: `<link, Mohamed to create>`. Pros: where Egyptian lifters already are. Cons: bug reports get buried, so ask for the template below.
- [ ] Optional form for structured reports: `<link, Mohamed to create>`. Do not collect names or health information beyond what the tester volunteers.

## Report template (paste this into the group description)
1. What did you do (the screen, what you tapped)?
2. What did you expect, what happened?
3. Phone make/model and Android version; GAIN version (Settings, bottom).
4. Screenshot or screen recording if you can.
5. If the app crashed or showed "something went wrong": Settings > Diagnostics > Share the report.

## What to ask testers each week (from the pilot plan, Step 20)
Did the app's target match the number you would have picked? If not, what did you load and why? Did you skip a session, and why? (No numbers are assumed beforehand; thresholds are Mohamed's, D5.)

## Triage
- Data loss or wrong target: fix first, release within days.
- Crash: read the shared report (it has no workout data), reproduce on Node tests if it is logic.
- Look and feel/Arabic wording: collect into the next batch.
- Every fix ships through docs/RELEASE-PROCESS.md; testers update in-app.

## Privacy and consent
Testers must be told what GAIN stores and sends (see PRIVACY-POLICY-DRAFT.md, which still needs legal review). If their workouts are used in the pilot analysis they must agree first (Step 20 consent), and exports they send are deleted after use unless they agree otherwise.
