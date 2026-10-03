# Rest timer alert (Step 10, partial)

Status: compiles; unit-tested only for the settings and scheduling logic; NOT device-verified. Whether the alert arrives on time with the screen off, on any phone, is **unknown**.

## What exists
- Settings > Rest timer: default rest (60 / 90 / 120 / 180 / 240 s), vibrate on/off, "Alert when rest ends, even with the screen off" on/off.
- The alert is one local notification (expo-notifications, channel "Rest timer", high importance) scheduled for the exact end time when a rest starts, replaced when you add or remove 15 s, cancelled when you stop the rest, leave the logger, or switch the setting off.
- While GAIN is open the existing in-app buzz is used and the notification banner is suppressed.
- Turning the alert on asks for the notification permission (Android 13+ prompt). If it is refused the setting stays off and the screen says how to allow it.
- No new database migration: three rows in `setting` (`rest_seconds`, `rest_vibrate`, `rest_notify`).

## What is not done or not known
- Not a foreground service or ongoing notification with a live countdown; this is a single alert at zero.
- Delivery with the screen off, after the app is swiped away, and under Doze or OEM battery savers: **not tested**. Android may delay a normal notification; the settings screen tells the user to set GAIN to unrestricted battery use if it comes late. Exact-alarm permission (SCHEDULE_EXACT_ALARM) is not requested.
- No sound setting beyond the notification channel's default (change it in the phone's channel settings).
- Optional training-day reminders: not built.
- Two phone makers must be tried before this step can be called done (plan requirement).
- No custom dev build is needed (expo-notifications works in a prebuilt app); Expo Go cannot be used for it.

## Decision for the v0.10.0 batch
The foreground-service/lock-screen countdown and the training-day reminders were **not built**: the first needs a native-module spike and a real phone to know whether it works under battery savers; the second needs a decision (the rotation is not tied to weekdays, so which days and what time?) and a phone to test delivery. Neither can be judged from unit tests.
