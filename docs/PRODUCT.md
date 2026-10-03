# GAIN — Product Description

Name: GAIN.
Status: product to build. Pricing and launch numbers below are decisions to test, not forecasts.

## Product overview

GAIN is an Arabic and English lifting app that ends every workout by deciding the next one.

You finish a session. Before you leave the gym, the app has already written the next targets: the exercise, the exact load that exists in your gym, the reps, and why. Over weeks it tracks whether you are on pace for a goal you actually named — 100 kg bench, a bodyweight target, or a muscle you want to prioritise — and it says so in one line, not a dashboard.

The core promise: **Leave knowing the next weight. Come back knowing if the goal is still on pace.**

It is built for muscle and strength, for people who already train. It does not promise a physique, a rate of progress, or a medical outcome. Results depend on training, food, sleep, and the person.

AI is not a chat tab. It is the layer that turns messy logs into the next target, the goal pace, and the small change when a week goes wrong. A rule calculates the number. The model handles the cases a fixed rule gets wrong. The user sees both, and nothing changes the plan until they accept it.

## Who it is for

Adults in Egypt who lift two to five days a week and already have a split, or are willing to keep one. They log somewhere — Hevy, Strong, Notes, a coach’s paper — and still decide the next weight themselves. English-speaking lifters can use the same app. Arabic is a first-class layout, not a translated skin.

Beginners can start from a template. They are not the first customer. People who need rehab need a clinician. Competition peaking is out of the first releases.

The first hundred users should be reachable in person: one gym, a few coaches, lifters who will say whether Thursday’s number was right.

## The job it has to win

Hevy is the notebook people already trust, and its Trainer only progresses programmes it generated. Strong will not tell you the next load. Alpha Progression and MacroFactor Workouts already recommend a weight and a rep target. Fitbod generates sessions that lifters keep editing.

GAIN does not try to be all of them. It wins one job:

**On the programme you already run, the next load is a weight you can actually load, decided from your history, explained, and tied to a dated goal.**

Switching has to be cheap. Hevy and Strong history import on day one. A progression model with no history is a guess, and a guess will not move someone off an app they already paid for.

## Positioning

Continuity is the product. The plan, the work done, the equipment in that gym, and the goal stay attached to each other.

What should feel different after two weeks:

- The next session is written before you close the app.
- The number respects this gym’s dumbbells, plates, and machines.
- A goal has a pace, and the pace moves when you miss or stall.
- A short week does not destroy the plan. It protects the lifts that serve the goal.
- You can reject a jump, and the app stops nagging you with the same jump.

Arabic, local equipment, and a visible reason are the reasons a lifter in Cairo can prefer it without caring what a foreign app does.

## Onboarding

Language, units (kilograms preselected, pounds offered), then the minimum needed to write a first session: days per week, session length, equipment, and one goal. Height and bodyweight are optional unless a bodyweight goal is on.

The user can bring a programme they already run, pick a reviewed template, or import a Hevy or Strong export. Exercises they dislike, muscles they want more of, and movements they have been told to avoid are optional. A restriction is a constraint, not a diagnosis. The app does not invent rehab.

Onboarding does not ask about the gym. It creates a default gym silently with standard loads in the chosen unit (2.5 kg barbell steps from a 20 kg bar, a typical dumbbell rack, 5 kg cable and machine jumps; in pounds, a 45 lb bar with 5 lb steps, 5 lb dumbbell steps and 5/10 lb stack jumps). The gym is still a list of loads that exist, not a generic “dumbbells: yes”: there is no Gym screen (removed in v0.8.0): the gym is a silent data-layer default and targets only use the standard loads. A gym editor may come back later if real use shows it is needed.

### Units

Kilograms are the default; pounds are a choice in onboarding and Settings. Everything stored, and everything the progression engine reads, is kilograms. Pounds are a display and input layer: weights are shown to 0.1 lb, typed pound values (goals, bodyweight, gym loads) are converted to kilograms, and the logger still steps along loads that exist in the gym. A pounds gym is edited natively in pounds (45 lb bar, 5 lb steps), so its loads read as clean pound numbers. A gym saved in kilograms and viewed in pounds shows honest conversions (22.5 kg is 49.6 lb) until the silent default rack is swapped for the standard pound rack (done automatically when the unit is switched and the rack is still the untouched standard one). Switching unit never rewrites logged history.

They see the first session and can edit it. Optional questions can be skipped.

## Main loop

