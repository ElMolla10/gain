# Workout on the iOS Lock Screen and Dynamic Island

> **Needs a native build with `GAIN_IOS_LIVE_ACTIVITY=1` and a paid Apple Developer Program team** (the App Group can't be provisioned by a free Personal Team). It does not work in Expo Go, in an OTA-only update, or in the current free-route build (docs/IOS.md).

While a workout is open, one Live Activity (`GainWorkoutActivity`) shows the GAIN badge and "Workout", the elapsed workout time (a native SwiftUI count-up that freezes while the workout is paused), the current exercise, "Set X of Y" (or Warm-up / Drop set / All sets done), the set's weight × reps (seconds or metres for timed exercises) and, while resting, the rest countdown with a progress bar inside the same card. Timers are native (`Text timerInterval`), so nothing ticks in JavaScript. Logging, the in-app rest clock and the local rest alert stay independent of this optional presentation.

## Building

The implementation uses the official Expo SDK 57 `expo-widgets` and `@expo/ui` modules. Expo Go does not include the widget extension. Build a new native app with:

```sh
cd apps/mobile
GAIN_IOS_LIVE_ACTIVITY=1 npx expo run:ios
```

Use the same variable for prebuild/EAS builds. The extension uses the resolved iOS bundle ID (including `GAIN_IOS_BUNDLE_ID`) plus `.ExpoWidgetsTarget`, and the App Group `group.<bundle ID>`. Register/provision both targets and that group with an Apple Developer Program team. The plugin deliberately disables remote push and frequent updates. Neither target receives an `aps-environment` entitlement.

The default (`GAIN_IOS_LIVE_ACTIVITY=0`, or unset) omits the extension and App Group, preserving the existing free Personal Team signing path. Apple Personal Teams cannot provision App Groups. Keep the environment consistent between prebuild, bundling, and native builds; switching it requires regenerating the native project. Android is unchanged.

## Lifecycle and limitations

- `src/logic/workoutActivityModel.ts` builds the props (all strings localised, Western digits, names cut to 32 characters, well under 1 KB).
- `src/logic/workoutLiveActivityController.ts` serialises native work, dedupes by content, recovers instances after relaunch, ends duplicates and leftover `GainRestActivity` cards from earlier builds, and contains every error. `sync(props | null)`, `stop()`, `reconcile(hasOpenSession)`.
- `src/native/workoutLiveActivity.ts` is the lazy gate (iOS 16.4+, `extra.restLiveActivityEnabled`, `ExpoWidgets` present); `workoutLiveActivityLayout.tsx` is the SwiftUI layout.
- `src/hooks/useWorkoutLiveActivity.ts` (called from useWorkoutSession) syncs with a 400 ms trailing debounce for typing and flushes at once on a new exercise or set, rest start/stop, pause/resume. Leaving the logger (collapse, swipe back) never ends the card: it calls `reconcile`, which ends it only when no workout is open. The rest block stays because the running rest persists (audit item 3). Finish and discard call `stop()`. App.tsx reconciles at boot and whenever the app becomes active.
- The build flag, plugin (`plugins/rest-live-activity-config.js`) and `extra.restLiveActivityEnabled` name are unchanged, so existing build scripts work.

Unsupported platforms, iOS below 16.4, disabled builds, missing native modules, disabled Live Activity permission, and native failures are silent best effort fallbacks. Live Activities require foreground app execution to start; iOS controls presentation and may dismiss them. Dynamic Island is available only on devices that have it.

The deadline is also passed as ActivityKit's `staleDate`. This marks an expired activity stale; it does **not** schedule automatic dismissal. When iOS suspends or terminates the app, the native countdown still reaches zero, but the card may remain until the app resumes and ends it, the user dismisses it, or iOS removes it. Exact background dismissal would require another execution mechanism; this implementation uses no push service or background polling. The local completion notification remains the completion alert.

## Manual device verification

Workout card (iPhone 15 Pro or later for the Dynamic Island, iOS 17+):
1. Start a workout and lock: badge, "Workout", a timer matching the in-app duration, the first exercise, "Set 1 of N", the target weight × reps.
2. Type a different weight and wait about half a second: the card shows it. Tick: the rest countdown appears in the same card and the line reads "Set 2 of N". At zero the countdown stops and the alert still fires.
3. Finish an exercise's last set: the card moves to the next exercise; everything ticked reads "All sets done".
4. Pause: the timer freezes and shows "Paused"; resume continues with no jump.
5. Collapse the logger or swipe back to Today: the card stays (with the rest). Reopen: no duplicate. Swipe the app away: the card stays; reopening keeps one card.
6. Finish or discard: the card disappears at once. A stale card (e.g. after a backup restore) goes when the app comes to the foreground.
7. Arabic device + Arabic GAIN, then English device + Arabic GAIN: Arabic labels, Western digits, no mirrored timer, nothing clipped. Light, dark and Always-On readable.
8. Live Activities off for GAIN in Settings, a free-ID build, and Android: everything works, no errors.

Older rest-only checks:

1. Install an opt-in native build on an iOS 16.4+ iPhone. Enable Live Activities in iOS Settings for GAIN. Log a set with a 60-second rest; verify the Lock Screen shows the exercise, rest label, progress and countdown. On a Dynamic Island device, check compact, minimal (alongside another activity), and expanded presentations.
2. Lock the device for at least 20 seconds. Verify native countdown agrees with the app's remaining time when reopened. Leave it locked past expiry; expect zero/stale presentation, then immediate removal when reopened.
3. Extend/shorten rest in the app and verify the deadline updates. Stop rest, log another set, finish/discard a workout, and switch workouts; verify no duplicate or abandoned card remains.
4. Relaunch during active rest; verify the existing card is reused or ended according to restored workout state. Disable Live Activities in Settings and repeat logging; the workout and local timer must still work.
5. Set both the device and GAIN to Arabic. Start a rest and check Lock Screen plus compact/expanded Dynamic Island: exercise/rest labels remain Arabic, while each separate countdown uses Western digits in `m:ss` order (for example `0:59`), without direction reversal. Only countdown Text uses the `en_US_POSIX` locale; surrounding labels retain the system locale and layout. Verify this on device because Expo UI does not expose a layout-direction modifier for these native views.
6. Install the default free-ID build and an Android build; verify ordinary rest logging/alerts continue without widget errors or new permissions.

Automated coverage checks lifecycle sequencing, recovery, deadline updates, duplicate suppression, unsupported platforms and error containment. Isolated `expo prebuild --platform ios --no-install` was verified for both modes: default main entitlements `{}` and no extension; opt-in App Group on both targets, `NSSupportsLiveActivities=true`, and no push entitlement. The opt-in iOS JavaScript export also succeeds. Actual device rendering and signing require the manual checks above.

References: [Expo SDK 57 Widgets](https://docs.expo.dev/versions/v57.0.0/sdk/widgets/), [Apple membership capabilities](https://developer.apple.com/support/compare-memberships/).
