import { isTimedMeasure, liftTrend, MAX_METRES, MAX_PLAUSIBLE_REPS, MAX_SECONDS, timedTrend, type HistorySession, type Measure, type LiftTrend, type LoggedSet, type OutlierStatus, type SetupType } from "@gain/engine";
import type { Db, Deps } from "./driver";
import type { FinishRepo } from "./finishRepo";
import type { Repos } from "./repos";

export class HistoryInvalid extends Error {
  constructor(public readonly code: "reps" | "load" | "rir" | "missing" | "duration" | "distance") {
    super(`Cannot save that set: ${code}`);
  }
}

export interface SessionListItem {
  id: string;
  dayName: string;
  gymName: string;
  finishedAt: number;
  exercises: number;
  workingSets: number;
  imported: boolean;
}
export interface HistorySetRow {
  id: string;
  load: number;
  reps: number;
  /** Seconds held (time exercises) or metres carried (distance exercises); null for reps exercises. */
  durationS: number | null;
  distanceM: number | null;
  rir: number | null;
  warmup: boolean;
  tags: string[];
  outlierStatus: OutlierStatus;
}
export interface SessionDetail {
  id: string;
  dayName: string;
  gymName: string;
  finishedAt: number;
  imported: boolean;
  exercises: { exerciseId: string; nameEn: string; nameAr: string; setup: SetupType; measure: Measure; sets: HistorySetRow[] }[];
}
export interface LiftItem {
  lineId: string;
  exerciseId: string;
  nameEn: string;
  nameAr: string;
  gymName: string;
  setup: SetupType;
  measure: Measure;
  sessions: number;
  lastAt: number;
  hasImported: boolean;
}

export const MAX_LOAD_KG = 2000;