1. Open Today. See the session, the goal lifts, the estimated time, and the one-line pace.
2. Start. Each exercise shows the last comparable performance and today’s target.
3. Log weight and reps with large controls. Repeat a set. Mark warm-ups. Optional effort.
4. Targets for later sets can update from what you just did, still using a load that exists here.
5. Finish. See what counted, what was a record, and what you changed.
6. Accept or edit the next session. It is written then, not tomorrow morning.
7. Once a week, one decision: keep, small change, or easier week.

Missed workouts are not completed workouts. The schedule shifts. Missed work is not stacked onto the next day.

## Ideas that should make it better

### 1. The next session is written at the door

The product is the handoff. When the user taps finish, the next scheduled session already has targets. They can accept, edit a load, or swap an exercise before they leave. There is no separate “generate plan” step to remember.

### 2. Gym fingerprint

A gym is a list of loads that exist, not a yes/no equipment checklist.

- Dumbbell pairs actually on the rack.
- Barbell increment, usually 2.5 kg, sometimes 1.25 kg if they own fractional plates.
- Cable and machine jumps, which are often 5 kg or a pin, not 2.5 kg.
- Assisted-machine stacks, logged as assistance removed, never compared with a free weight.
- Bodyweight movements logged as added load plus bodyweight, compared only with the same setup.

Recommendations cannot ask for 21 kg dumbbells if the rack goes 20, then 22.5. Several gyms can be saved. Home and the club do not share a history when the equipment is not the same.

A gym fingerprint can be shared inside that gym, so the second user does not rebuild the rack.

### 3. Progression currency

Progress is not always “add 2.5 kg”. Below the rep ceiling the app asks for one more rep. At the ceiling the load goes up, even if the smallest real step is bigger than the usual 2-10% band (e.g. 2.5 kg dumbbells). Where the load jump is unavailable, declined repeatedly, or the lifter opted into `oversizedStep: spend_first` (the `coaching_conventions` preset), the app spends a different currency, in this order:

1. More reps inside the range.
2. The same reps at a harder effort target, if they track effort.
3. A small quality change: pause, slower lowering, or an extra set on a goal lift.
4. Only then the next real load.

The user sees which currency was spent. “Stay at 30 kg, aim for 12, the next dumbbell is 32.5.” That sentence is the product.

### 4. Two clocks

The session clock answers what to do today. The goal clock answers whether the month still leads to the goal.

A goal is specific: 100 kg for 5 on bench by June, 78 kg bodyweight by a date, or “arms twice a week through March”. The app draws the pace from exposures, not from the calendar alone. A missed week moves the expected date or the required rate. It does not pretend the original date is intact.

If the user is behind, the weekly decision offers one small change: an extra exposure of that lift, a variation for two weeks, or a later date. It does not overhaul the programme after one bad session.

Bodyweight uses a rolling average. One heavy day is not a trend.

### 5. Rejection memory

Every accepted, edited, and rejected target is stored. If the user refuses the same load jump three times, the app stops proposing it and spends a different currency. This is the model learning the person, not a chat transcript. It is also why a lifter stays: the app heard them.

### 6. Outlier check

A set far from the recent line asks for a confirm before it moves the estimate. Wrong plate, wrong machine, a typo. Unconfirmed outliers do not change the next target. This single behaviour builds more trust than a smarter formula.

### 7. Same movement, different station

Barbell bench, Smith bench, and a machine press do not share a load history. Substitutions explain the difference and start a linked but separate line. If the user reports pain, the app does not claim another movement fixes it, and it does not tell them to push through it.

### 8. The short week

“I can train three days” or “I have 35 minutes” rebuilds the week around goal lifts and priority muscles. Accessories drop first. Rest is not crushed to keep the same volume. The user sees what was cut before starting.

Priority muscles have a weekly exposure floor. A user who asked for arms does not lose curls every time the session is shortened.

### 9. Warm-ups from today’s target

Warm-up sets are calculated from the working weight just decided, with jumps that match the gym fingerprint. They are logged as warm-ups and do not drive progression.

### 10. One weekly decision

The review is not a dashboard. It is one screen: exposures completed, goal lifts up or flat, pace on or behind, and one proposed change. Keep, apply, or edit. Observed numbers and the interpretation are visually separate. The app does not claim to measure fatigue or recovery.

### 11. Coach card

End of session can create a private link or image for a coach: what was done, next targets, goal pace. The coach does not get the account. This fits how a lot of Cairo gyms already work, without building a trainer product first.

### 12. Decision log the user can read

Every material suggestion stores the inputs: last comparable sets, increment available, effort if logged, goal pace, and the rule or model path used. “Why this weight?” opens that, not a paragraph from a chatbot. Conversational answers can sit on top later. They cannot write the plan.

## Programme

