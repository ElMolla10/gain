# Programme templates (v0.14.0)

Status: **48 templates, unit-tested only, NOT device-verified, NOT trainer-reviewed.** Arabic names are DRAFTS (flagged `arDraft` in the data, "draft name" in the Arabic UI). The v0.13.0 report that a trainer liked "the workouts/templates" covered the original 7; it does not cover the 40 added in v0.14.0, nor `ppl_upper_4` (added in v0.19.0 at Mohamed's request, the 48th).

## What these are (and are not)
Common community / coaching ways to arrange a training week, written with exercises from GAIN's own 607-exercise library. They are **not** copies of any named programme, **not** personalised, **not** medical advice. Names such as "StrongLifts-style", "Starting Strength-style", "PHUL-style", "PHAT-style", "Arnold split", "bro split", "torso / limbs" and "PPL" describe the *shape* (which lifts or muscles on which day, rough sets x reps) as widely circulated in lifting communities. I did **not** open or copy the original authors' programmes or books, so I make no claim that a template matches the original, and I cite no study for any template's sets, reps or split. The sets, reps and exercise picks are my arrangement and sanity-checked by the tests below, not derived from a source.

The only research GAIN relies on is the load-progression rule (based on the ACSM 2009 position stand, with GAIN conventions: rep ceilings, one-session trigger, standard steps; plus Mohamed's rep-ceiling configuration), documented in [PROGRESSION-RULES.md](PROGRESSION-RULES.md). Templates do not change that rule.

## Where they live
- `apps/mobile/src/logic/templateTypes.ts`: model (`Template`, `level`, `gear`, `goal`, per-lift `ceiling`).
- `apps/mobile/src/logic/templateData/{core,gymBasic,gymSplits,home}.ts`: the data.
- `apps/mobile/src/logic/templates.ts`: `TEMPLATES`, `templatesForDays`, `instantiateTemplate` (library ids -> an editable draft programme).
- `apps/mobile/src/logic/templateFilter.ts`, `templatePicker.ts`: filter / group / chip view-model. `components/TemplateBrowser.tsx` is the UI.

## The picker
Programmes are grouped by **days per week** and filterable by:
- **Days per week** (2 to 6; hidden during first-run setup, where the days are already known).
- **Where: Home or Gym.** Home = programmes that need only bodyweight, dumbbells/kettlebells or resistance bands. Gym shows **every** programme (a gym has dumbbells and floor space), so programmes usable in both appear under both; programmes that need gym equipment appear only under Gym.
- **Equipment I have**: Full gym (everything), Dumbbells (dumbbell + no-equipment programmes), Bands (band + no-equipment programmes), No equipment (bodyweight only). Dumbbells and bands do not stand in for each other.
- **Goal**: general fitness, strength, muscle size, bulking phase, glutes, arms and shoulders.
- **Level**: beginner, intermediate, advanced (my judgement of how much structure/volume the arrangement asks for).

Filters combine (AND). A chip that would show nothing with the other filters as they are is greyed out, so a tap never lands on an empty list. First-run setup still offers only programmes arranged for the days the lifter trains (never more days).

## How each template works with GAIN's rules
- **Progression (rule-v0.3):** each exercise gets the default rep ceiling for its kind (10 upper, 12 legs, 15 lateral raises) as the top of its range; load goes up when the weakest set at the current load reaches the ceiling. Tested on every template: a full rotation is logged and each next-session target carries `rule-v0.3` and a reason.
- **Strength shapes (3x5, 5x5, heavy 4x4-6):** a template can set a **per-lift ceiling**. `sl_5x5_3` / `ss_3` use ceiling 5 (so "every set hit 5" earns more weight); `strength_ul_4`, `phul_4`, `phat_5`, `db_strength_3` use 6 or 8 on their main lifts. Tested: 5x5 at 60 kg for two sessions gives a 62.5 kg target; one set at 4 reps keeps 60 kg. **Honest differences from the originals:** (1) the engine marks the first session of a lift as low confidence and repeats the load, so the first raise comes after two sessions of history; (2) the step is the smallest real gym load within 2-10% (e.g. 60 -> 62.5 kg), not a fixed amount; (3) no automatic deload after repeated failures (the stall deload is an opt-in engine convention, off by default).
- **Short-week rebuild:** the rebuild runs on every template for every day count and 3 time budgets (test). That sweep found a real bug (an unmeetable "2 sessions" floor pushed cuts onto the goal lift); fixed in the same release and covered by a hand test.
- **Programme switcher:** every template is created as a new programme, becomes active, and the previous programme stays with its history (test creates all 48 and switches among them).
- **A/B rotations:** `sl_5x5_3` and `ss_3` are two sessions (A, B) trained 3 days a week, so the rotation alternates A B A, B A B. The card says "A rotation of 2 sessions, trained 3 days a week." Weekly numbers scale by days per week / sessions in the rotation, as the app already does.
- **Timed holds** (plank, dead hang, carries) are not used in templates, because templates set rep ranges; add them in the programme editor.

## Added in v0.19.0: `ppl_upper_4` (Push / Pull / Legs / Upper)
Mohamed asked for a 4-day programme with days Push, Pull, Legs, Upper in that order. Checked first: none of the 47 had that shape (`ppl_3` is 3 days, `ppl_5`/`ul_ppl_5`/`ppl_6` are 5-6 days, `upper_lower_4`/`mix_4`/`torso_limbs_4` and the rest of the 4-day templates split differently), so it was added. It is a normal Gym / hypertrophy / intermediate template: Push, Pull and Legs reuse the `ppl_3` day shapes, and Upper is a second, machine/cable-leaning upper day (chest press machine, assisted pull-up, machine shoulder press, seated row machine, cable fly, rear-delt fly, cable curl, overhead triceps) so chest, back and shoulders are trained twice a week and the arms get a second exposure. Honest limit: legs are trained once a week (as in `ppl_3`), so it is listed with the single-frequency splits in the frequency test. It is shown under **4 days** and **Gym** (not Home), and is offered in first-run setup for lifters who train 4 days. The previous freeze on new templates was lifted for this one template only. Not device-verified, not trainer-reviewed; the Arabic name is a draft.

## Skipped on purpose
- **GZCLP-style** (tiered T1/T2/T3 lifts whose rep scheme changes after failed sessions, AMRAP last sets) and **5/3/1-style** (percentages of a training max in 3-4 week waves, AMRAP sets): the engine prescribes load from your own logged history within a fixed rep range and has no tiers, no percent-of-max, no wave/cycle state and no AMRAP target, so these cannot be expressed faithfully. A look-alike would be misleading, so none is shipped.
- **PHAT's speed-work sessions** and Starting Strength's power cleans are left out of the "-style" versions.
- Rep ranges are one number per lift (`repMin`) up to the ceiling; there is no separate per-set scheme (e.g. back-off sets).

## "Bulking phase" and women-friendly / general fitness
- `bulk_ul_4` and `bulk_ppl_6` are **higher-volume muscle-gain arrangements** (4-set compounds, 20-24 sets a session). That is all they are: GAIN gives **no food, calorie or weight-gain advice**, and the card says so.
- `general_fitness_3` (glute-friendly) and the glute templates are popular with many women lifters but are **for anyone**; nothing in the app is gendered.

## Tests (`apps/mobile/test/templates.test.ts`, `templatePicker.test.ts`, `shortWeek.test.ts`)
- Every template references real library ids (checked against the 607-row catalogue and against the seeded database), no id repeats inside a day, none is a timed exercise, no exercise is silently left out when a draft is built.
- No duplicate ids, English names, Arabic names or identical programmes (day/exercise/sets/reps fingerprint).
- The gear tag is true (dumbbell templates use dumbbell/kettlebell/bodyweight only, band templates band/bodyweight only, bodyweight templates bodyweight only, gym templates need gym gear).
- Weekly exposure sanity (my bounds, **not evidence-based minima**): a session is 5-26 sets and at most 9 exercises; no muscle above 30 hard sets a week; general/strength/hypertrophy/bulking templates give chest, back, shoulders, quads and the back of the legs at least 3 sets a week; pulling is at least half of pushing; 3+ day templates train each major area at least 1.5 times a week except the named body-part splits; glute templates >= 10 glute sets, arms/shoulders templates >= 12 arm and >= 8 delt sets; strength templates keep main lifts at <= 6 as the bottom of the range. Exceptions are listed in the test (the novice 3x5 shapes have one deadlift set, counted as one hamstring set).
- `pplUpperTemplate.test.ts` (v0.19.0): the one template `ppl_upper_4` has the exact name and day order, is not duplicated, uses library ids and gym gear, weekly exposure sanity, appears under 4 days and Gym (not Home) and in first-run for 4 days, instantiates in EN and AR, short-week rebuild for 1-4 days x 3 budgets, switcher create/switch/back.
- Picker / filter: facets, Home/Gym semantics, combination, counts, greyed-out options, grouping, onboarding offers, every label in English and Arabic.

## The templates
Sets per session are listed in order. "Gym" needs gym equipment; "Home" needs only what is named.

| id | days/week | English name | Arabic name (DRAFT) | level | needs | goal | sets per session |
|---|---|---|---|---|---|---|---|
| `full_body_2` | 2 | Full body, 2 days | جسم كامل، يومين | beginner | Gym | general | 13/13 |
| `upper_lower_2` | 2 | Upper / lower, 2 days | علوي / سفلي، يومين | beginner | Gym | general | 18/15 |
| `minimal_2` | 2 | Minimal 2 days (about 35 min) | الحد الأدنى يومين (حوالي 35 دقيقة) | beginner | Gym | general | 11/11 |
| `db_full_2` | 2 | Dumbbells at home: full body, 2 days | دمبل في البيت: جسم كامل، يومين | beginner | Home (dumbbells) | general | 13/15 |
| `bw_full_2` | 2 | No equipment: full body, 2 days | من غير أدوات: جسم كامل، يومين | beginner | Home (no equipment) | general | 14/14 |
| `band_full_2` | 2 | Resistance bands: full body, 2 days | أستيك مقاومة: جسم كامل، يومين | beginner | Home (bands) | general | 13/15 |
| `full_body_3` | 3 | Full body, 3 days | جسم كامل، 3 أيام | beginner | Gym | general | 13/13/15 |
| `ppl_3` | 3 | Push / pull / legs, 3 days | دفع / سحب / أرجل، 3 أيام | intermediate | Gym | general | 15/17/18 |
| `full_body_3_machines` | 3 | Full body on machines, 3 days (beginner) | جسم كامل على الماكينات، 3 أيام (مبتدئ) | beginner | Gym | general | 13/14/15 |
| `express_3` | 3 | Express full body, 3 x 30 min | جسم كامل سريع، 3 × 30 دقيقة | beginner | Gym | general | 9/9/9 |
| `general_fitness_3` | 3 | General fitness, 3 days (glute-friendly) | لياقة عامة، 3 أيام (مناسب للجلوتس) | beginner | Gym | general | 14/13/16 |
| `sl_5x5_3` | 3 (A/B rotation) | 5x5 strength A/B, 3 days (StrongLifts-style) | قوة 5×5 أ/ب، 3 أيام (على طريقة ستونج ليفتس) | beginner | Gym | strength | 15/11 |
| `ss_3` | 3 (A/B rotation) | 3x5 novice strength, 3 days (Starting Strength-style) | قوة مبتدئين 3×5، 3 أيام (على طريقة ستارتينج ستريندث) | beginner | Gym | strength | 7/10 |
| `arnold_3` | 3 | Arnold split, 3 days | تقسيم أرنولد، 3 أيام | intermediate | Gym | hypertrophy | 14/15/15 |
| `glutes_3` | 3 | Glute and lower-body focus, 3 days | تركيز على الجلوتس والرجلين، 3 أيام | beginner | Gym | glutes | 15/14/17 |
| `db_full_3` | 3 | Dumbbells at home: full body, 3 days | دمبل في البيت: جسم كامل، 3 أيام | beginner | Home (dumbbells) | general | 13/13/15 |
| `db_ppl_3` | 3 | Dumbbells at home: push / pull / legs, 3 days | دمبل في البيت: دفع / سحب / أرجل، 3 أيام | intermediate | Home (dumbbells) | general | 15/17/16 |
| `db_glutes_3` | 3 | Dumbbells at home: glute focus, 3 days | دمبل في البيت: تركيز على الجلوتس، 3 أيام | beginner | Home (dumbbells) | glutes | 13/14/14 |
| `db_strength_3` | 3 | Dumbbells at home: heavy and low-rep, 3 days | دمبل في البيت: تقيل وعدّات قليلة، 3 أيام | intermediate | Home (dumbbells) | strength | 12/10/13 |
| `bw_full_3` | 3 | No equipment: full body, 3 days | من غير أدوات: جسم كامل، 3 أيام | beginner | Home (no equipment) | general | 14/14/14 |
| `bw_ppl_3` | 3 | No equipment: push / pull / legs, 3 days | من غير أدوات: دفع / سحب / أرجل، 3 أيام | intermediate | Home (no equipment) | general | 13/14/17 |
| `band_full_3` | 3 | Resistance bands: full body, 3 days | أستيك مقاومة: جسم كامل، 3 أيام | beginner | Home (bands) | general | 13/13/14 |
| `band_glutes_3` | 3 | Resistance bands: glute focus, 3 days | أستيك مقاومة: تركيز على الجلوتس، 3 أيام | beginner | Home (bands) | glutes | 13/12/15 |
| `upper_lower_4` | 4 | Upper / lower, 4 days | علوي / سفلي، 4 أيام | intermediate | Gym | general | 18/15/16/15 |
| `mix_4` | 4 | Four-day mix (body-part split) | مزيج 4 أيام (تقسيم عضلات) | intermediate | Gym | hypertrophy | 12/14/15/15 |
| `ppl_upper_4` | 4 | Push / Pull / Legs / Upper | دفع / سحب / أرجل / علوي | intermediate | Gym | hypertrophy | 15/17/18/20 |
| `full_body_4` | 4 | Full body, 4 days | جسم كامل، 4 أيام | intermediate | Gym | general | 13/13/14/13 |
| `strength_ul_4` | 4 | Upper / lower strength, 4 days | علوي / سفلي قوة، 4 أيام | intermediate | Gym | strength | 17/15/15/14 |
| `phul_4` | 4 | Power + hypertrophy upper / lower, 4 days (PHUL-style) | قوة + تضخيم علوي / سفلي، 4 أيام (على طريقة PHUL) | intermediate | Gym | strength | 19/15/23/16 |
| `torso_limbs_4` | 4 | Torso / limbs, 4 days | جذع / أطراف، 4 أيام | intermediate | Gym | hypertrophy | 15/15/15/15 |
| `hypertrophy_ul_4` | 4 | Upper / lower for muscle size, 4 days (higher volume) | علوي / سفلي لتضخيم العضلات، 4 أيام (حجم أعلى) | intermediate | Gym | hypertrophy | 23/17/22/16 |
| `bulk_ul_4` | 4 | Bulking phase: upper / lower, 4 days (extra volume) | فترة التضخيم: علوي / سفلي، 4 أيام (حجم زيادة) | intermediate | Gym | bulking | 20/18/24/17 |
| `glutes_4` | 4 | Glute focus with upper days, 4 days | تركيز على الجلوتس مع أيام علوي، 4 أيام | intermediate | Gym | glutes | 16/16/17/16 |
| `arms_shoulders_4` | 4 | Arms and shoulders emphasis, 4 days | تركيز على الدراعات والكتف، 4 أيام | intermediate | Gym | arms_shoulders | 17/15/14/18 |
| `db_full_4` | 4 | Dumbbells at home: full body, 4 days | دمبل في البيت: جسم كامل، 4 أيام | intermediate | Home (dumbbells) | general | 11/13/14/15 |
| `db_ul_4` | 4 | Dumbbells at home: upper / lower, 4 days | دمبل في البيت: علوي / سفلي، 4 أيام | intermediate | Home (dumbbells) | hypertrophy | 19/14/23/15 |
| `db_arms_shoulders_4` | 4 | Dumbbells at home: arms and shoulders emphasis, 4 days | دمبل في البيت: تركيز على الدراعات والكتف، 4 أيام | intermediate | Home (dumbbells) | arms_shoulders | 17/15/12/19 |
| `bw_ul_4` | 4 | No equipment: upper / lower, 4 days | من غير أدوات: علوي / سفلي، 4 أيام | intermediate | Home (no equipment) | general | 17/17/17/15 |
| `band_ul_4` | 4 | Resistance bands: upper / lower, 4 days | أستيك مقاومة: علوي / سفلي، 4 أيام | intermediate | Home (bands) | hypertrophy | 20/14/18/15 |
| `ul_ppl_5` | 5 | Upper / lower + push / pull / legs, 5 days | علوي / سفلي + دفع / سحب / أرجل، 5 أيام | intermediate | Gym | hypertrophy | 16/15/14/12/15 |
| `ppl_5` | 5 | Push / pull / legs / push / pull, 5 days | دفع / سحب / أرجل / دفع / سحب، 5 أيام | intermediate | Gym | hypertrophy | 16/14/17/15/15 |
| `phat_5` | 5 | Power + hypertrophy, 5 days (PHAT-style) | قوة + تضخيم، 5 أيام (على طريقة PHAT) | advanced | Gym | hypertrophy | 15/15/17/15/19 |
| `bro_5` | 5 | Body-part split, 5 days (bro split) | تقسيم عضلات، 5 أيام | intermediate | Gym | hypertrophy | 13/15/14/16/20 |
| `db_ul_ppl_5` | 5 | Dumbbells at home: upper / lower + push / pull / legs, 5 days | دمبل في البيت: علوي / سفلي + دفع / سحب / أرجل، 5 أيام | intermediate | Home (dumbbells) | hypertrophy | 16/13/14/14/15 |
| `ppl_6` | 6 | Push / pull / legs, 6 days | دفع / سحب / أرجل، 6 أيام | intermediate | Gym | hypertrophy | 15/17/18/15/15/15 |
| `arnold_6` | 6 | Arnold split, 6 days | تقسيم أرنولد، 6 أيام | advanced | Gym | hypertrophy | 19/16/17/18/17/17 |
| `bulk_ppl_6` | 6 | Bulking phase: push / pull / legs, 6 days (extra volume) | فترة التضخيم: دفع / سحب / أرجل، 6 أيام (حجم زيادة) | advanced | Gym | bulking | 21/20/18/20/20/20 |
| `db_ppl_6` | 6 | Dumbbells at home: push / pull / legs, 6 days | دمبل في البيت: دفع / سحب / أرجل، 6 أيام | intermediate | Home (dumbbells) | hypertrophy | 16/15/14/16/15/16 |

## Not verified
- Nothing here has been opened on a phone: the picker layout (chip wrapping, RTL, greyed chips, long Arabic names), the onboarding flow with the new browser, and creating a template from the switcher on a device.
- No trainer has reviewed the 40 new templates; the 7 older ones were reported good by a trainer (scope not recorded).
- All Arabic names are my drafts (Egyptian-leaning), not reviewed by a native speaker.
- Exercise availability in a particular gym or home is the lifter's call; the app only knows the gear class. Bodyweight and home-dumbbell programmes need a pull-up bar (or sturdy bar/table edge) for pulling moves, and some dumbbell moves need a bench.
- Band exercises use the cable load model (no kg scale).
