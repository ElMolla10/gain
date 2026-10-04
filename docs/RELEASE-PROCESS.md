# Release process (Step 19): signed arm64 pre-release APK on GitHub

Status: **written from the process actually used for v0.9.0 and v0.10.0 on the build box. Run once from a fresh clone on the same box (2026-10-03, section 8) and it worked; never tried by a second person, on a second box, or on a second phone maker.** Treat it as a checklist to run, not as proof it is repeatable.

## 0. Before you start
- One build at a time. The box has ~16 GB RAM and Gradle needs ~3 GB: `pgrep -fa "gradle|emulator|qemu"` must be empty, `free -m` should show 4 GB+ available.
- Everything on `main` is merged on green CI. `npm run typecheck && npm test` pass locally.
- Next version number: look at `gh release list`; versions are `vMAJOR.MINOR.PATCH`, all releases are **pre-releases** until Mohamed says otherwise.

## 1. Bump the version (branch `release/X.Y.Z`)
`apps/mobile/app.json`: `expo.version` = `X.Y.Z` and `expo.android.versionCode` = **previous + 1** (Android only installs a higher versionCode over an older one; the in-app updater compares `expo.version`). Update the status table in `docs/MASTER-PLAN.md` and `docs/ROADMAP.md` honestly. PR, wait for green CI, merge.

## 2. Build (JDK 17, Android SDK in `~/tools`, `. ~/env-gain.sh`)
`~/env-gain.sh` is not in the repo. On a new box create it with the paths of your JDK 17 and Android SDK (platform 36, build-tools 36.0.0, NDK 27.1.12297006 as downloaded by Gradle; accept the licences once with `sdkmanager --licenses`):
```
export ANDROID_HOME=$HOME/tools/android-sdk ANDROID_SDK_ROOT=$HOME/tools/android-sdk JAVA_HOME=$HOME/tools/jdk-17.0.20.1+1
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH
```
From a fresh clone, install the JS dependencies first (prebuild runs with `--no-install` and the Gradle build reads the React Native/Expo sources from `node_modules`):
```
npm ci                                                            # repo root, Node 22+
cd apps/mobile
CI=1 npx expo prebuild --platform android --clean --no-install   # regenerates android/ (git-ignored)
git checkout package.json                                         # prebuild rewrites the "android" script; do not commit that
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon -Dorg.gradle.jvmargs=-Xmx2g
```
Output: `android/app/build/outputs/apk/release/app-release.apk` (about 2.5 minutes on a warm box, 346 Gradle tasks, from a fresh clone). It is signed with the *debug* key by the generated project; step 3 replaces that signature. **arm64-v8a only**: phones with armv7 or x86 are not covered.

**Build variants (v0.20.0).** The default build above is the sideload APK. A pilot variant (`GAIN_PILOT_TEMPLATES=1`) and a Google Play variant (`GAIN_DISTRIBUTION=play`) are described in [PLAY-BUILD.md](PLAY-BUILD.md); the pilot APK is published as an extra asset named `gain-pilot-vX.Y.Z-arm64.apk` (the updater ignores that name). Always `expo prebuild --clean` again when switching variants.

## 3. Sign with the release key (the SAME key as every earlier release)
```
BT=~/tools/android-sdk/build-tools/36.0.0
$BT/zipalign -f -p 4 app-release.apk aligned.apk
$BT/apksigner sign --ks ~/keystores/gain-release.jks --ks-key-alias gain \
  --ks-pass file:$HOME/keystores/gain-release.pw --out gain-vX.Y.Z-arm64.apk aligned.apk
$BT/apksigner verify --print-certs gain-vX.Y.Z-arm64.apk | grep "SHA-256"
sha256sum gain-vX.Y.Z-arm64.apk
```
- The signer certificate SHA-256 **must** be `571bc5a8ce699054ae7bffe0fc912fd1faf9de7dfd3d3eb962b1b8578315c5b2`. If it differs, STOP: Android will refuse the install as an update and users would have to uninstall (losing local data).
- The asset name must match `gain-vX.Y.Z...-arm64.apk` (the updater looks for that pattern).
- Never commit the keystore, the password file, `*.idsig` or any APK.

## 4. Release notes (the updater parses them)
Template (first line is free text; **keep the SHA-256 line exactly in this shape**, the updater falls back to it when GitHub gives no asset digest):
```
GAIN vX.Y.Z (pre-release, Android arm64). Built from main after PR #N (commit) with JDK 17 + Gradle assembleRelease. versionName X.Y.Z, versionCode C.

Signed with the same keystore as v0.1.0-vPREV (signer certificate SHA-256 571bc5a8ce699054ae7bffe0fc912fd1faf9de7dfd3d3eb962b1b8578315c5b2), so it installs over vPREV as an update and keeps your data. arm64-v8a only.

SHA-256 of the APK (gain-vX.Y.Z-arm64.apk): <64 hex characters>

What is new: ...
NOT verified on a device: ... (be specific)
Tests on main: engine N, mobile M, typecheck clean.
```
The updater shows only the first 1500 characters, so put what matters first.

## 5. Publish
```
gh release create vX.Y.Z gain-vX.Y.Z-arm64.apk --prerelease --target main --title "GAIN vX.Y.Z" --notes-file notes.md
gh release view vX.Y.Z --json assets,body   # check the asset's digest equals the SHA-256 line
```

