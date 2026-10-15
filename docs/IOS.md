# GAIN on an iPhone: test it yourself (free route), and the later TestFlight route

Status: **PREPARED ON LINUX, NEVER BUILT, NEVER RUN ON AN iPHONE.** The box that prepared this has no Mac and no Xcode. What was checked: the app config generates a valid iOS project (`npx expo prebuild --platform ios --no-install` succeeds), the TypeScript compiles, and all tests pass. What nobody has seen: the app compiling in Xcode, launching, looking right, or doing anything on an iPhone. Treat the first build as an experiment, and write down what you see (section 7 lists what is most likely to be wrong).

iOS is the current deployment priority for the six-batch audit. This guide covers local installation and the later TestFlight route. Native validation is tracked in [IOS-AUDIT-CHECKLIST.md](IOS-AUDIT-CHECKLIST.md).

## 0. What you need and what the free route can and cannot do

| | Free route (now) | Paid Apple Developer Program (later) |
|---|---|---|
| Cost | 0 | 99 USD a year (you estimated about 2,500 EGP; the exact price in EGP and whether your card works are not confirmed here) |
| Needs | A Mac with Xcode, your iPhone, a USB cable, a normal Apple ID | The same, plus enrolling (days, sometimes longer) |
| App stops opening after | **7 days** (you plug in and install again; data stays if you install over it with the same bundle id) | 1 year for a signed build; TestFlight builds last 90 days |
| Other people can install it | No (only phones you plug into your Mac) | Yes, through TestFlight (up to 100 internal testers with no review; external testers need Apple's beta review) |
| Limits | Only a few apps at a time from a free account, and a limited number of new app ids a week (Apple changes the numbers; if Xcode says "limit reached", wait a few days). No push notifications, iCloud, etc. GAIN needs none of these: its reminders and rest-timer alerts are local notifications | None that matter for GAIN |

Your Mac must be able to run **Xcode 26.4 or newer** (GAIN uses Expo SDK 57, which needs it; checked against docs.expo.dev/versions/v57.0.0 on 2026-10-04). Xcode 26.4 needs a recent macOS; the App Store will tell you if your MacBook Air is too old (then update macOS first, or this route is closed until you have a newer Mac or use EAS Build, section 9). Xcode itself is about 10 GB to download and needs about 40 GB free.

Your iPhone needs **iOS 16.4 or newer**.

If the App Store offers **Xcode 27** (the iOS 27 SDK), see section 6, "Xcode 27". It needs one extra switch that the setup script turns on for you.

## 1. One-time setup on the Mac

1. **Install Xcode** from the Mac App Store. Open it once, agree to the licence, and let it finish "Installing components" (it may offer to download the iOS platform: say yes).
2. **Install Node 22 or newer** from nodejs.org (the LTS installer is fine). Check in Terminal: `node -v` shows v22 or higher.
3. **Install CocoaPods.** The easiest way is Homebrew. If you do not have it: paste the one-line installer from brew.sh into Terminal. Then:
   ```
   brew install cocoapods
   ```
4. **Point the command line at Xcode** (once):
   ```
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -runFirstLaunch
   ```
5. **Add your Apple ID to Xcode:** Xcode menu > Settings > Accounts > the + button > Apple ID. A free Apple ID is enough. A "Personal Team" appears.
6. **Get the code:**
   ```
   git clone https://github.com/ElMolla10/gain.git
   cd gain
   ```

## 2. Let the script do the rest (recommended)

```
scripts/ios-setup.sh
```
It checks the Mac (and tells you in plain words what to fix), asks you for a bundle id, installs packages, generates the iOS project and prints the next steps. It is safe to run again. `scripts/ios-setup.sh --check` only checks. `scripts/ios-setup.sh --run` also builds and installs a standalone **Release** build on the phone at the end. `--run --debug` explicitly chooses a debug build that needs Metro. The helper first reuses `.env.ios`; if it is absent, it preserves a single bundle ID and signing team found in the existing Xcode project before suggesting a new ID.

If you prefer to do it by hand:
```
npm ci
cd apps/mobile
GAIN_IOS_BUNDLE_ID=com.yourname.gain npx expo prebuild --platform ios
```
(`com.yourname.gain` is your own made-up id; see "Bundle id" below.)

**Bundle id.** Apple lets only one team own an id. The default `app.gain.mobile` may already be taken, or may later belong to the paid account, so for the free route use your own, like `com.mohamed.gain`. The script remembers it in `apps/mobile/.env.ios` (git ignores that file). **A different bundle id is a different app on the phone**: its data starts empty. Use Settings > Your data > Export a full backup, then Restore, if you ever switch.

## 3. Put the app on your iPhone

1. Plug the iPhone into the Mac. Unlock it. Tap **Trust This Computer** on the phone and enter the passcode.
2. **Developer Mode (iOS 16 and newer).** On the iPhone: Settings > Privacy & Security > **Developer Mode** > On. The phone restarts; confirm "Turn On" after the restart. The switch only appears after the phone has been connected to a Mac running Xcode; if you do not see it, connect the phone, open Xcode once, then look again.
3. Build and install:
   ```
   cd apps/mobile
   npx expo run:ios --device --configuration Release
   ```
   Pick your iPhone when it asks. The first build takes a long time (10 to 30 minutes is normal). Leave the phone unlocked.
   - **Or with Xcode:** open `apps/mobile/ios/GAIN.xcworkspace` (the **.xcworkspace**, not .xcodeproj). Click the blue GAIN project > target GAIN > Signing & Capabilities > tick "Automatically manage signing" > Team = your name (Personal Team). Check that Bundle Identifier is your own id. Choose your iPhone at the top and press the play button.
4. First launch says **"Untrusted Developer"**. On the iPhone: Settings > General > **VPN & Device Management** > under Developer App tap your Apple ID > **Trust** > Trust. Open GAIN again.
5. The Release build runs without Metro or the Mac nearby. Use `scripts/ios-setup.sh --run --debug` only when you want development debugging with Metro.

## 4. Every 7 days

The free certificate expires after 7 days; GAIN then closes right after opening. Plug the phone in and run `scripts/ios-setup.sh --run` again (or press Run in Xcode). Your data stays if the bundle id is the same and you install over the old app. **Do not delete the app from the phone to "fix" it**: that deletes your data. Export a backup first if you are unsure.

## 5. When something goes wrong

| What you see | What it means / what to do |
|---|---|
| `xcode-select: error: tool 'xcodebuild' requires Xcode` | The command line points at the small Command Line Tools. Run the two commands in step 4 of section 1. |
| `Xcode 26.x is older than 26.4` / build fails on SDK version | Update Xcode in the App Store (update macOS first if it will not offer it). Do not use an older Xcode. |
| "You have not agreed to the Xcode license" | `sudo xcodebuild -license accept` |
| `pod install` fails, "CocoaPods not installed" | `brew install cocoapods`, then `cd apps/mobile/ios && pod install` (or run the script again). |
| `pod install` fails with Ruby / "Unable to find a specification" / `ffi` errors | Do not use the Mac's built-in Ruby. Use Homebrew's CocoaPods (above). If you installed CocoaPods with `sudo gem install`, remove it: `sudo gem uninstall cocoapods`, then `brew install cocoapods`. For "Unable to find a specification": `cd apps/mobile/ios && pod repo update && pod install`. |
| (If you see it) `pod install` works but the build says "Sandbox: rsync deny" / "Operation not permitted" | Xcode > the GAIN target > Build Settings > search "User Script Sandboxing" > set to No. |
| "Signing for GAIN requires a development team" | Xcode > Signing & Capabilities > Team = your Personal Team. Or give the script your Team ID: `scripts/ios-setup.sh --team-id ABCDE12345`. |
| "Failed to register bundle identifier" / "The app identifier ... cannot be registered to your development team" | Someone else has that id. Pick another (`com.yourname.gain2`), run the script again with `--bundle-id`, and press Run again. |
| "Personal development teams do not support the Push Notifications capability" | Should not happen: GAIN's config removes that entitlement. If you see it, `apps/mobile/ios/GAIN/GAIN.entitlements` should contain an empty `<dict/>`; re-run the script (it rebuilds the folder). Tell me, because the config is wrong. |
| "Could not launch GAIN... invalid code signature / profile has not been explicitly trusted" | Section 3, step 4 (trust the developer). |
| "Developer Mode disabled" | Section 3, step 2. |
| "Unable to install ... maximum number of apps" or "reached the limit of 10 app ids" | The free account has weekly/app-count limits. Delete another test app you put on this phone, or wait a few days. |
| "The device is not available" / phone not listed | Cable and unlock the phone, tap Trust, wait for Xcode's "Preparing device" to finish (Xcode > Window > Devices and Simulators). Try a different cable or port. |
| App opens then closes after about a week | The 7-day certificate ran out (section 4). |
| White or red error screen in a debug build | The phone cannot reach the Mac's dev server. Same Wi-Fi, or install the Release build (section 3, step 5). |
| Build fails in Swift/C++ with a very long error | Copy the **first** red error line, not the last. Run `rm -rf apps/mobile/ios && scripts/ios-setup.sh` to start clean. Tell me the first error. |
| Everything worked yesterday, now `expo prebuild` complains | `git pull`, then run the script again. Expo regenerates the `ios` folder from scratch each time; never edit files inside it. |

### CocoaPods and Ruby, in short
CocoaPods is a Ruby program. The Mac's own Ruby is old and locked down, which is the source of most `gem`, `ffi` and permission errors. Homebrew's `cocoapods` brings its own Ruby and avoids all of it. Check with `which pod` (should be under `/opt/homebrew/bin`) and `pod --version`.

## 6. Xcode 27 (iOS 27 SDK)
Apps built with the iOS 27 SDK must use the newer "scene" start-up. Expo SDK 57 has an opt-in for it (`expo-build-properties` `ios.enableSceneSupport`, needs expo 57.0.23 or newer; GAIN is on 57.0.26). The setup script turns it on automatically when it sees Xcode 27 (`GAIN_IOS_SCENES=1`). By hand: `GAIN_IOS_SCENES=1 npx expo prebuild --platform ios`. **This switch is unverified on a Mac.** If you use Xcode 26.4 to 26.x you do not need it. (Source: expo.dev/changelog/sdk-57, read 2026-10-04.)

## 7. What is known-untested on iOS

Mo is testing on his iPhone. This workspace has not run native checks; the table below records workspace evidence, not the outcome of Mo's testing. Record new results against the exact build in [IOS-AUDIT-CHECKLIST.md](IOS-AUDIT-CHECKLIST.md).

| Area | What the code does | Status |
|---|---|---|
| Xcode build with SDK 57 / React Native 0.86 | Prebuild output generated and read on Linux only | NOT BUILT |
| `pod install` | Not run (CocoaPods does not run on Linux) | NOT RUN |
| App launches, splash, icon | `icon.png` is 1024x1024 without transparency, as Apple requires; splash uses the same image as Android | NOT TESTED |
| Local database (expo-sqlite), migrations | Same code as Android; unit tests run on a Node SQLite driver | NOT TESTED ON iOS |
| Fonts (IBM Plex Sans / Arabic) | Loaded at start with `useFonts` under names like `IBMPlexSans_600SemiBold`, also embedded by the expo-font plugin. If text shows in the iPhone's default font, this is the cause | NOT TESTED |
| Safe areas / notch / home bar | Uses `react-native-safe-area-context` everywhere, Android and iOS alike | NOT TESTED |
| Keyboard over inputs | iOS-only `automaticallyAdjustKeyboardInsets` on sheets, exercise picker, logger | NOT TESTED |
| "Done" bar above number pads | iPhone number pads have no Return key; an `InputAccessoryView` adds a Done button (iOS only). Might not appear inside sheets | NOT TESTED |
| Date entry | A plain list picker (day / month / year), no native date picker | NOT TESTED |
| Rest timer alert and training-day reminders | Local notifications, permission asked when you turn them on. iOS has no per-app "channel"; the code skips channels on iOS. Weekly triggers use weekday 1 = Sunday as on Android; if a reminder comes on the wrong day, that is the bug | NOT TESTED |
| Notification permission text | iOS shows its own system prompt (there is no custom text key for notifications) | NOT TESTED |
| Vibration at the end of rest | `Vibration.vibrate` on iOS buzzes once for a fixed short time; the pattern is ignored | NOT TESTED |
| Export (JSON, CSV), coach-card PDF, diagnostics | `expo-file-system` + `expo-sharing` + `expo-print`; the iPhone share sheet | NOT TESTED |
| Import (Hevy CSV, GAIN backup) | `File.pickFileAsync` (Files app picker) | NOT TESTED |
| Sync (Back up and sync, recovery code) | `expo-secure-store` (iOS Keychain), same Cloudflare server as Android. The Keychain survives deleting the app on iOS, so after a reinstall the app may still find an old sync token. Untested | NOT TESTED |
| "Check for updates" | Hidden on iOS (it downloads an Android APK). New builds on iOS arrive only by building again (free route) or TestFlight | CODE ONLY |
| Arabic / RTL | `expo-localization` with RTL support; layout follows the app's own language setting | NOT TESTED |
| Dark / light | Follows the system or the app's setting; the status bar is set from the app | NOT TESTED |
| Back gesture | The navigation library handles the iOS swipe-back; there is no Android back-button code to port. The finish screen hides the back button, so check the swipe does not skip it | NOT TESTED |
| Alerts with three buttons | Button order was written for Android (the last button looks primary there); iOS may show them in a different order or emphasis | NOT TESTED |
| Background / killed app | Nothing iOS-specific (no background modes). iOS may end the app sooner than Android; the app saves each set as it is logged | NOT TESTED |
| Backups | iOS may include app data in an iCloud/computer backup; the privacy text has an iPhone version | NOT TESTED |
| Accessibility (VoiceOver, big text) | Labels are written for TalkBack; VoiceOver should read the same labels | NOT TESTED |
| Xcode 27 scene switch | Config generates the scene manifest (checked in Info.plist on Linux) | NOT BUILT |
| The iPad | The app is set to iPhone only; an iPad would run it in a small iPhone-sized window | NOT TESTED |

The rows to add to your phone checklist are in [NATIVE-CHECKLIST.md](NATIVE-CHECKLIST.md) (rows 34 and up).

## 8. What was changed in the code for iOS (so you know what is new)
- App config (`app.json`, `plugins/without-push-entitlement.js`): iPhone only, `buildNumber`, no Push Notifications entitlement (a free Apple ID cannot sign it, and GAIN only uses local notifications), no Face ID text, `usesNonExemptEncryption: false`, a privacy manifest (required-reason API list), optional environment switches `GAIN_IOS_BUNDLE_ID`, `GAIN_IOS_TEAM_ID`, `GAIN_IOS_SCENES`.
- Code (`Platform.OS` guarded; Android unchanged): the update card is hidden on iOS, privacy and delete-all texts have iPhone wording, number pads get a Done bar, scroll views make room for the keyboard.
- `scripts/ios-setup.sh` (this guide's helper; `bash -n`, shellcheck and a run against stand-in Mac tools were done on Linux, never on a Mac).
- CI job `ios-config`: the iOS JS bundle compiles (`expo export --platform ios`), prebuild succeeds, and the generated project has no push entitlement, no Face ID string and iPhone-only devices. This catches config rot; it does not build the app.
- Generated `ios/` is **not committed** (it is in `.gitignore`, like `android/`).

## 9. TestFlight and App Store preparation

**iOS is the current release priority.** Use [IOS-RELEASE.md](IOS-RELEASE.md) for the local Release archive, Xcode validation and submission sequence. [IOS-APP-PRIVACY.md](IOS-APP-PRIVACY.md) maps actual optional sync/share flows to draft store answers; [IOS-STORE-METADATA.md](IOS-STORE-METADATA.md) contains draft listing and review notes.

`GAIN_IOS_BUILD_NUMBER` (or `--build-number`) overrides the source default for a particular build. Use a new positive integer for each upload. The helper's `--archive /absolute/path/GAIN-N.xcarchive` requires an explicit build number, preserves bundle identity and signing team, and refuses existing archives. It creates a local generic-device Release archive and never uploads it. A Personal Team can install locally, but TestFlight distribution needs the appropriate Apple Developer Program team and provisioning.

No Apple membership, store record, certificate, signed archive, screenshot set or submission is claimed complete here. Keep your installed bundle ID for retention testing; changing it creates a separate app. Do not upload until the privacy/operator/contact fields, actual SDK privacy report, Worker deployment and device checks are resolved.

## 10. Sources read on 2026-10-04
- Expo SDK reference (Xcode 26.4+ and iOS 16.4+ for SDK 57): docs.expo.dev/versions/v57.0.0
- Expo SDK 57 changelog (Xcode 27 and scene support): expo.dev/changelog/sdk-57
- Apple, Offering account deletion in your app: developer.apple.com/support/offering-account-deletion-in-your-app
- Apple, App Review Guidelines 5.1.1(v): developer.apple.com/app-store/review/guidelines
Free-route limits (7 days, a few apps, app id counts) are Apple's commonly documented behaviour but Apple changes them; the numbers are not re-verified here.
