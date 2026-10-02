# Device test, release 0.4.0 (Step 1): result so far

**Verdict: NOT device-verified.** The full loop (onboard, start workout, log offline, finish, accept next targets, import the Hevy export, Why, Arabic, restart) was **not** run on any device. Nothing below is a pass for those lines.

## What was tried (2026-10-02, on the build box)

| Item | Result |
| --- | --- |
| Hardware acceleration | `/dev/kvm` exists but the host kernel faults when a virtual CPU is created (`kvm_spurious_fault` in `vmx_vcpu_create` in the kernel log, nested virtualisation is broken here). Acceleration was therefore not usable; trying it also wedged the box once. |
| Emulator | Android Emulator 37.2, `system-images;android-34;google_apis;x86_64`, Pixel 6 profile, **software emulation** (`-accel off`), 3 GB RAM, 4 cores. |
| APK | v0.4.0 source (main at 6596463), `expo prebuild` + `gradlew assembleRelease -PreactNativeArchitectures=x86_64` (debug-signed; the shipped APK is arm64-only and signed with the release key, so it cannot run on this x86 emulator without translation). Installed with `adb install`. |
| First boot | About 25 minutes to reach the launcher, with repeated "Process system isn't responding" dialogs. |
| App launch | **Pass (partial):** the app launched, showed the splash, then onboarding **Step 1 of 6** (language), **Step 2** (units, kg preselected) and **Step 3** (days, minutes, equipment) rendered correctly in dark mode. Screenshots: `/workspace/gain-screens/02-...`, `03-...`, `04-...` on the build box (not in git). |
| Rest of the loop | **Not run.** After tapping through Step 3 the guest stopped responding (ANRs with latency over 2 minutes, load average above 30, black screen). The emulator was killed to free the box. |
| Real phone | **Not run.** Needs Mohamed's phone. |

No bug in the app was found by this attempt, so no fix PR and no v0.4.1 release were made. That is absence of evidence, not a pass: the app was only seen for three screens.

## Checks that did run (not device checks)

- `npm run typecheck`, engine and mobile unit tests (logic and SQLite on Node), `expo export --platform android` bundle compile (CI).
- x86_64 release build compiles and installs.

## What Step 1 still needs

1. A real Android phone (the script in MASTER-PLAN Step 1), the signed arm64 APK from the release page, and the Hevy export.
2. Or a machine with working KVM / Android Studio AVD for the emulator run.
3. Fill in a pass/fail table here (phone model, Android version) when it is done, and only then tick Step 1.

Unverified until then: the system file picker for import, 1,049-row import timing, screen lock mid-session, kill mid-set, airplane mode, RTL flip on real screens, 200% font, upgrade-over-0.3.0 migration on a real install.
