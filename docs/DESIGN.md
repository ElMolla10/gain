# GAIN visual design system (identity v1: electric lime + charcoal)

Status: implemented on branch `design/visual-identity` (PR "Visual redesign: GAIN identity"). **Not verified on a phone.** See
[Verification](#verification-what-was-and-was-not-checked) for exactly what was checked and how. This document supersedes the
mint-on-charcoal pass (D1-D6, v0.15.0): its palette, type sizes and several layouts are replaced.

Sources: `GAIN-Visual-Identity.md` (spec) and the identity kit (`gain-tokens.ts/json`, `CONTRAST.md`, SVG icons, IBM Plex fonts).
Written specs and token files win over the HTML brand board, whose numbers are illustrative. The kit's logo vectors are simplified
proposals, so the app logo stays the measured geometry from the original logo (see Brand assets).

## 1. Tokens

All values live in one place and nothing else defines colours, sizes or spacing.

| File | What |
| --- | --- |
| `src/design/tokens.ts` | The kit's tokens, verbatim (no React Native import, so tests can read it). |
| `src/palettes.ts` | `darkPalette`, `lightPalette`, and the logger's `LogPalette` (derived from the main palette). Pure data; unit-tested for contrast. |
| `src/theme.ts` | `space`, `radius`, `type` scale, `MIN_TOUCH` 48, `INPUT_HEIGHT` 48, `PRIMARY_HEIGHT` 52, `motion`, `usePalette()`, appearance (dark default, light, system). |
| `src/fonts.ts`, `src/useBrandFonts.ts` | Font family mapping (pure) and the offline loader. |

**Colour roles** (`Palette`): `bg`, `card`, `raised`, `text`, `muted`, `accent` (lime as text/icon on dark, dark olive `#3C5700` on light:
lime is never text on paper), `fill` (lime `#B7F51B` in both themes), `onFill` (ink, never white), `fillPressed`, `tint`, `border`
(decoration), `edge` (interactive boundary), `disabled/onDisabled`, `success/warn/danger` with `*Bg` tints, `onDanger`.

| Token | Dark | Light |
| --- | --- | --- |
| bg / card / raised | `#10120E` / `#1B1F17` / `#242A1F` | `#F5F6EF` / `#FFFFFF` / `#ECEFE2` |
| text / muted | `#F5F6EF` / `#B2B9A6` | `#171C12` / `#526047` |
| accent (text/icon) | `#B7F51B` | `#3C5700` |
| fill / onFill | `#B7F51B` / `#10120E` | `#B7F51B` / `#10120E` |
| edge | `#8A9580` | `#7A876E` |

**Type scale** (dp before user font scaling, which is always honoured; a test fails on any other `fontSize`): 13 caption, 14 label, 16 body
(Arabic 17), 20 section, 28 screen title, 36 load/target numbers, 48 display. IBM Plex Sans (Regular/SemiBold/Bold) and IBM Plex Sans
Arabic; numbers are tabular and always set left-to-right (`AppText ltr`). Arabic text is rendered one size step larger with taller lines
(`scaleFor`). **Spacing** 4/8/12/16/24/32/48, 16 gutters, 24 between sections. **Radius** input 8, button 12, card 16, sheet 24, pill.

**Fonts.** The six TTFs are in `apps/mobile/assets/fonts/` with `OFL-LICENSE.txt` (SIL OFL 1.1). They were taken from the
`@expo-google-fonts/ibm-plex-sans` and `...-arabic` npm packages (OFL) and copied in; the packages are not dependencies. They are
embedded natively by the `expo-font` config plugin in `app.json` and registered from the bundle by `useFonts`. Nothing is downloaded at
run time (a test checks this). Weights: the code base writes 400/500/600/700/800; `faceFor` maps them to Regular, SemiBold, Bold
(500 becomes Regular; 600 and 700 become SemiBold; 800 and `bold` become Bold).

## 2. Components (`src/ui.tsx`, `src/components/`)

Screens use these and nothing else; there is no per-screen styling system.

`Screen` (title, `tab`, sticky `footer`, safe areas, keyboard) - `AppText` (family, Arabic scaling, `ltr` numerals) - `Card` (tones) -
`SectionTitle` - `BigButton` (primary / secondary / quiet / danger, `hero`, `loading`, icon; labels wrap, never truncate) - `IconButton`
(48x48, `back` mirrors in RTL) - `Field` (focus and error states, numeric) - `Chip` - `Stepper` - `FilterPanel` (collapsed by default, active
count, clear) - `ListRow` / `ListCard` - `TargetStrip` (the lime-edged target block) - `InlineStatus`, `Notice` (info/success/warn/error,
icon + words + optional retry) - `EmptyState`, `LoadingState`, `ErrorState` (retry) - `Sheet` (bottom sheet: heading, explicit close,
Android back, safe area) - `SaveStatus` (see 4) - `Icon` (react-native-svg, kit paths for today/plan/progress/settings plus a few
additions: close, plus, minus, alert, phone, cloud, play, edit) - `SettingsRows` (`Group`, `LinkRow`, `SwitchRow`, `SelectRow`) -
`BootScreens` (loading, error with retry, migration blocked: fixed bilingual copy, drawn before the language setting exists).

## 3. Screens: what changed and why

- **Navigation.** Four tabs with SVG icons, always-visible labels (wrap, capped at 1.4x font scale so the bar stays usable), selected state = tinted pill behind the icon + bold label + accent colour (not colour alone), bottom safe area. The History tab is relabelled **Progress** (route name unchanged so saved
  navigation state and tests keep working). Tab screens draw their own title (`Screen tab title`).
- **Today.** One session card: a "Suggested today" label (words, no star; "In progress" when a workout is open, "Your choice today" for any other day), the day name, program - sets - minutes, the one lime Start / Resume hero button, then the starter-program note "Starter program · Edit it to match your routine." (below the button; shown while the active program is the built-in starter, `programme.is_sample = 1`). A compact quiet **Change workout** action opens `ChoiceSheet` (an accessible radio list in the shared `Sheet`, every day selectable, each row "name, badge, sets - minutes"). With a workout open, the button always resumes that workout ("Resume <day>" when another day is being looked at) and never plans or starts a second one (`sessionAction`). Below: the exercise list; the lead exercise (goal lift first, as before) is highlighted inside the list (tint, bar, "NEXT TARGET" caption, its target and a quiet **Why** action to the Why screen). There is no separate lead-target card. Weekly review and goal pace appear only when configured. Short-week is a quiet button.
- **Workout logger.** One compact header row (back, title, help, rest timer, Finish), then one save-status line outside the scroll. The status says, in priority order: save failed / saving / "N not saved yet. Tick to save." (typed-but-unticked or edited rows) / "Resumed your open workout" (only for 6 s) / "Saved on this phone at HH:MM" / "Nothing logged yet" (`saveStatusKind`). Stats row. Per exercise: name with the rest control (timer icon + length or Off, 48 dp) and options menu on the same row, one wrapping target line `Target 55 kg x 9  [Why]` (`TargetLine`; Why is a `QuietAction`: accent text, no frame, 48 dp touch area), then set rows with Set / Previous / load / reps / tick (all 48 dp). The first unticked set of an exercise is the current set: strong wash, accent bar at the start edge, outlined boxes and tick. Ticked rows keep only a quiet wash and borderless boxes; the done tick is a **muted green** (shared tokens `doneFill` / `doneEdge` / `onDone` in `palettes.ts`, both themes, contrast-tested) with a check mark and checkbox state `checked`, so "done" never relies on colour alone and lime stays reserved for the current unfinished row (accent bar, outlined boxes, accent-outlined tick) and primary actions (Finish, rest Start). Vertical rhythm: an exercise block starts `space.md` below the previous one; heading, target line and set table sit directly on each other (the 48 dp rest toggle, Why action and set controls already carry the breathing room) with `space.xs` above the column heads. At font scale above 1.3 a row becomes two lines with captions so numbers never shrink or clip. The rest timer is a docked bar (layout child, never covering inputs) with the countdown at 36 sp, -15 / +30 / Stop, `accessibilityRole="timer"`. Instructions live in the Help sheet. The 250 ms tick stays isolated in `RestClock`.
- **Finish.** Title + "saved on this phone", the counted-sets summary (an empty workout says so; no celebration), collapsed records,
  then one card per next target: the number large, a status line, **Accept** (primary) and **Edit weight** (secondary), a stepper editor, the
  jump-guard notice, and Why / Reject as quiet actions. **Done** is a sticky hero button.
- **Plan.** Program name, version, a lime **Edit program** button, compact day cards (header + one-line preview, expand for the full list), and a
  "Program details" group of secondary rows (exposure, versions, switch, new). Editing uses steppers, move/remove chips, `Sheet`/modal pickers. **Filters** (program templates, exercise picker, decision log) are a collapsed `FilterPanel` with an active-count badge and
  "Clear"; chips wrap instead of scrolling sideways.
- **Progress.** Sessions / Lifts toggle, `ListRow` sessions (day, date, minutes, sets), empty states that say what will appear and offer a
  next step. Lift trend: direction in words, latest set at 36 sp, bars (outlined = imported) with first/last date, the same data as a
  text list below (the chart has a spoken summary).
- **Settings.** Groups: Training, Display, Advanced (layout direction override, both-names switch), Data, About. Real switches (row is the
  target), segmented selectors for language / units / appearance with a check on the selected one.
- **Onboarding and supporting screens.** Welcome with logo; step bar with text "Step i of n" (`progressbar`); sticky Next / Back footer;
  **Set up my plan** is the primary action, "Just start logging" secondary, import quiet (order changed: before, skipping was primary).
  Date pickers are `Sheet`s. Import, Goals, Data, Sync, Privacy, Diagnostics, Decision log, Short week, Stopped suggestions, Why, Plans
  all use `Screen`, `Notice` / `InlineStatus` for errors (no glyph characters), `LoadingState`, `EmptyState`, and danger buttons for destructive steps.
- **Brand assets.** Launcher icon, adaptive foreground/background, monochrome layer, splash, notification icon (white mono, no groove) and
  in-app logo are regenerated by `tools/brand/build_brand.py` from the original logo's measured geometry (`assets/brand/gain-logo-original.jpg`; masters and `preview-icons.png` mask previews in `assets/brand/`),
  recoloured to flat lime `#B7F51B` on ink `#10120E`. Adaptive foreground is kept inside the 66 dp safe zone. The notification colour is lime.

## 4. Decisions

- **Two lime roles.** `fill` (lime, with ink text) for actions and selection; `accent` for text and icons (lime on dark, olive on light).
  Lime text on a light background fails contrast, so it never appears.
- **Saved locally vs synced.** SQLite is the source of truth: "Saved on this phone" is always true after a save. "Backup synced" is shown only
  when Back up and sync is on and the last sync succeeded (`SaveStatusLine` reads local sync bookkeeping, no network). Pending and failed
  are separate messages. The two are never one tick. Sync screen status uses the same words.
- **Status is never colour alone** (icon + words everywhere; `InlineStatus`, `Notice`).
- **No example data in production.** Empty states say what will show up. Harness numbers (below) exist only in the screenshot tool.
- **Progress rules and recommendations: untouched.** No AI, no change to targets. (Historical note: this release also stated "no billing"; the dormant Plans scaffold it mentions was removed on 2026-10-03 and GAIN is completely free.)
- **Bug found while rendering and fixed.** Today compared a program-slot id with a target's exercise id, so planned targets never showed
  next to exercises (also in v0.15.0). It now matches on `exerciseId`. No rule or number changed.
- **Workout screen:** the "Saved on this phone" line now shows when a resumed workout already has saved sets (before, it said "Nothing logged yet"). Unsaved rows and a failed save are now part of that line (the failure alert is still shown) instead of only an alert or a footnote.

## 5. Gaps and honest adaptations

- **Not device-tested.** No visual or touch behaviour has been seen on an Android phone or emulator (see Verification).
- **`edge` colour.** The kit's dark `border` (`#414A36`) is far below 3:1 against the card, so it is used for decoration only. Control boundaries use `edge`: `#8A9580` on dark (derived, not in the kit) and the kit's `lightBorder` `#7A876E` on light.
- **Light-theme status colours and all tints are derived** (the kit defines dark-theme status colours only). Contrast was computed and is asserted in tests (4.5:1 text on its tint).
- **Lime fill on a light background** has only about 1.2-1.3:1 against the page (non-text). The ink label (about 14:1 on lime) carries the control; there is no dark outline around the lime button on light.
- **Extra icons** beyond the kit's set were drawn in the same style.
- **Tab labels** cap at 1.4x font scale (bar height); body text is never capped.
- **Arabic copy** for new strings is a draft and flagged in-app; it needs native review.
- **Rest timer** is announced as a timer but not read out every second (that would be noise); the end of rest still uses the existing vibration / notification alert.
- **Charts** are plain bars with first/last date; no y-axis values, ranges or tooltips. The text list below carries exact numbers.
- **No exercise media** exists in the library, so none is shown. No haptics or sounds were added.
- **Layout direction override** moved under Advanced; "auto" follows the language.
- **Logo.** The kit's simplified lime logo proposals were not used; the original logo geometry is kept (the kit says its vectors are not exact traces).
- **Back-compat.** The old `accentText` palette field and the logger's `blue*` names are gone; the test suite was updated with them.
- **Historical (v0.15.0):** a hidden Plans preview screen was restyled but unreachable. It, its flags and the scaffold were removed on 2026-10-03; GAIN is completely free.

## 6. Verification: what was and was not checked

| Check | Result | Kind |
| --- | --- | --- |
| `tsc --noEmit` (all workspaces) | pass | code |
| Unit tests (engine 365, sync 19, mobile 700, server 90) | pass | code (Node) |
| `expo export --platform android` (Hermes bundle incl. fonts, SVG) | pass | code |
| Contrast tables, font/size/touch-size rules, RTL start/end rules, no hex outside theme | pass | code (static) |
| Screens rendered in Chromium (react-native-web, real app code and real repos on SQLite/wasm, fake screenshot-only data; dark/light, EN, AR RTL, 1.5x text) | see `docs/design-screens/` | **web render, NOT a device test** |
| Android emulator / phone: TalkBack, touch targets, keyboard overlap, Android back, safe areas, real font scaling, notification and launcher art | **not done** | blocked (see below) |

Web-render caveats: react-native-web draws the same components but is not Android. Safe areas are fixed fake insets (36 top, 24 bottom);
the font scale is emulated by multiplying text sizes; the keyboard, the native stack header, haptics, notifications, TalkBack and the
system back button do not exist there. The bundled fonts load through CSS `@font-face` there, not the native path.

**Native blocker.** This box has no hardware virtualisation for the `box` user (`/dev/kvm` is `root:103`), so an x86_64 Android emulator runs in
pure software; the earlier v0.4.0 attempt rendered three onboarding screens and then hit system ANR dialogs (see `DEVICE-TEST-0.4.md`).


## 7. Starter program (what the built-in sample actually is)
Checked in code (`db/seedData.ts`, `repos.seedIfNeeded`, `onboardingRepo`): on a first launch the app seeds a generic 4-day upper/lower **structure** (days, exercises, sets, rep ranges), a placeholder gym rack and the exercise library, all stored with `is_sample = 1`. It seeds **no sessions, no logged sets, no targets and no decisions**: the first targets for those exercises are empty ("no target yet") until the lifter logs a lift. So nothing in the seed is demo history or a demo weight, and it is safe to present as a starter program. Onboarding replaces it (`retireSample`) once the lifter sets up their own plan. Screenshots in `docs/design-screens/` use fabricated history, but only inside the web-render harness (a box artefact, never shipped in the app); `test/doneTickStarter.test.ts` pins that the shipped seed has none. The stored program name still reads "Upper/Lower (sample)" and the gym "Sample gym (placeholder...)" on installs that already seeded them; renaming stored rows would be a data change, so it was left alone. Arabic wording for the starter strings is a **draft** pending review.

## 8. System rules: RTL, numbers, numeric type, state contrast, spacing, mirroring

From the Next Set core-flow design audit (2026-10-18, §4 S-1 to S-7). These are binding for new UI. Items marked *(planned)* name
tokens or sizes that land with the Today, logger and Finish PRs; the rule applies from now on.

### S-1. RTL and `ltr`
- `AppText ltr` is only for strings with **no Arabic letters at all**: pure numbers, clock times, dates, Latin names, the brand.
  `AppText` enforces this: when the children contain an Arabic letter (`ltrAllowed()` in `src/fonts.ts`) it ignores `ltr`, keeps the
  language's direction and warns in development. `test/bidiText.test.ts` (source audit) and `test/workoutSetRow.test.ts` (rendered in
  Arabic) fail when an `ltr` run carries Arabic.
