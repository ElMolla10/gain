# Achievements as the heart of Progress

## Product promise

Make a lifter's saved work feel visible, specific and worth returning to. Reward consistency, meaningful improvement and longevity without encouraging extra workouts, unsafe load jumps or a daily streak. The comparisons are with the lifter's own history and chosen goals. Exercise history and personal records remain accessible from the lift detail screen.

## Current state (16 October 2026)

The page has six lifetime badge tracks: training days, qualified weeks, active months, consistent years, weight breakthroughs and reached weight goals. A qualified week requires two distinct training days; an active month requires three qualified weeks; a year requires ten active months in a twelve-month window. It also shows weekly goal progress, up to three monthly exercise goals, recent weight breakthroughs and reached goals. The badge collection is mostly text chips. It lacks earned dates, a detail/reason view, a complete timeline, tailored short-term goals and a clear celebration when an achievement is earned. Current strength breakthroughs count a heavier load (or less machine assistance) on the same line, without matching repetitions; this is not sufficient evidence for a strength PR.

The You vs You and You vs the World screens and the synthetic benchmark bundle are removed in this change. The per-exercise LiftTrend and its personal history remain.

## Badge catalog to build

| Family | Candidate awards | Evidence and guardrail |
| --- | --- | --- |
| First steps | First finished workout, first four training weeks, first month goal | Trusted saved working sets; only once per award. |
| Consistency | 4/12/26/52 qualified weeks; 3/6/12 active months; 1/2/3 consistent years | Show cumulative and consecutive concepts separately. Planned rest never breaks a daily chain because no daily chain is scored. |
| Return | First session after a break of 14+ or 30+ days; four qualified weeks after returning | Positive welcome back, never a penalty for the gap. Do not grant repeatedly for manufactured short gaps. |
| Strength | First verified PR, 5/20/50 verified PR events; personally chosen load milestones at a fixed rep target | Same exercise, equipment and setup. Require comparable reps or a conservative estimated strength improvement and a minimum material gain. First session is a baseline. |
| Craft | 10/25/50 sessions on a particular lift; improvement on that lift across 3 months | Distinct sessions, not extra sets in one workout; can celebrate non-load progress for bodyweight and timed lifts. |
| Breadth | Balanced training across the lifter's selected program over 4/12 weeks | Use program/exercise categories already tracked; optional and never prescribe an unfamiliar exercise. |
| Endurance | Longer timed hold or loaded carry; repeated improvement over a training block | Same movement and measurement, trusted sets; compare load separately or within a matched band. |
| Long horizon | 100/250/500 training days and multi-year consistency | Rare and permanent, earned date visible. |

Avoid badges for daily attendance, extreme single-set loads without validation, raw workout volume, or changing bodyweight. A badge should say exactly what happened, such as “Bench press: 60 kg × 8 to 62 kg × 8,” and link to its supporting session.

## Progress experience

1. Put Achievements at the top of Progress as its primary action. In the eventual redesign, make the achievement summary the Progress landing experience: current week, next meaningful badge, recent earned item and one chosen monthly quest above workout history.
2. Build a trophy cabinet with clear earned/locked states, category filters, earned dates and rarity tiers based on difficulty, never fabricated population rarity. Tapping a badge explains the rule, progress, evidence and next tier.
3. Show a chronological personal story: first workout, notable PRs, goal completions, consistency milestones and comeback moments. Link each item to a session or exercise history.
4. On workout completion, show at most one prominent newly earned achievement and a compact list of any others. Give an optional private-by-default share card, with no bodyweight, gym or full log unless the user explicitly includes it.
5. Offer a choice of one of three monthly quests generated from the prior 6–8 weeks: consistency, a selected lift, or a program-completion goal. Explain the baseline and target; let the lifter swap/skip. Sparse history gets a logging/consistency quest. The normal next-set suggestion stays independent of the quest.

## Delivery sequence

**1. Trustworthy award engine.** Define versioned award IDs, evidence references and earned timestamps. Calculate from trusted saved sets and finished sessions; handle imports, corrections, deletes, timezones, equipment/setup changes, assistance direction, timed movements and offline sync. Separate a first baseline from a verified improvement. Add focused tests for these cases and a backfill so existing history earns the right badges.

**2. Strong first release.** Replace text chips with a cabinet and badge details. Add a “next up” recommendation, earned dates, a complete recent timeline and a workout-finish reveal. Ship a small catalog: first steps, consistency, real PRs, personal weight goals and comeback. Keep the first release easy to understand rather than launching dozens of near-identical counters.

**3. Personal quests and depth.** Add monthly choice, exercise mastery, timed/carry achievements and long-horizon tiers. Let people pin a goal. Make rules and progress accessible in English and Arabic, including screen reader labels and reduced-motion celebration.

**4. Validate with lifters.** Test comprehension and emotional response with the pilot. Measure locally/with consent: percentage who understand why a badge was earned, correction disputes, achievement-page return visits, four-week training retention, quest completion and whether rest days feel respected. Iterate thresholds and wording before adding more badges.

## Release criteria

An earned badge can be traced to qualifying history; editing or deleting that history reconciles the badge. No duplicate rewards for multiple sets in one session. A returning user sees backfilled awards with correct historical dates. At least one attainable next step is visible for a new or experienced lifter. In a pilot, lifters can explain the next badge rule without assistance, and no one believes a rest day erased progress.
