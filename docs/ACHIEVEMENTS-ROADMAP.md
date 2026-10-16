# Achievements: flagship Progress plan (v2)

## Promise and present state

GAIN should make saved training feel visible and worth returning to: consistency, verified improvement, chosen goals and longevity. It should never pressure a daily streak, an unsafe max attempt or extra junk sets. You vs You and You vs the World are retired; exercise history and LiftTrend remain available.

Today the page has training-day, week, month, year, weight-breakthrough and weight-goal counters. Weeks require two distinct days; months require three qualified weeks; years require ten active months in twelve. There are no earned timestamps or evidence sheets. The existing breakthrough counter can treat a heavier weight with fewer reps as a PR. Its label must be replaced or the calculation corrected before prominent strength badges ship.

The attached v2 proposal is a useful direction, with the following decisions to make it fit GAIN's actual log and avoid overclaiming. GAIN currently stores session times as Unix milliseconds and has a configurable `week_starts_on`; it does **not** store the session's original timezone or logical training date. Its trusted-session query qualifies a finished workout with at least one valid working set.

## Award contract and calendar

- Each definition has a stable ID, rule version, family, tier, progress target and localized title/rule keys. Tiers describe GAIN difficulty, not a claimed worldwide rarity. Never use a population percentage.
- An earned entry records the actual historical earn time, structured evidence (session/set IDs and values), backfill flag and celebration state. It must be possible to inspect why it was earned, even after an edit; do not treat an old snapshot as proof that a corrected set still exists.
- For **new sessions**, store the original local date, UTC offset or IANA zone when available, configured week start and logical training date at completion. Offer an optional 04:00 day rollover for late-night lifters; do not silently change the current midnight policy for everyone. A whole session belongs to one logical day, based on its start when reliable, otherwise finish. Changing a later timezone or setting must not relabel an old earned day.
- For older sessions and imports without an original zone, infer a date once from available timestamps and label it as inferred. Do not promise exact local dates for imported history that never supplied a timezone. Test Cairo midnight/04:00, travel, daylight-saving transitions and week/month boundaries.
- A qualified week retains the current rule: two distinct logical training days with at least one trusted working set on each. A blanket three-set minimum would exclude legitimate short sessions and existing users. A month is three qualified calendar weeks assigned consistently by the configured week-start date; a consistent year is ten active months in a rolling twelve. Show cumulative totals separately from a consecutive weekly run. No daily streak.

## Verified strength breakthrough: V1 exact rule

A strength badge is a specific **rep-count best**, not a claim of overall physiological adaptation or a world rank.

1. Only finished, undeleted, trusted working sets count. Exclude warmups, drop sets, unconfirmed/rejected outliers and nonpositive measures. Use the stored exercise line and equipment/setup identity; never combine another gym, implement or assistance direction. Preserve the meaning of a dumbbell load (per hand versus combined) rather than silently converting it.
2. Count 3–15 reps for V1 strength awards. Sets of 1–2 stay in history but do not trigger gamified PRs; higher reps can support a later capacity family. Rep bands (3–5, 6–10, 11–15) are labeled separately. Two distinct qualifying sessions in the **same band** establish a baseline; awards begin with the third. This avoids awarding a new 3-rep attempt based only on an old 8-rep set.
3. Direct load path: compare the new set with the **best previous set at the same rep count** on that line and in that band. A higher logged load earns a specific N-rep best only when it meets at least one valid increment for that exercise's recorded gym setup; if an increment is unavailable, require a positive difference above storage/rounding tolerance and label it provisional until reviewed. On an assisted machine, a lower assistance load is better at the same reps. A first-ever rep count establishes a baseline rather than a badge.
4. Rep path: at the same load, a new rep count at least one above the previous maximum within its band is a rep best, provided the band has its two-session baseline. Do not award two simultaneous load and rep badges for one set. Do not compare 100 kg × 3 to 95 kg × 8 as a single strength claim.
5. At most one breakthrough event per exercise line per session, anchored to the strongest qualifying evidence and its previous best. Multiple sets in one workout cannot farm counters. Weight-goal badges use the user-pinned target load **and** repetitions.

Cross-rep e1RM awards are **deferred**. A blended Brzycki/Epley number and 2.5% threshold would be an unvalidated product choice across machines, dumbbells and rep bands. If later piloted, specify formula, rep range, calibration and false-positive review separately; keep direct evidence legible in V1.

## Reconciliation and offline data

Use a versioned, deterministic evaluator plus a small SQLite earned-state/evidence cache and audit records. Do not introduce a separate general event-sourcing system for all workouts. On a set/session change, recompute affected line and calendar period, then dependent lifetime tiers; backfill older history chronologically. Imports earn their real historical dates and show one summary of backfilled awards rather than many workout-finish modals.

