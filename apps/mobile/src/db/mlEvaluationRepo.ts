import type { FeatureMap } from "@gain/engine";
import type { Db, Deps } from "./driver";
import type { SetRow } from "./workoutRepo";
import { trustedWorkingSet } from "../logic/liveAdaptation";

export interface PendingPrediction {
  modelVersion: string; sessionId: string; exerciseId: string; targetSetId: string;
  predictedReps: number; proposedWeight: number; features: FeatureMap;
  /** All saved sets visible when inference ran, not just this exercise. */
  sources: SetRow[];
}
export interface MlAccuracy {
  count: number; meanAbsoluteError: number | null; withinOnePercent: number | null; withinTwoPercent: number | null;
}
const sourceSnapshot = (sets: SetRow[]) => JSON.stringify(sets.map(s => [s.id, s.exerciseId, s.load, s.reps, s.durationS, s.distanceM, s.warmup, s.tags, s.outlierStatus]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));

export function createMlEvaluationRepo(db: Db, deps: Deps) {
  /** Refuses stale/late inference. First prediction wins: typing achieved reps or repeated
   * renders must never replace a forecast with information about the result. */
  async function record(p: PendingPrediction): Promise<boolean> {
    if (!p.modelVersion || !p.targetSetId || !Number.isFinite(p.predictedReps) || p.predictedReps < 0 || p.predictedReps > 50
      || !Number.isFinite(p.proposedWeight) || p.proposedWeight <= 0
      || !p.sources.some(s => s.sessionId === p.sessionId && s.exerciseId === p.exerciseId && trustedWorkingSet(s))
      || p.sources.some(s => s.sessionId !== p.sessionId)
      || Object.values(p.features).some(v => v != null && !Number.isFinite(v))) return false;
    return db.transaction(async () => {
      const session = await db.get<{ status: string; deleted_at: number | null }>("SELECT status, deleted_at FROM session WHERE id = ?", [p.sessionId]);
      if (session?.status !== "in_progress" || session.deleted_at !== null) return false;
      if (await db.get("SELECT id FROM workout_set WHERE id = ?", [p.targetSetId])) return false;
      const raw = await db.all<{ id: string; exercise_id: string; load: number; reps: number; duration_s: number | null; distance_m: number | null; is_warmup: number; tags_json: string; outlier_status: SetRow["outlierStatus"] }>(
        "SELECT * FROM workout_set WHERE session_id = ? AND deleted_at IS NULL", [p.sessionId]);
      const current = raw.map(s => ({ id: s.id, exerciseId: s.exercise_id, load: s.load, reps: s.reps, durationS: s.duration_s, distanceM: s.distance_m, warmup: s.is_warmup === 1, tags: JSON.parse(s.tags_json), outlierStatus: s.outlier_status } as SetRow));
      if (sourceSnapshot(current) !== sourceSnapshot(p.sources)) return false;
      const features = JSON.stringify(Object.fromEntries(Object.entries(p.features).map(([key, value]) => [key, value ?? null])));
      // Historical first-set features also depend on prior exercise history. Conservatively
      // invalidate if any of that history is corrected, rather than retain a misleading score.
      const history = await db.all<{ id: string }>("SELECT id FROM workout_set WHERE exercise_id = ? AND session_id != ? AND deleted_at IS NULL ORDER BY id", [p.exerciseId, p.sessionId]);
      const sources = JSON.stringify([...p.sources.map(s => s.id), ...history.map(s => s.id)]);
      await db.run(`INSERT INTO ml_prediction
        (id, model_version, session_id, exercise_id, target_set_id, predicted_reps, proposed_weight, features_json, source_set_ids_json, generated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(target_set_id, model_version) DO NOTHING`,
        [deps.newId(), p.modelVersion, p.sessionId, p.exerciseId, p.targetSetId, p.predictedReps, p.proposedWeight, features, sources, deps.now()]);
      return true;
    });
  }

  async function skip(targetSetId: string): Promise<void> {
    // Serialize behind an in-flight capture on the dedicated maintenance connection.
    await db.transaction(async () => {
      await db.run("UPDATE ml_prediction SET state = 'invalid', invalid_reason = 'skipped' WHERE target_set_id = ? AND state = 'pending'", [targetSetId]);
    });
  }

  /** Only an unlogged pending target is rebound on resume; never use position to match results. */
  async function pendingTarget(sessionId: string, exerciseId: string, modelVersion: string): Promise<string | null> {
    const row = await db.get<{ target_set_id: string }>(`SELECT target_set_id FROM ml_prediction p
      WHERE session_id = ? AND exercise_id = ? AND model_version = ? AND state = 'pending'
        AND NOT EXISTS (SELECT 1 FROM workout_set w WHERE w.id = p.target_set_id)
      ORDER BY generated_at DESC, id LIMIT 1`, [sessionId, exerciseId, modelVersion]);
    return row?.target_set_id ?? null;
  }

  async function accuracy(modelVersion: string): Promise<MlAccuracy> {
    // Join the current source of truth as an additional guard for deletion/restore/sync.
    const row = (await db.get<{ n: number; mae: number | null; one: number | null; two: number | null }>(`SELECT COUNT(*) AS n,
      AVG(p.absolute_error) AS mae, AVG(p.within_one) * 100 AS one, AVG(p.within_two) * 100 AS two
      FROM ml_prediction p JOIN workout_set w ON w.id = p.target_set_id JOIN session s ON s.id = p.session_id
      WHERE p.model_version = ? AND p.state = 'evaluated' AND s.deleted_at IS NULL AND s.status IN ('in_progress','finished') AND w.deleted_at IS NULL
        AND w.session_id = p.session_id AND w.exercise_id = p.exercise_id AND w.load = p.proposed_weight
        AND w.reps = p.actual_reps AND w.is_warmup = 0 AND w.duration_s IS NULL AND w.distance_m IS NULL
        AND w.outlier_status IN ('none','confirmed')
        AND NOT EXISTS (SELECT 1 FROM json_each(w.tags_json) WHERE value IN ('drop','failure'))`, [modelVersion]))!;
    return { count: row.n, meanAbsoluteError: row.mae, withinOnePercent: row.one, withinTwoPercent: row.two };
  }
  return { record, skip, pendingTarget, accuracy };
}
export type MlEvaluationRepo = ReturnType<typeof createMlEvaluationRepo>;