Reviewed templates for full body, upper/lower, push/pull/legs, and a four-day mix, chosen for days the user actually attends. Main lifts stay stable long enough to judge. Users can edit exercises, days, and priorities. Edits show the effect on weekly exposure. Programme versions keep old sessions readable.

Imported routines keep their structure. The app progresses them. It does not require the user to abandon a split that already works.

## Logging

Previous sets, today’s target, short cues. Large controls, repeat last set, warm-up versus working set. Optional tags for drop sets, supersets, and failure. Effort is optional reps in reserve, explained once. Recommendations do not require failure.

Offline first. Saved locally, synced later, with a visible saved state and no duplicate sessions. A native app is required for the rest timer, lock-screen timer, and one-thumb logging. A web prototype is only for tests.

## Exercise library

Search in Arabic aliases and English names. Numbers and exercise names stay readable in RTL layout. Equipment, setup, short cues, licensed demos. Short enough to read between sets. Aliases should match what people say in Egyptian gyms, not textbook translations.

## AI, not a chatbot

The model is allowed to do five things:

1. Estimate the next working set from comparable history and sets already done today.
2. Choose the progression currency when the ideal load does not exist.
3. Update goal pace from exposures, misses, and stalls.
4. Rank a substitution from equipment, pattern, and what this user has actually progressed on.
5. Propose one weekly change when the pace is behind or sessions are being cut.

It is not allowed to invent history, diagnose pain, write a rehab plan, or change the programme silently. Missing data is said out loud. Low confidence lowers the size of the suggestion, it does not hide behind a confident number.

A later assistant can answer “what did I lift last time?” and “why is this unchanged?” by reading the decision log. That is a window, not the engine.

## Screens

| Screen | Purpose |
| --- | --- |
| Today | Next session, goal pace in one line, start |
| Active workout | Targets, last performance, logger, rest |
| Finish | What counted, next session to accept |
| Goals | Lift goals, bodyweight goal, pace and date |
| Programme | Week, exercises, versions |
| History | Sessions and one trend per lift |
| Gym | Fingerprint, increments, shared gym profile |
| Settings | Language, units, privacy, subscription |

## Design

Large numbers, few taps, optional dark mode, RTL throughout. Colour is never the only status. No shame notifications, no streak that punishes a rest day. Notifications are optional and follow the user’s days.

## Boundaries

A trainer reviews templates, cues, and progression rules before public coaching claims. Rules are versioned.

Review status (2026-10-03): Mohamed reports a trainer said the workouts/templates are good, and that he reviewed the Arabic and it looks good. Both are reported on his word; reviewer identity and scope are not recorded. Rules and progression (rule-v0.3) and the short-week rules are not confirmed as reviewed unless stated. This does not clear any public coaching claim, and the in-app draft labels stay.

The app is a training aid. It is not a doctor, a physio, or a licensed coach. Pain gets a clear line to professional advice, not a generated treatment. No form scoring from video, no body-photo judgement, no meal plans, no public feed in the first releases.

## Price

Free: logging, history, one template, basic charts, own-data export. Records stay available after cancel.

Paid: next-session targets, gym-aware increments, goal pace, short-week rebuild, weekly decision. Show the limit before purchase.

Hypothesis to test: a monthly price near a local coaching snack, and an annual price that is the default offer. Annual should be the plan shown first. A trial has to cover several real sessions, with renewal stated before it starts. Confirm store fees and tax before locking a number. Do not assume 149–249 EGP a month is what people will pay until someone pays it.

## First release

Native iOS and Android. Arabic and English. Import. Gym fingerprint. Logger that works offline. Next-session targets with a visible reason. One strength goal and an optional bodyweight goal. Short-week cut. Weekly one-decision review. Export and delete.

Not in the first release: chatbot, social feed, wearables, nutrition, video scoring, trainer dashboard, photo progress. The coach card can follow as soon as lifters ask to send the screen to someone.

## How it grows from a few people

Start in one gym. Ten lifters who already log. Import or retype a month, show them the next weight beside the number they would have picked, and ask which they would load. Keep the ones who come back for Thursday’s target.

Coaches get the card, not a SaaS pitch. A shared gym fingerprint makes the second member faster to onboard than the first. Growth is someone on the next bench seeing the target and asking what the app is. Spend on acquisition only after those people are still logging in week six and a few have paid a stated price.

## Success

A user can log without fighting the screen, trust the next weight enough to load it, and tell whether the goal is on pace. A few of them pay and stay. That is the win. Beating every existing app at logging, social, and programming at once is not the goal, and is not required.

### Short description

Leave knowing the next weight. GAIN writes your next session from the one you just did, using the dumbbells and machines in your gym, and tells you if your goal is still on pace. Arabic and English. Your programme, your history, a number you can check.