- Mixed strings use the language's direction. Isolate **only** the numeric sub-runs with `isolateLtr()`. Never `isolateLtr()` a string
  that already contains Arabic (that is what laid "55 كجم × 9" out as "كجم × 9 55").
- `translate()` isolates its parameters: pure numbers and Latin get an LTR isolate; a parameter that already contains Arabic (a
  formatted load) gets a first-strong isolate (`isolateParam()`), so it keeps its own order.
- Load format everywhere: `formatLoad()` (→ `55 kg` / `55 كجم`, number isolated) then ` × ` then the isolated reps. Use the helpers in
  `src/logic/bidiText.ts`: `loadTargetText`, `targetRowText`, `plannedScheme`, `previousCellText`.
- Ranges use an en dash U+2013 with no spaces, inside one isolate: `isolateLtr("3 × 6–10")`.
- Number–unit and `×` use **no-break spaces** (U+00A0, `NBSP` in `src/i18n/format.ts`), so a load never wraps away from its unit
  or its reps (`55 كجم × 9` stays on one line). U+00A0 is bidi class CS, so it does not change the reading order.
- `writingDirection` only has an effect on iOS in React Native. On Android only the isolates protect the order, which makes these rules
  essential there. **Verify on an Android device in Arabic.**
- For tabular figures without forcing a direction, set `fontVariant: ["tabular-nums"]` (or `TargetStrip isNumeric`) instead of `ltr`.

