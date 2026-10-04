# Account-deletion web page: spec (Step 26 / G4)

Status: **SPEC + a static informational page, drafts.** The page exists as [site/public/delete-account.html](site/public/delete-account.html) (English and Arabic). The self-service part described in section 4 is **not built**. Nothing was checked with Play Console (no account); the policy summary below is from Google's public help pages read on 2026-10-04 and **must be re-read at submission** because the wording changes.

## 1. Why it is needed
Google Play's User Data policy: if an app lets people create an account from within the app, it must give (a) an in-app way to delete the account and its data and (b) a **web link** where people can request deletion without reinstalling the app, entered in the Data safety form; deleting must remove the associated data (freezing is not enough); retention must be disclosed ([Understanding Google Play's app account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111), [User Data](https://support.google.com/googleplay/android-developer/answer/10144311)). The page must load, show the deletion path prominently, name the app/developer as in the listing, and may use a form, a link or a support email.

Does GAIN's optional sync account count? **Assume yes** (the app creates an anonymous account when the lifter turns on Back up and sync). Whether Play also expects the page when no account is ever created is not required by the text above; GAIN's page covers both cases anyway. **Unknown / decide at submission:** how reviewers treat an anonymous account with no personal identifiers.

## 2. What exists today
| Path | Where | Covers |
| --- | --- | --- |
| Settings > Back up and sync > "Turn off and delete my backup" | app, wired to `DELETE /v1/account` | Account, all synced rows, phones' tokens, coach links, on the server |
| Settings > Data > "Delete all my data" | app | Online copy first (if sync is on), then everything on the phone |
| Coach link stop / expiry (7 days default, 30 max) | app / server | The stored card |
| Informational web page | `delete-account.html` | Explains all of the above, what deletion does not reach (exports, Android backup, GitHub/Cloudflare logs), D1 point-in-time history up to 7 days |

## 3. The gap
A person who **lost the phone or uninstalled and kept the 20-character recovery code** can delete only by reinstalling the app and signing in. Google wants a way that does not need the app. The server cannot identify an account by an email or a name (accounts are anonymous: a random id, a hashed recovery code, hashed device tokens), so a plain "email us to delete" request cannot be matched to rows without the code.

## 4. Options (Mohamed decides; both need the support email, section 6)
**A. Manual, email-based (no code; usable now).** The page tells the person to write to the support address, from any email, saying they want their GAIN backup deleted, and the operator replies with a way to prove control of the account: the person sends the recovery code **through a channel the operator specifies** (a one-time secure note service or a private message, not a normal email thread), and the operator runs a documented, audited script that calls `POST /v1/auth/recover` then `DELETE /v1/account` and replies "done". Cost: a person on call, a reply-time promise (say 30 days at most; Play help gives no number and I could not find one), and the operator handles a credential (delete the message after use). This is a policy and staffing decision before it is a technical one.

**B. Self-service web form (small build; recommended before G4).** A static page + one tiny client script on the same site:
1. The person pastes their recovery code (a password-type field, `autocomplete=off`, never logged).
2. The page calls the existing `POST /v1/auth/recover {recoveryCode}` on the sync Worker to get a device token (this registers a new "phone" for the account; acceptable because the next call deletes the account).
3. It shows what will be deleted (counts from `GET /v1/me`), asks for a typed confirmation word, then calls `DELETE /v1/account`.
4. It shows "Deleted" and the 7-day point-in-time note; any error is shown plainly (wrong code, rate-limited: recover is 10/h per IP, server paused).
Requirements and risks the build must handle: (a) **CORS**: the Worker does not currently send CORS headers for a browser page on another origin; either add a narrow allow-list (only the site origin, only `/v1/auth/recover` and `DELETE /v1/account`) or serve the page from the Worker itself (a new static route, no CORS); (b) the site's current CSP `default-src 'none'` must be relaxed to allow `script-src 'self'` and `connect-src` the Worker origin only; (c) no third-party scripts, no analytics, no logging of the code; (d) rate limits already exist on recover; add a test that a wrong code leaks nothing; (e) while `KILL_SWITCH=1`, deletion also answers 503 (SYNC.md): the page must say so; (f) tests: Worker tests for the CORS allow-list and an end-to-end test (create account, delete via the page's two calls, rows gone); (g) the page and the app strings say the same thing as the privacy policy. This is **server + site code; it is not an app release** (no APK change), but it changes a deployed Worker, so it needs the usual care (`apps/server/scripts/smoke.mjs`).

**C. Email only, no account handling.** Not enough: the operator cannot find the account (section 3).

## 5. Retention statements the page must keep true
- Synced rows, the account, tokens and coach links are removed immediately by `DELETE /v1/account`.
- Cloudflare D1 Time Travel keeps point-in-time history for 7 days on the free plan (30 on paid; plan not confirmed): deleted data can exist there for that long. A restore to an earlier moment would bring a deleted account back; re-run the deletion if that ever happens (SYNC.md).
- Devices unused for 400+ days are removed by the daily cron (SYNC.md). Nothing documented removes the synced rows of an idle account, so rows stay until the account is deleted (**decision open**: whether idle accounts should expire automatically).
- Rate-limit counters (per IP / account) are windowed and removed by the daily cron.
- GitHub and Cloudflare keep their own logs under their own policies.

## 6. Support email placeholder
The page uses the placeholder `[support email not set yet]` (a `<span data-ph="support-email">`). Mohamed provides one address (a domain mailbox is better than a personal one; a free-tier forwarding alias is enough for the Play listing); it is filled in with `node docs/site/fill-contact.mjs --email ... --operator ... --contact ...` (see [site/README.md](site/README.md)). The same address goes in the Play Console listing, the Data safety form (deletion contact) and the in-app privacy page (`privacy.contact`, an app change, needed only when the policy is final).

## 7. Done means
The web link loads without error from a browser with no GAIN installed; shows the deletion path above the fold; names GAIN and the operator; offers a working request path for a person who has only the recovery code (A staffed or B built and tested); the privacy policy links to it; the Play Data safety form deletion URL points to it. Not done: B, the support email, the operator identity, any Play Console entry.
