# Rest timer on the iOS Lock Screen

The rest timer can present a local Live Activity on the Lock Screen and Dynamic Island. The native countdown uses SwiftUI's bounded timer interval, so it continues counting while JavaScript is suspended and stops at zero. Logging, the in-app rest clock, and local completion alerts remain independent of this optional presentation.

## Building

The implementation uses the official Expo SDK 57 `expo-widgets` and `@expo/ui` modules. Expo Go does not include the widget extension. Build a new native app with:

```sh
cd apps/mobile
GAIN_IOS_LIVE_ACTIVITY=1 npx expo run:ios
```

Use the same variable for prebuild/EAS builds. The extension uses the resolved iOS bundle ID (including `GAIN_IOS_BUNDLE_ID`) plus `.ExpoWidgetsTarget`, and the App Group `group.<bundle ID>`. Register/provision both targets and that group with an Apple Developer Program team. The plugin deliberately disables remote push and frequent updates. Neither target receives an `aps-environment` entitlement.

The default (`GAIN_IOS_LIVE_ACTIVITY=0`, or unset) omits the extension and App Group, preserving the existing free Personal Team signing path. Apple Personal Teams cannot provision App Groups. Keep the environment consistent between prebuild, bundling, and native builds; switching it requires regenerating the native project. Android is unchanged.

## Lifecycle and limitations

`src/native/restLiveActivity.ts` exposes `restLiveActivity.sync({ endsAt, durationMs, label, restLabel? })` and `stop()`. The workout rest hook calls this without awaiting it in the logging path. One controller serializes native work, recovers existing instances after relaunch, removes duplicates, updates deadline/label changes, and ends immediately on stop or elapsed rest. `restLabel` accepts localized text.

Unsupported platforms, iOS below 16.4, disabled builds, missing native modules, disabled Live Activity permission, and native failures are silent best effort fallbacks. Live Activities require foreground app execution to start; iOS controls presentation and may dismiss them. Dynamic Island is available only on devices that have it.

The deadline is also passed as ActivityKit's `staleDate`. This marks an expired activity stale; it does **not** schedule automatic dismissal. When iOS suspends or terminates the app, the native countdown still reaches zero, but the card may remain until the app resumes and ends it, the user dismisses it, or iOS removes it. Exact background dismissal would require another execution mechanism; this implementation uses no push service or background polling. The local completion notification remains the completion alert.

## Manual device verification

1. Install an opt-in native build on an iOS 16.4+ iPhone. Enable Live Activities in iOS Settings for GAIN. Log a set with a 60-second rest; verify the Lock Screen shows the exercise, rest label, progress and countdown. On a Dynamic Island device, check compact, minimal (alongside another activity), and expanded presentations.
2. Lock the device for at least 20 seconds. Verify native countdown agrees with the app's remaining time when reopened. Leave it locked past expiry; expect zero/stale presentation, then immediate removal when reopened.
3. Extend/shorten rest in the app and verify the deadline updates. Stop rest, log another set, finish/discard a workout, and switch workouts; verify no duplicate or abandoned card remains.
4. Relaunch during active rest; verify the existing card is reused or ended according to restored workout state. Disable Live Activities in Settings and repeat logging; the workout and local timer must still work.
5. Set both the device and GAIN to Arabic. Start a rest and check Lock Screen plus compact/expanded Dynamic Island: exercise/rest labels remain Arabic, while each separate countdown uses Western digits in `m:ss` order (for example `0:59`), without direction reversal. Only countdown Text uses the `en_US_POSIX` locale; surrounding labels retain the system locale and layout. Verify this on device because Expo UI does not expose a layout-direction modifier for these native views.
6. Install the default free-ID build and an Android build; verify ordinary rest logging/alerts continue without widget errors or new permissions.

Automated coverage checks lifecycle sequencing, recovery, deadline updates, duplicate suppression, unsupported platforms and error containment. Isolated `expo prebuild --platform ios --no-install` was verified for both modes: default main entitlements `{}` and no extension; opt-in App Group on both targets, `NSSupportsLiveActivities=true`, and no push entitlement. The opt-in iOS JavaScript export also succeeds. Actual device rendering and signing require the manual checks above.

References: [Expo SDK 57 Widgets](https://docs.expo.dev/versions/v57.0.0/sdk/widgets/), [Apple membership capabilities](https://developer.apple.com/support/compare-memberships/).
