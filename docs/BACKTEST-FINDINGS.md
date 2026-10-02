# Backtest findings (rule-v0.1 on Mohamed's Hevy export)

Generated table: [BACKTEST-HEVY.md](BACKTEST-HEVY.md). Rerun: `npm run backtest:hevy -w @gain/engine`.
343 next-session checks over 29 lifts with 4+ sessions, 70 workouts, 2025-09-22 to 2026-09-29. Hevy gives no rep ranges, no real gym loads, no RPE, so the load grids are inferred and the rep range is assumed (6-10 fits his logged median of 8 reps, 25th-75th percentile 6-10).

What it showed (agreement with what he did, not proof of correctness):

1. With a 6-10 range the rule's load equals the load he actually used in 54% of sessions. The naive "same load as last time" equals it 60%. So v0.1 does not beat "repeat" on load agreement.
2. The rule proposed a load increase in only 3 of 343 sessions. He raised the load in 90 of 343 (26%) on his own. Cause: the anchor is the minimum reps across the sets at the top load, and he rarely hits the top of the range on every set, so the rule keeps saying "one more rep".
3. The step-down rule (two sessions below the range at the same load) fired 25 times; he stayed at the same load in 18 of those (72%). Step-down looks too eager for how he trains (he repeats the load and grinds).
4. Confidence behaves: high-confidence proposals match his load 59%, medium 49%, low 34%.
5. The effort currency never fired (no RPE in the export). Quality fired 15 times.

Candidate changes for rule-v0.2 (not done here; rules are versioned and need review): anchor on the best/median set at the top load instead of the minimum, make step-down need a bigger miss or three sessions, and let the user set the rep range per lift (the biggest lever in the table).

> Update: rule-v0.2 replaced the "tune to his behaviour" idea above with published progression models. See docs/PROGRESSION-RULES.md. Numbers for v0.2 are in docs/BACKTEST-HEVY.md.
