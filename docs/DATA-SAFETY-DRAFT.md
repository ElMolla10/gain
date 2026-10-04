# Google Play "Data safety" form: draft answers built from the real data flows (Step 26)

Status: **DRAFT. Nothing submitted; no Play Console account exists.** Written 2026-10-03 from the code on `main` (v0.17.0), the built APK (`aapt2 dump permissions`), `packages/sync`, `apps/server` and the privacy draft. It replaces the shorter table in [PLAY-LISTING-DRAFT.md](PLAY-LISTING-DRAFT.md). Play's form wording, categories and rules change, and I could not open the Console: **re-check every line against the live form at submission**. Where Play's definition leaves me guessing I say "judgment call" and give the reason. Not legal advice; the privacy policy it must match is itself an unreviewed draft ([PRIVACY-POLICY-DRAFT.md](PRIVACY-POLICY-DRAFT.md)).

Rule of thumb used (Play's own wording, paraphrased): "collected" = data leaves the device to the developer or a third party; data processed only on the device, and data the user sends by hand through the share sheet, are not "collected"; a service provider that processes data on the developer's behalf (Cloudflare here) is covered by "collected" but is not "sharing"; optional features still have to be declared (marked "optional").

## 1. The data flows that exist in the code (the facts the answers rest on)
| # | Flow | Trigger | Leaves the phone? | Where in code |
| --- | --- | --- | --- | --- |
| F1 | All logging, programs, goals, targets, settings, crash log | always | **No.** SQLite + one JSON file in app-private storage | `src/db`, `src/diagnostics` |
| F2 | Update check, then APK download | lifter taps "Check for updates" (never automatic) | Yes: request to `api.github.com` / `github.com`; GitHub sees the IP address and user-agent, **no training data** | `src/components/UpdateCard.tsx`, `src/logic/updateCheck.ts` |
| F3 | Back up and sync | OFF by default; lifter turns it on | Yes, to `gain-sync.elmolla10.workers.dev` (Cloudflare Worker + D1, region ENAM): rows of the tables `setting` (only 14 allow-listed keys, incl. `height_cm`, `birth_date`, `bodyweight_kg`), `gym`, `gym_load`, `exercise`, `exercise_line`, `programme*`, `import_batch`, `import_mapping`, `session`, `session_exercise`, `workout_set`, `goal`, `bodyweight_entry`, `target`, `decision_log`, `rejection_memory`, `weekly_review`, `short_week`. Not synced: language, rest-timer settings, reminders, crash log, update-check state. Token and recovery code kept in the secure store | `src/sync`, `packages/sync`, `apps/server` |
| F4 | Coach link | lifter taps "Share as a link" and agrees on screen | Yes: ONE card (session name/day, exercises with loads and reps, next targets, pace line, not-a-doctor line; no bodyweight) stored on the same server for 7 days (max 30) behind a random link; anyone with the link can read it | `src/screens/FinishScreen.tsx`, `apps/server/src/coach.ts` |
| F5 | Exports, coach-card PDF, diagnostics report, feedback message | lifter taps; Android share sheet | Only where the lifter sends it. Not collection by the developer | Data/Finish/Diagnostics screens |
| F6 | Server-side | automatic while F3/F4 are used | Cloudflare sees the IP address and request metadata of each request; the Worker keeps per-IP and per-account rate-limit counters (windowed, deleted by the daily cron); sync account = random id + hashed recovery code + hashed device tokens | `apps/server` |
| F7 | Android's own backup | `allowBackup=true` (decision D11 open) | Android/Google may copy the app database to the user's Google account. That is the OS feature; the developer receives nothing. Play's form does not count it as the developer's collection, but the policy must say it | built manifest |
Not present (checked in `privacyFlows.test.ts` and the dependency list): analytics, advertising or attribution SDKs, crash-reporting services, location, contacts, camera, microphone, photos, accounts/sign-in with a third party, any AI or model service, purchases/billing.

## 2. Permissions in the built app (the Console and users both see these)
v0.16.0 and earlier (measured on the published APK): INTERNET, READ/WRITE_EXTERNAL_STORAGE (max SDK 32), REQUEST_INSTALL_PACKAGES, SYSTEM_ALERT_WINDOW, VIBRATE, RECEIVE_BOOT_COMPLETED, POST_NOTIFICATIONS, USE_BIOMETRIC, USE_FINGERPRINT, ACCESS_NETWORK_STATE, WAKE_LOCK, `com.google.android.c2dm.permission.RECEIVE`, plus ~20 launcher-badge permissions from the notifications library.
**v0.17.0 removes SYSTEM_ALERT_WINDOW, READ/WRITE_EXTERNAL_STORAGE, USE_BIOMETRIC and USE_FINGERPRINT** (`blockedPermissions` in `app.json`; nothing in the source uses them). The APK's list is recorded in section 6 after the release build. Open items:
- **REQUEST_INSTALL_PACKAGES** is there for the self-updater. Play does not allow a Play-distributed app to install APKs from elsewhere; a Play build needs the updater removed (a build flavour). This is the biggest blocker for any Play submission and needs Mohamed's decision.
- `c2dm.RECEIVE` (push-message receive) and the badge permissions come from `expo-notifications`; GAIN schedules local notifications only and registers no push token. They stay because removing library-declared receivers without a device to test on is more dangerous than a longer list. It looks odd in a permission list; it collects nothing.

## 3. Draft answers
### 3.1 Top-level questions
| Question | Draft answer | Why / caveat |
| --- | --- | --- |
| Does the app collect or share any of the required user data types? | **Yes** (only through the two optional features F3 and F4) | The form has no "only if the user turns it on" exemption; optional collection is declared as optional |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | HTTPS to Cloudflare (`https://` hard-coded in `transport.ts`; the test checks the one host). The update check also uses HTTPS |
| Do you provide a way for users to request that their data is deleted? | **Yes** | In app: "Delete my backup" (account and all rows on the server), "Delete everything" (phone, and the online copy first), "stop sharing" for a coach link. A web URL for deletion requests outside the app is **not available**: Play asks for one when the app has accounts; the account here is anonymous, but check what the form demands. Open |
| Data safety "committed to the Play Families policy" | Not applicable | Not designed for children; adults only (open: set the audience in the Console) |
| Independent security review (optional) | No | None done |

### 3.2 Data types (declare as collected, all OPTIONAL, none required to use the app)
| Play category > type | Collected? | Shared? | Purpose | Notes / judgment calls |
| --- | --- | --- | --- | --- |
| Health and fitness > **Fitness info** (exercise, sets, loads, reps, goals) | Yes, only if sync (F3) or coach link (F4) is used | No | App functionality | The core payload of F3/F4 |
| Health and fitness > **Health info** | Yes, if the lifter entered bodyweight (synced via F3; not in the coach link) | No | App functionality | Judgment call: Play's "Health info" means things like medical records and symptoms; bodyweight may fit "Fitness info" instead. Declaring the stricter one is the safer answer |
| Personal info > **Other info** (date of birth, height) | Yes, only if entered (`birth_date`, `height_cm` are synced via F3). The birthday is stored but used for nothing yet | No | App functionality | Unused data that is collected is a policy smell: consider not syncing `birth_date` until a feature uses it (not changed here) |
| Personal info > **User IDs** | Yes with F3/F4: a random account id and token hashes, no name/email/phone | No | App functionality; account management | Judgment call: the id is generated by GAIN, not the advertising id. Email sign-in is not available, so no email is collected |
| App activity > **Other user-generated content** (exercise notes, custom exercise names, program names) | Yes with F3 | No | App functionality | Free text is in the synced rows |
| App info and performance > Crash logs / Diagnostics | **No** | - | - | The log never leaves the phone unless the lifter shares it (F5) |
| Device or other IDs | **No** | - | - | No advertising id, Android id or IMEI is read. The IP address seen by GitHub/Cloudflare (F2, F6) is not a listed type; whether Play expects it declared under "Device or other IDs" or not at all is **unknown to me** — check the current help text |
| Location, Contacts, Photos/videos, Audio, Messages, Calendar, Financial info, Web browsing, Files and docs | No | - | - | Files: the lifter picks an import file with the system picker; its content is read on the phone and not uploaded (F1). The imported rows are synced later as ordinary workouts |

"Shared" is **No** for everything: Cloudflare acts as the developer's service provider (no own use of the data), and the coach link is a user-initiated publication the lifter confirms on screen. Judgment call: if Play reviewers treat the coach link as "sharing publicly", declare Fitness info as shared for that feature and keep the in-app consent text. Data collected by F2 (GitHub) is moot in a Play build because the updater must go (section 2).

### 3.3 Security practices block
| Item | Draft answer |
| --- | --- |
| Encryption in transit | Yes |
| Encryption at rest | Provider-level only (Cloudflare D1). **Not end-to-end**: say so in the policy; the form does not ask |
| Users can request deletion | Yes (see 3.1) |
| Data retention | Until the lifter deletes it; coach links expire in 7 days (max 30); devices unused for 400+ days are removed by the daily cron; D1 Time Travel keeps point-in-time history for 7 days (free plan) after a deletion (SYNC.md) — **mention this in the policy** |

## 4. Where the policy and the form must agree (checklist for the day of submission)
- [ ] Policy URL is public and is the reviewed text (open: nobody has reviewed it; no controller identity or contact)
- [ ] The policy lists the same data types as 3.2, the same retention as 3.3, the Time Travel 7 days, ENAM region, Cloudflare as processor, and Android backup (F7)
- [ ] The in-app Privacy and safety page says the same (its test `privacyFlows.test.ts` guards the code, not the legal wording)
- [ ] The updater is out of the Play build; `REQUEST_INSTALL_PACKAGES` is not in the Play manifest
- [ ] The store build has been re-measured with `aapt2 dump permissions` (section 6 is only for the sideload APK)
- [ ] The answer set was re-checked against any code that changed since this draft (new sync tables, new settings keys, analytics, billing, email sign-in, a model service each force a new review)

## 5. What I could not determine
Play's current wording and any new questions; whether bodyweight is "Health info" or "Fitness info"; whether IP addresses must be declared; whether Egyptian or EU law needs more than Play does; whether a deletion-request web page is required for an anonymous-account app; how Cloudflare/GitHub log IPs (their own policies apply).

## 6. Measured permissions of the v0.17.0 sideload APK
`aapt2 dump permissions` on `gain-v0.17.0-arm64.apk` (2026-10-03, built from a clean clone of `main` at 8aabc06): INTERNET, REQUEST_INSTALL_PACKAGES, VIBRATE, RECEIVE_BOOT_COMPLETED, POST_NOTIFICATIONS, ACCESS_NETWORK_STATE, WAKE_LOCK, `com.google.android.c2dm.permission.RECEIVE`, the app's own `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`, `com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE` (added by a library; GAIN does not read the install referrer), and about 20 launcher-badge permissions. Gone compared with v0.16.0: SYSTEM_ALERT_WINDOW, READ/WRITE_EXTERNAL_STORAGE, USE_BIOMETRIC, USE_FINGERPRINT. `allowBackup` is still true (D11). Whether the app still imports files and shares exports without the storage permissions is the open device check (NATIVE-CHECKLIST rows 22-23).
