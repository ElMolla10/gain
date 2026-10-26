# iOS listing and review drafts

Prepared from current source, 2026-10-15. Not submitted. Confirm each advertised flow on the release build. Operator/contact, final URLs, age rating, screenshots and Apple account details remain open. AI wording intentionally makes no real-workout superiority claim.

## English listing

Name: GAIN: Workout Log & AI

Subtitle: Your next weight. Ready.

Keywords: workout,gym,strength,weights,reps,sets,progression,lifting,training,offline

Description:

GAIN helps you log your lifting and plan what comes next.

Build your program, set your exercise targets, and record working sets without a connection. See transparent next-session weight suggestions based on your history, then adjust them to your training.

During a workout, experimental on-device AI can suggest a next-set adjustment. Open the explanation, use your judgment, and choose what to lift. The model is still being evaluated on real workouts; its predictions are estimates, not a measure of your capacity.

• Log sets, reps and weights offline.
• Edit programs, reorder workouts and set exercise details.
• Track history and use kilograms or pounds.
• Train with English or Arabic.
• Export your data and restore a GAIN backup.
• Choose optional cloud backup and sync, or keep your training local.

Free at launch, with no ads or in-app purchases.

GAIN is a training aid, not medical advice. Stop if you experience pain or dizziness and seek qualified advice when needed. You decide what to lift.

## Arabic listing — independent wording review pending

Name: GAIN: سجل تمارينك

Subtitle: سجّل تمرينك واعرف خطوتك الجاية

Keywords: تمارين,جيم,حديد,أوزان,تكرارات,مجموعات,قوة,تقدم,تدريب

Description:

GAIN بيساعدك تسجّل تمرين الحديد وتعرف خطوتك الجاية.

اعمل برنامجك، ظبّط أهداف كل تمرين، وسجّل مجموعاتك حتى من غير إنترنت. شوف اقتراحات وزن الحصة الجاية وأسبابها من تاريخ تمرينك، وعدّلها حسب احتياجك.

أثناء التمرين، الذكاء الاصطناعي التجريبي بيشتغل على تليفونك وممكن يقترح تعديل للمجموعة الجاية. افتح السبب واختار الوزن المناسب ليك. النموذج لسه بيتقيّم على تمارين حقيقية؛ التوقعات تقديرات، مش قياس لقدرتك القصوى.

• سجّل المجموعات والتكرارات والأوزان من غير إنترنت.
• عدّل برنامجك ورتّب أيام التمرين واضبط تفاصيل كل تمرين.
• راجع تاريخك واختار الكيلوجرام أو الرطل.
• استخدم التطبيق بالعربي أو الإنجليزي.
• صدّر بياناتك واسترجع نسخة GAIN الاحتياطية.
• اختار النسخ الاحتياطي والمزامنة السحابية، أو خلّي تمرينك محلي.

التطبيق مجاني عند الإطلاق، من غير إعلانات ولا مشتريات جوّه التطبيق.

GAIN أداة مساعدة للتمرين، مش نصيحة طبية. لو عندك ألم أو دوخة وقّف، واسأل متخصص مؤهل عند الحاجة. إنت اللي بتقرر ترفع إيه.

## App Review notes — validate paths on the submitted build

GAIN is a free offline strength-training log. There are no purchases or ads. No login is required to create a program or record workouts.

Start with onboarding, choose a program and open today's workout. Record a set to view the next-set suggestion. Next-session progression uses transparent rules. Within-workout adaptation uses an experimental model bundled on the device, with manual choice and conservative product safeguards. It is not a clinical or injury-risk model, and no superiority over simple rules is claimed.

Optional backup/sync is in Settings > Back up and sync. It uses a random account and recovery code. In-app server account deletion: Settings > Back up and sync > Turn off and delete my backup, then confirm. Settings > Your data > Delete all my data also attempts remote account deletion before removing local data. Export a backup before testing deletion. Coach-card links are optional uploads and can be revoked; verify deletion with a coach-link-only account too.

Notifications are local rest/training reminders, enabled by the user; no push account is needed. No Apple Watch integration is offered. Apple Health is an opt-in, write-only export that exists only in builds made with `GAIN_IOS_HEALTHKIT=1` (default builds contain no HealthKit code or entitlement): when the lifter turns on Settings > Save workouts to Apple Health, each finished workout is saved as Traditional Strength Training (start, end, duration; no calories). GAIN reads nothing from Health. If a build with the flag is submitted, declare HealthKit in review notes and App Privacy. Technical prediction/evaluation tools are in Developer Mode (hold the About version or tap it seven times within five seconds); the normal app does not require it.

Before submitting, supply a reachable review contact and confirm the deployed optional backend is available. Do not claim optional online features work from source tests alone. Provide any access information Apple actually needs; no demo login is required for local training.

## TestFlight — What to Test

Please test a complete workout in a standalone Release build, including logging, editing a saved set, reordering and replacing an exercise, force-closing and resuming offline, and finishing the workout. Check history and confirm an upgrade retained existing data. Try backup export/restore using a copy, rest alerts with the phone locked, the number-pad Done bar, VoiceOver, large text and Arabic layout.

AI next-set suggestions are experimental. Note confusing or unsuitable suggestions and what you chose instead; do not lift beyond your judgment to satisfy a test. Report the build number, device, iOS version, language and reproduction steps. Avoid posting private training exports in public feedback.

## Screenshot capture plan

Use real iPhone/simulator captures of the submitted version with synthetic demo training data, no private account codes, emails or personal workouts. Do not fabricate a native screenshot from a mockup. Capture English and Arabic where that localization is offered.

| Scene | What to show |
| --- | --- |
| Today | Suggested workout and the Start action |
| Active workout | Current set and next action, with Experimental AI labeling visible if a suggestion is shown |
| Edit program | Reorder workouts and exercise settings |
| History | A representative workout and readable set detail |
| Data controls | Optional sync clearly separated from local logging |

Check the accepted display classes and dimensions in [Apple's current screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications) and the actual App Store Connect slots at upload time. iPhone-only configuration does not justify inventing iPad/Watch screenshots. No screenshots were captured here.
