# Design screenshots: WEB RENDER, NOT DEVICE TESTS

These PNGs are **not** from an Android device or emulator. They were drawn in headless Chromium by running the real app screens
(`apps/mobile/src`) through react-native-web, with the real repositories on SQLite/wasm and **fake, screenshot-only data**
(no real user data). Viewport 412x892 CSS px at 2x. Safe areas are fixed fake insets; "fs150" is 1.5x text emulated by scaling text sizes.
Not covered: native stack header, keyboard overlap, Android back, TalkBack, real font scaling, haptics, notifications, launcher/notification art.

File name: `<step>-<screen>-<theme>-<lang>[-fs150].png`

| Screen | Files |
| --- | --- |
| Onboarding (welcome) | `01a-onboarding-welcome-*` |
| Today (session-first) | `02a-today-*` |
| Workout logger (resumed workout, "Saved on this phone") | `03a-workout-*` |
| Finish summary | `04a-finish-*` |
| Plan | `05a-plan-*` |
| Progress (sessions) | `06a-progress-sessions-*` |
| Settings | `07a-settings-*` |

Variants per screen: `dark-en`, `light-en`, `dark-ar` (RTL), `light-ar` (RTL), `dark-en-fs150` (enlarged text).
The full set (161 images: more states, light/dark, EN/AR, 1.5x text) is a box artefact, not committed:
`/workspace/design/screens/web-render/`.
