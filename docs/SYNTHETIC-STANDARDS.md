# Experimental synthetic strength baseline

This model compares a saved performance with a generated baseline. It does not estimate a measured worldwide percentile. The app calls the result a GAIN index and labels the comparison as experimental.

## Files and inputs

Run `node_modules/.bin/vite-node --script scripts/generate-synthetic-standards.ts` from the repository root to reproduce the data.

`apps/mobile/src/data/synthetic-standards/age-12.json` through `age-100.json` contain one file per age, with male and female values for every catalogue exercise. Each age file holds aligned male/female value arrays; `exercises.json` supplies each position’s exercise key, metric, and provenance. Null values explicitly withhold a comparison. `coverage.json` identifies coverage by exercise. `manifest.json` records the equations and assumptions.

The files store values at reference height/bodyweight. The app evaluates height and bodyweight continuously, supporting 25–400 kg and 100–230 cm, rather than expanding a fixed grid of identical coefficients. Male reference: 74 kg and 175 cm. Female reference: 63 kg and 162 cm.

## Loaded movements

Ten exact barbell exercises are anchored to published self-reported gym medians from [FitnessVolt's public data API](https://fitnessvolt.com/strength-standards/strength-data/) (CC BY 4.0, snapshot fetched 16 October 2026). The bundled source contains gym medians only; competition data is excluded. A visible attribution link is shown in the app.

The remaining loaded baselines use explicit movement-pattern and equipment ratios in the generator. Those ratios, the age curve, and the height/bodyweight exponents are product hypotheses. They have not been validated as physiological predictions. Machine readings, cable ratios, range of motion and individual technique can make comparisons especially uncertain.

Loaded performance uses the best trusted saved working set of 1–10 reps in the past 365 days. A single is used directly; other sets use Epley estimated 1RM. Warmups, drop sets, rejected/unconfirmed outliers and deleted workouts are excluded. Different exercise/gym/setup lines remain separate.

## Bodyweight movements

- Unweighted repetitions: compare the best single unweighted set with a synthetic repetition baseline for that exercise.
- Holds: compare the best unweighted duration with a synthetic seconds baseline.
- Weighted vertical pulls and dips: use estimated total-system 1RM from bodyweight plus added load, for sets of 1–10 reps. Their baseline derives from the synthetic bodyweight-rep model. This is an experimental conversion, not a measured max.
- Weighted push-ups and other variations without a whole-body vertical model are withheld. Their effective bodyweight fraction cannot be inferred from the log.
- Assisted, band and distance movements have no comparison yet.

Repetition, duration and weighted bodyweight scores are shown separately. The app uses the comparison profile's current bodyweight/height, because historical sets do not reliably carry those measurements. Changing the comparison profile can therefore change earlier performances' current index.

## Age classes

Ages 12–17 use a separate synthetic youth class; no measured youth standards are claimed. Ages 18–100 use an adult age curve. All age effects are generated assumptions; even exercises with a published adult anchor have modeled age adjustments. The exact curve is recorded in the manifest and generator.

## Index

`index = clamp(round(500 + 250 * log2(performance / personalized-baseline)), 0, 1000)`

500 means the performance matches the model baseline. It does not mean the user is at the population median or stronger than 50% of people. No percentile, worldwide placement or synthetic sample-size claim is displayed. Profile details and scoring stay on the device; optional GAIN backup can sync comparison settings. The publisher's site opens only if the user taps its attribution link.
