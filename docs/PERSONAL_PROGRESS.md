# Personal progress

- **Exercise progression:** Progress → Exercises opens a page for each exercise/gym/setup line with the same monthly goal and baseline as the logger, its progress, a chart and recent workouts. Tapping the goal in the logger opens that page.
- **During a workout:** an exercise with a trusted baseline shows a goal for this calendar month, separate from today's prescription. The baseline is the strongest trusted working set in the preceding 90 days, or the first logged session of the month if there is no recent history. Rep goals aim for roughly 6% higher estimated strength, prefer the next weight that actually exists in the gym and stays within the exercise rep range, and never use a one-rep same-weight gain as a milestone. Holds and carries aim for roughly 20% more time or distance. The goal stays fixed during the month; progress counts only trusted sets from that month. A new exercise needs a completed baseline before any goal is shown. Assisted movements currently omit this goal.
- **Finish:** “What improved” compares new records with the earlier best on that exercise line. First sessions establish a baseline. No-record sessions receive a neutral acknowledgement.
- **Achievement cards:** Finish and saved workout details show the exact card to share as a PNG. The card includes the date, set/exercise counts, and up to three personal highlights. It omits gym name, bodyweight, routine name, and the full log. Capture and system sharing happen locally and only on a tap; temporary captures are released afterward.
- **Today / History / Finish:** the consistency card uses the existing days-per-week setting, selected week start, and current short-week goal when applicable. It counts distinct local dates with trusted working sets. Rest days never reset a daily streak. Lifetime training-day badges begin at 1, 5, 10, 25, 50, 100, 250, and 500 days.
- All comparisons use the existing exercise/gym/setup line. No population percentile, strength rank, or new AI claim is introduced. History edits and deletions are reflected on reload. English and Arabic, kg and lb, and rep/time/distance exercises are supported.

## Native dependency

PNG capture uses `react-native-view-shot` 5.1.0, the version specified by Expo 57's bundled-native-module manifest. Existing installed native builds need rebuilding to include the module. An older binary can still open the recap; a capture failure is caught and leaves text/PDF sharing available.

## Device checks before release

1. Log a prior 14 kg × 10 dumbbell set on a 2 kg grid, then a same-line 16 kg × 8 working set: the monthly goal fills and the finish recap shows the concrete improvement. Repeat with warmups, drops and unconfirmed sets: those must not count.
2. Share a PNG on Android and iOS. Check the actual saved image, Arabic layout, long exercise names, large accessibility text, and cancellation/retry. Verify it matches the preview and includes no extra personal fields.
3. Correct an earlier set and reopen a later workout: its comparison and card must reflect the correction. Delete all qualifying sets: the training day disappears from consistency.
4. Complete a weekly goal, take rest days, then cross the selected week boundary: weekly progress resets while lifetime badges remain. Split sessions on the same day count once. Check a two-day short week against a normal four-day goal.
