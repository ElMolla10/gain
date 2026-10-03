# Warm-ups in the logger (Step 9)

Status: unit-tested only, NOT device-verified. The scheme is the engine default; a trainer reviews it in Step 16. **Mohamed to confirm the scheme.**

- Button "Add warm-ups" in the logger, before anything is logged for the exercise today, when a target load exists (accepted, edited or proposed; not if declined).
- Scheme (engine `generateWarmups` default): empty bar x 10 on barbell lines when the target is at least 1.5x the bar, then 50% x 8, 70% x 5, 85% x 3 of the target, each rounded to a standard step in this gym, strictly rising and strictly below the target. At most 4 sets.
- You see the ladder first and tap "Add these warm-ups"; nothing is logged before that.
- Logged as warm-ups with fixed ids per session, exercise and step: a double tap or a retry adds nothing twice. No outlier check, no rest timer.
- Never counted: warm-ups do not change the next target, records or the trend (tested: same next proposal and same counted sets with and without warm-ups).
- No ladder for assisted lifts, when no gym loads are known, or when the target is too light. The logger says why.
- Loads are stored in kg; the ladder shows in your unit.

Open: a lifter who warms up differently still logs their own with the Warm-up toggle. No per-lift scheme setting yet.
