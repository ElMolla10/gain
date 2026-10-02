import {
  bodyweightPace,
  epley,
  liftPace,
  musclePace,
  type BodyweightEntry,
  type BodyweightPace,
  type LiftExposure,
  type LiftPace,
  type MusclePace,
} from "@gain/engine";
import { groupOfPattern, type MuscleGroup } from "../logic/exposure";
import type { GoalInput } from "../logic/onboarding";
import type { Db, Deps } from "./driver";
import type { Repos } from "./repos";

export type PaceResult =
  | { kind: "none" }
  | { kind: "lift"; goal: Extract<GoalInput, { kind: "lift" }>; pace: LiftPace }
  | { kind: "bodyweight"; goal: Extract<GoalInput, { kind: "bodyweight" }>; pace: BodyweightPace }
  | { kind: "muscle"; goal: Extract<GoalInput, { kind: "muscle" }>; pace: MusclePace };

/** Highest rep count that still counts toward an estimated 1RM. Long sets are poor predictors. */
export const E1RM_MAX_REPS = 12;

export interface WeighIn {
  id: string;
  kg: number;
  at: number;
}

/**
 * Goals and pace data layer: the one goal, weigh-ins, and the numbers the pace functions read from the lifter's own logs.
 * Everything is stored in kilograms. Imported history counts the same as logged sessions.
 */
