# Native checklist for v0.18.0 (v0.16.0 look + feedback share + fewer permissions + completely free)

**Nothing below has been run on an Android device or emulator.** The box has no usable hardware acceleration (`/dev/kvm` is root-only, `emulator -accel-check` fails for the box user, and the earlier software-emulated x86_64 run needed ~20-25 min to boot and then hit repeated ANRs; see DEVICE-TEST-0.4.md). Every row is NOT TESTED until you fill it in. Browser renders do not count.

Install the signed arm64 APK from the v0.18.0 release over v0.17.0 (Settings > Check for updates, or sideload). Phone: ______  Android: ______  Date: ______

| # | Check | How | Result |
|---|---|---|---|
| 1 | Update over v0.16.0 keeps history | Install over the old app; History/Progress still list old sessions | NOT TESTED |
| 2 | Weights/reps entry, keyboard open | Tap a weight box on the 3rd set of an exercise with the keyboard up: the row you type in is still visible, not hidden under the keyboard | NOT TESTED |
| 3 | Done tick is muted green, not lime | Tick a set: green box + check. Untick: back to the empty outlined box. The current (first unticked) set keeps the lime accent bar/outline | NOT TESTED |
| 4 | Complete / undo sets | Tick, untick, tick again; counts and "Saved on this phone" line are right | NOT TESTED |
| 5 | Add / delete sets | "Add set", swipe a row to Delete, confirm | NOT TESTED |
| 6 | Finish workout | Finish, summary shows the sets you logged, next targets appear | NOT TESTED |
| 7 | Rest timer: foreground | Tick a set; timer starts, +30/-15/Stop work | NOT TESTED |
| 8 | Rest timer: background + screen lock | Start timer, press Home / lock for >1 min; on return the countdown is correct; notification/alert fires if enabled | NOT TESTED |
| 9 | Background + resume | Leave mid-workout for a few minutes, reopen: same workout, nothing lost | NOT TESTED |
| 10 | Force-stop + reopen mid-workout | Log 2 sets, force-stop from Settings > Apps, reopen: Resume shows exactly 2 sets (none lost, none duplicated) | NOT TESTED |
| 11 | Large system text | Settings > Display > Font size largest (and Display size large): set rows stack in two lines, nothing clipped, Target line wraps, tick still tappable | NOT TESTED |
| 12 | TalkBack | Swipe through a set row: "<exercise>, set N" labels; tick says "checked" when done; "Undo/Tick" announced; Why and Change workout reachable | NOT TESTED |
| 13 | Arabic RTL | Switch to Arabic: layout mirrored, numbers stay LTR, starter note reads sensibly (draft Arabic) | NOT TESTED |
| 14 | kg / lb entry | Switch units, enter 62.5 / 135, previous/target show in the chosen unit, nothing changes the stored kg | NOT TESTED |
| 15 | Light / dark | Both themes: done tick readable, lime used only for current row + primary buttons | NOT TESTED |
| 16 | Native fonts | IBM Plex Sans / Plex Sans Arabic load (no fallback to Roboto look) | NOT TESTED |
| 17 | Navigation | Tabs, Today > Workout > back, Change workout sheet, Android back closes the sheet | NOT TESTED |
| 18 | Safe areas | Status bar/notch and gesture bar do not overlap the header, Finish, or the rest dock | NOT TESTED |
| 19 | Today starter note | Fresh install (or before onboarding): "Starter programme · Edit it to match your routine." under Start; no fake history or weights | NOT TESTED |
| 20 | Logger spacing | Heading, Target line, set table are close but readable; "Target 55 kg × 9 · Why" still compact | NOT TESTED |
| 21 | Send feedback (new in v0.17.0) | Settings > Diagnostics > Send feedback: the share sheet opens with a short message (3 questions + app version, Android, language, crash-note count). Edit it, send it to yourself: it holds no sets/weights/names | NOT TESTED |
| 22 | Import still works with fewer permissions (new) | Settings > Your data / Import: the system file picker opens and a Hevy CSV and a GAIN JSON backup are read. v0.17.0 removed the legacy storage permissions, so this is the row that would break | NOT TESTED |
| 23 | Export/share still works (new) | JSON backup, CSV, coach-card PDF and diagnostics report open the share sheet and the receiving app can read the file | NOT TESTED |
| 24 | Notifications still work (new check) | Rest alert and a training-day reminder arrive (permission prompt on Android 13+) | NOT TESTED |
| 25 | Permissions page (new) | Android Settings > Apps > GAIN > Permissions shows only Notifications (and no files/media, overlay or biometric entry) | NOT TESTED |
| 26 | Completely free (new in v0.18.0) | Settings has no plan, upgrade, subscription or purchase entry; nothing in the app asks for payment; every screen opens | NOT TESTED |

Report anything marked FAIL as an issue with a screenshot.
