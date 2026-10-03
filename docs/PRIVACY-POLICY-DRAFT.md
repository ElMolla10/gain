# GAIN privacy policy (DRAFT, NOT legally reviewed)

> **Status: draft for a lawyer or a reputable template service to review (decision D6). Do not publish it as final.** Placeholders in [square brackets] are open. Which laws apply to Egyptian users and to any EU users is **unknown** here; until a reviewer says otherwise the working standard is GDPR-style principles: collect little, ask consent where needed, let people export and delete.
>
> The in-app version is Settings > Privacy and safety (`strings.privacy.ts`, English and a DRAFT Arabic translation). `apps/mobile/test/privacyFlows.test.ts` fails if the code stops matching the statements below. Version of the app described: 0.17.0 (Android, sideloaded APK); sections 2 and 3 were last re-read against the code and the built APK on 2026-10-03.

## 1. Who is responsible
[Controller: person or company name], [postal address], contact: [email]. (Mohamed to decide; D6.)

## 2. What GAIN stores, and where
Everything is saved **on your phone**, in GAIN's private app storage (a SQLite database, plus the crash-log file in section 5). GAIN has no account, no server and no analytics or advertising service.

| Data | Why | Required? |
| --- | --- | --- |
| Workouts, sets (load, reps, effort), tags (warm-up, drop set, failure), exercise notes, programmes, gym load list | the product: logging and next-session targets | yes |
| Language, units, rest-timer, week-start and similar settings | the product | yes |
| Goal (lift, bodyweight or muscle) and weekly review decisions | pace and weekly decision | optional |
| Bodyweight entries, height, birthday | pace for a bodyweight goal; body-weight exercise loads. Health-adjacent, so optional. The birthday is stored but not used for anything yet. | optional |
| Imported Hevy/Strong files | you choose a file; its workouts are copied into the app's database; the file itself is not kept | optional |
| Safety copy before an update (`gain-before-update.json`, a full copy of your data in GAIN's private folder, written only when an update changes the database layout; replaced next time; removed by Delete everything) | restoring your data if an update goes wrong | on, not optional |
| Crash log (error names, short messages, trimmed stack, where) | fixing bugs. No workout data. | on by default, can be switched off |

GAIN does not request location, contacts, camera, photos, microphone, accounts or advertising identifiers. **Android permissions in the finished app** (checked with `aapt2 dump permissions` on the built APK; v0.16.0 and earlier carried extra ones that libraries add by default, removed in v0.17.0, see [DATA-SAFETY-DRAFT.md](DATA-SAFETY-DRAFT.md)): internet (update check, opt-in sync, coach links), installing the update APK it downloads (`REQUEST_INSTALL_PACKAGES`), vibration for the rest timer, wake lock / run at boot / notifications (the end-of-rest alert and, if you switch them on, training-day reminders: local notifications you schedule yourself, nothing is sent from a server), network state, and a push-message receive permission, an install-referrer permission and a set of launcher-badge permissions added by libraries (unused: GAIN registers no push token and reads no referrer). Earlier builds also listed overlay, shared-storage and biometric permissions that GAIN never used.

## 3. What can leave your phone, and when
Only through something you start:
1. **Check for updates** (Settings): the app asks GitHub (`api.github.com`, public, no token) for the list of releases, and, if you tap download, downloads the APK from `github.com`. GitHub can see your internet address, the request, and the app's user-agent, under GitHub's own privacy policy. No training data is sent.
2. **Exports and shares:** JSON backup, CSV, coach-card PDF and the diagnostics report are created on the phone and handed to Android's share sheet. You pick the destination (WhatsApp, e-mail, Drive...). GAIN does not send them and cannot see where they went.
3. **Android backup:** the app allows Android's own backup (decision D11 still open). If backup is on in your phone settings, Android/Google may keep a copy of the app data in your Google account. That is Android's feature; GAIN cannot see or control it. If we turn it off, the policy changes.

4. **Back up and sync (Settings, OFF by default; Step 21):** only if you turn it on. GAIN uploads your training data (sessions, sets, programmes, targets, goals, settings; not the crash log) to a GAIN server on Cloudflare (`gain-sync.elmolla10.workers.dev`, data location not chosen by GAIN) and keeps it until you delete it. It is not end-to-end encrypted. The account is anonymous: a random id and a recovery-code hash. Without the code the backup cannot be reached. Turning it off keeps the data on your phone; "Delete everything" deletes the online copy first. Cloudflare can see your internet address and request metadata under its own policy.
5. **Coach link (Finish screen):** only when you tap "Share as a link" and agree on screen. That ONE card (what you did, next targets, pace line; no bodyweight) is stored on the server and anyone with the link can read it without an account until it expires (7 days by default, 30 at most) or you stop sharing. The link text is random and only a hash of it is stored.

Nothing else. In particular: no analytics events, no crash upload, no advertising, no data selling, no model or AI service in this version.

## 4. Legal basis, retention, your rights
[To be written by the reviewer: legal basis/consent wording, retention, rights of access, correction, deletion, portability, complaint route; Egyptian data-protection law applicability; international transfer notes.] What the app already offers: **export everything** (Settings > Your data: JSON backup and CSV), **delete everything on the phone**, **edit or delete any set** in History, **switch off and clear the crash log**. Uninstalling the app removes its storage. Copies you shared and Android backups are outside GAIN's reach.

## 5. Crash log
See [DIAGNOSTICS.md](DIAGNOSTICS.md). Local file only; shared only if you tap Share.

## 6. Children
GAIN is not designed for children. [Reviewer to set the minimum age.]

## 7. Health and safety statement
GAIN is a training log and suggestion tool. It is not a doctor, a physiotherapist or a certified coach and gives no medical advice. Targets, pace and weekly decisions are suggestions based only on what you logged ([PROGRESSION-RULES.md](PROGRESSION-RULES.md) says exactly how). You decide what to lift. Pain, dizziness, injury or a medical condition: stop and ask a qualified professional. In the app: one-line note on the first onboarding screen, Today, Finish, Goals and Settings; full text on the privacy page; the coach-card PDF carries its own not-a-doctor line. Wording is a draft and not reviewed by a medical or legal professional.

## 8. Changes and contact
[How changes are announced.] Contact: [email].

## What changes this text (future steps)
Email sign-in (once a provider exists), a model layer (23), analytics (18, if ever), a Play listing (data-safety form, Step 26): each one adds data flows and **requires updating this policy and the in-app page first**.
