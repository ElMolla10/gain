# iOS listing and review drafts

Finalized draft 2026-10-26 (first prepared 2026-10-15). Not submitted. Confirm each advertised flow on the release build. Operator/contact, final URLs, age rating, screenshots and Apple account details remain open. AI wording intentionally makes no real-workout superiority claim.

## Limits check

| Field | Limit | EN | AR |
| --- | --- | --- | --- |
| Name | 30 | `GAIN` (4) | `GAIN` (4) |
| Subtitle | 30 | 27 | 24 |
| Keywords | 100 bytes | 96 | 96 (Arabic letters are 2 bytes each) |
| Promotional text | 170 | under | under |

If App Store Connect says "GAIN" is taken, pick the fallback with Mohamed; do not change it here silently.

## English listing (final draft)

Name: GAIN

Subtitle: Lift log & next-set weights

Keywords: strength,workout,gym,lifting,weights,progression,reps,sets,tracker,program,offline,arabic,kg,lbs

Promotional text: Log every set offline and see the weight for your next session, with the reason behind it. Free, no ads, in English and Arabic.

Description:

GAIN helps you log your lifting and know what to lift next.

Build your program, set your exercise targets and record working sets, with or without a connection. See clear next-session weight suggestions based on your own history, with the reason behind each one, then adjust them to your training.

During a workout, experimental on-device AI can suggest a next-set adjustment. Open the explanation, use your judgment and choose what to lift. The model is still being evaluated on real workouts; its predictions are estimates, not a measure of your capacity.

• Log sets, reps and weights offline.
• Edit programs, reorder workouts and set exercise details.
• Rest timer with alerts on the lock screen.
• Track history, personal bests and achievements; use kilograms or pounds.
• Train in English or Arabic.
• CSV import from other apps, full export and backup restore.
• Optional cloud backup and sync, or keep your training only on your phone.

Completely free, with no ads, no subscriptions and no in-app purchases.

GAIN is a training aid, not medical advice. Stop if you feel pain or dizziness and seek qualified advice when needed. You decide what to lift.

Brand note: the listing deliberately names no other apps. The in-app import screen names Hevy, Strong and FitNotes as CSV sources (`strings.import.ts`, `strings.data.ts`); that factual compatibility mention is flagged for Mohamed to keep or genericise before submission.

## Arabic listing: DRAFT, needs native review

Name: GAIN

Subtitle: تمرينك والوزن الجاي جاهز

Keywords: تمارين,جيم,حديد,أوزان,تكرارات,مجموعات,قوة,تقدم,تدريب

Promotional text: سجّل كل مجموعة من غير إنترنت، واعرف وزن الحصة الجاية وسببه. مجاني، من غير إعلانات، بالعربي والإنجليزي.

Description:

GAIN بيساعدك تسجّل تمرين الحديد وتعرف ترفع إيه المرة الجاية.

اعمل برنامجك، ظبّط أهداف كل تمرين، وسجّل مجموعاتك بإنترنت أو من غيره. شوف اقتراحات وزن الحصة الجاية من تاريخ تمرينك، مع سبب كل اقتراح، وعدّلها حسب تمرينك.

أثناء التمرين، الذكاء الاصطناعي التجريبي بيشتغل على تليفونك وممكن يقترح تعديل للمجموعة الجاية. افتح السبب واختار الوزن المناسب ليك. النموذج لسه بيتقيّم على تمارين حقيقية؛ التوقعات تقديرات، مش قياس لقدرتك.

• سجّل المجموعات والتكرارات والأوزان من غير إنترنت.
• عدّل برنامجك ورتّب أيام التمرين واضبط تفاصيل كل تمرين.
• تايمر راحة بتنبيه على شاشة القفل.
• تابع تاريخك وأرقامك القياسية وإنجازاتك، بالكيلو أو الرطل.
• استخدم التطبيق بالعربي أو الإنجليزي.
• استيراد CSV من تطبيقات تانية، وتصدير كامل واسترجاع النسخة الاحتياطية.
• نسخ احتياطي ومزامنة سحابية اختيارية، أو خلّي تمرينك على تليفونك بس.

