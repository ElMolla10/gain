# Accessibility, RTL and dark-mode checklist (Step 14)

**Scope of this file: CODE-LEVEL QA ONLY.** What is below was checked by reading the palettes and the source, with automated tests (`apps/mobile/test/a11yQa.test.ts`). **Nothing here was verified with TalkBack, at 200% font size, in a real RTL layout, or on a dark phone.** Those passes are still open (section 3) and are the real Step 14 exit test.

## 1. Automated, enforced on every CI run
| Rule | How checked | Result |
| --- | --- | --- |
| Text contrast 4.5:1 (text, muted text, accent, error, warning, blue on bg/card/field/done-row), light and dark, both palettes | WCAG formula on the palette tables (`src/palettes.ts`) | pass after fixes |
| Outline contrast 3:1 for inputs and choice buttons (`edge` colour) | same | pass after fixes |
| No hard-coded colours in screens/components | source scan, `.tsx` | pass after fixes |
| Every `Pressable` has an accessibility role | source scan | pass after fix (menu scrim) |
| Every text input and switch has an accessibility label | source scan | pass |
| Every pressable with its own height is >= 48 dp (hit slop counted) | source scan | pass after fixes |
| No `left`/`right` styles (only start/end) so Arabic mirrors | source scan | pass (one reviewed exception: LTR figure alignment; chevron glyph borders) |
| No visible English typed into screens; no unlabelled literal labels | source scan | pass |
| Font scaling never disabled | source scan | pass |
| English/Arabic key parity and Arabic text in every string | `test/i18n.test.ts` | pass |

## 2. Real defects this found and fixed
- **Error text (#b00020) on the dark background was 2.6:1** (unreadable-ish); now a theme colour `danger` (light #b00020, dark #ff8a8a), 6.8:1+ in both.
- **White "Delete" label on the dark red swipe action was 2.8:1**; now `onDanger` (black on the lighter dark-mode red, 7.6:1).
- **Input and choice-button outlines were 1.3-1.5:1** (decorative grey); inputs, date fields, day cards and the warm-up cancel button now use `edge` (3.6:1+).
- **Warning outline on odd values** (#c77700) was a fixed colour; now theme `warn`.
- **Small touch targets**: set-type letter 34 dp, tick box 38 dp, rest +/- buttons 44, warm-up/restore links 36-40, finish and rest pills 40, rest-line toggle 32, row menu button 44. All now >= 48 dp (bigger boxes or hit slop). The in-row ones rely on hit slop, so the picture is the same but the touch area is bigger; **whether neighbouring rows' hit areas collide is not checked on a device**.
- Menu scrim pressable had no role.

## 3. NOT verified (needs a phone, most need Mohamed or an Arabic speaker)
- [ ] TalkBack: reading order of the workout screen, that "checkbox checked/unchecked" for the tick and the swipe-to-delete action are discoverable (swipe has a visible/labelled delete button, but TalkBack custom actions are not wired).
- [ ] 200% font size: workout row layout (the dense set row has fixed-width columns; titles use `numberOfLines={1}` and will truncate), Today and Settings.
- [ ] RTL in a real Arabic-locale session: icons that must flip (chevrons) and numbers kept LTR (`ltr` helper); forceRTL needs an app restart on first switch (the app tells the user).
- [ ] Dark mode on an OLED phone: the workout palette is pure black background by design.
- [ ] Colour-blind check: status is also carried by labels/ticks/letters (design rule), not simulated.
- [ ] Arabic copy review by a native speaker (Step 8, Mohamed).
- [ ] Touch-target feel of the dense set rows with real fingers.
- [ ] Haptics / rest-timer sound for users who cannot see the screen.
