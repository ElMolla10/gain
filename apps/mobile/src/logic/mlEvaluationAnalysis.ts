import { baselineReps, buildEvaluationReport, type EvaluationReport, type EvaluationSample } from "./mlEvaluationReport";

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const label = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

/** Treat shared JSON as untrusted. Recompute all scores rather than trusting stored summaries. */
export function parseEvaluationExport(input: unknown): EvaluationReport {
  if (!object(input) || input.format !== "gain-ml-evaluation-v1" || !label(input.modelVersion)
    || !Array.isArray(input.samples) || !object(input.coverage)) throw new Error("Not a GAIN evaluation export");
  for (const sample of input.samples) {
    if (!object(sample) || !label(sample.exerciseId) || !finite(sample.predictedReps) || sample.predictedReps < 0 || sample.predictedReps > 50
      || !finite(sample.actualReps) || sample.actualReps <= 0 || !Number.isInteger(sample.actualReps)
      || (sample.sessionGroup !== undefined && !label(sample.sessionGroup)) || !object(sample.features)
      || Object.values(sample.features).some(value => value !== null && !finite(value))) throw new Error("Invalid evaluation sample");
  }
  const coverage = input.coverage;
  for (const key of ["captured", "pending", "invalidated", "excludedCurrentState"] as const) {
    if (!finite(coverage[key]) || !Number.isSafeInteger(coverage[key]) || coverage[key] < 0) throw new Error("Invalid evaluation coverage");
  }
  const { captured, pending, invalidated, excludedCurrentState } = coverage as unknown as EvaluationReport["coverage"];
  if (captured !== input.samples.length + pending + invalidated + excludedCurrentState) throw new Error("Evaluation coverage does not reconcile");
  return buildEvaluationReport(input.modelVersion, input.samples as EvaluationSample[], { captured, pending, invalidated, excludedCurrentState });
}

interface Interval {
  method: "session-cluster-percentile-bootstrap";
  confidence: 0.95;
  resamples: number;
  seed: number;
  minimumSessions: number;
  pairedSessions: number;
  ungroupedSamples: number;
  lower: number | null;
  upper: number | null;
  unavailableReason: "missing-session-groups" | "too-few-sessions" | null;
}
const SEED = 20261015;
const RESAMPLES = 2000;
const MINIMUM_SESSIONS = 5;

/** Resample whole sessions, retaining all paired sets and their correlation within each draw.
 * Statistic is set-weighted baseline MAE minus model MAE, matching the paired headline.
 * This is within-one-export uncertainty, never between-person generalization. */
function pairedInterval(samples: EvaluationSample[], kind: "repeatPrevious" | "loadAdjusted"): Interval {
  const groups = new Map<string, { sum: number; count: number }>();
  let ungroupedSamples = 0;
  for (const sample of samples) {
    const baseline = baselineReps(sample.features, kind);
    if (baseline === null) continue;
    if (!sample.sessionGroup) { ungroupedSamples++; continue; }
    const group = groups.get(sample.sessionGroup) ?? { sum: 0, count: 0 };
    group.sum += Math.abs(baseline - sample.actualReps) - Math.abs(sample.predictedReps - sample.actualReps);
    group.count++;
    groups.set(sample.sessionGroup, group);
  }
  const result: Interval = { method: "session-cluster-percentile-bootstrap", confidence: 0.95, resamples: RESAMPLES,
    seed: SEED, minimumSessions: MINIMUM_SESSIONS, pairedSessions: groups.size, ungroupedSamples,
    lower: null, upper: null, unavailableReason: ungroupedSamples ? "missing-session-groups" : groups.size < MINIMUM_SESSIONS ? "too-few-sessions" : null };
  if (result.unavailableReason) return result;
  const clusters = [...groups.values()];
  // Fixed seed for reproducible offline reports. No global random state or inference calls.
  let state = SEED;
  const random = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
  const draws: number[] = [];
  for (let i = 0; i < RESAMPLES; i++) {
    let sum = 0, count = 0;
    for (let j = 0; j < clusters.length; j++) {
      const group = clusters[Math.floor(random() * clusters.length)]!;
      sum += group.sum;
      count += group.count;
    }
    draws.push(sum / count);
  }
  draws.sort((a, b) => a - b);
  const quantile = (p: number) => {
    const position = (draws.length - 1) * p, left = Math.floor(position), fraction = position - left;
    return draws[left]! * (1 - fraction) + draws[Math.min(left + 1, draws.length - 1)]! * fraction;
  };
  return { ...result, lower: quantile(0.025), upper: quantile(0.975) };
}

/** Descriptive error tail, NOT an injury/safety rate or calibrated probability. */
function overprediction(samples: EvaluationSample[]) {
  const errors = samples.map(s => s.predictedReps - s.actualReps);
  const count = errors.filter(error => error >= 3).length;
  return { thresholdReps: 3, count, percent: errors.length ? count / errors.length * 100 : null };
}
export function analyzeEvaluation(report: EvaluationReport) {
  const summarize = (samples: EvaluationSample[]) => {
    const { model, comparisons } = buildEvaluationReport(report.modelVersion, samples,
      { captured: samples.length, pending: 0, invalidated: 0, excludedCurrentState: 0 });
    return { model, comparisons, overprediction: overprediction(samples) };
  };
  const cohort = (name: string, predicate: (s: EvaluationSample) => boolean) => ({ name, ...summarize(report.samples.filter(predicate)) });
  const change = (s: EvaluationSample) => s.features.relative_load_change;
  const observed = (s: EvaluationSample, feature: string) => finite(s.features[feature]);
  return {
    scope: "single-export-within-device" as const,
    sessionCount: new Set(report.samples.flatMap(s => s.sessionGroup ? [s.sessionGroup] : [])).size,
    overprediction: overprediction(report.samples),
    uncertainty: {
      repeatPrevious: pairedInterval(report.samples, "repeatPrevious"),
      loadAdjusted: pairedInterval(report.samples, "loadAdjusted"),
    },
    byLoadChange: [
      cohort("unchanged", s => finite(change(s)) && Math.abs(change(s)!) < 1e-9),
      cohort("decreased", s => finite(change(s)) && change(s)! <= -1e-9),
      cohort("increased", s => finite(change(s)) && change(s)! >= 1e-9),
      cohort("unknown", s => !finite(change(s))),
    ],
    byPriorHistory: [
      cohort("available", s => observed(s, "previous_workout_first_reps") && s.features.previous_workout_first_reps! > 0),
      cohort("unavailable", s => !observed(s, "previous_workout_first_reps") || s.features.previous_workout_first_reps! <= 0),
    ],
    byFeatureAvailability: ["previous_set_rpe", "rest_before_set_seconds", "sleep_hours", "readiness_self_report"].map(feature => ({ feature,
      observed: summarize(report.samples.filter(s => observed(s, feature))),
      missing: summarize(report.samples.filter(s => !observed(s, feature))),
    })),
    limitations: [
      "Logged reps may be capped by the chosen target; they are not measured capacity.",
      "Intervals resample sessions within one export, not independent lifters; five sessions is a reporting floor, not evidence of adequate power.",
      "Only paired eligible sets are compared; capture and benchmark exclusions can bias coverage.",
      "The overprediction tail is a descriptive prediction error, not a safety event rate or calibration measure.",
      "Do not concatenate overlapping exports, tune on evaluation sessions, or infer real-world superiority from synthetic/test data.",
    ],
  };
}
