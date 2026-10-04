# Play listing: screenshot shot-list, feature graphic brief, listing metadata (Step 26 / G4) (DRAFT)

Status: **DRAFT plan. No screenshot exists** (the build box cannot run a phone or an emulator; the first device pass is Mohamed's). Text drafts are in [PLAY-LISTING-DRAFT.md](PLAY-LISTING-DRAFT.md); this file is what to capture and what to enter. Play's size, count and policy rules change: **re-check them in the Console at upload** (the numbers below are the ones I know, not read from the live form).

## 1. Screenshots (real phone, from the signed Play/sideload build)
Rules to meet (verify live): 2 to 8 phone screenshots; PNG or JPEG; each side 320 to 3840 px; the longer side at most 2x the shorter; real screens of the shipped app, no misleading frames or claims.

**Capture setup (once):** a phone with the app installed and a **demo account that contains no personal data**: first run > "Set up my plan" > a pilot program (for example Upper / lower, 4 days) > import `fixtures/hevy-synthetic.csv` (invented sessions) > log one real-looking session so Finish shows next targets. Hide notifications; battery full; time 9:41-style clean status bar if the phone supports demo mode; system font size normal (also one shot at largest). Capture each set **four ways**: English light, English dark, Arabic (RTL) light, Arabic dark. Upload the English set to the English listing and the Arabic set to the Arabic (Egypt/ar) listing; keep dark first (it is the app's identity), light as a second set only if Play allows several.

| # | Screen | State to show | Caption EN (overlay or listing text; no result promise) | Caption AR (draft) | Claim it supports ([PLAY-LISTING-DRAFT.md](PLAY-LISTING-DRAFT.md) claim check) |
| --- | --- | --- | --- | --- | --- |
| 1 | Today | "Suggested today" card, one lime Start button, exercise list with the lead exercise's NEXT TARGET and Why | Know what to lift today | اعرف هترفع إيه النهارده | next session written at the door |
| 2 | Logger | A set row with Previous, load, reps, ticks done (green check), docked rest timer | Log sets in seconds, even offline | سجّل مجموعاتك في ثواني حتى من غير نت | logger, offline |
| 3 | Finish | Summary and one target card: large number, Accept / Edit weight / Reject | Your next weight, before you leave | وزنك الجاي قبل ما تمشي | targets written at finish |
| 4 | Why | The reason sentence plus "What you did (observed)" lines | See why, with the numbers behind it | شوف السبب والأرقام اللي وراه | why this weight / decision log |
| 5 | Goals / pace | Goal pace line ("on pace / behind / ahead" with inputs) | Is your goal on pace? An estimate from your own logs | هدفك ماشي في معاده؟ تقدير من سجلاتك | goal pace (estimate) |
| 6 | Plan | Program with day cards, or the template picker | Pick a program or build your own | اختار برنامج أو ابني برنامجك | programs/templates (draft, unreviewed label stays visible) |
| 7 | Progress | A lift trend with the direction in words | Your history, lift by lift | تاريخك، تمرين بتمرين | history and trends |
| 8 | Your data | Export / restore / delete screen | Your data stays on your phone. Export or delete any time | بياناتك على موبايلك. صدّر أو امسح في أي وقت | export / delete / local-only |

Don't shoot: the Settings update card (not in the Play build), the Back up and sync screen with a recovery code, the Diagnostics report, anything with a real name, birthday or bodyweight. Don't add medals, "results", before/after bodies, or the words *guaranteed*, *best*, *#1*.

**Done means:** 2 to 8 real captures per language, each checked against the claim it supports and against Play's current screenshot rules, from a build whose behaviour was verified on that phone. Until then the listing is not submittable.

## 2. Feature graphic (1024 x 500)
Drafts exist: [play-assets/](play-assets/README.md). Brief: charcoal `#10120E` background, lime `#B7F51B` accent, IBM Plex Sans / Plex Sans Arabic bold, the app tagline "Your next weight. Ready.", the logo, nothing else; no screenshots inside (they would go stale and are unverified), no price or rating claims. Keep key content inside the central safe area (Play crops on some surfaces). Arabic variant is mirrored. **Open:** a designer's pass if Mohamed wants one; a native read of the Arabic line.

## 3. Listing metadata to enter (all proposals; names and country scope are Mohamed's)
| Field | Proposal | Note |
| --- | --- | --- |
| App name | `GAIN: Next Weight, Lifting Log` (30 characters, the limit) | Trademark search unknown; avoid promotional words in the title |
| Short description (80) | `Log your lifts. Leave knowing the next weight and if your goal is on pace.` (74) | Arabic variant in PLAY-LISTING-DRAFT.md (53) |
| Full description (4000) | In PLAY-LISTING-DRAFT.md; checked 2026-10-04: English 1,923 characters, Arabic 1,446 | Contains the "completely free" statement, which `free.test.ts` guards |
| App category | Health & Fitness | Play may ask for a Health apps declaration for this category: **check at submission** |
| Tags | Fitness / workout log / weightlifting (pick from Play's list) | |
| Free / paid | Free, no in-app purchases, no ads | Permanent: a free app cannot become paid later |
| Contact email | `[support email: Mohamed]` (same address as the site: [site/README.md](site/README.md)) | Required; public |
| Contact website | The hosted site (privacy page) once a final home exists; the draft is on `https://gain-site.elmolla10.workers.dev` | |
| Privacy policy URL | `.../privacy` of the same site, after legal review | **Must not be the draft when submitted** |
| Account deletion URL | `.../delete-account` | Needs the request path in [ACCOUNT-DELETION-SPEC.md](ACCOUNT-DELETION-SPEC.md) |
| Target audience | 18+ (adults); not for children | GAIN's policy text says so |
| Content rating (IARC) | Draft answers: no violence, no sexual content, no profanity, no gambling, no user-to-user chat or content sharing in app (a coach link is a one-way card), no location, no purchases; health claims: none | The questionnaire needs a Console account; answer honestly at the time |
| Ads | No | |
| App access | All functionality available without login | Sync account is optional |
| Data safety | [DATA-SAFETY-DRAFT.md](DATA-SAFETY-DRAFT.md); re-measure the **Play** manifest first ([PLAY-BUILD.md](PLAY-BUILD.md) section 4) | |
| Countries | Egypt first, others later | Mohamed |
| Languages | English (default) + Arabic | Listing translation reviewed by a native reader |
| Name of the developer | Mohamed's choice: person or organisation | Affects identity checks and the policy's controller line |

## 4. Wording risks to settle before submission
- **Hevy / Strong in the description** ("Import your history from Hevy or Strong"): naming other products is a nominative, compatibility use, but Play's metadata policy forbids implying affiliation or endorsement, and trademark owners can object. Safer wording: "Import your workouts from a CSV file exported by other logging apps". Mohamed's call; the drafts keep the names for now.
- **"Why this weight / decision log", "goal on pace"**: claims are about transparency of a rule, not about results. Keep "estimate" and "suggestion". Trainer review of the rules (Step 16) is still blank; no public coaching claim is cleared.
- **Arabic copy** is a builder's draft; do not publish it without a native read.
- **"Holds and carries"** (v0.13.0) and other features that have never run on a phone: a listing claim is only as true as the phone test (G1 covers v0.18.0, reported by Mohamed, not independently verified).
