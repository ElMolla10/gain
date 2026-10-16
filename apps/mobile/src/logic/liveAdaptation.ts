import { recommendLiveSet, predictNextReps, type Decision, type FeatureMap, type SetContext, type GymLoadSpec, type EquipmentType, type Measure, type SetupType, type XGBoostJSON, type ModelSchema, type LoggedSet } from "@gain/engine";
import type { SetRow } from "../db/workoutRepo";
import { effectiveOf, kindOf, type SetRowDraft } from "./workoutRows";

export const LIVE_MISSING_FEATURES = ["rest", "rir", "sleep", "readiness", "rpe", "equipment", "days"];
export const trustedWorkingSet = (s: SetRow): boolean => !s.warmup && !s.tags.includes("drop") && (s.outlierStatus === "none" || s.outlierStatus === "confirmed") && s.durationS === null && s.distanceM === null && s.load > 0 && s.reps > 0;
export function nextAdaptiveRow(rows: SetRowDraft[]): SetRowDraft | undefined {
  const next = rows.find(r => !r.saved);
  return next && kindOf(next) !== "warmup" && kindOf(next) !== "drop" ? next : undefined;
}
/** The database does not record historic equipment or load convention. Missing inputs stay missing; RIR is never converted to RPE. */
export function liveContext(input: { exerciseId: string; measure: Measure; setup: SetupType; equipment: EquipmentType; sets: SetRow[]; rows: SetRowDraft[]; targetReps: number; last?: { performedAt: string; sets: LoggedSet[] } | null; supportedExerciseIds?: readonly string[]; sessionFatigueReps?: number }): SetContext | null {
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
  const prior = input.last?.sets.find(s => !s.warmup && !s.tags?.includes("drop") && (s.outlierStatus === undefined || s.outlierStatus === "none" || s.outlierStatus === "confirmed") && !s.durationS && !s.distanceM);
  const convention = input.equipment === "dumbbell" ? "per_dumbbell" : input.equipment === "barbell" ? "total_barbell_load" : input.equipment === "machine" || input.equipment === "cable" ? "displayed_machine_load" : "unknown";
  let consecutiveVeryLowSets = 0;
  for (const set of [...exercise].reverse()) {
    if (set.reps > 2 || set.load > exercise[0]!.load) break;
    consecutiveVeryLowSets++;
  }
  return {
    previousSetWeightKg: previous.load,
    proposedWeightKg: proposed,
    previousSetReps: previous.reps,
    firstWorkingSetReps: exercise[0]!.reps,
    firstWorkingSetWeightKg: exercise[0]!.load,
    consecutiveVeryLowSets,
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
    sessionFatigueReps: input.sessionFatigueReps && input.sessionFatigueReps > 0 ? input.sessionFatigueReps : undefined,
  };
}
/** Static requires are discoverable by Metro, inside the function so launch does not parse the trees. */
let cached: { model: XGBoostJSON; schema: ModelSchema } | undefined;
export function localPrediction(features: FeatureMap): number {
  cached ??= { model: require("../../../../packages/engine/assets/live-adaptation-v2/model.json") as XGBoostJSON, schema: require("../../../../packages/engine/assets/live-adaptation-v2/schema.json") as ModelSchema };
  return predictNextReps(cached.model, cached.schema, features);
}
export function liveRecommendation(context: SetContext, targetMin: number, targetMax: number, loadSpec: GymLoadSpec | null, predict = localPrediction): Decision {
  return recommendLiveSet({ context, targetMin, targetMax, loadSpec, predict });
}
/** Fill only expected reps on the next working row. Typed reps and saved rows stay. */
export function applyExpectedReps(rows: SetRowDraft[], key: string, reps: number): SetRowDraft[] {
  const next = nextAdaptiveRow(rows);
  if (!next || next.key !== key || next.reps !== null || !Number.isInteger(reps) || reps < 1) return rows;
  if (next.ghostReps === reps) return rows;
  return rows.map(r => r.key === key ? { ...r, ghostReps: reps } : r);
}
/** Fill the next working row without overwriting either value the lifter typed. */
export function applyLiveTarget(rows: SetRowDraft[], key: string, load: number, reps: number): SetRowDraft[] {
  const next = nextAdaptiveRow(rows);
  if (!next || next.key !== key || !Number.isFinite(load) || load <= 0 || !Number.isInteger(reps) || reps < 1) return rows;
  if (next.ghostLoad === load && next.ghostReps === reps) return rows;
  return rows.map(r => r.key === key ? { ...r, ghostLoad: load, ghostReps: reps } : r);
}
/** "Use this": put the suggestion in the next working row, replacing typed values. Saved rows stay. */
export function takeLiveTarget(rows: SetRowDraft[], key: string, load: number, reps: number): SetRowDraft[] {
  const next = nextAdaptiveRow(rows);
  if (!next || next.key !== key || !Number.isFinite(load) || load <= 0 || !Number.isInteger(reps) || reps < 1) return rows;
  if (next.load === null && next.reps === null && next.ghostLoad === load && next.ghostReps === reps) return rows;
  return rows.map(r => r.key === key ? { ...r, load: null, reps: null, invalidLoad: false, invalidReps: false, ghostLoad: load, ghostReps: reps } : r);
}
/** "Enter my own": drop auto-filled ghosts on the next working row so the boxes are empty to type. */
export function clearLiveTarget(rows: SetRowDraft[], key: string): SetRowDraft[] {
  const next = nextAdaptiveRow(rows);
  if (!next || next.key !== key) return rows;
  if (next.ghostLoad === null && next.ghostReps === null) return rows;
  return rows.map(r => r.key === key ? { ...r, ghostLoad: null, ghostReps: null } : r);
}
/** A maintain recommendation is still a real weight recommendation.
 * Never invent one when inference is unavailable or the exercise should stop. */
export function suggestedNextLoad(decision: Decision | undefined, hasLoggedWorkingSet: boolean): number | null {
  if (!hasLoggedWorkingSet || !decision || decision.action === "stop") return null;
  return Number.isFinite(decision.suggestedWeightKg) && decision.suggestedWeightKg > 0 ? decision.suggestedWeightKg : null;
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
export function tryLiveRecommendation(context: SetContext, targetMin: number, targetMax: number, loadSpec: GymLoadSpec | null, predict = localPrediction, onError?: (error: unknown) => void): Decision | null {
  try { return liveRecommendation(context, targetMin, targetMax, loadSpec, predict); }
  catch (error) { onError?.(error); return null; }
}