مجاني بالكامل، من غير إعلانات ولا اشتراكات ولا مشتريات جوّه التطبيق.

GAIN أداة مساعدة للتمرين، مش نصيحة طبية. لو حسّيت بألم أو دوخة وقّف، واسأل متخصص لما تحتاج. إنت اللي بتقرر ترفع إيه.

## App Review notes — validate paths on the submitted build

GAIN is a free offline strength-training log. There are no purchases or ads. No login is required to create a program or record workouts.

Start with onboarding, choose a program and open today's workout. Record a set to view the next-set suggestion. Next-session progression uses transparent rules. Within-workout adaptation uses an experimental model bundled on the device, with manual choice and conservative product safeguards. It is not a clinical or injury-risk model, and no superiority over simple rules is claimed.

Optional backup/sync is in Settings > Back up and sync. It uses a random account and recovery code, or optionally an email with an 8-digit code. In-app server account deletion: Settings > Back up and sync > Turn off and delete my backup, then confirm. Settings > Your data > Delete all my data also attempts remote account deletion before removing local data. Export a backup before testing deletion. Coach-card links are optional uploads and can be revoked; verify deletion with a coach-link-only account too.

Notifications are local rest/training reminders, enabled by the user; no push account is needed. No Apple Watch integration is offered. Apple Health is an opt-in, write-only export that exists only in builds made with `GAIN_IOS_HEALTHKIT=1` (default builds contain no HealthKit code or entitlement): when the lifter turns on Settings > Save workouts to Apple Health, each finished workout is saved as Traditional Strength Training (start, end, duration; no calories). GAIN reads nothing from Health. If a build with the flag is submitted, declare HealthKit in review notes and App Privacy. Technical prediction/evaluation tools are in Developer Mode (hold the About version or tap it seven times within five seconds); the normal app does not require it.

Contact for review: `<<OPERATOR_NAME>>`, `<<SUPPORT_EMAIL>>` (placeholders, not yet known). Before submitting, supply a reachable review contact and confirm the deployed optional backend is available. Do not claim optional online features work from source tests alone. Provide any access information Apple actually needs; no demo login is required for local training.

## TestFlight — What to Test

Please test a complete workout in a standalone Release build, including logging, editing a saved set, reordering and replacing an exercise, force-closing and resuming offline, and finishing the workout. Check history and confirm an upgrade retained existing data. Try backup export/restore using a copy, rest alerts with the phone locked, the number-pad Done bar, VoiceOver, large text and Arabic layout.

AI next-set suggestions are experimental. Note confusing or unsuitable suggestions and what you chose instead; do not lift beyond your judgment to satisfy a test. Report the build number, device, iOS version, language and reproduction steps. Avoid posting private training exports in public feedback.

## Screenshot plan

App Store Connect needs iPhone screenshots for the 6.9" class (1320×2868, portrait) and accepts the 6.5" class (1284×2778) as well. Capture both, in English and Arabic: 5 scenes × 2 sizes × 2 languages = 20 PNGs. Real simulator captures of the release build with synthetic demo data only; no private workouts, recovery codes or emails. Status bar is forced to 9:41, full battery, full signal.

| # | Scene | What to show |
| --- | --- | --- |
| 1 | Today | Next workout and Start, with the week bar |
| 2 | The Rack (logger) | Current set, Log set dock, "load the change" line |
| 3 | Finish | Next workout first, a personal best, Why |
| 4 | Progress | Trophy cabinet at the top, a lift trend |
| 5 | Plan / Settings | Program editor, or optional sync separated from local logging |

Run on the Mac: `scripts/ios-screenshots.sh` (see the script header). It builds a Release simulator app, launches it per language and device, and saves each scene to `screenshots/<lang>/<size>/NN-scene.png` after you navigate and press Enter. Defaults: 6.9" = "iPhone 17 Pro Max", 6.5" = "iPhone 14 Plus" (1284×2778); override with `GAIN_SHOT_DEVICE_69` / `GAIN_SHOT_DEVICE_65` if your Xcode has other simulators. The script checks every PNG's pixel size. The designer may frame them afterwards; the underlying screen must stay a real capture.

