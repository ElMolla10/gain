# Build an Android APK on GitHub

In [Actions → Android APK](https://github.com/ElMolla10/gain/actions/workflows/android-apk.yml),
choose **Run workflow** on `main`. When the run finishes, download the artifact
under **Artifacts** and unzip it. It contains the installable arm64 APK and
`SHA256SUMS.txt`. The app runs without Metro. The artifact expires in 14 days.

| Signing mode | Install behavior | Setup |
| --- | --- | --- |
| `preview` (default) | Installs as **GAIN Preview** alongside GAIN, with separate local data. | No secrets. Leave `version_code` empty to use the app config. |
| `release` | Updates the original sideload app when the version code is greater than the installed one. | Run from `main`, enter an unused version code greater than the last distributed APK, and configure the signing secrets below. |

Use the original GAIN release keystore (alias `gain`) for release mode.
Configure GitHub Actions secrets `GAIN_ANDROID_KEYSTORE_BASE64` (the original
JKS encoded as base64) and `GAIN_ANDROID_KEYSTORE_PASSWORD` (the existing
keystore password). The workflow checks the APK's signature against GAIN's
original release certificate and fails if it does not match. Keep the key
and password out of Git and workflow inputs.

The workflow builds on GitHub and produces a downloadable artifact. It does
not create a GitHub Release, submit to Google Play, or use an Expo cloud build.