### S-2. Numerals
- Western digits 0–9 everywhere, Arabic UI included (they match plates, machine stacks and the renders). Do not localise to
  Eastern Arabic-Indic digits.
- `×` (U+00D7) for sets × reps and load × reps, never Latin `x`, with a space on both sides.
- Number inputs and live numbers use `tabular-nums` (*planned* for `CellInput`).

### S-3. Numeric type roles
| role | size/line | weight | where |
|---|---|---|---|
| `load-hero` | 36/42 (AR 36/48) | 600 | Finish lead target, live next-set, rest clock |
| `entry` | 20/26 (24/28 if a token is added) | 600 tabular | kg / reps inputs |
| `target` | 20/26 | 600 | Today rows, logger target line, durations |
| `ref` | 14/20 | 400 tabular | Previous; the set chip is 16/600 |
| `caption` | 13/18 | 400/600 | column heads and labels only, never a status that needs action |

Arabic line heights come from `scaleFor()` (`src/fonts.ts`); don't hard-code a Latin line height on text that can be Arabic.

### S-4. Colour and state contrast
Text tokens pass comfortably (text 17.3:1; muted 9.3:1 dark / 6.2:1 light; accent 14.4:1 / 7.6:1). State **surfaces** are the weak
point in glare (doneBg vs bg 1.17 / 1.04; tint vs bg 1.43 / 1.08; doneFill vs field 1.51 / 1.13; primary fill vs white 1.31).
Rule: any state the lifter must tell apart mid-set needs a **non-colour cue of at least 3:1**: solid vs hollow, a bar, an icon or a
weight change. Tokens: `doneSolid` #5E8F72 / #2F7A50 and `onDoneSolid` #10120E / #FFFFFF *(planned, logger PR)*; light `activeBg`
#DCEBB0 *(planned)*; `fillEdge` transparent / #5C8A00 *(planned, Today PR)*; ghost placeholders in `edge` *(planned)*.