export function createGoalRepo(db: Db, deps: Deps, repos: Repos) {
  const { newId, now } = deps;

  async function getGoal(): Promise<GoalInput | null> {
    const r = await db.get<{ kind: "lift" | "bodyweight" | "muscle"; exercise_id: string | null; target_load: number | null; target_reps: number | null; target_weight_kg: number | null; target_date: string | null; note: string | null }>(
      "SELECT kind, exercise_id, target_load, target_reps, target_weight_kg, target_date, note FROM goal WHERE deleted_at IS NULL ORDER BY created_at DESC, rowid DESC LIMIT 1",
    );
    if (!r) return null;
    if (r.kind === "lift") return { kind: "lift", exerciseId: r.exercise_id!, targetLoad: r.target_load!, targetReps: r.target_reps!, targetDate: r.target_date };
    if (r.kind === "bodyweight") return { kind: "bodyweight", targetWeightKg: r.target_weight_kg!, targetDate: r.target_date };
    return { kind: "muscle", muscle: r.note as MuscleGroup };
  }

  /** One goal at a time: the earlier goal is retired (soft delete), never edited in place. The caller validates with `buildGoal`. */
  async function setGoal(goal: GoalInput): Promise<void> {
    const t = now();
    const id = newId();
    await db.transaction(async () => {
      await db.run("UPDATE goal SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL", [t, t]);
      if (goal.kind === "lift")
        await db.run("INSERT INTO goal (id, kind, exercise_id, target_load, target_reps, target_date, created_at, updated_at) VALUES (?, 'lift', ?, ?, ?, ?, ?, ?)", [id, goal.exerciseId, goal.targetLoad, goal.targetReps, goal.targetDate, t, t]);
      else if (goal.kind === "bodyweight")
        await db.run("INSERT INTO goal (id, kind, target_weight_kg, target_date, created_at, updated_at) VALUES (?, 'bodyweight', ?, ?, ?, ?)", [id, goal.targetWeightKg, goal.targetDate, t, t]);
      else await db.run("INSERT INTO goal (id, kind, note, created_at, updated_at) VALUES (?, 'muscle', ?, ?, ?)", [id, goal.muscle, t, t]);
    });
  }

  async function clearGoal(): Promise<void> {
    const t = now();
    await db.run("UPDATE goal SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL", [t, t]);
  }

  async function addWeighIn(kg: number, at: number = now()): Promise<string> {
    if (!(kg >= 30 && kg <= 300)) throw new Error("Bodyweight must be between 30 and 300 kg");
    const id = newId();
    const t = now();
    await db.run("INSERT INTO bodyweight_entry (id, weight_kg, measured_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [id, kg, at, t, t]);
    await repos.setSetting("bodyweight_kg", String(kg));
    return id;
  }

  async function deleteWeighIn(id: string): Promise<void> {
    const t = now();
    await db.run("UPDATE bodyweight_entry SET deleted_at = ?, updated_at = ? WHERE id = ?", [t, t, id]);
  }

  /** Newest first. */
  async function listWeighIns(limit = 30): Promise<WeighIn[]> {
    const rows = await db.all<{ id: string; weight_kg: number; measured_at: number }>(
      "SELECT id, weight_kg, measured_at FROM bodyweight_entry WHERE deleted_at IS NULL ORDER BY measured_at DESC, rowid DESC LIMIT ?",
      [limit],
    );
    return rows.map((r) => ({ id: r.id, kg: r.weight_kg, at: r.measured_at }));
  }

  /**
   * One exposure per finished session: the best estimated 1RM of its working sets (reps 1-12). Warm-ups, rejected sets and sets
   * still waiting for an outlier confirm are left out. All gyms and setups of the exercise count: pace is about the lift, not one rack.
   */
  async function liftExposures(exerciseId: string): Promise<LiftExposure[]> {
    const rows = await db.all<{ sid: string; at: number; load: number; reps: number }>(
      `SELECT s.id AS sid, COALESCE(s.finished_at, s.started_at, s.created_at) AS at, ws.load AS load, ws.reps AS reps
         FROM workout_set ws JOIN session s ON s.id = ws.session_id
        WHERE ws.exercise_id = ? AND s.status = 'finished' AND ws.deleted_at IS NULL AND s.deleted_at IS NULL
          AND ws.is_warmup = 0 AND ws.outlier_status IN ('none','confirmed') AND ws.reps >= 1 AND ws.reps <= ? AND ws.load > 0
        ORDER BY at`,
      [exerciseId, E1RM_MAX_REPS],
    );
    const best = new Map<string, LiftExposure>();
    for (const r of rows) {
      const e = epley(r.load, r.reps);
      const cur = best.get(r.sid);
      if (!cur || e > cur.e1rm) best.set(r.sid, { at: r.at, e1rm: e });
    }
    return [...best.values()].sort((a, b) => a.at - b.at);
  }

  async function bodyweightEntries(): Promise<BodyweightEntry[]> {
    return (await listWeighIns(400)).map((w) => ({ at: w.at, kg: w.kg }));
  }

  /** Finished-session times that trained the muscle group with at least one working set. */
  async function muscleSessionTimes(muscle: MuscleGroup): Promise<number[]> {
    const rows = await db.all<{ sid: string; at: number; pattern: string }>(
      `SELECT DISTINCT s.id AS sid, COALESCE(s.finished_at, s.started_at, s.created_at) AS at, e.pattern AS pattern
         FROM workout_set ws JOIN session s ON s.id = ws.session_id JOIN exercise e ON e.id = ws.exercise_id
        WHERE s.status = 'finished' AND ws.deleted_at IS NULL AND s.deleted_at IS NULL AND ws.is_warmup = 0
          AND ws.outlier_status IN ('none','confirmed')`,
    );
    const seen = new Set<string>();
    const out: number[] = [];
    for (const r of rows) {
      if (groupOfPattern(r.pattern) !== muscle || seen.has(r.sid)) continue;
      seen.add(r.sid);
      out.push(r.at);
    }
    return out.sort((a, b) => a - b);
  }

  /** The pace of the current goal, with the numbers it used. `nowMs` is a parameter so tests and screens agree on "today". */
  async function getPace(nowMs: number = now()): Promise<PaceResult> {
    const goal = await getGoal();
    if (!goal) return { kind: "none" };
    if (goal.kind === "lift") {
      return { kind: "lift", goal, pace: liftPace({ targetLoad: goal.targetLoad, targetReps: goal.targetReps, targetDate: goal.targetDate }, await liftExposures(goal.exerciseId), nowMs) };
    }
    if (goal.kind === "bodyweight") {
      return { kind: "bodyweight", goal, pace: bodyweightPace({ targetKg: goal.targetWeightKg, targetDate: goal.targetDate }, await bodyweightEntries(), nowMs) };
    }
    const start = await db.get<{ t: number | null }>("SELECT MIN(created_at) AS t FROM goal WHERE kind = 'muscle' AND deleted_at IS NULL");
    return { kind: "muscle", goal, pace: musclePace(await muscleSessionTimes(goal.muscle), nowMs, start?.t ?? null) };
  }

  return { getGoal, setGoal, clearGoal, addWeighIn, deleteWeighIn, listWeighIns, liftExposures, muscleSessionTimes, getPace };
}
export type GoalRepo = ReturnType<typeof createGoalRepo>;
