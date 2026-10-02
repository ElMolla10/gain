# Progression rules (rule-v0.2)

How GAIN decides the next set, which parts rest on published evidence, and which are coaching convention. Nothing here was tuned to any one lifter's history. The Hevy backtest (`docs/BACKTEST-HEVY.md`) is a sanity check only.

Currency order is unchanged from `docs/PRODUCT.md`: **more reps in the range, then the same reps at a harder effort target, then a small quality change, then the next real load.** Load moves only when the lift has earned it (the trigger below) and only to a load that exists in the gym.

## What each source says (and how far I read it)

Only sources I actually opened are cited. "Read" says how much.

| # | Source | What I took from it | Read |
|---|---|---|---|
| 1 | Ratamess N.A. et al., ACSM Position Stand, *Progression Models in Resistance Training for Healthy Adults*, Med Sci Sports Exerc 2009. [PubMed](https://pubmed.ncbi.nlm.nih.gov/19204579/), [Table 2 on Medscape](https://www.medscape.com/viewarticle/717047_9) | "When training at a specific RM load, a 2-10% increase in load be applied when the individual can perform the current workload for 1-2 repetitions over the desired number on two consecutive training sessions." Evidence grade **B** (limited body of RCTs). Smaller muscle groups get smaller increases. | Table 2 and the abstract in full (Medscape page fetched; PubMed itself returned 403 to my fetcher, the abstract text came through search) |
| 2 | Suchomel T.J. et al., *Training for Muscular Strength: Methods for Monitoring and Adjusting Training Intensity*, Sports Med 2021. [doi:10.1007/s40279-021-01488-9](https://doi.org/10.1007/s40279-021-01488-9) | Definition of the **2-for-2 rule**: raise the load if the lifter does at least 2 reps over the goal on the **last set** in two consecutive sessions. Its limits: may promote training to failure, ignores technique, goal and relative intensity. RIR/RPE section: if 1 rep in reserve is expected and the lifter reports 2, the load can go up; RIR/RPE is best combined with %1RM; lifters under-report effort; RIR estimates get less accurate above about 4 RIR or above about 12 reps. | Sections 2.1-2.5 read in full from the PDF |
| 3 | NASM, *Progressive Overload Explained* (Adams, updated 2026). [link](https://www.nasm.org/resource-center/blog/training/progressive-overload-explained-programming-progress-for-every-client) | 2-for-2 wording for trainers; "approximately 2 to 5% upper body, 5 to 10% lower body"; small consistent increases beat aggressive ones; plateau advice: check recovery first, then change the stimulus, a deload week, or a different overload strategy. A trainer education page, not a trial. | Full page |
| 4 | Zourdos M.C. et al., *Novel Resistance Training-Specific RPE Scale Measuring Repetitions in Reserve*, J Strength Cond Res 2016;30(1):267-275. [Europe PMC](https://europepmc.org/article/MED/26049792) | RPE 10 = 0 reps in reserve, 9 = 1, 8 = 2, and so on. In 29 squatters (15 experienced, 14 novice) RPE correlated inversely with bar velocity (r = -0.88 experienced, -0.77 novice). "A practical method to regulate daily training load." | **Abstract only** |
| 5 | Helms E.R. et al., *Application of the Repetitions in Reserve-Based RPE Scale for Resistance Training*, Strength Cond J 2016. [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC4961270/) | The RIR scale is used to adjust load set to set and gauge intensity near limit loads. | **Search excerpts only.** The full text returned 403 / timed out. I did not take any number or table from it. |
| 6 | Bell L. et al., *Integrating Deloading into Strength and Physique Sports Training Programmes: An International Delphi Consensus Approach*, Sports Med Open 2023. [link](https://link.springer.com/article/10.1186/s40798-023-00633-0) | Expert **consensus** (34 coaches in round 1, 21 in round 3), not a trial. Deload = "a period of reduced training stress designed to mitigate physiological and psychological fatigue, promote recovery, and enhance preparedness". Universal agreement that volume is reduced; intensity or effort may also drop; deloads can be pre-planned or autoregulated, reactive when fatigued. Typically about 7 days, every 4-6 weeks (from the background section). The authors state it is "currently unclear whether deloading is a necessary part of the training programme". | Full text |
| 7 | Bell L. et al., *Deloading practices in strength and physique sports: a cross-sectional survey*, 2024. [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10948666/) | 246 competitive athletes: deloads about 6.4 days long, every about 5.6 weeks; reported triggers include performance stalling or decreasing (54%). | **Search excerpt only** |

## What is evidence and what is convention

| Part of rule-v0.2 | Status | Basis |
|---|---|---|
| Raise load only after 1-2 reps over target on **two consecutive sessions**; step size within 2-10% | **Evidence, grade B** (limited RCTs) | Source 1 |
| The same trigger worded on the last set, 2 reps over (2-for-2) | **Convention** with a published definition | Source 2 (which also lists its weaknesses); available as the `two_for_two` preset |
| Default trigger: weakest set at the top load reaches the **top of the rep range** in two consecutive sessions (`extraReps` 0) | **Convention.** A blend: it keeps ACSM's "two consecutive sessions" but treats the top of the range as the desired number instead of requiring reps beyond it. The strict ACSM reading is the `acsm_2009` preset (`extraReps` 1). | My choice; see Source 1 for the stricter reading |
| Double progression ("fill the range, then add load, reset to the bottom") | **Convention** | No controlled evidence found. Preset `double_progression` = first session at the top is enough |
| Step band upper body 2-5%, lower body 5-10% | **Convention** inside the ACSM 2-10% envelope | Source 3 for the numbers, Source 1 for the envelope |
| Pick the smallest real load inside the band; if the smallest real step is under the band minimum and a bigger real step still fits, take that one | **Design choice** to honour gym loads (product rule), not from a source | `loads.ts` |
| A step bigger than the band is "too big": spend reps, effort, quality first | **Product rule** (PRODUCT.md currency order) | |
| RIR scale: RPE 10 = 0 RIR | **Evidence** (validated against bar velocity in squats; other lifts less studied) | Source 4 |
| Fast track: if effort is tracked and the qualifying session left **3 or more** reps in reserve, one session is enough | **Convention extrapolated from** Source 2's example (expected 1 RIR, reported 2, load can go up). The value 3 is mine and configurable. | |
| Asking for fewer reps in reserve before adding load (effort currency), floor 1 RIR | **Product rule** | |
| Stall: 4 sessions at one load with no rep gain over the oldest, not ready for more load, then a deload of about 10% snapped to a real load, mid-range reps, and 3 RIR if effort is tracked | **Convention.** Sources 3, 6 and 7 support "deload when performance stalls" and "lower load or effort"; none gives 4 sessions or 10% for one lift. Both numbers are configurable. | |
| Step down one real step after 3 sessions below the bottom of the range at the same load (v0.1: 2) | **Convention.** More evidence before going down, because one or two bad days are normal. | |

Known limits stated by the sources and kept in mind: the 2-for-2 rule may push lifters to failure and ignores technique (Source 2); lifters under-report effort and RIR gets noisy far from failure (Source 2); the effect of deloading itself is not established (Source 6); and none of this was validated on a stratified sample of gym lifters. The app proposes, the lifter accepts, edits or rejects.

## Per-lift configuration

`ExerciseSpec` carries the settings. Everything has a default, so a lift with only a rep range works.

```ts
{
  repRange: { min: 6, max: 10 },        // per lift
  bodyRegion: "lower",                   // "upper" (default) | "lower": picks the step band
  trackEffort: true,                     // enables the effort currency and the RIR fast track
  progression: {
    preset: "acsm_2009",                 // optional: "double_progression" | "acsm_2009" | "two_for_two"
    trigger: { extraReps: 0, sessions: 2, repsBasis: "all_sets", fastTrackRir: 3 },
    increment: { minPct: 0.05, maxPct: 0.10 },   // fractions of the current load
    stepDownAfterMisses: 3,
    stall: { sessions: 4, deloadPct: 0.10 },     // or null to switch off
  },
}
```

Resolution order: body-region default, then preset, then explicit fields. `resolveProgression` validates and throws on nonsense. The resolved policy and how close the lift is to earning load (`readiness`) are stored in the decision inputs, so the Why screen can show them.

## Decision flow (engine)

1. Only comparable history (same exercise, gym, setup). Warm-ups, drop sets and unconfirmed outliers are excluded.
2. Anchor on the last top load, snapped to a load that exists in this gym.
3. Low confidence: repeat, never a jump.
4. Step down one real step after `stepDownAfterMisses` sessions below the range.
5. Stall: a lighter load, snapped to a real one.
6. Below the range: rebuild reps. Inside the range: one more rep.
7. At the top: not ready, so confirm (or spend effort if tracked). Ready (enough consecutive qualifying sessions, or fast tracked): effort, quality, then load, or load first when the step is inside the band.

## Sanity check against Mohamed's Hevy history

Details in `docs/BACKTEST-HEVY.md`. 343 next-sessions, 70 workouts. The export has no per-lift rep ranges, RIR or gym loads, so the range is a single assumed value and the load grid is inferred. At 6-10: the rule proposed the same load he used 55% of the time (v0.1: 54%; just repeating the last load: 60%). The rule proposed a heavier load 0% of the time; he actually went heavier 26% of the time. In the 90 sessions where he raised the load, the session before had a median of 7 reps on his weakest set, so he usually moves the load up before filling a 6-10 range. That is either a lower real rep range for those lifts (a per-lift setting) or faster progression than the evidence-based trigger allows; the export cannot tell which. The rule is therefore **more conservative than he is, and almost never more aggressive**. This is a flag, not a target: the thresholds were not changed to close the gap.