### S-5. Tap targets and spacing
Every control is at least 48 dp (`MIN_TOUCH`). Between adjacent 48 dp targets on logger screens keep **at least 8 dp**. Stay on the
4 dp grid: no `gap: 6`, `paddingVertical: 2` or `gap: 2` stacks in new code.

### S-6. Fonts
Plex Sans Arabic is used when the language is Arabic or the text contains Arabic. With S-1 applied, numbers live in their own runs and
an `ltr` run never contains Arabic, so digits keep the same Plex Sans metrics on Arabic and English screens.

### S-7. Mirroring
Only directional arrows and disclosure chevrons mirror (`mirror` / `back` props). Media (play, pause), check, timer, pencil, why and the
brand mark never mirror. Start-edge bars use `borderStart*` / `start:` so they move to the right in Arabic; the current-set bar position
in RTL must be checked on iOS and Android (react-native-web draws it on the left).

## 9. System rules, rest of the app: dates, selection, light-mode state, destructive actions, one title

From the rest-of-app design audit (2026-10-18, §11 S-8 to S-12). Binding for new UI, like S-1 to S-7.

### S-8. Dates
- One formatter: `formatDay()` in `src/logic/dateText.ts`. EN "Wed 16 Sep", AR "الأربعاء 16 سبتمبر"; the year appears only when it
  isn't the current year. Digits are Western in both languages (S-2).
