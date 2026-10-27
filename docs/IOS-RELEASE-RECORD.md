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
| Operator / contact / final policy and support URLs | LIVE and final text 2026-10-27 (no DRAFT banner, no noindex) | Privacy https://gain-site.elmolla10.workers.dev/privacy, Support https://gain-site.elmolla10.workers.dev/support, Terms https://gain-site.elmolla10.workers.dev/terms (EN + AR on one page, 200 checked). Minimum age 13, Egyptian law, backups kept until the user deletes them, deletion requests confirmed by email from the support address. Email sign-in is worded conditionally: the sync server has no email provider configured yet. Not lawyer-reviewed |
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
| 1 | Apple Developer Program membership active | DONE 2026-10-27 (enrolled as **Individual**) | Seller name on the store: Mohamed Ehab |
| 2 | Accept the agreements in App Store Connect > Business (Free Apps agreement is enough; no banking/tax needed for a free app) | DONE (app record created) | |
| 3 | Register bundle ID `com.mohamedehabelmolla.gain` (Certificates, IDs & Profiles), enabling HealthKit only if the store build sets `GAIN_IOS_HEALTHKIT=1` | DONE 2026-10-27 (Xcode-managed ID already on the account; ASC record created with it) | Cannot change after the first upload |
| 4 | Create the ASC app record: name **GAIN: Workout Tracker** ("GAIN" was taken; the home-screen name stays GAIN), primary language English, bundle ID `com.mohamedehabelmolla.gain`, SKU `gain-ios` | DONE 2026-10-27 (ASC app ID 6827498090) | Add Arabic as a localization |
| 5 | Create an App Store Connect API key (Users and Access > Integrations, role App Manager); keep the `.p8` outside the repo; give Key ID / Issuer ID via EAS secrets or env (`EXPO_ASC_*`), never in git | DONE 2026-10-27 (key held in the builder's env; not in git) | Alternative: sign in when `eas build` asks |
| 6 | `eas login` + `eas init` in `apps/mobile` (commits the projectId), `eas build:version:set -p ios` | `eas init` DONE 2026-10-27 (project `@mo_ehab10/gain`, projectId and ASC app ID 6827498090 committed in app.json / eas.json) | docs/IOS-RELEASE.md §2 |
| 7 | Operator Mohamed Ehab, support imody101@gmail.com: the site pages keep their placeholders in git by design (`siteDraft.test.ts`); fill them at deploy with `node docs/site/fill-contact.mjs --email imody101@gmail.com --operator "Mohamed Ehab"` (writes docs/site/dist, 14 placeholders), then deploy dist and put the privacy-policy and support URLs into ASC | DONE 2026-10-27 (deployed to https://gain-site.elmolla10.workers.dev) | Enter the URLs in ASC. Postal address still open; pilot contact set to the support email |
| 8 | Native Arabic review of the store listing and new in-app strings | OPEN | docs/IOS-STORE-METADATA.md, docs/ARABIC-REVIEW-SHEET.md |
| 9 | Genericise the other-app names in the in-app import screen (Mohamed: genericise, CSV only) | DONE | `strings.import.ts`, `strings.data.ts` |
| 10 | Screenshots: run `scripts/ios-screenshots.sh` on the Mac (6.9" and 6.5", EN and AR), review, upload to ASC | OPEN | Synthetic data only |
| 11 | Enter App Privacy answers, age rating and export compliance from docs/IOS-APP-PRIVACY.md | OPEN | Check against the archive's privacy report |
| 12 | Approve the first `eas build -p ios --profile production` and `eas submit` (upload to TestFlight) | OPEN | Upload ≠ review submission |
| 13 | TestFlight: install, upgrade test, What to Test, approve any external beta review | OPEN | |
| 14 | Final OK and press **Submit for Review**; choose manual release | OPEN | Only Mohamed |

### Open placeholders (as of 2026-10-26)

Filled: operator "Mohamed Ehab" and support email imody101@gmail.com in PRIVACY-POLICY-DRAFT.md, TERMS-DRAFT.md, ACCOUNT-DELETION-SPEC.md, the in-app privacy contact string and IOS-STORE-METADATA.md.

Still open:
- Site pages (support, privacy, terms, delete-account) are filled only in the generated dist, via the command above; verified locally that it fills 14 placeholders.
- `[pilot contact not set yet]` in docs/site/public/pilot-guide.html (Android pilot only).
- Postal address in the privacy policy, if required; age limit and governing law in the terms.
- Enter the privacy, support and (optional) terms URLs above in App Store Connect; replace the remaining reviewer placeholders on the privacy and terms pages and remove the DRAFT banners/noindex on purpose before App Review.
- Team ID, API key ID / issuer ID (env/secrets only). The EAS `projectId` and ASC app ID are committed (not secrets).


## App Store Connect state (2026-10-27, app 6827498090, version 1.0.0, NOT submitted)

Done through the ASC API: en-GB (primary), en-US and ar-SA localizations (name, subtitle, description, keywords, promotional text, support, marketing and privacy URLs); copyright 2026 Mohamed Ehab; category Health & Fitness; age rating questionnaire all-None (computed 4+); price Free (USA base) with all territories except mainland China (needs an ICP filing); content rights = no third-party content; build 1.0.0 (7) attached (ITSAppUsesNonExemptEncryption = NO); screenshots 6.9" (1320x2868) and 6.5" (1284x2778) uploaded for en-GB, en-US (4 each: Today, Logger, Trophy Cabinet, Arabic Today) and ar-SA (3: Today, Logger, Cabinet), all real iPhone captures with the status bar cropped.

Still needed from Mohamed (web UI or info): App Privacy nutrition label (not available in the API), EU Digital Services Act trader status, App Review contact phone (the review-detail record cannot be created without it), then the final Submit for Review.
