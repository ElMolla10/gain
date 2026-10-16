import { AGE_STANDARD_LOADERS } from "../data/synthetic-standards";
import manifest from "../data/synthetic-standards/manifest.json";
import exerciseModels from "../data/synthetic-standards/exercises.json";

export type ComparisonSex = "male" | "female";
export type ModelBasis = "published_anchor" | "synthetic_estimate";
type ModelMetric = "load" | "reps" | "seconds" | "assisted" | "carry" | "weighted_hold";
type Row = { male: number; female: number; basis: ModelBasis; metric: ModelMetric; weightedEligible?: boolean } | null;
type AgeFile = { ageClass: "youth" | "adult"; male: (number | null)[]; female: (number | null)[] };
const modelIndex = new Map(exerciseModels.map((model, index) => [model.key, { ...model, index }]));

function modelRow(seedKey: string, age: number): Row {
  const meta = modelIndex.get(seedKey);
  if (!meta?.metric) return null;
  const file = AGE_STANDARD_LOADERS[age - 12]?.() as AgeFile | undefined;
  const male = file?.male[meta.index], female = file?.female[meta.index];
  if (male == null || female == null) return null;
  return { male, female, metric: meta.metric as ModelMetric, basis: age <= 17 ? "synthetic_estimate" : meta.basis as ModelBasis, weightedEligible: meta.weightedEligible };
}

/** Rank-like GAIN index against a deterministic synthetic median, never a population percentile. */
export function modeledStrengthIndex(seedKey: string, e1rmKg: number, sex: ComparisonSex, age: number, bodyweightKg: number, heightCm: number): { score: number; baselineKg: number; basis: ModelBasis; ageClass: "youth" | "adult" } | null {
  if (!Number.isInteger(age) || age < 12 || age > 100 || !Number.isFinite(bodyweightKg) || bodyweightKg < 25 || bodyweightKg > 400 ||
      !Number.isFinite(heightCm) || heightCm < 100 || heightCm > 230 || !Number.isFinite(e1rmKg) || e1rmKg <= 0) return null;
  const row = modelRow(seedKey, age);
  if (!row || row.metric !== "load") return null;
  const reference = manifest.reference[sex];
  const baselineKg = row[sex] * Math.pow(bodyweightKg / reference.bodyweightKg, manifest.bodyweightExponent)
    * Math.pow(heightCm / reference.heightCm, manifest.heightExponent);
  if (!Number.isFinite(baselineKg) || baselineKg <= 0) return null;
  const score = Math.round(Math.max(0, Math.min(1000, 500 + 250 * Math.log2(e1rmKg / baselineKg))));
  return { score, baselineKg: Math.round(baselineKg * 10) / 10, basis: row.basis, ageClass: age <= 17 ? "youth" : "adult" };
}

export function modeledBodyweightIndex(seedKey: string, performance: { reps: number; load: number; seconds: number | null }, sex: ComparisonSex, age: number, bodyweightKg: number, heightCm: number): { score: number; baseline: number; value: number; metric: "reps" | "seconds" | "weighted_bodyweight"; ageClass: "youth" | "adult" } | null {
  if (!Number.isInteger(age) || age < 12 || age > 100 || !Number.isFinite(bodyweightKg) || bodyweightKg < 25 || bodyweightKg > 400 ||
      !Number.isFinite(heightCm) || heightCm < 100 || heightCm > 230 || !Number.isFinite(performance.load) || performance.load < 0) return null;
  const row = modelRow(seedKey, age);
  if (!row || (row.metric !== "reps" && row.metric !== "seconds")) return null;
  const reference = manifest.reference[sex];
  let baseline = row[sex] * Math.pow(reference.bodyweightKg / bodyweightKg, .2) * Math.pow(reference.heightCm / heightCm, .08);
  let metric: "reps" | "seconds" | "weighted_bodyweight" = row.metric;
  let value = row.metric === "seconds" ? performance.seconds ?? 0 : performance.reps;
  if (performance.load > 0) {
    // Only whole-body vertical movements use this model; push-ups do not lift 100% of bodyweight.
    if (!row.weightedEligible || row.metric !== "reps" || !Number.isInteger(performance.reps) || performance.reps < 1 || performance.reps > 10) return null;
    metric = "weighted_bodyweight";
    baseline = bodyweightKg * (1 + baseline / 30);
    value = (bodyweightKg + performance.load) * (performance.reps === 1 ? 1 : 1 + performance.reps / 30);
  }
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(baseline) || baseline <= 0) return null;
  const score = Math.round(Math.max(0, Math.min(1000, 500 + 250 * Math.log2(value / baseline))));
  return { score, baseline: Math.round(baseline * 10) / 10, value: Math.round(value * 10) / 10, metric, ageClass: age <= 17 ? "youth" : "adult" };
}

/** Distinct experimental metrics; assistance is subtracted, while carry work and loaded hold are proxies. */
export function modeledAlternativeIndex(seedKey: string, performance: { load: number; reps: number; seconds: number | null; distance: number | null }, sex: ComparisonSex, age: number, bodyweightKg: number, heightCm: number): { score: number; value: number; metric: "assisted" | "carry" | "weighted_hold"; ageClass: "youth" | "adult" } | null {
  if (!Number.isInteger(age) || age < 12 || age > 100 || !Number.isFinite(bodyweightKg) || bodyweightKg < 25 || bodyweightKg > 400 ||
      !Number.isFinite(heightCm) || heightCm < 100 || heightCm > 230 || !Number.isFinite(performance.load)) return null;
  const row = modelRow(seedKey, age);
  if (!row || (row.metric !== "assisted" && row.metric !== "carry" && row.metric !== "weighted_hold")) return null;
  const reference = manifest.reference[sex];
  const scale = Math.pow(reference.bodyweightKg / bodyweightKg, .2) * Math.pow(reference.heightCm / heightCm, .08);
  const baseline = row[sex] * scale;
  let value: number;
  let comparison: number;
  if (row.metric === "assisted") {
    if (performance.load < 0 || performance.load >= bodyweightKg || !Number.isInteger(performance.reps) || performance.reps < 1 || performance.reps > 10) return null;
    value = (bodyweightKg - performance.load) * (1 + performance.reps / 30);
    comparison = bodyweightKg * (1 + baseline / 30);
  } else if (row.metric === "carry") {
    if (performance.load <= 0 || !performance.distance || performance.distance <= 0) return null;
    // The logged load is the total stated load; distance times load fraction is a simple work proxy.
    value = performance.distance * performance.load / bodyweightKg;
    comparison = baseline * .35;
  } else {
    if (performance.load <= 0 || !performance.seconds || performance.seconds <= 0) return null;
    value = performance.seconds * (1 + performance.load / bodyweightKg);
    comparison = baseline * 1.2;
  }
  if (!Number.isFinite(value) || !Number.isFinite(comparison) || comparison <= 0) return null;
  return { score: Math.round(Math.max(0, Math.min(1000, 500 + 250 * Math.log2(value / comparison)))),
    value: Math.round(value * 10) / 10, metric: row.metric, ageClass: age <= 17 ? "youth" : "adult" };
}
