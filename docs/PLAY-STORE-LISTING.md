# Google Play listing and closed-test plan (DRAFT)

**DRAFT for Mohamed's review. Nothing in this file has been submitted. This is not a store upload, a build, or a merge of app-code changes.** Written 16 Nov 2026 from `main` at `4b6d6bf`, against the live iOS listing (GAIN: Workout Tracker 1.0.2), [IOS-STORE-METADATA.md](IOS-STORE-METADATA.md), the October 2026 Play prep, and the current Play Console rules for a new personal account.

Spelling in store copy is **program**. Kilograms are the default unit; pounds are supported. Do not call GAIN "AI coaching". Do not invent features. Do not put build numbers in store copy. Live Activities are iOS-only and must not appear in the Play listing.

Related older drafts, kept as history and cross-checks: [PLAY-LISTING-DRAFT.md](PLAY-LISTING-DRAFT.md), [PLAY-ASSETS.md](PLAY-ASSETS.md), [PLAY-BUILD.md](PLAY-BUILD.md), [DATA-SAFETY-DRAFT.md](DATA-SAFETY-DRAFT.md), [ACCOUNT-DELETION-SPEC.md](ACCOUNT-DELETION-SPEC.md), [PRIVACY-POLICY-DRAFT.md](PRIVACY-POLICY-DRAFT.md), [site/README.md](site/README.md). Prefer this file when the older one disagrees.

---

## 1. Android config (as of 16 Nov 2026)

