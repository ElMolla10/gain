# Check for updates (v0.8.0)

Settings > Updates. Status: **unit-tested logic only; NOT run on a device.**

What it does
1. Asks `https://api.github.com/repos/ElMolla10/gain/releases?per_page=30` (public repo, no token, no account) for the releases. Pre-releases count (every GAIN release so far is one). Drafts and tags that are not `vX.Y.Z` are ignored.
2. Picks the highest version number and compares it with the installed `expo.version`. Equal or older: "you have the newest version". Newer: shows the version, the first 1500 characters of the release notes, the download size and a button.
3. The button downloads the asset named `gain-vX.Y.Z...-arm64.apk` (https only) into the app cache, computes its SHA-256 and compares it with the hash the release promises: GitHub's own asset `digest` when present, otherwise the hash on the "SHA-256 of the APK (...)" line of the release notes. A mismatch deletes the file and installs nothing. No hash in the release: it says so and still offers the install (Android's signature check is then the only guard).
4. Opens Android's installer with a `content://` URI (expo-file-system's FileProvider) through expo-intent-launcher (`ACTION_VIEW`, `application/vnd.android.package-archive`, read-permission grant). The manifest has `REQUEST_INSTALL_PACKAGES`. If Android blocks installs from GAIN, the "Allow installs from GAIN" button opens `ACTION_MANAGE_UNKNOWN_APP_SOURCES` for `app.gain.mobile`.

Why it updates in place: every release is signed with the same keystore (signer certificate SHA-256 `571bc5a8...c5b2`) and has a higher `versionCode`, so Android installs it over the old one and keeps the data.

Failures are named, not thrown: offline / timeout, GitHub rate limit (403/429), other HTTP error, unexpected answer, release without an APK, hash mismatch, download or installer failure.

Not verified on a device: the download, the file provider URI being accepted by the system installer, the "unknown sources" prompt flow on the phone maker's Android, and the install-over behaviour. GitHub's unauthenticated API allows 60 requests an hour per IP.
