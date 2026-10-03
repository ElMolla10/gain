# Crash log and diagnostics export (Step 18, v0.10.0)

Status: **built, unit-tested only, NOT run on a device. Wording needs legal review (DRAFT).** No third-party service is used, so decision D7 (crash/analytics tool) is not needed for this part.

## What it does
- **Crash log on the phone.** One small JSON file in the app's private document folder (`gain-diagnostics.json`). On by default, can be switched off and cleared in Settings > Diagnostics and crash log. It is never uploaded by the app: no account, no server, no SDK.
- **What is recorded:** when, kind (`crash` = fatal uncaught error or a screen that failed to draw, `error` = other uncaught or boot error, `warn`), where it was caught (`uncaught`, `render`, `boot`), the error name and a message cut to 300 characters, and up to 12 lines of the stack. Repeats of the same error in a row only count up. The newest 50 entries are kept. E-mail addresses, file paths and `file://`/`content://` URIs are scrubbed to their last part (best effort; the lifter reads the report before sharing).
- **What is never recorded:** sets, loads, reps, notes, exercise or programme names, goals, bodyweight, a device id, the advertising id, location. There are no breadcrumbs or analytics events.
- **Where entries come from:** React Native's global error hook (previous handler still runs afterwards, so app behaviour is unchanged), a root error boundary (a screen that throws while drawing shows a plain message and "Try again" instead of a blank screen), and a failure while opening the database at start-up.
- **Export is opt-in each time.** "Show me the report" displays the plain-text report (app version, Android version, language, database schema number, the entries). "Share the report" writes it to the cache folder as `gain-diagnostics-<date>.txt` and opens the Android share sheet; the lifter chooses the destination. Nothing happens automatically.

## Guarantees that are tested
`apps/mobile/test/diagnostics.test.ts`: entry trimming and redaction, repeat counting, 50-entry cap, damaged log file ignored, off switch honoured, the logger never throws (disk errors included), report contains no workout data and says so, global handler logs then delegates, no double install, and a source guard that the diagnostics code contains no network, analytics or crash-service references.

## Not done / unverified
- Never run on a phone: file write on a fatal crash (the write is synchronous so it should land before the process dies, unverified), error boundary look, share sheet.
- Native (Java/Kotlin) crashes and out-of-memory kills are NOT caught by a JavaScript handler. Android's own "vitals" are not available without Play. Only JS errors are logged.
- Unhandled promise rejections are not hooked (the app catches its own); to be revisited after device tests.
- No event analytics (Step 18's "few product numbers"): that part needs an opt-in consent screen and a tool/hosting decision (D7) and is left open. The privacy draft ([PRIVACY-POLICY-DRAFT.md](PRIVACY-POLICY-DRAFT.md)) says there is none.
