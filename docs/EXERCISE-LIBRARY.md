# Exercise library (v0.12.0)

Status: **built and unit-tested; never opened on a phone.** Every Arabic name and alias is a DRAFT (see [ARABIC-REVIEW-SHEET.md](ARABIC-REVIEW-SHEET.md)). English names follow Hevy's "Name (Equipment)" style but were **not checked against Hevy's app or list** (see "What is not verified").

## What ships
- **607 exercises**: 50 that shipped before v0.12.0 (20 sample-program exercises + 30 draft library rows, names unchanged) plus **557 new rows**. Counts are asserted by `apps/mobile/test/library.test.ts` (>= 500 total, >= 450 added by the library lists).
- Spread by picker group (primary muscle): chest 55, back 75 (lats, upper back, lower back), shoulders 71 (front, side, rear delts), biceps 36, triceps 42, forearms 25, quads 72, hamstrings 39, glutes 31, calves 15, core 68 (abs, obliques), traps 11, neck 8, hips 19 (adductors, abductors, hip flexors), full body 40. A test requires every group >= 8 rows.
- Spread by gear: barbell 100, dumbbell 102, cable 86, machine 65, plate-loaded 38, Smith 24, kettlebell 25, band 30, EZ bar 5, trap bar 6, bodyweight 110, suspension 10, assisted 6 (test: every gear >= 5).
- Setups: 481 free, 120 bodyweight + added, 6 assisted. Ceiling classes: 406 upper (10), 191 leg (12), 10 lateral raise (15).
- Source files: `apps/mobile/src/db/library/{upper,arms,lower,core}.ts` (data), `types.ts` (muscle/gear model, builder), `existing.ts` (metadata for the 50 older rows), `libraryDraft.ts` (assembles the list, `LIBRARY_VERSION = 2`).

## Per-exercise fields
| Field | Where | Notes |
|---|---|---|
| English name | `exercise.name_en` | Hevy style, e.g. `Bench Press (Barbell)`, `Lat Pulldown (Cable)`; the 50 older rows keep their old names |
| Equipment type | `exercise.equipment` | the engine's six types: dumbbell, barbell, plate, cable, machine, assisted |
| Setup type | `exercise.setup` | `free`, `assisted`, `bodyweight_plus_added` |
| Movement pattern | `exercise.pattern` | the app's 15 patterns; abs, traps, forearms, neck, glute-isolation and hip work use `other` on purpose (the weekly-sets arithmetic does not credit them to a muscle group it cannot justify) |
| Arabic name + aliases | `name_ar`, `aliases_ar_json` | DRAFT |
| Primary muscle, gear, ceiling class | **shipped catalogue only** (`CATALOG`, looked up by `seed_key`) | not stored in SQLite: no migration, and nothing new for sync. The picker's muscle/gear filters read it. A lifter's own exercise has no catalogue entry and is filtered by its equipment and pattern |

