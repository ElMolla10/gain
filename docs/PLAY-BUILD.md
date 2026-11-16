# Build variants: sideload, pilot, Google Play (Step 25 / G4) (v0.20.0)

Status: **the Play variant builds and its manifest was measured on a build box (2026-10-04); nothing was run on a phone and nothing was submitted to Play at that time.** The default sideload build is unchanged. A Play Console account now exists (identity still in review as of 16 Nov 2026). Listing copy, the `play` EAS profile, version 1.0.3 / versionCode 23, and the local AAB script are in [PLAY-STORE-LISTING.md](PLAY-STORE-LISTING.md).


## 1. The switches (build time only)
Set as environment variables when running `expo prebuild` / `expo export` / Gradle. They are applied by `apps/mobile/app.config.js` (which extends `app.json`) through `apps/mobile/build-flags.js` and are written into the app's own config (`expo.extra`), where `src/buildConfig.ts` reads them. A wrong value (`GAIN_DISTRIBUTION=Play`, `GAIN_PILOT_TEMPLATES=true`) stops the build with an error instead of making a different app. Empty means "not set".

| Variable | Values | Effect |
| --- | --- | --- |
| `GAIN_DISTRIBUTION` | `sideload` (default) / `play` | `play`: `REQUEST_INSTALL_PACKAGES` is removed from the permissions and added to `blockedPermissions` (so no library can bring it back); Settings does not render the "Check for updates" card (so there is no download-and-install code path to reach); the in-app privacy page drops its "Check for updates contacts GitHub" line. `sideload`: exactly the app of v0.19.0. |
| `GAIN_PILOT_TEMPLATES` | unset or `0` (default) / `1` | `1`: the first-run template picker and Plan > Program details > start a template offer only the six pilot programs ([pilot/PILOT-TEMPLATES.md](pilot/PILOT-TEMPLATES.md)); Settings shows "Pilot build: only the six pilot programs are offered." Nothing is removed from the code, the tests or the database; an unknown id list or an empty match falls back to all 48. |

What is **not** changed by either: package id (`app.gain.mobile`), versionName/versionCode, the database, the rules, the sync code, every other permission, `allowBackup` (decision D11 open).

What is **not** done for a Play build (see section 5): the updater's code (`UpdateCard.tsx`, `updateCheck.ts`, and the `expo-intent-launcher` import) is still in the JS bundle, unreachable but not tree-shaken; the sideload install guides ([INSTALL-GUIDE.md](INSTALL-GUIDE.md), [pilot/GUIDE.md](pilot/GUIDE.md)) describe the sideload app, not a Play install.

## 2. Commands
From a fresh clone, as in [RELEASE-PROCESS.md](RELEASE-PROCESS.md) section 2 (`. ~/env-gain.sh`, `npm ci` first). The variable must be set for `expo prebuild` (it reads the config) and is also safe to set for Gradle:

```
cd apps/mobile
# sideload (the GitHub release APK): nothing set
CI=1 npx expo prebuild --platform android --clean --no-install
# pilot build (sideload + six programs)
GAIN_PILOT_TEMPLATES=1 CI=1 npx expo prebuild --platform android --clean --no-install
# Play build (or use scripts/android-play-aab.sh; --prebuild-only checks the manifest without signing)
GAIN_DISTRIBUTION=play CI=1 npx expo prebuild --platform android --clean --no-install
git checkout package.json
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon -Dorg.gradle.jvmargs=-Xmx2g   # APK (sideload or pilot)
./gradlew bundleRelease   -PreactNativeArchitectures=arm64-v8a --no-daemon -Dorg.gradle.jvmargs=-Xmx2g   # AAB (Play; sign with the v1.0.2 key, see PLAY-STORE-LISTING.md)
```
Run `prebuild --clean` again whenever the variables change; the generated `android/` folder is git-ignored and keeps the old manifest otherwise. Check what you built: `expo config --json` shows `extra`; `aapt2 dump permissions app-release.apk`; `unzip -p app-release.apk assets/app.config` shows the embedded `extra` (a `null` list is stored as `{}`, which the app treats as "all templates").

## 3. Pilot variant: file naming and publishing
The pilot APK is published next to the normal one as **`gain-pilot-vX.Y.Z-arm64.apk`**. That name does **not** match the in-app updater's `gain-vX.Y.Z...-arm64.apk` pattern, so "Check for updates" never offers it by accident (an installed pilot build that checks for updates is told it is up to date, then later gets the normal APK, which has all 48 programs). Same package id, same signing key, versionCode equal to the normal build, so either installs over the other as an update. The SHA-256 of both APKs goes in the release notes ([RELEASE-PROCESS.md](RELEASE-PROCESS.md) section 4).

