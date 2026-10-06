# Pilot kit (Step 20): protocol, consent text, check-ins, bug report, numbers

Status: **DRAFT KIT. No pilot has started and nobody has been recruited.** Everything below is for Mohamed to adapt. The consent text has had **no legal review** (D6) and the Arabic is a builder's draft nobody native has read. Success thresholds are blank on purpose (D5, in [PILOT-RETENTION-METRICS.md](PILOT-RETENTION-METRICS.md)). GAIN has no analytics: numbers come from the lifter's own backup file, a weekly check-in and the pilot sheet.

**Finished drafts of the pilot materials (2026-10-04) live in [pilot/](pilot/README.md):** runbook, print-ready consent (EN/AR, local-only), WhatsApp messages (EN/AR), one-page install-and-report guide (EN/AR), FAQ, the six pilot programs and how to show only them, consent log and override sheet templates. Where they differ from this page (local-only consent, no sync paragraph), they win; this page stays the protocol and the stop rules.

## 0. What has to be decided by a person before the first install
| Decision | Who | Why it blocks |
| --- | --- | --- |
| Thresholds for "good" (week-1/6 retention, agreement, rejected share) written in PILOT-RETENTION-METRICS.md **before** the pilot | Mohamed (D5) | Otherwise the result gets judged after the fact |
| The gym, the 10 lifters, who runs the pilot day to day | Mohamed | Needs people |
| A phone for every lifter that runs the arm64 APK; whether iPhone users are simply out | Mohamed | Android arm64 only today |
| Feedback channel (WhatsApp group or form) | Mohamed | [BETA-FEEDBACK.md](BETA-FEEDBACK.md) |
| Whether the consent text below is enough for Egypt (and any EU participant) | a lawyer (D6) | Health-adjacent training data; the draft is not legal advice |
| Whether a trainer has reviewed the rules the lifters will be shown | a trainer (Step 16) | Targets are rule-v0.3 suggestions; the review pack is [TRAINER-REVIEW-PACK.md](TRAINER-REVIEW-PACK.md) and has no verdicts |
| The Step 1 device test has passed on at least one phone | Mohamed (a phone) | Mohamed reports this passed on 2026-10-04 (not independently verified; no results committed); putting an unverified build in ten people's hands is Mohamed's risk call |

