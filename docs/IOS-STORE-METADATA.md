# iOS listing and review drafts

Entered in App Store Connect 2026-10-27 (version 1.0.0, build 7); NOT submitted for review (Mohamed gives the final OK). AI wording intentionally makes no real-workout superiority claim.

## Limits check

| Field | Limit | EN | AR |
| --- | --- | --- | --- |
| Name | 30 | `GAIN: Workout Tracker` (21) | `GAIN: Workout Tracker` (21) |
| Subtitle | 30 | 27 | 24 |
| Keywords | 100 bytes | 96 | 96 (Arabic letters are 2 bytes each) |
| Promotional text | 170 | under | under |

"GAIN" alone was taken in App Store Connect, so the owner chose **GAIN: Workout Tracker** (2026-10-27). The name under the icon on the home screen stays **GAIN** (`expo.name` in `apps/mobile/app.json`).

## Seller and support

Seller (Individual): Mohamed Ehab. Support email: imody101@gmail.com. Deployed 2026-10-27 (all return 200; EN and AR on each page): **Support URL** https://gain-site.elmolla10.workers.dev/support, **Privacy policy URL** https://gain-site.elmolla10.workers.dev/privacy, **Terms** https://gain-site.elmolla10.workers.dev/terms, delete-your-data page https://gain-site.elmolla10.workers.dev/delete-account. The pages are final text (not lawyer-reviewed), indexable, with the operator and contact filled at deploy time. Copyright: © 2026 Mohamed Ehab.

