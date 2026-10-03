# Release process (Step 19): signed arm64 pre-release APK on GitHub

Status: **written from the process actually used for v0.9.0 and v0.10.0 on the build box. Never tried from a clean clone by a second person, and never tried on a second phone maker.** Treat it as a checklist to run, not as proof it is repeatable.

## 0. Before you start
- One build at a time. The box has ~16 GB RAM and Gradle needs ~3 GB: `pgrep -fa "gradle|emulator|qemu"` must be empty, `free -m` should show 4 GB+ available.
- Everything on `main` is merged on green CI. `npm run typecheck && npm test` pass locally.
- Next version number: look at `gh release list`; versions are `vMAJOR.MINOR.PATCH`, all releases are **pre-releases** until Mohamed says otherwise.

## 1. Bump the version (branch `release/X.Y.Z`)
`apps/mobile/app.json`: `expo.version` = `X.Y.Z` and `expo.android.versionCode` = **previous + 1** (Android only installs a higher versionCode over an older one; the in-app updater compares `expo.version`). Update the status table in `docs/MASTER-PLAN.md` and `docs/ROADMAP.md` honestly. PR, wait for green CI, merge.

## 2. Build (JDK 17, Android SDK in `~/tools`, `. ~/env-gain.sh`)
```
cd apps/mobile
CI=1 npx expo prebuild --platform android --clean --no-install   # regenerates android/ (git-ignored)
git checkout package.json                                         # prebuild rewrites the "android" script; do not commit that
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon -Dorg.gradle.jvmargs=-Xmx2g
```
Output: `android/app/build/outputs/apk/release/app-release.apk` (about 2 minutes on a warm box). It is signed with the *debug* key by the generated project; step 3 replaces that signature. **arm64-v8a only**: phones with armv7 or x86 are not covered.

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

## 8. Clean-clone check (still to run once)
`git clone`, `npm ci`, steps 2-3 on a box that has the SDK. Expect `npm ci` plus prebuild to need network. Not done.
