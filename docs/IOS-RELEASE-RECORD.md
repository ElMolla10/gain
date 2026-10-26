# iOS release evidence record

Template — no native result is pre-filled. Complete for one candidate; keep evidence private when it contains fitness data. Source preparation and green CI are not a TestFlight or App Store release.

| Identity | Value |
| --- | --- |
| Source commit / clean or locally changed | TO RECORD |
| Marketing version / upload build number | TO RECORD |
| Bundle ID / team (no credentials) | TO RECORD |
| macOS / Xcode / Node / CocoaPods | TO RECORD |
| iPhone / iOS / previous installed build | TO RECORD |
| Date / tester / language / units / text size | TO RECORD |

| Gate | Result | Evidence / issue |
| --- | --- | --- |
| Local Release archive and archive report | NOT RUN HERE | |
| Xcode signing/provisioning and Validate App | NOT RUN HERE | |
| Archived SDK privacy report | NOT REVIEWED | |
| Upgrade retains existing data | NOT RECORDED | |
| Full focused iPhone checklist | NOT RECORDED | |
| English / Arabic / VoiceOver / large text | NOT RECORDED | |
| Offline interruption / backup / restore / long history | NOT RECORDED | |
| Phase-4 real-workout evaluation | PENDING REAL EXPORTS | |
| Production Worker auth deployment and smoke | NOT VERIFIED | |
| Account deletion incl. coach-link-only account | NOT VERIFIED ON PRODUCTION | |
| Operator / contact / final policy and support URLs | OPEN | |
| Store privacy / age rating / export compliance answers | NOT ENTERED | |
| Real screenshots and localized metadata review | PENDING | |
| App Store Connect processed build identity | NOT UPLOADED HERE | |
| TestFlight install/upgrade and beta feedback | NOT RUN HERE | |
| Apple review and public availability | NOT SUBMITTED HERE | |

Record each blocking failure and its fix/build. Do not replace an unrun result with PASS because a related unit test passed. Do not mark an old native run as evidence for a newly changed build without rerunning affected checks.

## Owner-only checklist (Mohamed)

Agents prepare source and drafts only; they never create, upload or submit anything in Apple's systems. Tick each step when done.

| # | Step | Status | Notes |
| --- | --- | --- | --- |
| 1 | Apple Developer Program membership active | PENDING (enrolled, awaiting Apple) | Individual vs company decides the seller name on the store |
| 2 | Accept the agreements in App Store Connect > Business (Free Apps agreement is enough; no banking/tax needed for a free app) | OPEN | |
| 3 | Register bundle ID `com.elmolla.gain` (Certificates, IDs & Profiles), enabling HealthKit only if the store build sets `GAIN_IOS_HEALTHKIT=1` | OPEN | Cannot change after the first upload |
| 4 | Create the ASC app record: name **GAIN** (fallback if taken: decide then), primary language English, bundle ID `com.elmolla.gain`, SKU e.g. `gain-ios` | OPEN | Add Arabic as a localization |
| 5 | Create an App Store Connect API key (Users and Access > Integrations, role App Manager); keep the `.p8` outside the repo; give Key ID / Issuer ID via EAS secrets or env (`EXPO_ASC_*`), never in git | OPEN | Alternative: sign in when `eas build` asks |
| 6 | `eas login` + `eas init` in `apps/mobile` (commits the projectId), `eas build:version:set -p ios` | OPEN | docs/IOS-RELEASE.md §2 |
| 7 | Operator name/address, support email, (optional) pilot contact → run `node docs/site/fill-contact.mjs --email … --operator "…" --contact "…"`, deploy the site, and put the privacy-policy and support URLs into ASC | OPEN | Placeholders listed below |
| 8 | Native Arabic review of the store listing and new in-app strings | OPEN | docs/IOS-STORE-METADATA.md, docs/ARABIC-REVIEW-SHEET.md |
| 9 | Keep or genericise the Hevy/Strong/FitNotes names in the in-app import screen | OPEN | `strings.import.ts`, `strings.data.ts` |
| 10 | Screenshots: run `scripts/ios-screenshots.sh` on the Mac (6.9" and 6.5", EN and AR), review, upload to ASC | OPEN | Synthetic data only |
| 11 | Enter App Privacy answers, age rating and export compliance from docs/IOS-APP-PRIVACY.md | OPEN | Check against the archive's privacy report |
| 12 | Approve the first `eas build -p ios --profile production` and `eas submit` (upload to TestFlight) | OPEN | Upload ≠ review submission |
| 13 | TestFlight: install, upgrade test, What to Test, approve any external beta review | OPEN | |
| 14 | Final OK and press **Submit for Review**; choose manual release | OPEN | Only Mohamed |

### Open placeholders (as of 2026-10-26)

- `[operator name and address not set yet]`, `[support email not set yet]`, `[pilot contact not set yet]` in `docs/site/public/*.html` (filled by `docs/site/fill-contact.mjs`), plus the same markers in the policy/terms drafts and in-app strings listed in the PR.
- `<<OPERATOR_NAME>>`, `<<SUPPORT_EMAIL>>` in the App Review contact (docs/IOS-STORE-METADATA.md).
- Privacy policy URL and support URL for App Store Connect (after the site is deployed).
- EAS `projectId` (from `eas init`), ASC app ID, Team ID, API key ID / issuer ID (env/secrets only).
- Store name fallback if "GAIN" is taken.