## 4. Measured: Play variant of the v0.19.0 sources plus this change (2026-10-04, build box)
Built from a clean checkout with `GAIN_DISTRIBUTION=play`: `assembleRelease` and `bundleRelease` in one Gradle run, BUILD SUCCESSFUL in 2 m 51 s (396 tasks). AAB 25.6 MB (unsigned by Play; debug-signed by the generated project), APK 36.6 MB.
- `aapt2 dump permissions`: INTERNET, VIBRATE, RECEIVE_BOOT_COMPLETED, POST_NOTIFICATIONS, ACCESS_NETWORK_STATE, WAKE_LOCK, `com.google.android.c2dm.permission.RECEIVE`, the app's own `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`, `com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE` and about 18 launcher-badge permissions from the notifications library. **`REQUEST_INSTALL_PACKAGES` is absent** (the sideload build keeps it, see its own check in [DATA-SAFETY-DRAFT.md](DATA-SAFETY-DRAFT.md) section 6). Unchanged from the sideload list otherwise.
- `aapt2 dump badging`: `app.gain.mobile`, versionCode 19, versionName 0.19.0, `compileSdkVersion` 36, `targetSdkVersion` 36.
- Embedded config (`assets/app.config`): `extra.distribution = "play"`, `android.permissions = []`.
- NOT checked: install on a phone, that Settings really omits the card (the wiring is tested by source checks only), the AAB with Play's bundletool/pre-launch report, signing with an upload key, whether Play's policy scanner still flags something else (for example the install-referrer permission a library declares: GAIN reads no referrer).

## 5. What a Play submission still needs (none done; all outside the repo's reach)
1. **Developer account and app signing (updated 16 Nov 2026).** A personal Play Console account exists; identity verification was still in review when this was written. **Do not enrol the old sideload key** `571bc5a8ce699054ae7bffe0fc912fd1faf9de7dfd3d3eb962b1b8578315c5b2` (that key signed v0.1.0–v0.21.0 only, and lives on the build box). The current key is the **Windows v1.0.2** keystore, certificate SHA-256 `9bb983dd9766e52b8f2f363da38a07057da1fc5309a0f1719ad2a7c96eea2a4b`, which signed the published `gain-v1.0.2-arm64.apk`. Mohamed decided to enrol that v1.0.2 key as the Play **app signing key** so a Play install can update over the sideloaded 1.0.2 APK (`versionCode` 23 or higher). The keystore is not in git and is not on the build box; it will be used privately, never committed.

   For a new Play app, Google otherwise generates an app signing key when the first bundle is uploaded. That default would break in-place updates from the 1.0.2 sideload APK, and it can only be changed **before** a release is rolled out to open testing or production. Enrol the existing key first, on the Play App Signing page (**Protected with Play > Play Store protection > Manage Play app signing**, or **Release > Setup > App signing**): **Change key** / “export and upload a key from a Java keystore”, then provide a copy of the v1.0.2 key via the **PEPK** tool. The Console shows the exact command and Google's encryption key. On the private machine that holds the keystore, run a command of the form:

   ```
   java -jar pepk.jar --keystore=PATH_TO_JKS --alias=KEY_ALIAS --output=encrypted-private-key.zip --encryptionkey=KEY_FROM_THE_CONSOLE
   ```

   Upload the encrypted file (not the raw keystore), enrol, and confirm the **App signing key certificate** SHA-256 is `9bb983dd…`. If it is not, stop. Optionally register a separate **upload key** later with `keytool -export -rfc -keystore PATH_TO_UPLOAD_KEYSTORE -alias UPLOAD_ALIAS -file upload_certificate.pem` and upload that PEM; until then the first AABs can be signed with the same v1.0.2 key. A lost upload key can be reset; the app signing key cannot. See [PLAY-STORE-LISTING.md](PLAY-STORE-LISTING.md) section 1 and `scripts/android-play-aab.sh`.

2. **Testing tracks** before production: a new personal account must run a **closed** test with at least 12 testers opted in continuously for 14 days, then apply for production access ([Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)). The plan is in [PLAY-STORE-LISTING.md](PLAY-STORE-LISTING.md) section 8.
3. **Policy forms**: Data safety ([DATA-SAFETY-DRAFT.md](DATA-SAFETY-DRAFT.md), re-check against the Play manifest above), content rating, target audience (adults), Health apps declaration if the Console asks, Ads = No, Account deletion URL ([ACCOUNT-DELETION-SPEC.md](ACCOUNT-DELETION-SPEC.md)).
4. **Privacy policy at a public URL that a lawyer has reviewed**, with an operator and a support email ([site/README.md](site/README.md)). The draft is hosted (see its hosting record) but is not the final policy.
5. **Listing assets**: real phone screenshots in Arabic and English ([PLAY-ASSETS.md](PLAY-ASSETS.md)), feature graphic, native-reviewed Arabic.
6. **G3 first** (MASTER-PLAN: Store ready needs a validated pilot), and a pre-launch report with no crashes.
7. **A Play-specific privacy copy review**: the in-app and web privacy text say the sideload build has "Check for updates"; the web text already says a Play build will not. Re-read both when the Play build is real.
8. In the Play build, **the app cannot update itself**; users update through Play. The sideload build keeps its own updater and the GitHub release flow unchanged.
