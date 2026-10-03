# Trainer review pack (Step 16): rules for a qualified trainer to check

Status: **PREPARED, NOT REVIEWED.** Nothing in this file says a trainer has looked at the rules below. Mohamed reports (2026-10-03, on his word, reviewer and scope not recorded) that a trainer liked the *workouts/templates*. The rules here are not covered by that report. Until the sign-off block at the end is filled in by a named trainer, the in-app "draft" labels stay and no public coaching claim is made.

How to use: give the trainer this file and [PROGRESSION-RULES.md](PROGRESSION-RULES.md), [SHORT-WEEK-RULES.md](SHORT-WEEK-RULES.md), [WARMUPS.md](WARMUPS.md), [PACE-RULES.md](PACE-RULES.md), [WEEKLY-RULES.md](WEEKLY-RULES.md), [TIMED-EXERCISES.md](TIMED-EXERCISES.md). For every row they mark one verdict and write a note. Changes become `rule-v0.4` or later and are logged in PROGRESSION-RULES.md; every stored decision keeps the rule version it was made with.

Plain facts the trainer should know first
- The app proposes a number; the lifter accepts, edits or rejects it. It does not diagnose, treat pain or promise results.
- Defaults come from one research source (ACSM 2009 position stand: raise load 2-10% when the lifter can do the target) plus Mohamed's configuration (target = a rep ceiling, one session at it is enough). The configuration is an instruction, not a study.
- A Hevy backtest on one lifter's 70 workouts: the rule picked the same load he used 58% of the time; "repeat last load" 60%. It proposed a heavier load in 4% of sessions while he went heavier in 26% ([BACKTEST-HEVY.md](BACKTEST-HEVY.md)). One lifter, friendly data; a flag, not a verdict.

Verdict key: **A** = accept as is, **C** = accept with the change in the note, **R** = reject / replace, **?** = cannot judge.

## 1. Progression, rule-v0.3 (reps exercises)

| # | Item | Current value | Where | Question for the trainer | Verdict | Note |
|---|---|---|---|---|---|---|
| 1.1 | Rep ceiling, upper body | 10 | PROGRESSION-RULES.md, `ceilings` | Is 10 the right point to add load for upper-body lifts for the lifters this app is for? | | |
| 1.2 | Rep ceiling, legs | 12 | same | Right for squat/press/hinge/leg isolation? Should hinges differ? | | |
| 1.3 | Rep ceiling, lateral raises | 15 | same | Right? Rear-delt raises are NOT in this group; correct? | | |
| 1.4 | Trigger | Weakest working set at the current load reaches the ceiling, in ONE session | same | ACSM says 1-2 reps over on two consecutive sessions. Is one session at the ceiling acceptable, or should it be two (an opt-in switch exists)? | | |
| 1.5 | Step size | 2-10% of the load, smallest real gym load that fits | same | Acceptable band for upper and lower body? (Opt-in alternative: upper 2-5%, lower 5-10%.) | | |
| 1.6 | Step bigger than the band | Still proposed at the ceiling when it is the next real load | same | Fine, or should it add reps/quality first (opt-in `spend_first`)? | | |
| 1.7 | One session of history | Repeat the load, low confidence, never a jump | same | Agree? | | |
| 1.8 | Below the range | Rebuild reps at the same load | same | Agree? | | |
| 1.9 | Repeated declined jump | After the lifter repeatedly declines the same jump, offer effort/quality instead | same | Agree? | | |
| 1.10 | Effort (RIR) | Only when tracked; floor of 1 rep in reserve | same | Agree? | | |
| 1.11 | Opt-in, OFF by default: deload after 4 stalled sessions (-10%); step down after 3 misses | off | same | Should either become default? What numbers? | | |
| 1.12 | Outlier check | A set far from the lifter's own line is held for a confirm | `outlier.ts` | Is "ask, never silently drop" the right behaviour? | | |

## 2. Timed and distance exercises, timed-v0.1 (new in v0.13.0)

