import { recommendLiveSet, predictNextReps, type Decision, type FeatureMap, type SetContext, type GymLoadSpec, type EquipmentType, type Measure, type SetupType, type XGBoostJSON, type ModelSchema, type LoggedSet } from "@gain/engine";
import type { SetRow } from "../db/workoutRepo";
import { effectiveOf, kindOf, type SetRowDraft } from "./workoutRows";

export const trustedWorkingSet = (s: SetRow): boolean => !s.warmup && !s.tags.includes("drop") && !s.tags.includes("failure") && (s.outlierStatus === "none" || s.outlierStatus === "confirmed") && s.durationS === null && s.distanceM === null && s.load > 0 && s.reps > 0;
export function nextAdaptiveRow(rows: SetRowDraft[]): SetRowDraft | undefined {
  const next = rows.find(r => !r.saved);
  return next && kindOf(next) === "normal" ? next : undefined;
}
/** The database does not record historic equipment or load convention. Missing inputs stay missing; RIR is never converted to RPE. */
export function liveContext(input: { exerciseId: string; measure: Measure; setup: SetupType; equipment: EquipmentType; sets: SetRow[]; rows: SetRowDraft[]; targetReps: number; last?: { performedAt: string; sets: LoggedSet[] } | null; supportedExerciseIds?: readonly string[] }): SetContext | null {
  if (input.measure !== "reps" || input.setup !== "free" || input.equipment === "assisted") return null;
  const next = nextAdaptiveRow(input.rows);
  if (!next || input.rows.some(r => r.saved && r.dirty)) return null;
  const latest = input.sets.filter(s => s.exerciseId === input.exerciseId).at(-1);
  if (!latest || !trustedWorkingSet(latest)) return null;
  const confirmed = input.sets.filter(s => trustedWorkingSet(s) && (!input.supportedExerciseIds || input.supportedExerciseIds.includes(s.exerciseId)));
  const exercise = confirmed.filter(s => s.exerciseId === input.exerciseId);
  const previous = exercise[exercise.length - 1];
  // First-time exercises may have no target/ghost weight for the next set.
  // Use the most recent saved, trusted working weight as the baseline instead of
  // suppressing a useful recommendation. An explicitly entered next load wins.
  const proposed = effectiveOf(next).load ?? previous?.load ?? null;
  if (!previous || proposed === null || proposed <= 0) return null;
  const prior = input.last?.sets.find(s => !s.warmup && !s.tags?.includes("drop") && !s.tags?.includes("failure") && (s.outlierStatus === undefined || s.outlierStatus === "none" || s.outlierStatus === "confirmed") && !s.durationS && !s.distanceM);
  const convention = input.equipment === "dumbbell" ? "per_dumbbell" : input.equipment === "barbell" ? "total_barbell_load" : input.equipment === "machine" || input.equipment === "cable" ? "displayed_machine_load" : "unknown";
  return {
    previousSetWeightKg: previous.load,
    proposedWeightKg: proposed,
    previousSetReps: previous.reps,
    firstWorkingSetReps: exercise[0]!.reps,
    priorWorkingVolume: exercise.reduce((n, s) => n + s.load * s.reps, 0),
    workingSetsBefore: exercise.length,
    loadConvention: convention,
    setIndex: exercise.length + 1,
    workoutSetsBefore: confirmed.length,
    targetReps: input.targetReps,
    priorWorkingReps: exercise.reduce((n, s) => n + s.reps, 0),
    previousWorkoutFirstWeightKg: prior?.load ?? null,
    previousWorkoutFirstReps: prior?.reps ?? null,
    // Exercise-line dates do not establish when shared equipment was last used.
    priorWorkoutsOnEquipment: null,
    daysSincePreviousWorkout: null,
    restSeconds: null,
    plannedRir: null,
    sleepHours: null,
    readiness: null,
    previousSetRpe: null,
  };
}
/** Static requires are discoverable by Metro, inside the function so launch does not parse the trees. */
let cached: { model: XGBoostJSON; schema: ModelSchema } | undefined;
export function localPrediction(features: FeatureMap): number {
  cached ??= { model: require("../../../../packages/engine/assets/live-adaptation-v2/model.json") as XGBoostJSON, schema: require("../../../../packages/engine/assets/live-adaptation-v2/schema.json") as ModelSchema };
  return predictNextReps(cached.model, cached.schema, features);
}
export function liveRecommendation(context: SetContext, targetMin: number, targetMax: number, loadSpec: GymLoadSpec, predict = localPrediction): Decision {
  return recommendLiveSet({ context, targetMin, targetMax, loadSpec, predict });
}
/** Manual load wins. Accepting a card changes only the next normal unlogged row's ghost. */
export function applyLiveLoad(rows: SetRowDraft[], key: string, load: number): SetRowDraft[] {
  const next = nextAdaptiveRow(rows);
  if (!next || next.key !== key || next.load !== null || !Number.isFinite(load) || load <= 0) return rows;
  return rows.map(r => r.key === key ? { ...r, ghostLoad: load } : r);
}
/** Stable across row keystrokes; dismissal lasts until the saved confirmed performance changes. */
export function livePerformanceKey(sets: SetRow[], exerciseId: string): string {
  return JSON.stringify(sets.filter(s => s.exerciseId === exerciseId && trustedWorkingSet(s)).map(s => [s.id,s.load,s.reps]));
}

export type ReportedSymptom = "severe_pain" | "dizziness";
/** Explicit user reports override the displayed policy. This path never calls the model. */
export function reportedSymptomDecision(decision: Decision, symptom?: ReportedSymptom): Decision {
  return symptom ? { ...decision, action: "stop", reason: "reported_symptoms" } : decision;
}
/** Failure never changes row data or deterministic plan; the logger can omit the optional card. */
export function tryLiveRecommendation(context: SetContext, targetMin: number, targetMax: number, loadSpec: GymLoadSpec, predict = localPrediction, onError?: (error: unknown) => void): Decision | null {
  try { return liveRecommendation(context, targetMin, targetMax, loadSpec, predict); }
  catch (error) { onError?.(error); return null; }
}
