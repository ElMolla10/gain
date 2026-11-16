# Exercise progression redesign (Summary / Rep Max / History)

`mockups/` are the approved designs (Nov 2026). `preview/` are renders of the shipped `LiftTrendView` through
react-native-web with a stub header and sample data, for review only: fonts, the native header and the setup sheet
differ on device.

- Summary: next-workout hero, estimated 1RM chart (3M / 1Y / All) with a dashed 3-month projection, a Goal field
  ("in ~N months · early Jan", "Over 12 months at this pace", "Not on pace yet", "Already reached"), three stat
  tiles and the last 3 workouts.
- Projection math: `packages/engine/src/projection.ts` (Theil-Sen e1RM slope over the trend window, linear from the
  latest session; hidden with fewer than 4 sessions in 8 weeks).
- Gear (native header) opens the setup sheet: Target (pin), Sets and reps, Weight jumps, Focus block, plus Edit
  exercise / Gym and setup when they apply. Each row opens the existing editor.
