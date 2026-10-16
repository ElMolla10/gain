# Achievement pilot checklist and local gate signals

Status: **collects signals only. No gate has been met.** Counts stay on the phone. Nothing is uploaded.

## Export the checklist

Settings → Pilot checklist.

1. Answer the four questions (two short written answers, two yes/no, optional note on unexpected badge changes).
2. Save on this phone, then Share answers. That opens the system share sheet with JSON. GAIN does not send the file.

The JSON is:

- `kind`: `gain.pilot-checklist`
- `appVersion`
- `achievementRuleVersion`
- `sessionCount` (finished workouts on this phone, not a person)
- `exportedAt`
- `answers` (the four questions)

It does not include a name, gym, exercise list, or training log.

## Local Progress notes (opt-in)

Off until the lifter allows it (one-time card on Progress, or Privacy → Count Progress taps). After that, this phone counts:

- Progress tab opened
- Badge detail opened
- Supporting workout opened
- Share card
- Quest picked or swapped
- Hero reveal shown

Settings → Diagnostics (Developer Mode) shows the counts, last time, and a Clear button. Delete everything also wipes them. They never change next-set suggestions.

## The four gates (Diagnostics only)

These are local counters that map to the original release gates. They are **signals**. Meeting a number in Diagnostics does not mean a gate has passed.

| Gate | What is counted |
| --- | --- |
| Comprehension | Times a badge detail was open and the supporting workout was opened |
| Rest-day safety | Times the checklist answer “felt penalized for rest days” was yes |
| Engine integrity | Times the checklist answer “badge disappeared or changed unexpectedly” was yes |
| Engagement | Progress tab opens and share-card generations in the last 28 days |

Do not show these on the Progress tab. Do not treat a low or high number as a pass or a fail.
