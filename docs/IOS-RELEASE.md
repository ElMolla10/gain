# iOS release preparation — phase 5

Status: source preparation only. Mo is already testing on an iPhone; this workspace has no Mac, signing identity or device-test evidence for the new build. No archive, upload, TestFlight distribution or App Store submission has been performed here.

## 1. Freeze and validate one build

Use current merged main and record the commit. Export a backup before upgrading; retain the installed app's bundle ID to test database retention. Do not uninstall the existing app to make an upgrade test pass.

Run `scripts/ios-setup.sh --run` on the Mac to install a standalone Release build. Stop Metro, disconnect the Mac and complete [IOS-AUDIT-CHECKLIST.md](IOS-AUDIT-CHECKLIST.md). Record results in [IOS-RELEASE-RECORD.md](IOS-RELEASE-RECORD.md). Prior iPhone testing is useful but does not certify a different build.

Required evidence includes upgrade retention, interrupted/offline logging, long histories, native import/export/restore, background rest alerts, keyboard, VoiceOver, large text and Arabic layouts. Keep screenshots of failures and fix blockers before inviting testers. Do not advertise accessibility support based only on labels in source.

## 2. Build for the App Store with EAS (primary)

The App Store bundle ID is `com.elmolla.gain` (the default in `apps/mobile/app.json`; it cannot change after the first upload). `GAIN_IOS_BUNDLE_ID` still overrides it for personal free-Apple-ID builds via `scripts/ios-setup.sh`/`.env.ios`. **A different bundle ID is a different app on the phone, with empty data**: before moving a phone from a personal ID to `com.elmolla.gain`, export a full backup (Settings > Your data) and restore it in the new app. Android keeps `app.gain.mobile`.

Profiles in `apps/mobile/eas.json`:

| Profile | Use | Distribution |
| --- | --- | --- |
| `development` | Simulator Debug build | internal |
| `preview` | Device build for registered test phones (ad hoc) | internal |
| `production` | App Store / TestFlight build; build number auto-increments (tracked remotely by EAS, `appVersionSource: remote`) | store |

One-time (owner, after the Apple Developer membership is active), from `apps/mobile`:

```bash
npm i -g eas-cli
eas login
eas init                      # links the Expo project; commit the projectId it writes
eas build:version:set -p ios  # seed the remote build number (e.g. 1)
```

Build and upload:

```bash
cd apps/mobile
eas build -p ios --profile production   # EAS manages certificates/profiles when you sign in to Apple or provide the ASC key
eas submit -p ios --profile production --latest   # uploads to App Store Connect / TestFlight only; does NOT submit for review
```

`eas submit` reads the App Store Connect API key from the environment or EAS secrets, never from the repo:

```bash
export EXPO_ASC_API_KEY_PATH=/secure/path/AuthKey_XXXXXXXXXX.p8   # never inside the repo (*.p8 is git-ignored)
export EXPO_ASC_KEY_ID=XXXXXXXXXX
export EXPO_ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export EXPO_APPLE_TEAM_ID=XXXXXXXXXX
```