**Engine equipment per gear** (a decision, not a fact about gyms): kettlebell -> dumbbell (fixed steps); band -> cable (bands have no kg scale, so the lifter's own number is used); Smith and plate-loaded -> machine; EZ and trap bar -> barbell; bodyweight and suspension -> plate with `bodyweight_plus_added`; assisted machine -> assisted. The picker still shows the true gear (Smith, band, kettlebell...).

## Rep ceilings
The default ceiling (10 upper body, 12 legs, 15 lateral raises) comes from the engine's name classifier (`classifyLift`). Each row stores its class (`upper` / `lower` / `lateral_raise`) and a test fails if it disagrees with the classifier or with `ceilingForName`. Every "lateral raise" / "side raise" variant is 15; reverse/rear/bent variants are not. v0.12.0 taught the classifier more leg-region names (back extension, sled, jumps, tibialis raise, glute band work, hip flexor, thruster, rack pull). **Olympic lifts and full-body moves have a ceiling only because the app needs one**; whether 10 or 12 suits them is not decided.

## How it reaches a phone
`topUpLibrary()` runs once per `LIBRARY_VERSION` (now 2) and inserts only the `seed_key`s the phone does not have in any state (live, edited or deleted). It never updates, renames, resurrects or deletes a row; custom exercises have no `seed_key` and are never touched. Tests cover a v1 phone with an edited row, a deleted row and a custom exercise.

## Import matching
Hevy and Strong titles resolve to library rows (`matchLibrary` in the engine): exact name first, then same words + stated equipment, Smith lines kept apart from machine lines, equipment words in plain titles ("Dumbbell Row"), and variant brackets ("Deadlift (Trap Bar)"). Every title in `fixtures/hevy-export.csv` (55) and the synthetic Hevy/Strong fixtures resolves to exactly one library row; the import preview of the real export proposes **zero** new exercises (tested). A movement the app already shipped under a different name is not added a second time (tested), but where the older name differs in words (e.g. `Barbell Back Squat` vs Hevy's `Squat (Barbell)`) both rows exist.

## Picker
Search by English name, Arabic name or alias (all words must match, Arabic letter forms unified), filter by muscle group and by gear, results ranked and capped (50 shown, "Show more"). The searchable text is built once per list, not per keystroke.

## Sources and licences
Names and metadata only. No descriptions, cues, images or video were copied from anyone.
| Source | What it is | Licence | How it was used |
|---|---|---|---|
| free-exercise-db (github.com/yuhonas/free-exercise-db) | 876 exercises, JSON | The Unlicense (public domain), per its README | Fetched 2026-10-03; **coverage cross-check only** (which common movements my list lacked), then I added the ones that were missing. No rows imported. |
| wger exercise database (wger.de API, `exerciseinfo`, English) | 916 English entries | Per entry: CC-BY-SA 4.0 (763), CC-BY-SA 3.0 (132), CC0 (21) | Fetched 2026-10-03; **coverage cross-check only**. None of its text, descriptions, images or rows were copied, so no share-alike material is in this repo. |
| Mohamed's Hevy export (`fixtures/hevy-export.csv`) and the synthetic Hevy/Strong fixtures | his own history | his | Every title is a library row (kept as written, including his custom titles like `Low machine shrug`). |
| My own list | movement names as commonly used in gyms, written in Hevy's style | n/a | Everything else. Plain movement names are not creative works, but I am not a lawyer; if a licence concern is raised, remove the row. |

## What is not verified
- **Hevy's own list**: its exercise library is not public (the API needs a key), so "matches Hevy naming" means the style in Mohamed's export and my knowledge of it. Some names (for example `Chest Press (Plate Loaded)`, `Seated Row (Plate Loaded)`, `Cable Crossover`) may differ from Hevy's exact title; such an import falls back to "pick one" and never creates a wrong match.
- **Strong's names** were checked only against the synthetic fixture. The Strong evidence is synthetic (P26): no real Strong export has been tested, so the Strong import is unverified on real data.
- **All Arabic** (names, aliases, gear words such as "ماكينة بالأطباق" for plate-loaded and "(TRX)"): drafted by me, not slang I have heard; not reviewed by a native Egyptian lifter. Rows 51+ of the review sheet were added after Mohamed's reported review and are unreviewed.
- **Muscle assignments** are one primary muscle per row, a judgement call for compound lifts (a Smith squat is "quads"; a dip is "chest" or "triceps" by variant).
- **Time-based moves** (plank, dead hang, wall sit, farmers walk) are in the list, but GAIN's logger records reps and load; how they should be logged was not decided.
- **Band exercises** use the cable load model (no kg scale); sensible only if the lifter types a number they understand.
- **Performance**: tested in Node (top-up of ~560 rows, filter in milliseconds). Not timed on a phone.

## Same movement under two names (v0.13)

A few movements were shipped twice: once under an older GAIN name and once under the Hevy-style name (for example "Conventional Deadlift" and "Deadlift (Barbell)"). The pairs are listed in `apps/mobile/src/db/library/equivalents.ts` (9 pairs; identical movement, gear, muscle and setup only. Variants such as single-arm, incline, rope or lying stay separate).

**Nothing is merged, renamed or deleted.** Phones keep both rows and all history on either. The only effect: when a file import's title matches a row that has no use on this phone (no logged sets, no gym line, no program slot) and its twin does, the import suggests the twin that is in use, so one lift does not split into two histories. The lifter can still pick another exercise on the import screen. If neither is in use, the exact name match is kept.

Not done: hiding a twin in the picker, or moving history from one row to the other. Both would change what a phone already shows and need a decision (and a real-phone check) first.
