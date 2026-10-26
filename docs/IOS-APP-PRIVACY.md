# iOS privacy worksheet

Draft source mapping, reviewed 2026-10-15. Not entered into App Store Connect and not a legal review. Reconcile this with the final binary, SDK privacy report, production services and final public policy before submission.

Apple's definition of collection includes off-device retention; on-device-only processing is different. Optional ongoing sync still needs disclosure. Random account/device IDs do not make account-linked fitness records unlinked. Source: [Apple's app privacy details](https://developer.apple.com/app-store/app-privacy-details/).

## Current app flows and proposed answers

| Source flow | Data | Draft Apple type | Linked / purpose / tracking |
| --- | --- | --- | --- |
| `SYNC_TABLES`: workout_set, session, targets, goals; coach-card uploads | Exercise performance, reps, loads, effort, recommendations | Fitness | Yes / App Functionality / No |
| bodyweight_entry; synced bodyweight_kg, height_cm | Body measurements | Health (conservative mapping) | Yes / App Functionality / No |
| Synced notes, exercise/program names and other free-form fields | User-created training content | Other User Content | Yes / App Functionality / No |
| Optional email sign-in (Settings > Back up and sync > email + 8-digit code, `SyncScreen` → `sync.startEmail`/`verifyEmail`) | Email address, used only to link phones to the backup | Contact Info > Email Address | Yes / App Functionality / No |
| Worker account.id and recovery-account identity | Random account-level identifier | User ID | Yes / App Functionality / No |
| Worker device.id and device authentication association | App-created device-level identifier, not IDFA | Device ID | Yes / App Functionality / No |
| Synced birth_date/preferences; Worker rate-limit request metadata | Birthday/settings and request metadata not otherwise categorized | Other Data Types (conservative mapping) | Yes / App Functionality / No |
| Local next-set inference and ml_prediction table | Frozen model inputs/outputs and matched outcomes | Local-only, not automatically collected by the app's server | Outside sync; full backup and manual evaluation export include records |
| Local crash file | Error names/messages/stacks | Local-only until the user shares it | If operator receives support/diagnostic files, reassess disclosure and retention |
| OS share sheet: JSON/CSV/PDF/evaluation | User-selected export to chosen destination | Recipient and purpose depend on user's choice | No automatic GAIN upload; do not describe exported data as anonymous |
| Apple Health export (only builds with `GAIN_IOS_HEALTHKIT=1`, opt-in switch, off by default) | Finished workout start/end/duration written to the on-device Health store; nothing read | On-device to Apple Health, not collected by GAIN | Not collected / not tracking; HealthKit data is never sent to GAIN's server. The Health workout UUID is stored on the session row (and syncs like other session columns) |
| OS device backup | App database/files in enabled Apple backup | Apple-controlled service | Explain in policy; inspect actual backup behavior on device |

The app-level `app.json` manifest declares the seven off-device categories above (Email Address added 2026-10-26), linked for app functionality with no tracking. Existing required-reason API categories/reasons are retained. These declarations describe optional server functionality; they do not turn sync on. Local SQLite storage and on-device inference do not by themselves require remote-collection claims.

## Verify before finalizing answers

- Inspect every Expo/React Native/native dependency in the **archived** SDK privacy report. The app uses third-party SDKs even though it has no analytics/advertising SDK. Ensure required-reason declarations reflect actual usage; merely having a reason string is not proof of compliance.
- Confirm production Cloudflare deployment, region, access controls, request logs, rate-limit metadata and retention/recovery settings. Request metadata may add disclosures depending on what is retained and how it is used. Do not state a retention period from an assumed hosting plan.
- **Corrected 2026-10-26:** the mobile UI *does* offer optional email sign-in (SyncScreen email card). Email Address is now declared in the manifest and below. Verify delivery and deletion with the real email provider, and that deleting the backup also deletes the stored email.
- Decide the real operator identity, reachable contact/support URL, policy URL, retention/deletion wording and applicable regional obligations. Placeholders remain in both in-app and static draft text; they block final publication.
- Decide whether support will receive exported diagnostics or evaluation files. Apply Apple's optional-disclosure conditions to the actual flow; do not automatically omit it just because sharing is voluntary.
- Verify no tracking, ads, IDFA collection, remote AI requests or unexpected SDK telemetry in the final app. The current source shows no analytics/ad integration and local inference; this is not a network trace of the archive.

## Deletion and review

Settings > Back up and sync > Turn off and delete my backup initiates server account deletion. Settings > Your data > Delete all my data also attempts server deletion before local wipe. Verify both against production, including a coach-link-only account, a network failure and the required confirmation. Turning sync off alone is not account deletion. Confirm expired/revoked links and deleted accounts no longer return content; record provider recovery retention separately.

[Apple requires in-app deletion even for automatically created guest accounts](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion). Include the tested paths in review notes. No third-party social login is present; reassess sign-in requirements if that changes.

The manifest, the App Store Connect privacy label, the public privacy policy and the in-app explanation are distinct artifacts. Keep all four consistent. This worksheet does not authorize selecting Data Not Collected for a build offering opt-in sync/coach uploads.

## Code reconciliation (2026-10-26, main 589dc64)

Network: the app makes exactly two kinds of request. (1) The optional sync Worker `https://gain-sync.elmolla10.workers.dev` (`src/sync/transport.ts`): account/device creation, recovery code, optional email code, sync push/pull of `SYNC_TABLES`, coach links, deletion. Nothing is sent while sync is off. (2) The GitHub releases check (`src/logic/updateCheck.ts`), which is Android sideload only: on iOS the Update card is hidden/disabled, so **no request on iOS**. Fonts are bundled; there are no analytics, ads, crash-reporting or attribution SDKs, no IDFA, and no ATT prompt (`NSPrivacyTracking` false).

Diagnostics and feedback: crash/diagnostic entries stay in a local file; "Send feedback" builds text that the user sends through the system share sheet themselves. Achievement telemetry (`achievementTelemetry.ts`) is on-device only. Not collected unless the user chooses to send it to support.

HealthKit: write-only workout export, opt-in, only in builds with `GAIN_IOS_HEALTHKIT=1`, where `plugins/apple-health-config.js` adds `NSHealthUpdateUsageDescription` and `NSHealthShareUsageDescription` ("GAIN saves your finished workouts to Apple Health."). Without the flag no HealthKit entitlement or string is present. HealthKit data is never sent to GAIN's server or used for advertising (Guideline 5.1.3). If the store build enables it, add a localized Arabic string (InfoPlist.strings) and enable the HealthKit capability on the App ID.

Required-reason APIs (manifest in `app.json` → `PrivacyInfo.xcprivacy`): FileTimestamp C617.1, UserDefaults CA92.1, SystemBootTime 35F9.1, DiskSpace E174.1. Recheck against the Xcode privacy report of the archive; SDK manifests (Expo, RN) cover their own use.

### Proposed App Store Connect privacy answers

"Do you or your third-party partners collect data from this app?" **Yes** (because of optional sync). Data types, all *Linked to the user*, *App Functionality* only, *not used for tracking*:

- Health & Fitness > Fitness (workouts, sets, loads)
- Health & Fitness > Health (bodyweight, height; conservative)
- Contact Info > Email Address (optional email sign-in)
- User Content > Other User Content (notes, program/exercise names)
- Identifiers > User ID (random account ID)
- Identifiers > Device ID (app-generated device ID, not IDFA)
- Other Data > Other Data Types (birth date, preferences)

Not collected: location, contacts, browsing, search, purchases, financial info, usage data, diagnostics, advertising data.

### Export compliance

`ios.config.usesNonExemptEncryption: false` → `ITSAppUsesNonExemptEncryption = NO` in Info.plist. The app uses only Apple/OS HTTPS (TLS) and hashing (SHA-256 via expo-crypto); no proprietary or non-exempt encryption. Answer in App Store Connect: "None of the algorithms mentioned above" / exempt. No annual self-classification report should be needed; confirm in the console.

### Age rating (proposed: 4+)

All content descriptors "None": no violence, sexual content, profanity, horror, drugs/alcohol/tobacco, gambling or contests, mature themes, medical/treatment information (the app gives training load suggestions, not medical advice), no unrestricted web access, no user-to-user messaging or public user-generated content (coach links are private read-only shares), no advertising, no in-app purchases. Answer the current questionnaire against the final build; this is a draft.

### In-app account deletion paths (for App Review, Guideline 5.1.1(v))

1. Settings > Back up and sync > **Turn off and delete my backup** → confirm "Yes, delete my backup". Erases the server account, backup, email link and coach links; local data stays.
2. Settings > Your data > **Delete all my data** → deletes the server account and backup, then wipes the phone. If the server is unreachable it says so and offers "Delete only on this phone"; the online copy can still be deleted later with the recovery code.

No account is needed to use the app; sync is optional and created by the user.