| # | Item | Current value | Question | Verdict | Note |
|---|---|---|---|---|---|
| 2.1 | Default range | Holds 30-60 s, carries 20-40 m, 3 sets | Sensible starting ranges? | | |
| 2.2 | Step inside the range | About 10% of the last value, at least 5, multiples of 5 | Right size for holds and carries? | | |
| 2.3 | Add load | After 2 sessions at the top of the range: next real load, restart at the range minimum | Right trigger? Should holds add load at all, or only time? | | |
| 2.4 | Caps | 3600 s and 5000 m per set | Sensible? | | |
| 2.5 | Where seconds matter | Carries logged in seconds (Mohamed's own Farmers walk) do not fit a metres exercise and are reported, not converted | Should a carry be allowed to progress by time? | | |

## 3. Warm-ups ([WARMUPS.md](WARMUPS.md))

| # | Item | Current value | Question | Verdict | Note |
|---|---|---|---|---|---|
| 3.1 | Ladder | Empty bar x 10 (barbell, if target >= 1.5x the bar), then 50% x 8, 70% x 5, 85% x 3 of the target, rounded to loads that exist, at most 4 sets | Acceptable for the usual lifts? Too many sets for isolation lifts? | | |
| 3.2 | When offered | Only before the first set of that exercise, with a target; not for assisted lifts or very light targets | Agree? | | |
| 3.3 | Counting | Warm-ups never change targets, records or trends | Agree? | | |

## 4. Short week ([SHORT-WEEK-RULES.md](SHORT-WEEK-RULES.md))

| # | Item | Current value | Question | Verdict | Note |
|---|---|---|---|---|---|
| 4.1 | Which days stay | Most goal lifts, then most priority-muscle sets | Sensible? | | |
| 4.2 | Goal lifts | Never removed while an accessory can go; trimmed to no fewer than 3 sets only as a last resort | Agree? | | |
| 4.3 | Priority-muscle floor | At least min(original, 6) sets and min(original, 2) sessions in the week | Right floors? | | |
| 4.4 | Time budget | 3 minutes per set; cut order: non-priority accessory, extra sets above 2, priority accessory, goal-lift sets | Agree with the order and the 3 min/set estimate? | | |
| 4.5 | Rest | Rest times between sets are not shortened | Agree? | | |

## 5. Goal pace and weekly decision ([PACE-RULES.md](PACE-RULES.md), [WEEKLY-RULES.md](WEEKLY-RULES.md))

| # | Item | Current value | Question | Verdict | Note |
|---|---|---|---|---|---|
| 5.1 | Strength estimate | Epley `load x (1 + reps/30)`, working sets of 1-12 reps | Acceptable as a trend measure (never shown as a max)? | | |
| 5.2 | "On pace" | ratio of actual to needed rate: ahead >= 1.25, on pace >= 0.85 | Reasonable? (Thresholds are builder defaults; Mohamed decides D5.) | | |
| 5.3 | Thin data | Fewer than 4 exposures: says "too little data" | Agree? | | |
| 5.4 | Muscle floor | 2 sessions per week | Reasonable for a muscle goal? | | |
| 5.5 | Weekly rule | Easier week offered only after a 2% fall in each of the last two sessions on a goal lift; no claim about fatigue | Agree? | | |
| 5.6 | Behind pace | Move the date if the projection is > 28 days late; else one more exposure or a two-week variation | Agree? | | |

## 6. Other things to look at
- Templates: 7 older draft templates (already reported as good by a trainer, scope not recorded: ask the same person to confirm in writing which templates were covered) and 40 added in v0.14.0 that **nobody has reviewed** ([TEMPLATES.md](TEMPLATES.md): list, rationale, what is a community shape vs a claim). Please review the exercise picks, set/rep numbers, the strength shapes with a low rep ceiling, and the higher-volume "bulking phase" ones.
- Pain/injury wording on the Privacy and safety page: confirm it sends people to a professional and gives no treatment advice.
- Anything the trainer wants removed or changed that is not listed above.

## Sign-off checklist (to be filled by the trainer, not by us)

- [ ] I reviewed sections 1-5 as written above, on the date below.
- [ ] My verdicts and notes are recorded in the table rows (or attached).
- [ ] Open disagreements are listed here: ______________________
- [ ] I agree my name may / may not (circle) appear in the repo and in the app.

Name: __________  Qualification: __________  Date: __________

Developer side after sign-off: copy verdicts into PROGRESSION-RULES.md, make changes as `rule-v0.4`, rerun the Hevy backtest and report the agreement honestly, update MASTER-PLAN Step 16. Do not mark Step 16 done before a named trainer's written feedback is in the repo.
