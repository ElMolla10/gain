# Design screenshots: WEB RENDER, NOT DEVICE TESTS

These PNGs are **not** from an Android device or emulator. They were drawn in headless Chromium by running the real app screens
(`apps/mobile/src`) through react-native-web, with the real repositories on SQLite/wasm and **fake, screenshot-only data**
(no real user data). Viewport 412x892 CSS px at 2x. Safe areas are fixed fake insets; "fs150" is 1.5x text emulated by scaling text sizes.
Not covered: native stack header, keyboard overlap, Android back, TalkBack, real font scaling, haptics, notifications, launcher/notification art.

File name: `<step>-<screen>-<theme>-<lang>[-fs150].png`

| Screen | Files |
| --- | --- |
| Onboarding (welcome) | `01a-onboarding-welcome-*` |
| Today (suggested session, lead target highlighted in the list) | `02a-today-*` |
| Today: the "Change workout" picker open | `02d-today-change-*` |
| Workout logger (just resumed: temporary "Resumed" note in the status line) | `03a-workout-*` |
| Workout logger, a few seconds later (note gone: "Saved on this phone") | `03b-workout-note-gone-*` |
| Workout logger with a typed-but-unticked set ("1 not saved yet") | `03c-workout-unsaved-*` |
| Finish summary | `04a-finish-*` |
| Plan | `05a-plan-*` |
| Progress (sessions) | `06a-progress-sessions-*` |
| Settings | `07a-settings-*` |

Variants for Today and the logger: `dark-en`, `light-en`, `dark-ar` (RTL), `light-ar` (RTL), plus enlarged text `dark-en-fs150`, `dark-ar-fs150`, `light-en-fs150`.
The other screens keep the earlier five variants (`dark-en`, `light-en`, `dark-ar`, `light-ar`, `dark-en-fs150`). Picker, "note gone" and "unsaved" are shown in a subset (see the file names).
Large text ("fs150") is the harness multiplying text sizes by 1.5 and feeding `fontScale` 1.5 to the layout code; it is not Android's real system font scaling.
The full set (more states, light/dark, EN/AR, 1.5x text; the Today/logger images are regenerated for this revision) is a box artefact, not committed:
`/workspace/design/screens/web-render/`.

## Revision for this round (done tick, spacing, starter note)
Today and logger screenshots (`02a`, `02d`, `03a`, `03b`, `03c`) were regenerated: completed sets now show a **muted green** tick (not lime), spacing between exercise heading, target line and set table is tighter, and Today shows "Starter program · Edit it to match your routine." (Arabic is a draft). Still **web renders on fabricated screenshot-only data, not device tests**.
