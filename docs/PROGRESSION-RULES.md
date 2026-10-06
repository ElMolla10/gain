# Progression rules (rule-v0.4)

**rule-v0.4 (v0.21.0): the program's own rep range wins.** Until rule-v0.3 the GAIN rep ceilings (10 / 12 / 15) silently replaced the top of an imported or hand-written program's range (an 8-12 program progressed at 10, shown as 8-10). From rule-v0.4 the **top of the program's own range is what earns more load**. The GAIN ceilings are used only (a) for an exercise whose program has **no upper rep limit** (the Why screen then says so), (b) when the lifter switches on **Settings > "Use GAIN rep ceilings"** (off by default, labelled; it restores the rule-v0.3 behaviour for every exercise), and (c) as the starting top when a program is built from a template (the template stores that number as its top). A rep ceiling set on one exercise still wins over both. Nothing else in the rule changed (load grid, 2-10% band, snapping, one-session trigger, sets needed, confidence, rejection memory). Decisions already stored keep their recorded rule version (`rule-v0.3`); only new ones say `rule-v0.4`. Consequence to know about: editing the app-wide ceilings in Settings no longer changes a program that has its own top unless the setting is on.

**The default rule is based on the ACSM 2009 position stand** (source 1 below): raise the load 2-10% when the lifter can do the target. It is not a literal implementation of ACSM: the 10/12/15 rep ceilings, the one-session trigger and the snapping to standard steps are GAIN conventions. On top of it sits **Mohamed's own configuration**: what "the target" is, and how often it has to be hit.

Nothing here was tuned to any one lifter's history. The Hevy backtest (`docs/BACKTEST-HEVY.md`) is a sanity check only.

## The default rule in one paragraph