## 6. Update-over-install check (every release)
On a phone that has the previous version: Settings > Check for updates > Download and install; then confirm the version number changed, the history is still there and one workout can be started. **Not yet done by anyone for any release**; it needs a phone. Second check on a phone from a different maker (battery savers and the "install unknown apps" flow differ).

## 7. Keystore custody (Mohamed)
`~/keystores/gain-release.jks` + `.pw` live on the build box only. **Whether a backup exists elsewhere is unknown.** Losing the key means sideloaded users cannot update (they must uninstall and lose data unless they exported a backup) and, depending on the Play App Signing choice, blocks Play uploads. Action for Mohamed: copy both files to an offline place he controls, separately from each other, and write down who holds them.

## 8. Clean-clone check
Run on 2026-10-03 on the build box (same SDK, JDK and keystore as the real releases), from a fresh `git clone` of `main` at v0.13.0 (`1e867e0`): `npm ci` (11 s), `npm run typecheck` (clean in all 4 workspaces), `npm test` (engine 354, sync 19, mobile 565, server 83, all pass), `npm run export:android -w @gain/mobile` (1122 modules, 3.3 MB Hermes bundle), `expo prebuild`, `gradlew assembleRelease` (BUILD SUCCESSFUL in 2m 24s), zipalign + apksigner: signer certificate SHA-256 matched `571bc5a8...c5b2`, `aapt2 dump badging` showed `app.gain.mobile` versionCode 13, versionName 0.13.0. The test APK was deleted and not published.
Still NOT checked: a different machine (this box already had the SDK, JDK, NDK and a Gradle cache, so a truly cold box needs the SDK/NDK downloads and licence acceptance), a different person, byte-for-byte reproducibility against the published APK (not attempted), installing the result on a phone.

Second run, 2026-10-03 (evening), for v0.17.0, from a fresh `git clone` of `main` at `8aabc06` into an empty directory: `npm ci` (10 s), typecheck clean in all workspaces, `npm test` (engine 365, sync 19, mobile 740, server 90, all pass), `npm run export:android`, `expo prebuild`, `gradlew assembleRelease` (BUILD SUCCESSFUL in 2m 48s, 387 tasks), zipalign + apksigner: signer certificate SHA-256 `571bc5a8...c5b2`, `aapt2 dump badging`: `app.gain.mobile` versionCode 17, versionName 0.17.0, native-code arm64-v8a, 36.7 MB. This APK was published as v0.17.0; the GitHub asset digest matches the SHA-256 line in the notes and a re-download hashes identically. Same box, SDK and Gradle cache as before, so the "cold machine" and "second person" gaps remain. `aapt2 dump permissions` is a useful extra check (it caught permissions the privacy draft did not list).

Third run, 2026-10-03 (night), for v0.18.0, from a fresh `git clone` of `main` into an empty directory: `npm ci`, typecheck clean in all workspaces, `npm test` (engine 365, sync 19, mobile 736, server 90, all pass), then the version bump PR (#123) merged on green CI, `expo prebuild`, `gradlew assembleRelease` (BUILD SUCCESSFUL in 2m 3s, 387 tasks), zipalign + apksigner: signer certificate SHA-256 `571bc5a8...c5b2`, `aapt2 dump badging`: `app.gain.mobile` versionCode 18, versionName 0.18.0, native-code arm64-v8a, 36.7 MB. Published as pre-release v0.18.0; a re-download hashes identically to the SHA-256 line in the notes (GitHub showed no asset digest right after upload, so the notes line is the reference). Same box, SDK and Gradle cache as before: the cold-machine and second-person gaps remain, and nothing was installed on a phone.

Fourth run, 2026-10-04, for v0.19.0, from a fresh `git clone` of `main` at `4e6aa51`: `npm ci`, typecheck clean, `npm test` (engine 365, sync 19, mobile 747, server 90, all pass), `expo prebuild`, `gradlew assembleRelease` (BUILD SUCCESSFUL in 2m 57s, 387 tasks), zipalign + apksigner: signer certificate SHA-256 `571bc5a8...c5b2`, published as a pre-release and the downloaded asset re-hashed identical. Note: `apksigner` needs `. ~/env-gain.sh` in the same shell (it calls `java`). Still not installed on a phone by the builder.

Fifth run, 2026-10-04, for v0.20.0, from a fresh `git clone` of `main` at `cbc5ff0`: `npm ci`, typecheck clean, `npm test` (engine 365, sync 19, mobile 773, server 90, all pass). Two builds, each `expo prebuild --clean` then `gradlew assembleRelease` (BUILD SUCCESSFUL in 2m 28s and 2m 12s): the normal build (`gain-v0.20.0-arm64.apk`, SHA-256 `c517c504...04c9`) and the pilot-subset build with `GAIN_PILOT_TEMPLATES=1` (`gain-pilot-v0.20.0-arm64.apk`, SHA-256 `dc9c5fd5...faf2`). Both: signer certificate SHA-256 `571bc5a8...c5b2`, versionCode 20, versionName 0.20.0, REQUEST_INSTALL_PACKAGES present; the pilot list appears only in the pilot APK's embedded `app.config`. Published as a pre-release at 04:56 Cairo; downloaded assets re-hashed identical. Earlier the same day a `GAIN_DISTRIBUTION=play` variant (APK + AAB) was built and inspected: no REQUEST_INSTALL_PACKAGES (not published). Still not installed on a phone by the builder.
