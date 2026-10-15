# iOS privacy worksheet

Draft source mapping, reviewed 2026-10-15. Not entered into App Store Connect and not a legal review. Reconcile this with the final binary, SDK privacy report, production services and final public policy before submission.

Apple's definition of collection includes off-device retention; on-device-only processing is different. Optional ongoing sync still needs disclosure. Random account/device IDs do not make account-linked fitness records unlinked. Source: [Apple's app privacy details](https://developer.apple.com/app-store/app-privacy-details/).

## Current app flows and proposed answers

| Source flow | Data | Draft Apple type | Linked / purpose / tracking |
| --- | --- | --- | --- |
| `SYNC_TABLES`: workout_set, session, targets, goals; coach-card uploads | Exercise performance, reps, loads, effort, recommendations | Fitness | Yes / App Functionality / No |
| bodyweight_entry; synced bodyweight_kg, height_cm | Body measurements | Health (conservative mapping) | Yes / App Functionality / No |
| Synced notes, exercise/program names and other free-form fields | User-created training content | Other User Content | Yes / App Functionality / No |
| Worker account.id and recovery-account identity | Random account-level identifier | User ID | Yes / App Functionality / No |
| Worker device.id and device authentication association | App-created device-level identifier, not IDFA | Device ID | Yes / App Functionality / No |
| Synced birth_date/preferences; Worker rate-limit request metadata | Birthday/settings and request metadata not otherwise categorized | Other Data Types (conservative mapping) | Yes / App Functionality / No |
| Local next-set inference and ml_prediction table | Frozen model inputs/outputs and matched outcomes | Local-only, not automatically collected by the app's server | Outside sync; full backup and manual evaluation export include records |
| Local crash file | Error names/messages/stacks | Local-only until the user shares it | If operator receives support/diagnostic files, reassess disclosure and retention |
| OS share sheet: JSON/CSV/PDF/evaluation | User-selected export to chosen destination | Recipient and purpose depend on user's choice | No automatic GAIN upload; do not describe exported data as anonymous |
| OS device backup | App database/files in enabled Apple backup | Apple-controlled service | Explain in policy; inspect actual backup behavior on device |

The app-level `app.json` manifest declares the six off-device categories above, linked for app functionality with no tracking. Existing required-reason API categories/reasons are retained. These declarations describe optional server functionality; they do not turn sync on. Local SQLite storage and on-device inference do not by themselves require remote-collection claims.

## Verify before finalizing answers

- Inspect every Expo/React Native/native dependency in the **archived** SDK privacy report. The app uses third-party SDKs even though it has no analytics/advertising SDK. Ensure required-reason declarations reflect actual usage; merely having a reason string is not proof of compliance.
- Confirm production Cloudflare deployment, region, access controls, request logs, rate-limit metadata and retention/recovery settings. Request metadata may add disclosures depending on what is retained and how it is used. Do not state a retention period from an assumed hosting plan.
- Email endpoints exist on the Worker, but the current mobile UI has no email sign-in. If enabled, declare Email Address, update policy/manifest and account-review paths, and verify delivery and deletion with the real provider.
- Decide the real operator identity, reachable contact/support URL, policy URL, retention/deletion wording and applicable regional obligations. Placeholders remain in both in-app and static draft text; they block final publication.
- Decide whether support will receive exported diagnostics or evaluation files. Apply Apple's optional-disclosure conditions to the actual flow; do not automatically omit it just because sharing is voluntary.
- Verify no tracking, ads, IDFA collection, remote AI requests or unexpected SDK telemetry in the final app. The current source shows no analytics/ad integration and local inference; this is not a network trace of the archive.

## Deletion and review

Settings > Back up and sync > Turn off and delete my backup initiates server account deletion. Settings > Your data > Delete all my data also attempts server deletion before local wipe. Verify both against production, including a coach-link-only account, a network failure and the required confirmation. Turning sync off alone is not account deletion. Confirm expired/revoked links and deleted accounts no longer return content; record provider recovery retention separately.

[Apple requires in-app deletion even for automatically created guest accounts](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion). Include the tested paths in review notes. No third-party social login is present; reassess sign-in requirements if that changes.

The manifest, the App Store Connect privacy label, the public privacy policy and the in-app explanation are distinct artifacts. Keep all four consistent. This worksheet does not authorize selecting Data Not Collected for a build offering opt-in sync/coach uploads.