The ASC app ID (`ascAppId`) is chosen interactively on the first submit, or passed with `--asc-app-id`. Health export ships only if the build sets `GAIN_IOS_HEALTHKIT=1` (add it to the profile's `env` deliberately, after the HealthKit capability is enabled for the App ID).

## 3. Fallback: local Xcode archive

Select the intended Apple Developer Program team in Xcode and confirm its provisioning for the bundle ID. Local Personal Team installation is separate from TestFlight distribution. The helper preserves `.env.ios`/existing Xcode identity; an archive requires a team and an explicit build number. Never change the installed identity just to get signing to pass.

From the repository root on the Mac, choose an unused number greater than the last uploaded build for the version (42 is an example). This helper accepts integers 1–9999:


```bash
scripts/ios-setup.sh --archive "$HOME/GAIN-42.xcarchive" --build-number 42
```

If the intended team is not already saved, pass `--team-id` with your actual Team ID; use `--bundle-id` only to choose the intended registered identity. The helper generates the project/pods and runs `xcodebuild archive` with Release and `generic/platform=iOS`. It does not export or upload. Existing archive paths are refused, and the build number is not saved for silent reuse. `GAIN_IOS_BUILD_NUMBER` is the equivalent config override when generating/building outside the helper.

Inspect the resulting archive using the **actual intended** bundle ID:

```bash
node scripts/ios-archive-report.cjs "$HOME/GAIN-42.xcarchive" com.yourname.gain 42
```

The read-only JSON report checks app identity/version/build, device platform, iPhone family, encryption/HTTP settings, app-level privacy declarations and presence of the embedded JS bundle. It returns a nonzero exit code on failure. Save the report with your private release evidence. It does not verify signatures, provisioning, framework privacy practices, runtime behavior or acceptance by Apple. These helpers were tested with stand-in tools on Linux; the real Mac commands remain to be exercised.

Open the archive in Xcode Organizer. Inspect signing, generate the complete privacy report including all embedded SDKs, resolve validation warnings, and use Validate App. Confirm that bundle ID, version and build number match the record. The app-level manifest is not a substitute for each SDK's manifest or the App Store Connect privacy answers.

## 4. Resolve the remaining submission inputs

- Complete [IOS-APP-PRIVACY.md](IOS-APP-PRIVACY.md), the operator/contact details and final public privacy/support URLs. Existing HTML and policy text remain drafts; merging source is not evidence that the URLs are deployed or accessible.
- Verify the production Worker has the auth fixes and passes its smoke script. The source changes alone do not establish this. Email-provider setup is separate; the current mobile UI uses recovery codes.
- Use [IOS-STORE-METADATA.md](IOS-STORE-METADATA.md) for listing copy, reviewer paths, TestFlight notes and real screenshot scenes. No screenshots have been fabricated or taken here.
- Complete the current App Store Connect age-rating, export-compliance and other required questionnaires against the actual binary and offered regions. Do not copy an assumed age rating or claim untested accessibility support.
- Keep AI labeled experimental. Phase 4's real-workout collection/evaluation remains open; no superiority, clinical, injury-prevention or strength-gain claims are supported.

## 5. Upload and test through Apple

When the record is complete and blockers are resolved, use Xcode Organizer's distribution flow for App Store Connect. Check the processed build's version and number before selecting it. Set beta review contact and What to Test information; follow the current internal/external tester workflow shown by Apple. Verify installation through TestFlight itself, including upgrading an earlier installation, before treating local installation as distribution evidence.

Submission/upload is a separate action; these scripts never perform it. Record Apple validation and review responses. Keep public availability under manual control until the native evidence and release inputs are accepted.

## Sources checked 2026-10-15

- [Apple: Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)
- [Apple: App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- [Apple: Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- [Apple: Account deletion](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion)
- [Apple: Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)

Recheck the current console requirements and SDK privacy report at submission time.

## Icon and splash audit (2026-10-26)

| Asset | Size | Mode | Alpha | Colour profile | Background |
| --- | --- | --- | --- | --- | --- |
| `apps/mobile/assets/icon.png` | 1024×1024 | RGB | none | no ICC chunk (treated as sRGB) | `#10120E` charcoal, edge to edge |
| `apps/mobile/assets/splash-icon.png` | 1024×1024 | RGB | none | no ICC chunk (treated as sRGB) | `#10120E`, matches the splash `backgroundColor` |

No change was needed; the lime arrow is untouched. The splash uses one charcoal background in both light and dark appearance (the app UI is dark-first), and because the image's own background equals the splash colour there is no visible box in either mode. `test/iosAssets.test.ts` guards size and the no-alpha rule. Still to check on a device: the splash in light mode and the icon at small sizes on the Home Screen.
