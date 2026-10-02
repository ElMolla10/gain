# Coach card (Step 13, local first)

Status: **unit-tested only, NOT device-verified.** The card has never been rendered or shared on a phone.

## What it is
On the Finish screen, "Share coach card (PDF)" makes one page and opens the system share sheet (WhatsApp, email, Files). No account, no server, nothing leaves the phone until the lifter picks an app.

## What is on it (my default, Mohamed to confirm)
1. Title, session date.
2. **What I did:** per exercise, working-set count, top set, record lines (only when there is earlier history on that same line; a first time says "no record is claimed"), and how many warm-ups / unconfirmed sets were not counted.
3. **Next targets** for the next day: load x reps, status (proposed / accepted / edited / rejected) and the same reason sentence the app shows.
4. **Goal pace:** the app's one-line pace, only for lift and muscle goals. A bodyweight goal or no goal shows no pace block. **Bodyweight never appears on the card** (tested in English and Arabic).
5. Footer: shared by the lifter; GAIN is not a doctor or a coach; not medical advice; targets are suggestions.

## How
- `logic/coachCard.ts`: `buildCardModel` (strings, units, names), `cardHtml` (self-contained HTML, escaped, `lang` and `dir` set from the card language, no scripts, images or links), `cardPaceLine`.
- `expo-print` turns the HTML into a PDF in the cache folder; `expo-sharing` shares it (`application/pdf`). Both are Expo modules; the release build compiles on the box.
- Language and unit follow the app setting at the time of sharing.

## Not verified / known limits
- PDF rendering on a real phone, Arabic shaping and right-to-left layout in the PDF, the font used for Arabic, page fit on small and large phones, the share sheet itself. The plan's "done means" (renders correctly in RTL and LTR on two screen sizes) is **not met until a phone check**.
- An image (PNG) card was not built: it needs a screenshot module. PDF was chosen because the plan allows image or PDF and `expo-print` renders HTML with proper bidi text.
- The Arabic strings on the card are drafts.
- Private links for coaches come with Step 22, not here.