The store name is **GAIN: Workout Tracker** (owner's decision; "GAIN" alone was taken, and the old draft "GAIN: Workout Log & AI" is retired). The home-screen name stays **GAIN**. The listing makes no "AI" claim; in-app experimental suggestions are described plainly.

## English listing (final draft)

Name: GAIN: Workout Tracker

Subtitle: Lift log & next-set weights

Keywords: strength,gym,lifting,weights,progression,reps,sets,log,program,offline,arabic,kg,lbs,barbell

Promotional text: Log every set offline and see the weight for your next session, with the reason behind it. Free, no ads, in English and Arabic.

Description:

GAIN helps you log your lifting and know what to lift next.

Build your program, set your exercise targets and record working sets, with or without a connection. See clear next-session weight suggestions based on your own history, with the reason behind each one, then adjust them to your training.

During a workout, GAIN can suggest a next-set adjustment, worked out on your phone. Open the explanation, use your judgment and choose what to lift. Suggestions are estimates, not a measure of your capacity.

• Log sets, reps and weights offline.
• Edit programs, reorder workouts and set exercise details.
• Rest timer with alerts on the lock screen.
• Track history, personal bests and achievements; use kilograms or pounds.
• Train in English or Arabic.
• CSV import from other apps, full export and backup restore.
• Optional cloud backup and sync, or keep your training only on your phone.

Completely free, with no ads, no subscriptions and no in-app purchases.

GAIN is a training aid, not medical advice. Stop if you feel pain or dizziness and seek qualified advice when needed. You decide what to lift.

Brand note: the listing deliberately names no other apps. The in-app import screen is generic too ("Import from any app you previously used"); it accepts CSV files only (Mohamed's decision, Oct 26 2026).

## Arabic listing: DRAFT, needs native review

Name: GAIN: Workout Tracker

Subtitle: تمرينك والوزن الجاي جاهز

Keywords: تمارين,جيم,حديد,أوزان,تكرارات,مجموعات,قوة,تقدم,تدريب

Promotional text: سجّل كل مجموعة من غير إنترنت، واعرف وزن الحصة الجاية وسببه. مجاني، من غير إعلانات، بالعربي والإنجليزي.

Description:

GAIN بيساعدك تسجّل تمرين الحديد وتعرف ترفع إيه المرة الجاية.

اعمل برنامجك، ظبّط أهداف كل تمرين، وسجّل مجموعاتك بإنترنت أو من غيره. شوف اقتراحات وزن الحصة الجاية من تاريخ تمرينك، مع سبب كل اقتراح، وعدّلها حسب تمرينك.

أثناء التمرين، GAIN ممكن يقترح تعديل للمجموعة الجاية، محسوب على تليفونك. افتح السبب واختار الوزن المناسب ليك. الاقتراحات تقديرات، مش قياس لقدرتك.

• سجّل المجموعات والتكرارات والأوزان من غير إنترنت.
• عدّل برنامجك ورتّب أيام التمرين واضبط تفاصيل كل تمرين.
• تايمر راحة بتنبيه على شاشة القفل.
• تابع تاريخك وأرقامك القياسية وإنجازاتك، بالكيلو أو الرطل.
• استخدم التطبيق بالعربي أو الإنجليزي.
• استيراد CSV من تطبيقات تانية، وتصدير كامل واسترجاع النسخة الاحتياطية.
• نسخ احتياطي ومزامنة سحابية اختيارية، أو خلّي تمرينك على تليفونك بس.

مجاني بالكامل، من غير إعلانات ولا اشتراكات ولا مشتريات جوّه التطبيق.

GAIN أداة مساعدة للتمرين، مش نصيحة طبية. لو حسّيت بألم أو دوخة وقّف، واسأل متخصص لما تحتاج. إنت اللي بتقرر ترفع إيه.

## App Review notes (as entered in App Store Connect, 2026-10-27, for build 1.0.0 (7))

Sign-in is not required. The notes below are what App Review sees; HealthKit is not in this build.

> GAIN is a free strength-training log. There are no purchases and no ads. No sign-in is required: the whole app (programs, logging, history, achievements) works without an account.
>
> How to try it: complete onboarding, choose a program and open today's workout. Record a set to see the next-set suggestion; finish the workout to see next-session targets and the reason behind each. Suggestions are plain training-load estimates, not medical advice.
>
> Optional backup/sync (Settings > Back up and sync) is off until the user turns it on. It creates a random account with a recovery code. An optional email sign-in with an 8-digit code also exists; the server's email service is not switched on yet, so that card shows "Email sign-in is not available on this server" and the recovery code works instead.
>
> Account deletion (Guideline 5.1.1(v)): Settings > Back up and sync > "Turn off and delete my backup" and confirm. This deletes the server account, its data, linked email and coach links. Settings > Your data > "Delete all my data" also deletes the online copy first, then wipes the phone. Coach-card links are optional private uploads that can be revoked.
>
> Notifications are local rest-timer alerts only; no push account is used. No Apple Watch or HealthKit integration is included in this build. No tracking, no analytics, no third-party SDKs that collect data.
>
> Privacy policy: https://gain-site.elmolla10.workers.dev/privacy . Support: https://gain-site.elmolla10.workers.dev/support . Contact: Mohamed Ehab, imody101@gmail.com.

## TestFlight — What to Test

Please test a complete workout in a standalone Release build, including logging, editing a saved set, reordering and replacing an exercise, force-closing and resuming offline, and finishing the workout. Check history and confirm an upgrade retained existing data. Try backup export/restore using a copy, rest alerts with the phone locked, the number-pad Done bar, VoiceOver, large text and Arabic layout.

Next-set suggestions are experimental. Note confusing or unsuitable suggestions and what you chose instead; do not lift beyond your judgment to satisfy a test. Report the build number, device, iOS version, language and reproduction steps. Avoid posting private training exports in public feedback.

## Screenshot plan

App Store Connect needs iPhone screenshots for the 6.9" class (1320×2868, portrait) and accepts the 6.5" class (1284×2778) as well. Capture both, in English and Arabic: 6 scenes × 2 sizes × 2 languages = 24 PNGs. Real simulator captures of the release build with synthetic demo data only; no private workouts, recovery codes or emails. Status bar is forced to 9:41, full battery, full signal.

| # | Scene | What to show |
| --- | --- | --- |
| 01-today | Today | Next workout, loaded barbell, Start |
| 02-logger | The Rack (logger) | Current set, Log set dock, "load the change" line |
| 03-finish | Finish | Next targets first, with Why |
| 04-progress | Progress | Trophy cabinet at the top, personal bests |
| 05-arabic | Any screen in Arabic | Full right-to-left layout |
| 06-private | Your data / sync | Local by default, optional backup |

Six scenes and their DRAFT captions are in `scripts/appstore-shots/captions.py` (01-today, 02-logger, 03-finish, 04-progress, 05-arabic, 06-private); the table above is the overview. Run on the Mac: `scripts/ios-screenshots.sh` (see the script header). It builds a Release simulator app, launches it per language and device, and saves each scene to `screenshots/<lang>/<size>/NN-scene.png` after you navigate and press Enter, then frames the 6.9" captures with the designer's generator `scripts/appstore-shots/shots.py` (via `frame_all.py`) into `screenshots/framed/` at both exact sizes. **Never upload the designer's PLACEHOLDER mockups**; `frame_all.py` refuses them. Defaults: 6.9" = "iPhone 17 Pro Max", 6.5" = "iPhone 14 Plus" (1284×2778); override with `GAIN_SHOT_DEVICE_69` / `GAIN_SHOT_DEVICE_65` if your Xcode has other simulators. The script checks every PNG's pixel size. The designer may frame them afterwards; the underlying screen must stay a real capture.

