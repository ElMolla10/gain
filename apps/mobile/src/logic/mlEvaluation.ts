import { buildLiveAdaptationFeatures, type Decision, type SetContext } from "@gain/engine";
import type { PendingPrediction } from "../db/mlEvaluationRepo";
import type { SetRow } from "../db/workoutRepo";
import type { SetRowDraft } from "./workoutRows";
import { nextAdaptiveRow } from "./liveAdaptation";
import { formatNumber } from "./dateText";

export const LIVE_MODEL_VERSION: string = require("../../../../packages/engine/assets/live-adaptation-v2/schema.json").model_version;

/** Repetitions, counts and percentages must never pass through the kg/lb formatter. */
export const formatMlNumber = (value: number, lang: "en" | "ar", decimals = 0): string => formatNumber(value, lang, decimals);

/** The policy's chosen prediction is for suggestedWeightKg, not necessarily the original load.
 * Stop/symptom cards and targets with typed outcome reps are not evaluation forecasts. */
export function evaluationPrediction(sessionId: string, exerciseId: string, rows: SetRowDraft[], sources: SetRow[], context: SetContext, decision: Decision): PendingPrediction | null {
  const target = nextAdaptiveRow(rows);
  if (!target || target.reps !== null || decision.action === "stop" || decision.reason === "reported_symptoms") return null;
  return {
    modelVersion: LIVE_MODEL_VERSION, sessionId, exerciseId, targetSetId: target.key,
    predictedReps: decision.predictedReps, proposedWeight: decision.suggestedWeightKg,
    features: buildLiveAdaptationFeatures({ ...context, proposedWeightKg: decision.suggestedWeightKg }), sources,
  };
}

/** Restore only the identity, never invent or alter a load/rep target. */
export function resumeEvaluationTarget(rows: SetRowDraft[], targetId: string | null): SetRowDraft[] {
  const target = nextAdaptiveRow(rows);
  if (!targetId || !target) return rows;
  return rows.map(row => row.key === target.key ? { ...row, key: targetId } : row);
}