## 1. Protocol (about ten lifters, one gym, six weeks)
1. **Who:** adults who already log workouts, train 2 or more days a week, and have an Android phone. Not for anyone with a medical condition that limits training unless their doctor is fine with it; GAIN is not medical advice. Ask for 10; expect fewer finishing.
2. **Before week 0 (setup, ~20 min each, in person):** install from the release APK following [INSTALL-GUIDE.md](INSTALL-GUIDE.md); read and agree the consent (section 3); give the lifter a pilot code (P01..P10) written only in the pilot sheet; onboard; import their Hevy/Strong export or type the program; check the gym's real weights are set. Write down phone model, Android version, GAIN version.
3. **Week 0-5:** the lifter trains as usual and logs in GAIN. For each target the app proposes they accept, edit or reject it (that is what is measured). Nobody coaches them toward the app's number.
4. **Weekly check-in (end of weeks 1 to 6):** send the three questions from PILOT-RETENTION-METRICS.md (days planned/done; what you loaded instead of the app's number and why; what broke or confused you). Answers go in the sheet.
5. **Numbers:** at the end of weeks 1, 2 and 6 (and any time a lifter leaves) ask them to export (Settings > Your data > JSON backup) and send it privately. Run section 5. Keep the file only as long as needed (section 4).
6. **Week 6 or exit interview (15 min):** where did the app's number feel wrong? Did you trust it enough to load it? What stopped you opening the app? What would make you stay? What would make you recommend it to someone at your gym?
7. **Stop rules:** pause the pilot and fix first if (a) any lifter loses logged sets, (b) a target is clearly unsafe (a large jump after a failed or painful session), or (c) the update path breaks installs. Tell all lifters the same day. Any pain or injury report: tell them to stop and ask a professional; log it as an incident, not a data point.
8. **Report:** counts not percentages ("6 of 9"), agreement next to "repeat last load" computed from the same data, override reasons in the lifters' words, top bugs, what to change. The rule is not tuned to ten people; changes go through the trainer review.

## 2. Setup checklist per lifter
- [ ] Consent read, questions answered, yes recorded in the pilot sheet (date, pilot code, not the name)
- [ ] APK installed; Settings shows the expected GAIN version
- [ ] Language and units set; program chosen/imported; gym weights checked
- [ ] Rest alert and (if wanted) training-day reminders switched on and a notification arrives (Android battery savers may block it)
- [ ] Back up and sync: **OFF and not offered** in the planned local-only pilot (MASTER-PLAN Now 5 overrides the older "ask, do not push" wording). If a lifter turned it on anyway, write that down (the data then also sits on the GAIN server in Cloudflare/ENAM) and use the deletion steps in section 4
- [ ] They know where to report bugs and how to share the diagnostics report

## 3. Consent text (DRAFT, not legally reviewed)

> **Superseded for the planned pilot by [pilot/CONSENT.md](pilot/CONSENT.md)** (local-only: Back up and sync is not offered, so the sync paragraph below does not apply). Kept here as the longer original.

### English
> **GAIN pilot: what I am asking you to agree to**
>
> I am testing a lifting log called GAIN. It suggests your next weight after each workout. I want to learn whether the suggestions are right and whether people keep using the app.
>
> **What I would take from you:** a backup file you export yourself from the app (Settings > Your data). It contains your workouts and sets, the suggestions GAIN made and whether you accepted, changed or rejected them, your programs and settings, and anything you typed into the app such as notes, bodyweight, height or birthday if you entered them. I do not need your name; I will label your file with a code (P01, P02...). I will read workouts, sets and suggestions. I will not use notes, bodyweight, height or birthday.
> **Also:** your short answers in the weekly check-in, and what you tell me in the final interview.
> **Why:** to measure how often you used the suggested weight, how often you changed it and why, and whether you were still logging in weeks 1, 2 and 6.
> **Who sees it:** [name(s) of the people who run the pilot, and the trainer if they see it]. Nothing is sold or shared with advertisers. Results are reported as group counts and short quotes without names.
> **How long I keep it:** [until the pilot report is finished, at most N days], then I delete your file. You can ask me to delete everything about you at any time, before or after the pilot, by messaging [contact].
> **Your choices:** joining is voluntary; you can stop at any time without giving a reason; you can say no to sending a file and still take part by answering the check-ins.
> **Back up and sync:** it is off unless you turn it on. If you turn it on, a copy of your training data is stored on a GAIN server (on Cloudflare) until you delete it in the app.
> **Health:** GAIN is a training log, not a doctor or coach. Its numbers are suggestions based on what you logged. You decide what to lift. If something hurts, stop and ask a qualified professional.
> **This is a test version.** It can have bugs; keep your own record of anything you cannot afford to lose (you can export a backup any time).
>
> Name: ____________ Pilot code: ____ Date: ______ I agree: [ ]

### Arabic (مسودة، محتاجة مراجعة من متحدث أصلي ومراجعة قانونية)
> **تجربة GAIN: إيه اللي بطلب موافقتك عليه**
>
> أنا بجرّب تطبيق تسجيل تمارين اسمه GAIN. التطبيق بيقترح عليك الوزن الجاي بعد كل تمرينة. عايز أعرف الاقتراحات صح ولا لأ، وهل الناس بتكمّل تستخدمه.
>
> **اللي هاخده منك:** ملف نسخة احتياطية إنت بتصدّره بنفسك من التطبيق (الإعدادات > بياناتك). فيه تمارينك ومجموعاتك، واقتراحات GAIN وإنت قبلتها ولا عدّلتها ولا رفضتها، وبرامجك وإعداداتك، وأي حاجة كتبتها جوه التطبيق زي الملاحظات أو وزن الجسم أو الطول أو تاريخ الميلاد لو دخلتهم. مش محتاج اسمك؛ هسمّي ملفك بكود (P01, P02...). هقرأ التمارين والمجموعات والاقتراحات. مش هستخدم الملاحظات ولا وزن الجسم ولا الطول ولا تاريخ الميلاد.
> **كمان:** إجاباتك القصيرة في المتابعة الأسبوعية، وكلامك في المقابلة الأخيرة.
> **ليه:** عشان أقيس كام مرة استخدمت الوزن المقترح، وكام مرة غيّرته وليه، وهل كنت لسه بتسجّل في الأسابيع 1 و2 و6.
> **مين هيشوف:** [أسماء اللي بيديروا التجربة، والمدرب لو هيشوف]. مفيش حاجة بتتباع ولا بتتشارك مع معلنين. النتايج بتتنشر أرقام مجمّعة وجمل قصيرة من غير أسماء.
> **هحتفظ بيه قد إيه:** [لحد ما تقرير التجربة يخلص، وبحد أقصى N يوم]، وبعدها بمسح ملفك. تقدر تطلب مني أمسح كل حاجة عنك في أي وقت، قبل التجربة أو بعدها، برسالة على [وسيلة التواصل].
> **اختياراتك:** الاشتراك اختياري؛ تقدر توقف في أي وقت من غير ما تقول السبب؛ وتقدر ترفض تبعت الملف وتكمّل بالإجابة على المتابعة بس.
> **النسخ الاحتياطي والمزامنة:** مقفول إلا لو فتحته. لو فتحته، نسخة من بيانات تمرينك بتتحفظ على سيرفر GAIN (على Cloudflare) لحد ما تمسحها من التطبيق.
> **الصحة:** GAIN سجل تمارين، مش دكتور ولا مدرب. أرقامه اقتراحات مبنية على اللي سجلته. إنت اللي بتقرر ترفع كام. لو في حاجة بتوجعك وقّف واسأل متخصص.
> **دي نسخة تجريبية.** ممكن يكون فيها أخطاء؛ احتفظ بنسختك الخاصة من أي حاجة مينفعش تضيع (تقدر تصدّر نسخة احتياطية في أي وقت).
>
> الاسم: ____________ الكود: ____ التاريخ: ______ موافق: [ ]

## 4. Handling the files
- One file per lifter per export, named `P01.json` (code only). Keep them in one folder on the runner's computer, not in a shared drive, chat group or the repo (the repo never contains pilot data).
- The backup holds EVERYTHING in the app (notes, bodyweight, birthday, custom exercise names), more than the metric needs. The metrics script reads `session`, `workout_set`, `target`, `exercise_line` and `exercise`. It does not read `bodyweight_entry`, notes, height or birthday. Nothing raw is copied out of the file: stdout/stderr contain counts only. Delete the file when the numbers are in the sheet unless the lifter agreed to keep it longer.
- A lifter's request to delete = delete their file, their sheet rows (or replace the code), and, if they used Back up and sync, remind them to use Settings > Delete my backup (the server has no admin screen and rows are anonymous, so the operator cannot tell whose rows are whose; only the lifter can delete theirs, or the operator can wipe the whole database with wrangler).
- Do not forward backups by chat apps that keep copies; ask for the share sheet to a private email or a USB cable.

## 5. Pilot sheet and numbers
Template: [pilot/pilot-sheet-template.csv](pilot/pilot-sheet-template.csv) (same columns as the table in PILOT-RETENTION-METRICS.md). Fill the first fifteen columns automatically from the backups (use absolute file paths: the npm script runs inside `apps/mobile`):
```
npm ci
npm run pilot-metrics -w @gain/mobile -- --tz-minutes 180 $HOME/pilot/P01.json $HOME/pilot/P02.json > $HOME/pilot/sheet.csv
```
It prints the CSV on stdout (one row per lifter per week reached) and, on stderr, "week N: retained X of Y who reached it", the totals of targets compared with what was loaded, and a like-for-like line against "repeat the last weight". `comparable` is the denominator for app-vs-logged counts. `both_comparable` is the smaller denominator used for the fair head-to-head: only those comparable targets that also have a counted working set in the newest earlier finished session on the same exercise, gym, equipment and setup; imported history may supply that earlier session. `both_app_same` and `both_repeat_same` count matches inside that exact same denominator.

The exact exclusions are in PILOT-RETENTION-METRICS.md and `apps/mobile/src/logic/pilotMetrics.ts`: no finite, non-negative numeric target or no counted working set; unfinished/imported/deleted target session; warm-up, drop, unconfirmed-outlier, rejected-outlier, deleted, or negative-load set; missing/mismatched exercise id, missing/invalid equipment, gym id or setup; equipment `assisted` with a non-assisted setup; and a session gym id that is present but not the line's gym. Soft-deleted exercise/line rows are retained as historical metadata. Bodyweight is not part of the comparison and is not inferred. For assisted work, the hardest set is the one with the least assistance; "more" means a smaller pin. For added-load work, "more" means a larger plate. "Same" is within 0.01 kg of the stored load. An edited target is compared with the app's original target number; status counts remain separate.

Dry run on a synthetic file: [pilot/sample/README.md](pilot/sample/README.md). `--tz-minutes` is the lifter's offset from UTC (a backup does not record it; Cairo is 180 in summer time and 120 in winter). The last four columns (days planned, app version, on-pace status, bugs/quotes) come from the check-ins by hand. The comparison is unit-tested on synthetic backups and one exported by the app's own code; **not yet run on a real pilot file**. Re-run any sheet made by an earlier tool version from the original backups: versions before v0.21.0 mixed lines and read assistance backwards; v0.21.0 and the following effective-load revision either required a bodyweight or folded one into the weight. This version compares the stored load only. The synthetic file has no assisted or added-load work, so its counts stay the same.

## 6. Bug reports
- Testers: the template in [BETA-FEEDBACK.md](BETA-FEEDBACK.md) (paste into the WhatsApp group description) or, for people with a GitHub account, the issue template `.github/ISSUE_TEMPLATE/bug_report.md`. Never ask for a backup file in a bug report.
- The runner copies each report into the sheet's "bugs / quotes" cell and triages with the rules in BETA-FEEDBACK.md. Data loss and wrong targets first.

## 7. What this kit does not do
It does not recruit, host, store consent signatures safely, measure anything automatically, or replace a lawyer, a trainer or a device test. It does not collect analytics and adds none.
