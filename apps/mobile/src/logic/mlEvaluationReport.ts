import { epley, type FeatureMap } from "@gain/engine";

export interface EvaluationSample {
  exerciseId: string;
  /** Export-local grouping for session-level checks; never the database session ID. */
  sessionGroup?: string;
  predictedReps: number;
  actualReps: number;
  features: FeatureMap;
}
export interface ErrorSummary {
  count: number;
  meanAbsoluteError: number | null;
  withinOnePercent: number | null;
  withinTwoPercent: number | null;
  /** Positive means predictions overestimate the logged reps. */
  meanOverprediction: number | null;
}
export interface PairedComparison {
  model: ErrorSummary;
  baseline: ErrorSummary;
  /** Baseline MAE minus model MAE on the SAME sets; positive favors the model. */
  maeImprovement: number | null;
  modelWins: number;
  ties: number;
  baselineWins: number;
}
export interface EvaluationCoverage {
  captured: number;
  pending: number;
  invalidated: number;
  excludedCurrentState: number;
}
export interface EvaluationReport {
  format: "gain-ml-evaluation-v1";
  modelVersion: string;
  coverage: EvaluationCoverage & { evaluated: number };
  model: ErrorSummary;
  comparisons: { repeatPrevious: PairedComparison; loadAdjusted: PairedComparison };
  byExercise: { exerciseId: string; model: ErrorSummary; comparisons: EvaluationReport["comparisons"] }[];
  byHistory: { priorFirstSetUnavailable: ErrorSummary; priorFirstSetAvailable: ErrorSummary };
  featureCoverage: { feature: string; observed: number; missing: number }[];
  /** Frozen inputs/outcomes without raw session/set identifiers. */
  samples: EvaluationSample[];
}
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const knownFeature = (feature: string, value: unknown) => finite(value) && !(feature === "load_convention" && value === -1);
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

export function errorSummary(pairs: { predicted: number; actual: number }[]): ErrorSummary {
  const errors = pairs.map(p => Math.abs(p.predicted - p.actual));
  return { count: pairs.length, meanAbsoluteError: mean(errors),
    withinOnePercent: pairs.length ? errors.filter(e => e <= 1).length / pairs.length * 100 : null,
    withinTwoPercent: pairs.length ? errors.filter(e => e <= 2).length / pairs.length * 100 : null,
    meanOverprediction: mean(pairs.map(p => p.predicted - p.actual)) };
}
/** These benchmarks read only frozen BEFORE-set inputs, never the achieved reps. */
export function baselineReps(features: FeatureMap, kind: "repeatPrevious" | "loadAdjusted"): number | null {
  const reps = features.previous_reps;
  const change = features.relative_load_change;
  if (!finite(reps) || reps < 1 || reps > 50 || !finite(change)) return null;
  if (kind === "repeatPrevious") return Math.abs(change) < 1e-9 ? reps : null;
  if (reps > 30) return null;
  // Constant estimated capacity at a neighboring load, using the engine's existing Epley yardstick.
  // This ignores between-set fatigue; it is a benchmark, not an exercise prescription.
  const ratio = 1 + change;
  if (ratio < 0.8 - 1e-9 || ratio > 1.05 + 1e-9) return null;
  if (Math.abs(change) < 1e-9) return reps;
  return Math.max(0, Math.min(50, 30 * (epley(1, reps) / ratio - 1)));
}
function comparison(samples: EvaluationSample[], kind: "repeatPrevious" | "loadAdjusted"): PairedComparison {
  const paired = samples.flatMap(s => {
    const predicted = baselineReps(s.features, kind);
    return predicted === null ? [] : [{ sample: s, baseline: predicted }];
  });
  const model = errorSummary(paired.map(p => ({ predicted: p.sample.predictedReps, actual: p.sample.actualReps })));
  const baseline = errorSummary(paired.map(p => ({ predicted: p.baseline, actual: p.sample.actualReps })));
  let modelWins = 0, ties = 0, baselineWins = 0;
  for (const p of paired) {
    const delta = Math.abs(p.baseline - p.sample.actualReps) - Math.abs(p.sample.predictedReps - p.sample.actualReps);
    if (Math.abs(delta) < 1e-9) ties++;
    else if (delta > 0) modelWins++;
    else baselineWins++;
  }
  return { model, baseline, maeImprovement: model.count ? baseline.meanAbsoluteError! - model.meanAbsoluteError! : null, modelWins, ties, baselineWins };
}
function comparisons(samples: EvaluationSample[]) {
  return { repeatPrevious: comparison(samples, "repeatPrevious"), loadAdjusted: comparison(samples, "loadAdjusted") };
}
export function buildEvaluationReport(modelVersion: string, samples: EvaluationSample[], coverage: EvaluationCoverage): EvaluationReport {
  if (samples.some(s => !finite(s.predictedReps) || !finite(s.actualReps) || s.predictedReps < 0 || s.predictedReps > 50 || s.actualReps <= 0)) throw new Error("Invalid evaluation sample");
  const summary = (xs: EvaluationSample[]) => errorSummary(xs.map(s => ({ predicted: s.predictedReps, actual: s.actualReps })));
  const withHistory = (s: EvaluationSample) => finite(s.features.previous_workout_first_reps) && s.features.previous_workout_first_reps > 0;
  return {
    format: "gain-ml-evaluation-v1", modelVersion, coverage: { ...coverage, evaluated: samples.length },
    model: summary(samples), comparisons: comparisons(samples),
    byExercise: [...new Set(samples.map(s => s.exerciseId))].sort().map(exerciseId => {
      const group = samples.filter(s => s.exerciseId === exerciseId);
      return { exerciseId, model: summary(group), comparisons: comparisons(group) };
    }),
    byHistory: { priorFirstSetUnavailable: summary(samples.filter(s => !withHistory(s))), priorFirstSetAvailable: summary(samples.filter(withHistory)) },
    featureCoverage: [...new Set(samples.flatMap(s => Object.keys(s.features)))].sort().map(feature => ({ feature,
      observed: samples.filter(s => knownFeature(feature, s.features[feature])).length,
      missing: samples.filter(s => !knownFeature(feature, s.features[feature])).length })),
    samples,
  };
}