A rename, display-language change, archive or unifying equivalent exercise names must not silently remove a badge. A material correction or deletion of its qualifying set should first seek the next valid historical evidence. If none exists, mark the award **adjusted after edit**, keep its record visible with the reason, and update counts; do not keep a false verified PR as earned or make it disappear without explanation. Give the user a clear inline notice during the edit. Audit entries should be minimal and local, with the same backup/delete-all behavior as other GAIN data. Sync must preserve rule versions and avoid duplicate reveals across devices.

Evidence is stored as language-neutral fields, not prebuilt English prose. Render names, numbers, units and direction through the existing English/Arabic i18n system with isolated LTR numeric spans inside RTL text. Design the schema in phase 1 and test VoiceOver/TalkBack order, arrow direction and Arabic quantity forms before the first UI release; do not assume ICU MessageFormat is already installed.

## Badge catalog

| Family | Initial awards | Guardrail |
| --- | --- | --- |
| First steps | First trusted finished workout; first 4 qualified weeks | One-time; first set is a baseline, not a PR. |
| Consistency | 4/12/26/52/104 qualified weeks; 3/6/12/24 active months; 1/2/3 consistent years | Lifetime tiers never reset; separate current run can restart without shame. |
| Return | Return after 14+ and 30+ days; 4 qualified weeks after a return | At least 3 qualified pre-gap weeks; one return unlock per 90 days. Check actual session times, including imports. |
| Strength | First verified rep-count PR; 5/20/50/100 verified events; user-pinned load × rep target | Exact matching and session deduplication above. |
| Craft | 10/25/50/100 distinct sessions on one lift | Count distinct sessions; a new gym/setup remains a separate line unless explicitly mapped. |
| Capacity | Bodyweight reps, timed hold, loaded carry progress | Compare the same exercise and setup; for carries, hold load constant or use an explicitly disclosed load band. |
| Long horizon | 100/250/500/1,000 training days; multi-year consistency | Real earned date and supporting history; permanent when evidence remains. |

Program-breadth awards need a reliable record of what was scheduled at the time. Current flexible programs, replacements and imports can make an “85% adherence” claim wrong, so this family waits for explicit program-version snapshots and user research. No awards for daily check-ins, single-workout tonnage, caloric burn, bodyweight changes or 1–2 rep max-outs.

## Product experience

1. **Progress landing:** weekly pulse, one selected monthly quest when available, one or two attainable next awards, and two recent evidence-backed highlights. Keep workout history one tap away.
2. **Cabinet and detail:** earned, in-progress and family filters; an earned date, plain rule, progress to next tier, structured receipt and link to the supporting session or LiftTrend. Avoid a wall of hundreds of nearly identical chips.
3. **Personal timeline:** first session, meaningful PRs, goals, returns and years in chronological order. Show source workout and inferred-date marker where needed.
4. **Workout finish:** spotlight one new award by significance, list any others compactly, respect reduced motion and haptic preferences, and never replay an already celebrated backfilled award.
5. **Share:** explicit action, private by default. The card starts with a badge and relative improvement; absolute load, bodyweight, gym/location and full log are excluded unless expressly chosen for that card.
6. **Monthly quests:** later offer three explainable options based on 6–8 weeks of history: rhythm, a familiar lift, and program progress only when scheduled adherence can be measured. Cold start gets foundational options. A lifter chooses one, can skip or swap without punishment, and quests never modify next-set prescriptions.

## Delivery and gates

**Phase 1 — trustworthy engine and migration.** Freeze calendar semantics, evidence schema, versioned definitions, PR rule and reconciliation behavior. Backfill chronologically. Test timezone travel, imports, same-band PRs, assistance, gym/equipment identity, dumbbell load meaning, edits/deletes and duplicates. Add structured bilingual evidence rendering in this phase.

**Phase 2 — flagship first release.** Put the weekly pulse, next award, cabinet, evidence sheet and timeline in Progress. Ship first steps, consistency, return, verified strength and pinned goals. Add one workout-finish reveal and private share card. Audit accessibility and Arabic/English layouts.

**Phase 3 — depth.** Add chosen monthly quests, craft and capacity awards, long-horizon tiers and any program breadth only once its evidence exists. Iterate thresholds using actual lifter feedback.

**Phase 4 — validation.** In a consent-based pilot, ask lifters to explain their latest award and next badge, inspect every disputed PR/edited award, ask specifically whether rest days feel penalized, and measure Progress return visits and four-week retention. Target at least 90% comprehension as a design goal; treat any trust or rest-day complaint as a review trigger. Do not claim statistically meaningful retention lift or a <0.5% dispute rate from a tiny pilot.

Release only when an award links to valid evidence, corrections are visible and reproducible, backfilled earned dates are honest about missing timezone data, and a new or established lifter sees a relevant next step without being pushed to train unsafely.
