# Training-day reminders (Step 10, optional part)

Status: **built and unit-tested (settings, scheduling plan, wording). NOT verified on a phone: whether the notification arrives on the chosen weekday and time, after a reboot, with battery savers, after the app is swiped away, in Arabic text on a lock screen.**

- Settings > "Training-day reminders". **Off by default.** The lifter picks the weekdays (Sunday to Saturday chips) and an hour/minute (minutes in steps of 5). Turning it on asks for the notification permission (Android 13+ prompt); if refused, the switch stays off and the screen says so.
- One repeating weekly local notification per chosen weekday (Expo `WEEKLY` trigger, ids `gain-reminder-0..6`, own Android channel "Training-day reminders", default importance). Nothing is sent from a server and nothing leaves the phone.
- GAIN's rotation is not tied to weekdays (the next day is the next in the programme), so the text does not name a workout: "Training day. Open GAIN to see today's workout." / Arabic draft. No streaks, no "you missed", no guilt wording (a test checks the strings in both languages).
- Changing days, time or on/off replaces all reminders at once. At app start, if the setting is on, the schedule is put back in step (and re-written in the current language). Changing language in Settings updates the text at the next app start.
- Skipped days are not tracked and nothing happens when the lifter does not train.

Code: `apps/mobile/src/logic/reminders.ts` (pure), `apps/mobile/src/notifications/reminders.ts` (Expo, device only), Settings card. Tests: `apps/mobile/test/reminders.test.ts`.

Not done: an exact-alarm or "keep GAIN unrestricted" tip for aggressive battery managers (needs a real phone to learn what each maker does); a per-day time; skipping the reminder when a workout is already logged today.