/** Past sessions, per-lift trends, and correcting a logged set. Reads finished sessions only; edits resync planned targets. */
export function createHistoryRepo(db: Db, deps: Deps, repos: Repos, finish: FinishRepo) {
  const { now } = deps;

  async function listSessions(limit = 30, offset = 0): Promise<SessionListItem[]> {
    const rows = await db.all<{ id: string; day_name: string; gym_name: string; finished_at: number; imported: number; exercises: number; sets: number }>(
      `SELECT s.id, d.name AS day_name, g.name AS gym_name, s.finished_at, (s.import_key IS NOT NULL) AS imported,
              (SELECT COUNT(DISTINCT ws.exercise_id) FROM workout_set ws WHERE ws.session_id = s.id AND ws.deleted_at IS NULL) AS exercises,
              (SELECT COUNT(*) FROM workout_set ws WHERE ws.session_id = s.id AND ws.deleted_at IS NULL AND ws.is_warmup = 0) AS sets
         FROM session s JOIN programme_day d ON d.id = s.programme_day_id JOIN gym g ON g.id = s.gym_id
        WHERE s.status = 'finished' AND s.deleted_at IS NULL AND s.finished_at IS NOT NULL
        ORDER BY s.finished_at DESC, s.rowid DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    return rows.map((r) => ({ id: r.id, dayName: r.day_name, gymName: r.gym_name, finishedAt: r.finished_at, exercises: r.exercises, workingSets: r.sets, imported: r.imported === 1 }));
  }

  async function countSessions(): Promise<number> {
    return (await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM session WHERE status = 'finished' AND deleted_at IS NULL AND finished_at IS NOT NULL"))!.n;
  }

  async function getSession(id: string): Promise<SessionDetail | null> {
    const s = await db.get<{ id: string; day_name: string; gym_name: string; finished_at: number; imported: number }>(
      `SELECT s.id, d.name AS day_name, g.name AS gym_name, s.finished_at, (s.import_key IS NOT NULL) AS imported
         FROM session s JOIN programme_day d ON d.id = s.programme_day_id JOIN gym g ON g.id = s.gym_id
        WHERE s.id = ? AND s.status = 'finished' AND s.deleted_at IS NULL`,
      [id],
    );
    if (!s) return null;
    const rows = await db.all<{
      id: string; exercise_id: string; name_en: string; name_ar: string; setup: SetupType; measure: Measure; load: number; reps: number; duration_s: number | null; distance_m: number | null; rir: number | null;
      is_warmup: number; tags_json: string; outlier_status: OutlierStatus;
    }>(
      `SELECT ws.id, ws.exercise_id, e.name_en, e.name_ar, l.setup, e.measure, ws.load, ws.reps, ws.duration_s, ws.distance_m, ws.rir, ws.is_warmup, ws.tags_json, ws.outlier_status
         FROM workout_set ws JOIN exercise e ON e.id = ws.exercise_id JOIN exercise_line l ON l.id = ws.line_id
        WHERE ws.session_id = ? AND ws.deleted_at IS NULL ORDER BY ws.created_at, ws.position, ws.rowid`,
      [id],
    );
    const exercises: SessionDetail["exercises"] = [];
    for (const r of rows) {
      let ex = exercises.find((e) => e.exerciseId === r.exercise_id);
      if (!ex) {
        ex = { exerciseId: r.exercise_id, nameEn: r.name_en, nameAr: r.name_ar, setup: r.setup, measure: r.measure, sets: [] };
        exercises.push(ex);
      }
      ex.sets.push({ id: r.id, load: r.load, reps: r.reps, durationS: r.duration_s, distanceM: r.distance_m, rir: r.rir, warmup: r.is_warmup === 1, tags: JSON.parse(r.tags_json) as string[], outlierStatus: r.outlier_status });
    }
    return { id: s.id, dayName: s.day_name, gymName: s.gym_name, finishedAt: s.finished_at, imported: s.imported === 1, exercises };
  }

  /** Every exercise + gym + setup line that has at least one finished working set. Lines are never merged. */
  async function listLifts(): Promise<LiftItem[]> {
    const rows = await db.all<{ line_id: string; exercise_id: string; name_en: string; name_ar: string; gym_name: string; setup: SetupType; measure: Measure; sessions: number; last_at: number; imported: number }>(
      `SELECT l.id AS line_id, e.id AS exercise_id, e.name_en, e.name_ar, g.name AS gym_name, l.setup, e.measure,
              COUNT(DISTINCT s.id) AS sessions, MAX(s.finished_at) AS last_at, MAX(s.import_key IS NOT NULL) AS imported
         FROM exercise_line l JOIN exercise e ON e.id = l.exercise_id JOIN gym g ON g.id = l.gym_id
         JOIN workout_set ws ON ws.line_id = l.id AND ws.deleted_at IS NULL AND ws.is_warmup = 0
         JOIN session s ON s.id = ws.session_id AND s.status = 'finished' AND s.deleted_at IS NULL
        WHERE l.deleted_at IS NULL GROUP BY l.id ORDER BY last_at DESC`,
    );
    return rows.map((r) => ({
      lineId: r.line_id, exerciseId: r.exercise_id, nameEn: r.name_en, nameAr: r.name_ar, gymName: r.gym_name, setup: r.setup, measure: r.measure,
      sessions: r.sessions, lastAt: r.last_at, hasImported: r.imported === 1,
    }));
  }

  async function getLiftTrend(lineId: string): Promise<{ lift: LiftItem; trend: LiftTrend } | null> {
    const lift = (await listLifts()).find((l) => l.lineId === lineId);
    if (!lift) return null;
    const rows = await db.all<{ sid: string; finished_at: number; imported: number; load: number; reps: number; duration_s: number | null; distance_m: number | null; rir: number | null; is_warmup: number; tags_json: string; outlier_status: OutlierStatus }>(
      `SELECT s.id AS sid, s.finished_at, (s.import_key IS NOT NULL) AS imported, ws.load, ws.reps, ws.duration_s, ws.distance_m, ws.rir, ws.is_warmup, ws.tags_json, ws.outlier_status
         FROM workout_set ws JOIN session s ON s.id = ws.session_id
        WHERE ws.line_id = ? AND s.status = 'finished' AND ws.deleted_at IS NULL AND s.deleted_at IS NULL AND s.finished_at IS NOT NULL
        ORDER BY s.finished_at, ws.position`,
      [lineId],
    );
    const line = { exerciseId: lift.exerciseId, gymId: "", setup: lift.setup };
    const bySession = new Map<string, HistorySession>();
    const imported = new Set<number>();
    for (const r of rows) {
      let h = bySession.get(r.sid);
      if (!h) {
        h = { line, performedAt: new Date(r.finished_at).toISOString(), sets: [] };
        bySession.set(r.sid, h);
        if (r.imported === 1) imported.add(r.finished_at);
      }
      const set: LoggedSet = { load: r.load, reps: r.reps, ...(r.duration_s !== null ? { durationS: r.duration_s } : {}), ...(r.distance_m !== null ? { distanceM: r.distance_m } : {}), rir: r.rir, warmup: r.is_warmup === 1, tags: JSON.parse(r.tags_json) as string[], outlierStatus: r.outlier_status };
      h.sets.push(set);
    }
    const sessions = [...bySession.values()];
    return { lift, trend: isTimedMeasure(lift.measure) ? timedTrend(sessions, lift.setup, lift.measure, imported) : liftTrend(sessions, lift.setup, imported) };
  }

  async function resync(): Promise<void> {
    const active = await repos.getActiveGymId();
    if (active) await finish.refreshPlannedSessions(active);
  }

  /**
   * Correct a logged set. A set that was waiting on an outlier confirm becomes confirmed (the lifter looked at it and set
   * the value). Planned sessions are re-proposed from the corrected history; kept accepted / edited choices stay.
   */
  async function updateSet(setId: string, v: { load: number; reps: number; rir: number | null; durationS?: number | null; distanceM?: number | null }): Promise<void> {
    const row = await db.get<{ id: string; measure: Measure }>(
      "SELECT ws.id, e.measure FROM workout_set ws JOIN session s ON s.id = ws.session_id JOIN exercise e ON e.id = ws.exercise_id WHERE ws.id = ? AND ws.deleted_at IS NULL AND s.status = 'finished'",
      [setId],
    );
    if (!row) throw new HistoryInvalid("missing");
    let durationS: number | null = null;
    let distanceM: number | null = null;
    let reps = v.reps;
    let rir = v.rir;
    if (row.measure === "time") {
      if (typeof v.durationS !== "number" || !Number.isInteger(v.durationS) || v.durationS < 1 || v.durationS > MAX_SECONDS) throw new HistoryInvalid("duration");
      durationS = v.durationS;
      reps = 1;
      rir = null;
    } else if (row.measure === "distance") {
      if (typeof v.distanceM !== "number" || !Number.isFinite(v.distanceM) || v.distanceM <= 0 || v.distanceM > MAX_METRES) throw new HistoryInvalid("distance");
      distanceM = v.distanceM;
      reps = 1;
      rir = null;
    } else if (!Number.isInteger(reps) || reps < 1 || reps > MAX_PLAUSIBLE_REPS) throw new HistoryInvalid("reps");
    if (!Number.isFinite(v.load) || v.load < 0 || v.load > MAX_LOAD_KG) throw new HistoryInvalid("load");
    if (rir !== null && !(Number.isFinite(rir) && rir >= 0 && rir <= 10)) throw new HistoryInvalid("rir");
    const t = now();
    await db.run(
      "UPDATE workout_set SET load = ?, reps = ?, duration_s = ?, distance_m = ?, rir = ?, outlier_status = CASE WHEN outlier_status = 'unconfirmed' THEN 'confirmed' ELSE outlier_status END, updated_at = ? WHERE id = ?",
      [v.load, reps, durationS, distanceM, rir, t, setId],
    );
    await resync();
  }

  /** Remove a logged set from a finished session (soft delete, kept for sync). */
  async function removeSet(setId: string): Promise<void> {
    const t = now();
    const r = await db.run(
      "UPDATE workout_set SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL AND session_id IN (SELECT id FROM session WHERE status = 'finished')",
      [t, t, setId],
    );
    if (r.changes === 0) throw new HistoryInvalid("missing");
    await resync();
  }

  return { listSessions, countSessions, getSession, listLifts, getLiftTrend, updateSet, removeSet };
}
export type HistoryRepo = ReturnType<typeof createHistoryRepo>;