- No `toLocaleDateString("ar-EG", …)` anywhere: `ar-EG` prints Eastern Arabic-Indic digits. `rg '"ar-EG"' apps/mobile/src` should
  find nothing outside `dateText.ts`.
- ISO dates (`2026-09-16`) only in exports and file names, never in the UI.
- Hermes' Intl support differs by platform, so check dates on an iOS and an Android device in Arabic.

### S-9. Selection controls
- 2–5 short options → segmented `SelectRow`.
- Options that need a description → `RadioRow` inside a `RadioGroup`.
- Multi-select filters → `Chip` with a check; a single-select chip group uses `Chip radio`.
- Every single-select gets `radio` + `checked` semantics and a non-colour selected cue (a check, or a 2 dp `accent` border), so the
  choice reads in grayscale.
- Lime **fill** means "selected chip/segment" or "primary action", never both on the same row. No `BigButton selected` for choices.

### S-10. Light mode: lime is not a state colour
Lime #B7F51B on light surfaces is 1.12–1.31:1 (bone, white, raised), so a state drawn with lime fill alone (selected control, switch
track, progress segment, tab tint) disappears in sun. In light mode state boundaries use `accent` #3C5700 (7.6–8.2:1). Lime fill is
allowed only on a primary action with an ink label, which reads by its label (14.4:1). Extends S-4.

### S-11. Destructive actions: one ladder
- First tap: outlined `danger` (`BigButton variant="danger"`, or a `danger` text / trash icon).
- Final confirm: solid `danger` fill with an `onDanger` label (`variant="dangerSolid"`), with Cancel (secondary) at least 16 dp away.
- Never style a destructive action `quiet` (which renders in accent), and never make one a one-tap `Chip`.
- Anything that loses logged data keeps its confirm; the data-loss guards themselves are owned by their own PRs, not by styling work.

### S-12. One title per screen
A stack screen shows the native header title only (17/22 semibold on iOS, 20/26 on Android) and does not also pass `Screen title`;
tab roots keep `Screen title` and hide the native header. A long name (e.g. an exercise on Loads or the lift trend) goes in the body as
a 20/26 heading instead of a long header. `test/oneTitle.test.ts` lists the stack screens that must not render `Screen title`.