| Item | Value | Notes |
| --- | --- | --- |
| Package name | `app.gain.mobile` | From `apps/mobile/app.json`. Permanent once the app is created in Play Console. |
| Home-screen name | `GAIN` | `expo.name`. The store title is separate (section 4). |
| versionName | `1.0.3` | Bumped on 16 Nov 2026 for iOS TestFlight (#361). Live iOS App Store is still **1.0.2**. |
| versionCode | `22` | Same as the GitHub sideload APK `gain-v1.0.2-arm64.apk`. Android will not install an update over that APK unless the versionCode is **23 or higher** and the **app-signing certificate matches**. |
| EAS project | `@mo_ehab10/gain` (`fc6b6b6c-020b-49fb-8ee4-e0ec954b290e`) | Authenticated as `mo_ehab10`. |
| EAS Android builds | **None.** `eas build:list --platform android --limit 5` returned zero builds. | |
| EAS Android keystore | **None.** No Android app credentials exist on the Expo project for `app.gain.mobile` (current or legacy). The keystore is **not** EAS-managed. | |
| `eas.json` Android / AAB profile | **No Play-specific profile.** `production` has `distribution: store` (EAS would emit an AAB) but it **extends `base`**, which sets `GAIN_DISTRIBUTION=sideload`. A production Android build from EAS today would keep `REQUEST_INSTALL_PACKAGES` and the in-app updater, which Play rejects. `submit.production` is iOS-only (`ascAppId`). `appVersionSource` is `remote` (only matters for EAS-managed version codes). | |
| Expo SDK | 57. Default `compileSdkVersion` / `targetSdkVersion` **36**, `minSdkVersion` 24. | The October Play-variant measurement also reported target 36. That meets Play's rule from 31 Aug 2026: new apps must target API 36. |
| Expo cloud builds | Free-plan iOS cloud credits are used up until 1 Dec 2026. Do not use EAS cloud for the Play AAB. | |

### Signing (no secret values)

Sideload APKs through **v0.21.0** were signed with the release keystore that lives on the build box at `~/keystores/gain-release.jks` (certificate SHA-256 `571bc5a8ce699054ae7bffe0fc912fd1faf9de7dfd3d3eb962b1b8578315c5b2`). [RELEASE-PROCESS.md](RELEASE-PROCESS.md) and [PLAY-BUILD.md](PLAY-BUILD.md) still describe this key as current. That is stale.

The published **v1.0.2** GitHub APK (`versionCode 22`, 11 Nov 2026) was signed on Windows with a **new** dedicated release keystore. Its certificate SHA-256 is `9bb983dd9766e52b8f2f363da38a07057da1fc5309a0f1719ad2a7c96eea2a4b`. That keystore is **not** on this build box. Existing v0.21.0 users already cannot update in place; the v1.0.2 release notes tell them to export, uninstall, and restore.

Mohamed must decide Play App Signing before the first AAB upload (the choice is hard to undo):

- **Option A — let Google generate the app signing key.** The Play install uses a different signer than the 1.0.2 sideload APK. Lifters on 1.0.2 cannot update from Play in place; they export a backup, uninstall, and reinstall. This is the simpler path if the 1.0.2 Windows keystore is not available, or if sideload and Play should stay separate.
- **Option B — enrol the 1.0.2 key (`9bb983dd…`) as the Play app signing key.** Play can then install over the 1.0.2 sideload APK, if the Play AAB has versionCode ≥ 23. Mohamed has to provide that keystore (it is not on the build box). Do **not** enrol the old `571bc5a8…` key; current 1.0.2 users are not on it.

In both cases keep a separate **upload key**. The old box keystore can stay the sideload key for any last v0.21-line rebuilds, but it must not be used as the Play app signing key.

### How to get a signed Play AAB without Expo cloud quota

The unmerged workflow `.github/workflows/android-apk.yml` (only on `feat/workout-reordering`) uploads a **debug-signed PR APK**. It is not a Play path. GitHub Releases are manual sideload APKs, not AABs. There is no Android equivalent of [IOS-GITHUB-BUILD.md](IOS-GITHUB-BUILD.md) yet.

**Recommended path (no Expo cloud credits, no EAS credentials required):**

1. A later, small code change (not in this PR): add an EAS/`gradle` **play** profile that sets `GAIN_DISTRIBUTION=play`, and bump `android.versionCode` to **23** (and decide whether `versionName` stays `1.0.3` to match current `main`, or is held at `1.0.2` to match live iOS). Recommendation: ship **1.0.3 / 23** from current `main`.
2. On Ubuntu (this box, or a future GitHub Actions `ubuntu-latest` job, like the iOS `eas build --local` workflow):

```
cd apps/mobile
GAIN_DISTRIBUTION=play CI=1 npx expo prebuild --platform android --clean --no-install
git checkout package.json
cd android
./gradlew bundleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon
```

3. Sign the AAB with the chosen **upload** keystore (`jarsigner` / Play's App Signing upload-key process). Then upload that AAB to the Play closed-testing track. Re-measure the bundle before upload: `bundletool dump manifest` / permissions must **not** include `REQUEST_INSTALL_PACKAGES`, and `extra.distribution` must be `play`.

**Later alternative, still no cloud quota:** after Mohamed provides or creates an upload key, store it as EAS Android credentials (or as GitHub `app-store` environment secrets) and run `eas build --platform android --profile play --local` on Ubuntu. `eas build --local` does not spend Expo cloud credits. Do not create those credentials or trigger a workflow in this phase.

The October 2026 Play variant already built an AAB this way (`bundleRelease` in 2 m 51 s on the build box, targetSdk 36, no install-packages permission). That measurement was of v0.19.0 sources. Rebuild from current `main` and measure again before upload.

---

## 2. What already exists from October 2026, and what is stale

| Item | Where | State on 16 Nov 2026 |
| --- | --- | --- |
| Listing copy | [PLAY-LISTING-DRAFT.md](PLAY-LISTING-DRAFT.md) | Stale. Title `GAIN: Next Weight, Lifting Log` does not match live iOS `GAIN: Workout Tracker`. Body does not include 1.0.2 features (program preview, continue from imports, rebuild from history, optional lighter plan, compact Trophy Cabinet, simpler Today and Progress). The line "There is no account" is misleading once optional sync is on. Prefer section 4 below. |
| Shot list / metadata | [PLAY-ASSETS.md](PLAY-ASSETS.md) | Mostly still useful as a capture plan, but it still says "no screenshot exists" and points at the October title. |
| Feature graphic | `docs/play-assets/feature-graphic-en-draft.png`, `…-ar-draft.png` (1024×500, RGB) | Present and on-spec: "Your next weight. Ready." / Arabic draft, charcoal `#10120E`, lime `#B7F51B`, "Free lifting log". Arabic line still needs a native read. The listing draft's "feature graphic not made" line is stale. |
| Store icon | `docs/play-assets/icon-512.png` (512×512, RGB, no alpha, 38 KB) | Ready to upload; re-check Play's current icon rules at upload. Source is `apps/mobile/assets/icon.png` (1024×1024). |
| Screenshots | `docs/screenshots/01-today-en.png` … `04-trophy-cabinet.png` (600×1200) | **Do not upload to Play.** They were added for the GitHub README (26 Oct 2026), show the older Today / Cabinet UI (including a Cabinet tab and an "Engine Strategy" card), and look like iPhone captures, not a current Android Play build. Play still needs 2–8 **real Android** screenshots per language from the Play variant, at current UI. Shot list in [PLAY-ASSETS.md](PLAY-ASSETS.md) section 1 is the right plan; recapture on a phone or emulator. |
| Privacy policy (hosted) | https://gain-site.elmolla10.workers.dev/privacy | **Live, HTTP 200**, no DRAFT banner, no `noindex`. Operator Mohamed Ehab, support `imody101@gmail.com`, last updated 27 Oct 2026. Not lawyer-reviewed. Stale lines: it still says "the Android build (v0.22.0)", and the home page still says the Android app is sideloaded and not on Google Play. Update and redeploy before a public listing is visible, but the URL is usable for Console setup and closed testing. |
| Terms | https://gain-site.elmolla10.workers.dev/terms | Live, HTTP 200, 27 Oct 2026, not lawyer-reviewed. |
| Account deletion page | https://gain-site.elmolla10.workers.dev/delete-account | Live, HTTP 200. Required, because optional Back up and sync creates a server account (even when it is anonymous / recovery-code based). In-app paths still exist: Settings > Back up and sync > "Turn off and delete my backup", and Settings > Your data > "Delete all my data". |
| Support | https://gain-site.elmolla10.workers.dev/support | Live, HTTP 200. Email `imody101@gmail.com`. |
| Data safety answers | [DATA-SAFETY-DRAFT.md](DATA-SAFETY-DRAFT.md) | Written 3 Oct 2026 from v0.17.0. Still the right structure, but stale on: the deletion URL (now live), email sign-in (code exists, **off** in store builds; see section 5), and the Play-build updater (removed when `GAIN_DISTRIBUTION=play`). Use section 5 below. |
| Content rating | [PLAY-ASSETS.md](PLAY-ASSETS.md) section 3 | Outline only; questionnaire not filled (no Console account yet). Draft answers in section 6. |
| Play build switch | `GAIN_DISTRIBUTION=play` in `apps/mobile/build-flags.js` | Still the correct way to drop `REQUEST_INSTALL_PACKAGES` and the "Check for updates" card. Measured on 4 Oct 2026 for v0.19.0 sources. Must be set for every Play AAB. |
| Closed-test plan | [PLAY-BUILD.md](PLAY-BUILD.md) said "unknown, check at the time" | Now known. Section 8. |

---

## 3. Policy blockers

| Topic | Verdict |
| --- | --- |
| targetSdkVersion | **OK if we rebuild on current Expo 57.** Play requires API **36** for new apps and updates as of 31 Aug 2026 ([Play target API policy](https://developer.android.com/google/play/requirements/target-sdk)). Expo 57 defaults to 36; the October Play variant measured 36. Confirm on the new AAB before upload. |
| `REQUEST_INSTALL_PACKAGES` | **Blocker unless `GAIN_DISTRIBUTION=play` is set.** `app.json` still declares the permission for the sideload APK. The play switch removes it and adds it to `blockedPermissions`. Do not upload a sideload-profile AAB. Re-measure the Play AAB. |
| Other permissions | October Play manifest (v0.19.0) had INTERNET, VIBRATE, RECEIVE_BOOT_COMPLETED, POST_NOTIFICATIONS, ACCESS_NETWORK_STATE, WAKE_LOCK, `c2dm.RECEIVE`, the app's `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`, Finsky install-referrer (library-declared; GAIN does not read a referrer), and launcher-badge permissions from `expo-notifications`. GAIN schedules **local** notifications only and registers no push token. `SYSTEM_ALERT_WINDOW`, storage, and biometric permissions stay in `blockedPermissions`. Re-measure after the rebuild. |
| Account deletion | **Required, and already covered.** Optional sync creates a server account (random id + hashed recovery code; email sign-in exists in code but is off). Play needs an in-app deletion path and a public web URL. Both exist. Put https://gain-site.elmolla10.workers.dev/delete-account on the Data safety form. |
| Email sign-in | Off by default (`GAIN_EMAIL_SIGNIN` unset / `0`; no EAS profile turns it on). The sync server still cannot send mail. The Play build should leave it off. Do not declare email as collected unless that flag is turned on. |
| Ads / IAP / paid tiers | None in the code (`free.test.ts`). Console: Free, Ads = No, in-app purchases = No. |
| Health claims | The listing must keep "training aid, not medical advice" and make no result promises. Play may show a Health apps declaration for the Health & Fitness category; answer that GAIN is a workout log, not a medical device and not medical advice. |
| `allowBackup` | Still true (decision D11 open). The privacy policy already discloses Android/Google backup. No change required for a first upload; revisit later if Mohamed wants it off. |
| Privacy policy legal review | Still outstanding (D6). The hosted text is indexable and is already used for the iOS listing. Closed testing can start with it; a lawyer review remains recommended before a wide production launch. |

---

## 4. Listing text (en-US and ar)

Play limits: title ≤ 30 characters, short description ≤ 80, full description ≤ 4000. There is no keyword field and no subtitle, so the title and short description carry the search words that iOS puts in those extra fields.

**Title recommendation:** use the November 2026 iOS ASO name, because Play has no subtitle or keyword field. Alternative, if Mohamed wants the stores to match exactly: the live iOS name.

### English (en-US)

**App name (max 30), recommended:** `GAIN: Gym Workout Tracker` (25)

Alternative (exact live iOS name): `GAIN: Workout Tracker` (21)

**Short description (max 80):** `Log sets offline. See your next weight, and why, in English and Arabic.` (71)

**Full description (1,452 characters; limit 4,000):**

> GAIN helps you log your lifting and know what to lift next.
>
> Build your program, preview it before you start, set your exercise targets and record working sets, with or without a connection. See clear next-session weight suggestions based on your own history, with the reason behind each one, then adjust them to your training. You can continue from an imported history, rebuild a program from what you have already logged, or choose an optional lighter plan.
>
> During a workout, GAIN can suggest a next-set adjustment, worked out on your phone. Open the explanation, use your judgment and choose what to lift. Suggestions are estimates, not a measure of your capacity.
>
> • Log sets, reps and weights offline.
> • Preview a program before you start, edit days and set exercise details.
> • Continue from a CSV import or rebuild a program from your history.
> • Optional lighter plan when you want less volume.
> • Rest timer with alerts.
> • Track history, personal bests and a compact Trophy Cabinet; kilograms by default, pounds supported.
> • Simpler Today and Progress screens.
> • Train in English or Arabic.
> • CSV import from other apps, full export and backup restore.
> • Optional cloud backup and sync, or keep your training only on your phone.
>
> Completely free, with no ads, no subscriptions and no in-app purchases.
>
> GAIN is a training aid, not medical advice. Stop if you feel pain or dizziness and seek qualified advice when needed. You decide what to lift.

### Arabic (ar) — builder's draft, needs a native Egyptian read before it goes public

**اسم التطبيق (حد أقصى 30)، المقترح:** `GAIN: سجل تمارين الجيم` (22)

البديل (نفس الاسم الحي على iOS): `GAIN: Workout Tracker` (21)

**وصف قصير (حد أقصى 80):** `سجّل تمرينك من غير نت، واعرف الوزن الجاي وسببه. مجاني ومن غير إعلانات.` (70)

**الوصف الكامل (1,183 حرفاً؛ الحد 4,000):**

> GAIN بيساعدك تسجّل تمرين الحديد وتعرف ترفع إيه المرة الجاية.
>
> اعمل برنامجك، وعاينه قبل ما تبدأ، ظبّط أهداف كل تمرين، وسجّل مجموعاتك بإنترنت أو من غيره. شوف اقتراحات وزن الحصة الجاية من تاريخ تمرينك، مع سبب كل اقتراح، وعدّلها حسب تمرينك. تقدر تكمل من تاريخ مستورد، أو تعيد بناء برنامج من اللي سجلته، أو تختار خطة أخف اختيارية.
>
> أثناء التمرين، GAIN ممكن يقترح تعديل للمجموعة الجاية، محسوب على تليفونك. افتح السبب واختار الوزن المناسب ليك. الاقتراحات تقديرات، مش قياس لقدرتك.
>
> • سجّل المجموعات والتكرارات والأوزان من غير إنترنت.
> • عاين البرنامج قبل ما تبدأ، وعدّل الأيام وتفاصيل كل تمرين.
> • كمّل من استيراد CSV أو ابنِ برنامج من تاريخك.
> • خطة أخف اختيارية لما تحب تقلل الحجم.
> • تايمر راحة بتنبيه.
> • تابع تاريخك وأرقامك القياسية وخزانة الجوائز المختصرة؛ الكيلو هو الافتراضي، والرطل مدعوم.
> • شاشات Today وProgress أبسط.
> • استخدم التطبيق بالعربي أو الإنجليزي.
> • استيراد CSV من تطبيقات تانية، وتصدير كامل واسترجاع النسخة الاحتياطية.
> • نسخ احتياطي ومزامنة سحابية اختيارية، أو خلّي تمرينك على تليفونك بس.
>
> مجاني بالكامل، من غير إعلانات ولا اشتراكات ولا مشتريات جوّه التطبيق.
>
> GAIN أداة مساعدة للتمرين، مش نصيحة طبية. لو حسّيت بألم أو دوخة وقّف، واسأل متخصص لما تحتاج. إنت اللي بتقرر ترفع إيه.

Do not mention Live Activities, TestFlight, build numbers, or other apps by name.

### Store settings

| Field | Proposal |
| --- | --- |
| Category | Health & Fitness |
| Tags | Pick from Play's current list (fitness / workout / weightlifting as available) |
| Default language | English (United States). Add an Arabic listing (Egypt). |
| Price | Free. No in-app products. Ads = No. |
| Contact email | imody101@gmail.com |
| Contact website | https://gain-site.elmolla10.workers.dev/support |
| Privacy policy URL | https://gain-site.elmolla10.workers.dev/privacy |
| Terms URL (if asked) | https://gain-site.elmolla10.workers.dev/terms |
| Account deletion URL | https://gain-site.elmolla10.workers.dev/delete-account |
| Target audience | 18+ / adults; not designed for children; not in the Families programme |
| App access | All core features work without a login. Optional backup/sync is off until the user turns it on. |
| Developer name | Mohamed Ehab (personal account) |
| Countries | Mohamed decides. A sensible start is Egypt plus the countries already used on iOS. |
| News app / COVID / data-safety etc. | Answer No where they do not apply. |

---

## 5. Data safety form (draft, from the current code)

Re-check every line against the live Console form at submission. "Collected" means data leaves the phone to Mohamed or a processor (Cloudflare). Data that stays on the phone, or that the user sends themselves through the share sheet, is not collected. Optional features are still declared, marked optional. Written from the code on `main` (16 Nov 2026), [DATA-SAFETY-DRAFT.md](DATA-SAFETY-DRAFT.md), [IOS-APP-PRIVACY.md](IOS-APP-PRIVACY.md), and the hosted privacy policy.

### Top-level

| Question | Draft answer |
| --- | --- |
| Does the app collect or share any of the required user data types? | **Yes**, only through two optional features: Back up and sync (off by default) and Share as a link (coach card). |
| Is all collected user data encrypted in transit? | **Yes** (HTTPS to `gain-sync.elmolla10.workers.dev`). |
| Can users request that their data is deleted? | **Yes.** In app: Settings > Back up and sync > "Turn off and delete my backup"; Settings > Your data > "Delete all my data"; revoke a coach link. Web: https://gain-site.elmolla10.workers.dev/delete-account (email imody101@gmail.com). |
| Committed to the Play Families policy? | Not applicable. Adults only. |
| Independent security review? | No. |

### Data types (all optional; none required to use the app)

| Play type | Collected? | Shared? | Purpose | Why |
| --- | --- | --- | --- | --- |
| Health and fitness > Fitness info | Yes, if sync or a coach link is used | No (see caveat) | App functionality | Workouts, sets, loads, reps, goals, next targets. Core payload of sync and of the coach card. |
| Health and fitness > Health info | Yes, if the user entered bodyweight and then turned sync on (not included in the coach card) | No | App functionality | Safer to declare the stricter bucket; Play may instead accept bodyweight as Fitness info. |
| Personal info > Other info | Yes, if entered and sync is on (`birth_date`, `height_cm`). Birthday is stored but unused. | No | App functionality | Same as the iOS privacy label. |
| Personal info > User IDs | Yes, with sync or a coach link: a random account id and token hashes. No name or phone. | No | App functionality; account management | |
| Personal info > Email address | **No, in the Play build as planned.** Email sign-in is compiled off (`GAIN_EMAIL_SIGNIN` default 0). Declare Email only if that flag is turned on later, and update the policy first. | — | — | The iOS privacy manifest still lists Email Address because the flag can return; Play Data safety should match the shipped Android build. |
| App activity > Other user-generated content | Yes, if sync is on (notes, custom exercise names, program names) | No | App functionality | |
| App info and performance > Crash logs / Diagnostics | No | — | — | The log stays on the phone unless the user shares it. |
| Device or other IDs | No advertising id, Android id, or IMEI is read. Cloudflare sees an IP for sync/coach requests; whether Play wants that under Device IDs is a judgment call — check the live help text. | — | — | |
| Location, Contacts, Photos, Audio, Messages, Calendar, Financial, Browsing, Files and docs | No | — | — | Imports use the system picker and stay on the phone until the user turns sync on, at which point the imported rows are ordinary workouts. |

**Shared = No** for everything: Cloudflare is the developer's processor, not an independent use of the data. The coach link is a user-initiated publication the user confirms on screen. If Play reviewers treat that link as "sharing publicly", declare Fitness info as shared for that feature and keep the in-app consent.

The Play build does **not** include the GitHub update check, so do not declare a GitHub data flow.

Encryption at rest is provider-level only (Cloudflare D1), **not** end-to-end; the policy already says so. Retention: until the user deletes it; coach links expire in 7 days (max 30); unused devices are removed after 400 days; D1 Time Travel may keep point-in-time history for up to 7 days after deletion (already in the policy).

---

## 6. Content rating (IARC) draft answers

Fill the questionnaire in Play Console honestly at the time; wording changes. Draft intent:

| Topic | Draft answer |
| --- | --- |
| Violence | No |
| Sexual content, nudity, dating | No |
| Profanity, crude humour, discrimination, horror | No |
| Alcohol, tobacco, drugs | No |
| Gambling or simulated gambling | No |
| Location sharing | No |
| Digital purchases, ads, paid content | No |
| User-to-user chat or social networking | No. There is no inbox, comments, or chat. "Share as a link" publishes a one-way workout card the user creates, behind a random URL, which they can revoke. It expires. Answer the UGC / "users can share content" question in that light; do not call it a social network. |
| Unrestricted web access | No in-app browser for arbitrary sites |
| Target age | Adults, 18+. Not designed for children. |
| Health / medical | Fitness / workout log only. No medical diagnosis, treatment, or health-condition management. No heart-rate or clinical sensors. |
| Health apps declaration (if shown for this category) | GAIN is a training log and suggestion tool, not a medical device and not medical advice. |

Expected outcome is a low (Everyone / PEGI 3-style) rating, but accept whatever IARC assigns.

---

## 7. Assets still needed

| Asset | Spec (re-check in Console at upload) | State |
| --- | --- | --- |
| High-res icon | 512×512 32-bit PNG | Ready: `docs/play-assets/icon-512.png` (RGB, no alpha). |
| Feature graphic | 1024×500 PNG/JPG | EN and AR drafts ready in `docs/play-assets/`. Keep important content away from the edges (Play crops on some surfaces). Native-read the Arabic line. A designer pass is optional. |
| Phone screenshots | 2 to 8 per listing language; PNG or JPEG; each side 320–3840 px; longer side at most 2× the shorter; real screens of the shipped Play build; no fake UI, no result promises, no "best" / "#1" | **Not ready.** Recapture on Android from the Play variant, English and Arabic, dark first (the app's identity). Follow the shot list in [PLAY-ASSETS.md](PLAY-ASSETS.md): Today, logger, Finish with next targets, Why, Goals/pace, Plan, Progress / Trophy Cabinet, Your data. Use synthetic demo data only (`fixtures/hevy-synthetic.csv`). Do not shoot the sideload update card, a recovery code, diagnostics, or real personal data. Do not upload the README images in `docs/screenshots/`. |
| 7-inch / 10-inch tablet screenshots | Optional | The app is phone-first; skip unless Mohamed wants tablet listing coverage. |
| Promo video | Optional | None planned. |

---

## 8. Closed-test plan

Applies because this is a **personal** Play Console account created after 13 November 2023. Official rule: [App testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465). Production and pre-registration stay locked until this is done.

**The requirement:** a **closed** test (not internal, not open) with **at least 12 testers opted in continuously for the preceding 14 days** at the moment Mohamed applies for production access. A tester who opts out before day 14 does not count; if they opt back in, their 14 days start again. Internal testing is useful for a first smoke build but does **not** satisfy the rule. Open testing is only available after production access.

Review of the production-access application usually takes **up to 7 days**. Google can ask for more testing if fewer than 12 testers are still opted in, or if engagement looks too thin.

### Track setup

1. Finish Play Console account verification (identity, non-trader declaration, Play Console app on the spare Android phone, phone number once identity is approved).
2. Create the app with package name **`app.gain.mobile`**. Double-check this before the first save; it cannot change later.
3. Complete app setup so closed testing can start: store listing (section 4), privacy policy URL, categories, target audience, content rating (section 6), Data safety (section 5), Ads = No, news/COVID declarations as applicable, contact email, account deletion URL.
4. Choose Play App Signing (section 1, Mohamed's decision).
5. Optional but useful: upload the same Play AAB to the **internal** testing track first, install it on Mohamed's spare phone, and smoke-test onboarding, a workout, Finish, export, and (if wanted) sync + delete.
6. Create a **closed** testing release on the default closed track, upload the signed Play AAB (`GAIN_DISTRIBUTION=play`, versionCode 23+), and add testers.
7. Testers: a **Google Group** is easier to maintain than a pasted email list. Collect 14–16 Google accounts (not 12 exactly — people drop out). Each tester must open the opt-in link, accept, and install from Play. Tell them clearly: stay opted in for 14 days even if they only open the app a few times; uninstalling is not the same as opting out, but they should keep the app installed and actually use it, because Google looks at engagement.
8. Send a short test script (email or WhatsApp): complete onboarding, pick or preview a program, log a workout, finish and look at next-session targets and Why, try Arabic if they can, export a backup, and optionally turn on Back up and sync then delete the backup. Remind them GAIN is a log, not medical advice, and they should not lift beyond their judgment for the test.
9. Collect feedback at imody101@gmail.com and in Play's testing-feedback page. Keep a brief log; the production-access form asks for a summary.
10. From day 1 to day 14, check the closed-test tester count. If it falls below 12 opted-in, recruit replacements and wait for *their* 14 continuous days.
11. When 12 testers have been opted in continuously for 14 days, apply for production access from the Dashboard (draft answers below; fill the engagement and feedback parts from what actually happened).
12. After approval, create a production release (the same or a newer AAB) and submit it for review. Production access alone does not publish the app.

### 14-day checklist

| Day | What to do |
| --- | --- |
| Before day 0 | Account verified. Listing, privacy, Data safety, content rating, and signing choice done. Play AAB measured and uploaded. 14+ testers invited. |
| Day 0 | Closed release rolled out. Confirm each tester has opted in and installed. Start a simple tally (name, Google account, opt-in date). |
| Days 1–3 | Nudge anyone who was invited but has not opted in. Confirm at least 12 are opted in before treating the clock as started. |
| Mid-test | Ask testers to run the script if they have not. Collect bugs. Ship a closed-track update only if needed (a new AAB does not reset opt-in, but tell testers to update). |
| Every few days | Re-check the opted-in count. Replace drop-outs; remember replacements have their own 14-day clock. |
| Day 14 (with 12 still opted in) | Export or screenshot the tester list. Summarise feedback. Apply for production access. |
| After the application | Wait for the email (usually ≤ 7 days). Do not turn off the closed test. If Google asks for more testing, keep testers opted in and continue. |

### Production-access application — draft answers

The live form has three sections. Engagement and "what changed" must be rewritten after the test with real numbers. The rest can be prepared now.

**Part 1 — About your closed test**

- How easy was it to recruit testers? Fill after the fact (friends, family, gym / training contacts, Instagram). Honest option; do not invent a large campaign.
- Did testers use all available features? Draft to complete later, along the lines of: testers were asked to onboard, preview and start a program, log and finish a workout, look at next-session targets and the reason, browse Progress and the Trophy Cabinet, and try export. Optional backup/sync was described as optional and off by default. Note any features nobody touched.
- Did usage match expected production behaviour? Draft: yes, with the difference that testers were following a short script and used synthetic or their own training data for a limited period, rather than training in the app for months. Note any real differences (language, kg vs lb, import).
- Feedback summary and how it was collected: fill later from email and Play testing feedback. Method: email imody101@gmail.com and Play's private testing-feedback form.

**Part 2 — About your app**

- Target audience: Adults who already lift and want a phone log that suggests the next session's weight from their own history, with the reason. English and Arabic speakers, especially in Egypt and other Arabic-speaking markets, plus anyone comfortable in English. Not for children. Not a beginner-only coaching product and not a medical app.
- Value proposition: GAIN is a free, ad-free lifting log. Workouts can be logged offline. After a session it writes the next targets from the lifter's own history and shows why, so they can accept, edit, or reject them. A program can be previewed before it starts, continued from an import, or rebuilt from history. An optional lighter plan is available. Data stays on the phone unless the lifter turns on optional backup. English and Arabic. Kilograms by default, pounds supported.
- Estimated first-year installs: Mohamed chooses. A conservative "less than 10,000" (or the lowest range the form offers) is honest for a first personal listing.

**Part 3 — About your production readiness**

- Changes made from the closed test: write after the test. If nothing material changed, say so and list any small bug fixes. Do not claim changes that did not happen.
- How you determined it is ready: the closed test met the 12 testers / 14-day rule; testers completed a full workout path without a blocker; Data safety, privacy policy, content rating, and the Play AAB permissions were re-checked; the app is free, has no ads or purchases, and core features work without an account. Add any pre-launch report result once that has been run.

---

## 9. Ordered checklist

### Mohamed does

1. Finish Play Console verification: identity (already in review), non-trader declaration, Play Console app on the spare Android phone, phone number after identity is approved.
2. Start lining up **14–16** Android testers with Google accounts now (the Instagram story is a reasonable place to ask). Tell them they must stay opted in for 14 days.
3. Decide Play App Signing (section 1, Option A or B). If Option B, provide the **1.0.2 Windows keystore** (certificate `9bb983dd…`) through a private channel, not in git or chat. If that key is lost, use Option A and tell 1.0.2 sideload users they will need to export, uninstall, and reinstall.
4. Decide the Play title (`GAIN: Gym Workout Tracker` vs `GAIN: Workout Tracker`) and whether the first Play versionName is 1.0.3 (recommended, matches current `main`) or 1.0.2 (matches live iOS).
5. Capture or approve real Android screenshots from the Play build, in English and Arabic, once a signed Play build is on a phone. Native-read the Arabic listing and the Arabic feature graphic.
6. After the 14-day closed test, apply for production access (using the filled-in form) and, when that is approved, give an explicit OK before any production store submission.

### What I will do next (after this draft is accepted; still no store submission)

1. Small code/docs follow-up: add a `play` EAS/Gradle profile with `GAIN_DISTRIBUTION=play`, and bump `versionCode` to 23 (plus the agreed versionName).
2. Build and sign a Play AAB locally on Ubuntu, re-measure permissions and `extra.distribution`, and hand Mohamed the file to upload (or, later, a GitHub Actions `eas build --local` workflow modelled on the iOS TestFlight job — not triggered without his OK).
3. Help paste listing text, Data safety, content rating, and the deletion/privacy URLs into Play Console once he is signed in (he clicks submit).
4. Help run the internal then closed tracks, the tester instructions, and the 14-day tally.
5. Update and redeploy the public site so it no longer says the Android app is only sideloaded, and so the privacy page does not still say "Android build (v0.22.0)".
6. Recapture or frame Android screenshots with him if he wants help on a device or emulator.

Nothing in this document authorises a Play upload, a credentials change, a workflow run, or a merge of app code.