Load goes up only when the **weakest working set at the current load reaches that lift's rep ceiling**: **the top of the program's own rep range** (rule-v0.4; before that always the GAIN ceiling: **10 reps for upper-body lifts, 12 for legs, 15 for lateral raises**, any variant, which is still what applies when the program has no upper limit or the setting is on). One session at the ceiling is enough. Until then the target is one more rep at the same load. The step is 2-10% of the load (ACSM), taken as the smallest real load in the gym that fits the band. If even the smallest real step is bigger than 10% (light loads, e.g. a 2.5 kg dumbbell jump from 10 kg to 12.5 kg for lateral raises at 15 reps), the load increase is **still proposed**: the lifter reached the ceiling and nothing smaller exists, so pause / tempo is not spent first. The Why screen says the step is above the guide. Two cases stay cautious: a bodyweight line with no bodyweight on file (the step's share cannot be measured), and the opt-in `coaching_conventions` preset (`oversizedStep: "spend_first"`: effort, quality, then load). If the lifter declines the oversized jump repeatedly, effort / quality are offered instead, as for any declined jump.

| Layer | What | Where it comes from |
|---|---|---|
| ACSM 2009 (research) | Raise load by **2-10%** when the lifter can do the target; evidence grade B. | Source 1 |
| Mohamed's configuration | The target is the **rep ceiling** (10 / 12 / 15), a **single session** at it triggers the increase, and the weakest working set is the one that counts. | Instruction from Mohamed. Not from a study. |
| Currency order, gym loads, outliers, rejection memory | Product rules. | `docs/PRODUCT.md` |

**Where this departs from ACSM's wording, on purpose.** ACSM says: increase "when the individual can perform the current workload for 1-2 repetitions over the desired number on two consecutive training sessions". Mohamed asked for load to go up when he *reaches* the ceiling, so by default `extraReps` is 0 and `sessions` is 1. The literal ACSM trigger is still available as the `acsm_2009_strict` preset (1 rep over the ceiling, two consecutive sessions).

## Default rep ceilings (GAIN ceilings)

Used when the program has no top for the exercise, when "Use GAIN rep ceilings" is on, and for the top of a program built from a template.

| Kind of lift | Ceiling | How a lift is classified |
|---|---|---|
| Upper body (default for everything not listed below) | **10** | name |
| Legs | **12** | name: squat (any), leg press / extension / curl / any "leg" move, lunge, RDL and every deadlift variant, calf, hip thrust, glute anything, hamstring, quad, adductor/abductor, good morning, step-up, Nordic, kettlebell swing |
| Lateral raises | **15** | name: lateral raise / side raise / side lateral raise, any equipment (dumbbell, cable, single-arm, machine, seated). Reverse, rear and bent-over variants are rear-delt work and are NOT lateral raises. |

A lift can carry an explicit `bodyRegion`; otherwise it is classified from `ExerciseSpec.name` (or `exerciseId`, which is the exercise title for Hevy imports). Known grey areas: back extension / hyperextension is classed upper (it is not in the leg list); hanging leg raise is abs, so upper.

**Editable at two levels.** Per lift: `progression.repCeiling` (the mobile app stores it per program exercise; `NULL` = follow the default). Per kind of lift, app-wide: `options.repCeilings` in the engine, the "Reps that earn more weight" card in Settings in the app. A per-lift value beats the app-wide one, which beats the built-in 10 / 12 / 15. A per-lift ceiling replaces the top of the program's rep range always; the GAIN ceilings do so only in the cases above (rule-v0.4); the bottom of the range is kept (never above the top).

## Opt-in conventions (off by default)

These were in the earlier rule-v0.2 draft. They are **conventions with no controlled evidence found**, so they are no longer on the default path. Each can be switched on per lift, or all together with `preset: "coaching_conventions"`.

| Convention | Config | Basis |
|---|---|---|
| Two sessions at the ceiling before load goes up | `trigger.sessions: 2` | ACSM's "two consecutive sessions", but with the target as the ceiling instead of 1-2 reps beyond it. |
| RIR fast track: one session is enough if it left 3+ reps in reserve (effort tracked) | `trigger.fastTrackRir: 3` | Extrapolated from Suchomel 2021's RIR example. The number 3 is arbitrary. |
| Region step bands: upper 2-5%, lower 5-10% | preset `coaching_conventions` (or `increment`) | NASM wording (source 3), inside ACSM's 2-10%. |
| Stall deload: 4 sessions at one load with no rep gain, then about 10% lighter | `stall: { sessions: 4, deloadPct: 0.1 }` | Sources 3, 6, 7 support "deload when performance stalls"; none gives 4 sessions or 10% for one lift. |
| Step the load down after 3 sessions below the bottom of the range | `stepDownAfterMisses: 3` | Convention. |
| 2-for-2 (2 reps over on the LAST set, two sessions) | `preset: "two_for_two"` | Source 2, which also lists its weaknesses. |

## What each source says (and how far I read it)

Only sources I actually opened are cited. "Read" says how much.

| # | Source | What I took from it | Read |
|---|---|---|---|
| 1 | Ratamess N.A. et al., ACSM Position Stand, *Progression Models in Resistance Training for Healthy Adults*, Med Sci Sports Exerc 2009. [PubMed](https://pubmed.ncbi.nlm.nih.gov/19204579/), [Table 2 on Medscape](https://www.medscape.com/viewarticle/717047_9) | "When training at a specific RM load, a 2-10% increase in load be applied when the individual can perform the current workload for 1-2 repetitions over the desired number on two consecutive training sessions." Evidence grade **B** (limited body of RCTs). Smaller muscle groups get smaller increases. | Table 2 and the abstract in full (Medscape page fetched; PubMed itself returned 403 to my fetcher, the abstract text came through search) |
| 2 | Suchomel T.J. et al., *Training for Muscular Strength: Methods for Monitoring and Adjusting Training Intensity*, Sports Med 2021. [doi:10.1007/s40279-021-01488-9](https://doi.org/10.1007/s40279-021-01488-9) | Definition of the **2-for-2 rule**: raise the load if the lifter does at least 2 reps over the goal on the **last set** in two consecutive sessions. Its limits: may promote training to failure, ignores technique, goal and relative intensity. RIR/RPE section: if 1 rep in reserve is expected and the lifter reports 2, the load can go up; RIR/RPE is best combined with %1RM; lifters under-report effort; RIR estimates get less accurate above about 4 RIR or above about 12 reps. | Sections 2.1-2.5 read in full from the PDF |
| 3 | NASM, *Progressive Overload Explained* (Adams, updated 2026). [link](https://www.nasm.org/resource-center/blog/training/progressive-overload-explained-programming-progress-for-every-client) | 2-for-2 wording for trainers; "approximately 2 to 5% upper body, 5 to 10% lower body"; small consistent increases beat aggressive ones; plateau advice: check recovery first, then change the stimulus, a deload week, or a different overload strategy. A trainer education page, not a trial. | Full page |
| 4 | Zourdos M.C. et al., *Novel Resistance Training-Specific RPE Scale Measuring Repetitions in Reserve*, J Strength Cond Res 2016;30(1):267-275. [Europe PMC](https://europepmc.org/article/MED/26049792) | RPE 10 = 0 reps in reserve, 9 = 1, 8 = 2, and so on. In 29 squatters (15 experienced, 14 novice) RPE correlated inversely with bar velocity (r = -0.88 experienced, -0.77 novice). "A practical method to regulate daily training load." | **Abstract only** |
| 5 | Helms E.R. et al., *Application of the Repetitions in Reserve-Based RPE Scale for Resistance Training*, Strength Cond J 2016. [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC4961270/) | The RIR scale is used to adjust load set to set and gauge intensity near limit loads. | **Search excerpts only.** The full text returned 403 / timed out. I did not take any number or table from it. |
| 6 | Bell L. et al., *Integrating Deloading into Strength and Physique Sports Training Programs: An International Delphi Consensus Approach*, Sports Med Open 2023. [link](https://link.springer.com/article/10.1186/s40798-023-00633-0) | Expert **consensus** (34 coaches in round 1, 21 in round 3), not a trial. Deload = "a period of reduced training stress designed to mitigate physiological and psychological fatigue, promote recovery, and enhance preparedness". Universal agreement that volume is reduced; intensity or effort may also drop; deloads can be pre-planned or autoregulated, reactive when fatigued. Typically about 7 days, every 4-6 weeks (from the background section). The authors state it is "currently unclear whether deloading is a necessary part of the training program". | Full text |
| 7 | Bell L. et al., *Deloading practices in strength and physique sports: a cross-sectional survey*, 2024. [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10948666/) | 246 competitive athletes: deloads about 6.4 days long, every about 5.6 weeks; reported triggers include performance stalling or decreasing (54%). | **Search excerpt only** |

## Evidence vs convention, part by part

| Part | Status | Basis |
|---|---|---|
| Raise load by 2-10% when the target is reached | **Evidence, grade B** (limited RCTs) | Source 1. This is the default rule. |
| Smaller muscle groups get smaller increases | ACSM text | Source 1; not enforced by default, available via `increment` / `coaching_conventions`. |
| Target = rep ceiling 10 / 12 / 15; one session at it; weakest set counts | **Mohamed's configuration** | Instruction, not a study |
| Pick the smallest real load inside the band; if the smallest real step is under the band minimum and a bigger real step still fits, take that one | **Design choice** to honour gym loads | `loads.ts` |
| A step bigger than the band is flagged "too big" (`jumpTooBig`), but at the ceiling it is still proposed (`oversizedStep: "load"`, default); `spend_first` (effort, quality, then load) is opt-in and used by `coaching_conventions` | **Mohamed's instruction** (replaces the earlier product rule that spent quality first) | Not applied when bodyweight is unknown |
| Low confidence (one session of history): repeat, never a jump | **Product rule** | A lifter's very first repeat session at the ceiling therefore waits one more session |
| RIR scale: RPE 10 = 0 RIR | **Evidence** (validated against bar velocity in squats; other lifts less studied) | Source 4. Only used when effort is tracked. |
| Asking for fewer reps in reserve before adding load (effort currency), floor 1 RIR | **Product rule** | Only when effort is tracked |
| Everything in "Opt-in conventions" | **Convention** | See that table |

Known limits stated by the sources and kept in mind: the 2-for-2 rule may push lifters to failure and ignores technique (Source 2); lifters under-report effort and RIR gets noisy far from failure (Source 2); the effect of deloading itself is not established (Source 6); and none of this was validated on a stratified sample of gym lifters. The app proposes, the lifter accepts, edits or rejects.

## Per-lift configuration

`ExerciseSpec` carries the settings. Everything has a default, so a lift with only a name and a rep range works.

```ts
{
  exerciseId: "...",
  name: "Lateral Raise (Cable)",         // classifies the lift: upper 10 / legs 12 / lateral raise 15
  repRange: { min: 10, max: 15 },        // the program's own range; its top wins (rule-v0.4). Omit max = no upper limit: the GAIN ceiling applies
  bodyRegion: "lower",                   // optional: skip the name guess
  trackEffort: true,                     // enables the effort currency
  progression: {
    repCeiling: 12,                      // per-lift ceiling (omit = default for the kind of lift)
    preset: "acsm_2009",                 // DEFAULT. Others: "acsm_2009_strict" | "double_progression" | "two_for_two" | "coaching_conventions"
    trigger: { extraReps: 0, sessions: 1, repsBasis: "all_sets", fastTrackRir: null },
    increment: { minPct: 0.02, maxPct: 0.10 },   // fractions of the current load
    stepDownAfterMisses: null,                   // opt-in
    stall: null,                                 // opt-in, e.g. { sessions: 4, deloadPct: 0.10 }
  },
}
// app-wide: proposeNext({ ..., options: { repCeilings: { upper: 10, lower: 12, lateral_raise: 15 }, useGainCeilings: false } })   // useGainCeilings: true = GAIN ceilings replace every program top (rule-v0.3 behaviour)
```

Resolution order: default (acsm_2009), then the named preset, then explicit fields. `resolveProgression` validates and throws on nonsense. The resolved policy (including the ceiling and where it came from) and how close the lift is to earning load (`readiness`) are stored in the decision inputs, so the Why screen can show them.

## Decision flow (engine)

1. Only comparable history (same exercise, gym, setup). Warm-ups, drop sets and unconfirmed outliers are excluded.
2. Anchor on the last top load, snapped to a standard step.
3. Low confidence: repeat, never a jump.
4. (Opt-in) step down one real step after `stepDownAfterMisses` sessions below the range; (opt-in) stall deload.
5. Below the bottom of the range: rebuild reps. Between the bottom and the ceiling: one more rep.
6. At the ceiling: ready. The next real load, even when the smallest real step is bigger than 10% (`oversizedStep: load`, default). With `oversizedStep: spend_first`, or when the step's share cannot be measured (bodyweight unknown), a step bigger than the band spends effort (if tracked), then quality, then load. A repeatedly declined load jump falls back to effort / quality.

## Sanity check against Mohamed's Hevy history

Details in `docs/BACKTEST-HEVY.md`. 343 next-sessions, 70 workouts. The export has no per-lift rep ranges, RIR or gym loads, so the load grid is inferred and the bottom of the range assumed. The export has no program, so the backtest models a program with no upper limit (GAIN ceilings apply; rule-v0.4 gives the same numbers as rule-v0.3 here, and nothing was measured about program-wins ranges). With the 10 / 12 / 15 ceilings the rule proposed the same load he used 58% of the time; just repeating the last load gives 60%, so **the rule does not beat repeat-last on this measure**. It proposed a heavier load in 4% of sessions (and in 14 of the 19 next-sessions that followed a session at the ceiling, now that an oversized real step no longer waits behind pause / tempo); he actually went heavier in 26%. Only 10% of his 90 load increases came right after a session at the ceiling, so he normally raises the load well before reaching 10 / 12 / 15 reps (median 7 reps before an increase). That is a flag about the gap between this instruction and his past behaviour, not a target: no threshold was changed to close it.

## Big-jump confirmation (fixes release, P04)
A proposed load more than **10%** above what the lifter did last time (same exercise, gym and setup; free-weight style loads only) is not applied silently. Ticking such a row in the logger, or pressing Accept on the Finish screen, first shows the size of the jump and four choices: use the proposed load anyway, repeat last time's load and reps, the same load with one more rep, or a "microload" (the smallest real step above last time's load, offered only when it is smaller than the proposed jump). The threshold is a setting (`jump_confirm_pct`, default 10; `0` switches the question off); there is no screen for it yet. Logic: `apps/mobile/src/logic/jumpGuard.ts`. The engine's own rule (increment band, rejection memory) is unchanged. Not verified on a phone.

## Effective rep range (fixes release P05, changed in rule-v0.4)
**rule-v0.4:** the top in force is, in order, the lift's own ceiling, the GAIN ceiling when "Use GAIN rep ceilings" is on, the program's own top, and the GAIN ceiling when the program has no top (`resolveRepTop` in the engine, used by both the rule and the Program tab, so what the app shows is what the rule uses). A program of 8-12 on the bench press now progresses at 12. The text below is how rule-v0.3 worked (kept because decisions stored under it still read this way):

rule-v0.3: the rule replaced the TOP of the program's rep range with the **rep ceiling** (the lift's own ceiling if one was set, else the app-wide default for its kind of lift: 10 upper, 12 lower, 15 lateral raise, editable in Settings), because the ceiling is what earns more load. A program of 8-12 on the bench press therefore progressed at 10 unless the lift had its own ceiling. That was stated, not silent: the Program tab shows the range in force per exercise and says when it differs from the program's range and why; the Why screen adds "Program range 8-12; rep ceiling in force 10 (app-wide default for this kind of lift)"; the ceiling field in the program editor says it replaces the top of the range. Decisions store the program's own range (`programmeRepRange`, `max` null = no upper limit) next to the range used (`repRange`), and from rule-v0.4 also `repTopBasis` (`lift` / `program` / `gain_setting` / `no_upper_bound`) and the GAIN ceiling that would apply (`gainCeiling`); the Why screen words each case ("Rep range 8-12 is your program's own...", "Your program has no upper rep limit for this exercise, so GAIN's rep ceiling ... applies", "... Use GAIN rep ceilings is on..."). Older stored decisions lack these fields and show what they always showed.

## "Weakest set at the top load", partial sessions, top set + back-off (fixes release, P21)
- **Reps of a session** = the weakest set at its top load: the FEWEST reps in any working set at the heaviest load of that session (warm-ups, drop sets and unconfirmed outliers excluded). Lighter sets of the same session (back-offs) are not part of it. The Why screen says this in plain words.
- **Sets needed.** A session only counts towards more load when at least as many working sets were done at its top load as the program prescribes (`plannedSets`; the mobile app always passes the day's set count). A session that stopped early, or whose last set was dropped to a lighter load, does not earn progression even if the sets it did were strong: the proposal repeats the load, asks for all sets, and the Why screen shows a warning ("fewer sets were done at the top load than the program prescribes"). More sets than prescribed are fine. When the plan is unknown (no `plannedSets`, e.g. imported history backtests) one set is enough, as before. This is a deliberately conservative reading, not an evidence-based one.
- **Top set + back-off (v0.21.0, classification corrected with per-set targets).** Per exercise the program editor offers "Straight sets" (default) or "Top set + back-offs" with a "Top sets" count (1 up to sets minus 1; stored in `programme_day_exercise.top_sets`, NULL = straight sets; migration 10). With it set, a set is a top set only when stored data says so: a `slot:N` at or under the top-set count, or `role:top`. Log order is not identity. A session with no slot and no role tag is not judged: the proposal is low confidence, names no load (`currency` `none`), does not list an inferred top (`inputs.sessions` empty), and the reason is `ambiguous_top` so the lifter sets the weight. The newest unmarked session does not let an older tagged session earn a jump. An older unmarked session is ignored and is not used as a top load. A heavier set tagged as a back-off is ignored, **even if it is heavier**. A lighter set inside the tagged top group stays a top set: it is not called a back-off just because it weighs less, and if it missed the group's hardest load the session does not earn a jump. A `slot:N` tag is written once and is not recomputed after a warm-up, drop, delete, add, or an out-of-order log, so a role cannot move onto a different working set. Opening or resuming a workout does not write a slot or a role onto a saved set that has neither, so a lighter set logged before a heavier one is not stored as the top set. If those tags name no top set, the session does not adopt a back-off load: the proposal repeats the previous real top load with `setsAtTop` 0 and does not jump; if there is no previous top, nothing is invented. Straight sets (no `topSets`) are unchanged: the heaviest trusted working load of the whole session is still the anchor. The Why screen says only sets logged as the top set decide, and that an older workout that does not mark the top set does not raise the weight. The decision's recorded inputs carry `topSets` only when it is less than the planned sets. Timed exercises have no top sets. The next session's target for a scheme stores one number per working set in `target.set_targets_json` (migration 12; NULL = straight sets or a target written before this, so old rows do not change). Top slots copy the proposed load and reps, or stay empty when nothing was proposed. Later slots copy last session's working set at that slot only when that session stored a slot or a role; an unmarked session does not fill them. The top load is never copied onto a back-off slot. Finish can accept the target, edit the headline (every top slot follows) or edit one back-off (only that slot). Accepting puts the top slots back on the proposal and keeps a back-off the lifter already edited. Rejecting clears the headline choice and leaves the per-set JSON in place; the logger does not ghost a rejected plan. Accepting or editing a rejected target is refused, so that JSON cannot be restored into a live target, and planning the same session again does not un-reject it. Refreshing that planned session at the same gym does not rewrite it into a new proposal. The logger ghosts those numbers and, when a set is logged, tags it `slot:N` plus `role:top` or `role:backoff`. Sync: both columns travel as part of the row; an older phone's row that omits `set_targets_json` does not wipe it, and a row with a column this app does not know is parked ("newer app"). Older backups without the columns restore as straight sets with no per-set plan. Not verified on a phone.

## Weights set per exercise (v0.21.0)
By default the next load is the smallest real step in the **gym's grid for the exercise's equipment** (`gym_load`: a list for dumbbells, a step grid for the rest). Those grids are standard defaults (typical weights), not a measurement of any real gym. A lifter can instead set the weights that exist **for one exercise**: a step (jump, optional lightest and heaviest weight; machine stacks, barbell plates) or a list (dumbbells that jump by 2). Stored in kilograms in `exercise.load_spec_json` (NULL = nothing set; migration 11), typed in kg or lb, applies to that exercise in every gym. The engine reads it as `ExerciseSpec.loadOverride` (it replaces the gym grid for that exercise only; the same snapping, band, assisted and zero rules apply), and the decision records `inputs.gym.loadSource = "exercise"` and the exact `loadSpec` used, so the Why screen says "Weights you set for this exercise: ..." only then; otherwise it says the weights come from the standard steps (typical weights, not a measurement of your gym). Rule thresholds do not change, so the rule version stays `rule-v0.4`. Setting or clearing the weights changes no logged set and no earlier decision; planned sessions are rewritten (kept choices that are still weights on the new grid stay). Logic: `loads.ts` (`specForExercise`), `apps/mobile/src/logic/exerciseLoads.ts`. Not verified on a phone.
