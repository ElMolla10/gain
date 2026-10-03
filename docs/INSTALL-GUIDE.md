# Installing and updating GAIN (beta, Android) — DRAFT one-pager for testers

Status: **draft, not tested with a non-technical lifter.** The step "Done means: a non-technical lifter installs and updates from this guide without help" is still open. Wording of the phone's own screens varies by maker; the screenshots are not made yet.

GAIN beta is a test app. It is not in the Play Store. It works without an account and without internet. Your workouts stay on your phone.

## Install the first time
1. On your phone open the link Mohamed sent (the GitHub "Releases" page) and download the file named **gain-vX.Y.Z-arm64.apk** (the newest one at the top).
2. Open the downloaded file. Android will say it cannot install apps from this source: tap **Settings** and switch on **Allow from this source** for your browser or Files app, then go back and tap **Install**.
3. If Android shows "Play Protect" a warning for an unknown app: tap **Install anyway** (the app is signed by Mohamed, it is not scanned by Google yet).
4. Open GAIN. Pick language and units. That is all.

This file only works on 64-bit ARM phones (most phones from the last years). If it says "app not compatible", tell Mohamed which phone you have.

## Update
Inside the app: **Settings > Check for updates**. If there is a newer version, tap **Download and install**. The app checks the download's fingerprint before it opens the installer. Your workouts stay.
Do not uninstall first. Uninstalling deletes your data (unless you saved a backup: Settings > Your data > Export a full backup (JSON)).

## Before every update (30 seconds, optional but kind to yourself)
Settings > Your data > Export a full backup (JSON), and send the file to yourself on WhatsApp.

## When something is wrong
Settings > Diagnostics > Share the report (it contains no workouts), send it to Mohamed with a sentence on what you were doing. See docs/BETA-FEEDBACK.md.
