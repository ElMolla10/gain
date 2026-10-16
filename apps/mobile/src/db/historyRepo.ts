import { consistencyProgress, personalMilestone } from "../logic/personalProgress";
import { strengthBreakthroughs, type BreakthroughInput } from "../logic/achievementProgress";
import { findSpec, weekStartOf, isTimedMeasure, liftTrend, MAX_METRES, MAX_PLAUSIBLE_REPS, MAX_SECONDS, timedTrend, type HistorySession, type Measure, type LiftTrend, type LoggedSet, type OutlierStatus, type SetupType } from "@gain/engine";
import type { Db, Deps } from "./driver";
import { hasLoggedSets } from "./sessionSql";
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
  /** When the workout was started (null when unknown, e.g. imported). */
  startedAt: number | null;
  /** Accumulated paused milliseconds; subtracted from wall time for the shown duration. */
  pausedMs: number;
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
  /** Null if an import has no reliable start time. */
  startedAt: number | null;
  pausedMs: number;
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
    const rows = await db.all<{ id: string; day_name: string; gym_name: string; finished_at: number; started_at: number | null; paused_ms: number; imported: number; exercises: number; sets: number }>(
      `SELECT s.id, d.name AS day_name, g.name AS gym_name, s.finished_at, s.started_at, s.paused_ms, (s.import_key IS NOT NULL) AS imported,
              (SELECT COUNT(DISTINCT ws.exercise_id) FROM workout_set ws WHERE ws.session_id = s.id AND ws.deleted_at IS NULL) AS exercises,
              (SELECT COUNT(*) FROM workout_set ws WHERE ws.session_id = s.id AND ws.deleted_at IS NULL AND ws.is_warmup = 0) AS sets
         FROM session s JOIN programme_day d ON d.id = s.programme_day_id JOIN gym g ON g.id = s.gym_id
        WHERE s.status = 'finished' AND s.deleted_at IS NULL AND s.finished_at IS NOT NULL AND ${hasLoggedSets("s")}
        ORDER BY s.finished_at DESC, s.rowid DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    return rows.map((r) => ({ id: r.id, dayName: r.day_name, gymName: r.gym_name, finishedAt: r.finished_at, startedAt: r.started_at, pausedMs: r.paused_ms ?? 0, exercises: r.exercises, workingSets: r.sets, imported: r.imported === 1 }));
  }

  /** Only days with trusted working sets qualify. Read all history, without the History screen's pagination limit. */
  async function trustedTrainingSessions(at: number) {
    return db.all<{ finishedAt: number }>(
      `SELECT s.finished_at AS finishedAt FROM session s
       WHERE s.status = 'finished' AND s.deleted_at IS NULL AND s.finished_at IS NOT NULL
         AND s.finished_at <= ?
         AND EXISTS (
           SELECT 1 FROM workout_set ws JOIN exercise e ON e.id = ws.exercise_id
           WHERE ws.session_id = s.id AND ws.deleted_at IS NULL AND ws.is_warmup = 0
             AND ws.outlier_status NOT IN ('unconfirmed', 'rejected')
             AND NOT EXISTS (SELECT 1 FROM json_each(ws.tags_json) WHERE value = 'drop')
             AND CASE e.measure WHEN 'time' THEN ws.duration_s > 0 WHEN 'distance' THEN ws.distance_m > 0 ELSE ws.reps > 0 END
         )`, [at],
    );
  }

  async function getAchievementDays(at = now()): Promise<number[]> {
    return (await trustedTrainingSessions(at)).map(row => row.finishedAt);
  }

  async function getPersonalProgress(at = now()) {
    const sessions = await trustedTrainingSessions(at);
    const rawGoal = await repos.getSetting("days_per_week");
    const rawStart = await repos.getSetting("week_starts_on");
    const start = rawStart === null || rawStart === "" ? 1 : Number(rawStart);
    const startsOn = Number.isInteger(start) && start >= 0 && start <= 6 ? start : 1;
    const active = await repos.getLatestProgrammeVersion();
    const short = active ? await db.get<{ days: number; week_start: string }>(
      "SELECT days, week_start FROM short_week WHERE status = 'active' AND short_version_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1", [active.versionId],
    ) : null;
    const weekStart = weekStartOf(at - new Date(at).getTimezoneOffset() * 60_000, startsOn);
    const goal = short?.week_start === weekStart ? short.days : rawGoal === null || rawGoal === "" ? null : Number(rawGoal);
    return consistencyProgress(sessions, at, goal, startsOn);
  }

  /** A saved lift goal earns a badge only after a trusted set reaches both its load and reps during that goal's lifetime. */
  async function getReachedWeightGoals(at = now()) {
    return db.all<{ id: string; exerciseId: string; nameEn: string; nameAr: string; load: number; reps: number; reachedAt: number }>(
      `SELECT g.id, g.exercise_id AS exerciseId, e.name_en AS nameEn, e.name_ar AS nameAr,
              g.target_load AS load, g.target_reps AS reps, MIN(s.finished_at) AS reachedAt
         FROM goal g JOIN exercise e ON e.id = g.exercise_id
         JOIN workout_set ws ON ws.exercise_id = g.exercise_id
         JOIN session s ON s.id = ws.session_id
        WHERE g.kind = 'lift' AND g.target_load IS NOT NULL AND g.target_reps IS NOT NULL
          AND s.status = 'finished' AND s.deleted_at IS NULL AND s.finished_at IS NOT NULL
          AND s.finished_at >= g.created_at AND s.finished_at <= ?
          AND (g.deleted_at IS NULL OR s.finished_at <= g.deleted_at)
          AND ws.deleted_at IS NULL AND ws.is_warmup = 0
          AND ws.outlier_status NOT IN ('unconfirmed', 'rejected')
          AND NOT EXISTS (SELECT 1 FROM json_each(ws.tags_json) WHERE value = 'drop')
          AND ws.load >= g.target_load AND ws.reps >= g.target_reps
        GROUP BY g.id ORDER BY reachedAt DESC`, [at],
    );
  }

  /** Recomputed from trusted saved sets. Corrections, exclusions and deleted workouts update achievements automatically. */
  async function getStrengthBreakthroughs(at = now()) {
    const rows = await db.all<BreakthroughInput>(
      `SELECT l.id AS lineId, e.id AS exerciseId, e.name_en AS nameEn, e.name_ar AS nameAr,
              l.setup, s.id AS sessionId, s.finished_at AS at, ws.load
         FROM workout_set ws JOIN session s ON s.id = ws.session_id
         JOIN exercise_line l ON l.id = ws.line_id JOIN exercise e ON e.id = ws.exercise_id
        WHERE s.status = 'finished' AND s.deleted_at IS NULL AND s.finished_at IS NOT NULL AND s.finished_at <= ?
          AND ws.deleted_at IS NULL AND ws.is_warmup = 0
          AND ws.outlier_status NOT IN ('unconfirmed', 'rejected')
          AND NOT EXISTS (SELECT 1 FROM json_each(ws.tags_json) WHERE value = 'drop')
          AND CASE e.measure WHEN 'time' THEN ws.duration_s > 0 WHEN 'distance' THEN ws.distance_m > 0 ELSE ws.reps > 0 END
        ORDER BY s.finished_at, s.rowid, ws.position, ws.rowid`, [at],
    );
    return strengthBreakthroughs(rows, at);
  }

  async function countSessions(): Promise<number> {
    return (await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM session s WHERE s.status = 'finished' AND s.deleted_at IS NULL AND s.finished_at IS NOT NULL AND ${hasLoggedSets("s")}`))!.n;
  }

  async function getSession(id: string): Promise<SessionDetail | null> {
    const s = await db.get<{ id: string; day_name: string; gym_name: string; finished_at: number; started_at: number | null; paused_ms: number; imported: number }>(
      `SELECT s.id, d.name AS day_name, g.name AS gym_name, s.finished_at, s.started_at, s.paused_ms, (s.import_key IS NOT NULL) AS imported
         FROM session s JOIN programme_day d ON d.id = s.programme_day_id JOIN gym g ON g.id = s.gym_id
        WHERE s.id = ? AND s.status = 'finished' AND s.deleted_at IS NULL AND ${hasLoggedSets("s")}`,
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
    return { id: s.id, dayName: s.day_name, gymName: s.gym_name, finishedAt: s.finished_at, startedAt: s.started_at, pausedMs: s.paused_ms ?? 0, imported: s.imported === 1, exercises };
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

  async function getLiftTrend(lineId: string): Promise<{ lift: LiftItem; sessions: HistorySession[]; trend: LiftTrend } | null> {
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
    return {
      lift,
      sessions,
      trend: isTimedMeasure(lift.measure) ? timedTrend(sessions, lift.setup, lift.measure, imported) : liftTrend(sessions, lift.setup, imported),
    };
  }

  /** The same monthly goal as the workout logger, using finished sets on this exact exercise/gym/setup line. */
  async function getLiftGoal(lineId: string) {
    const line = await db.get<{ exercise_id: string; gym_id: string; setup: SetupType; measure: Measure }>(
      `SELECT l.exercise_id, l.gym_id, l.setup, e.measure FROM exercise_line l
       JOIN exercise e ON e.id = l.exercise_id WHERE l.id = ? AND l.deleted_at IS NULL`, [lineId]);
    if (!line || line.setup === "assisted") return null;
    const rows = await db.all<{ sid: string; finished_at: number; load: number; reps: number; duration_s: number | null; distance_m: number | null; is_warmup: number; tags_json: string; outlier_status: OutlierStatus }>(
      `SELECT s.id AS sid, s.finished_at, ws.load, ws.reps, ws.duration_s, ws.distance_m,
              ws.is_warmup, ws.tags_json, ws.outlier_status
         FROM workout_set ws JOIN session s ON s.id = ws.session_id
        WHERE ws.line_id = ? AND s.status = 'finished' AND s.deleted_at IS NULL
          AND ws.deleted_at IS NULL AND s.finished_at IS NOT NULL
        ORDER BY s.finished_at, ws.position`, [lineId]);
    const bySession = new Map<string, { performedAt: string; sets: LoggedSet[] }>();
    for (const r of rows) {
      let session = bySession.get(r.sid);
      if (!session) {
        session = { performedAt: new Date(r.finished_at).toISOString(), sets: [] };
        bySession.set(r.sid, session);
      }
      session.sets.push({ load: r.load, reps: r.reps,
        ...(r.duration_s !== null ? { durationS: r.duration_s } : {}),
        ...(r.distance_m !== null ? { distanceM: r.distance_m } : {}),
        warmup: r.is_warmup === 1, tags: JSON.parse(r.tags_json) as string[], outlierStatus: r.outlier_status });
    }
    const exerciseLoads = await repos.getExerciseLoads(line.exercise_id);
    const gym = await repos.loadGymFingerprint(line.gym_id);
    const spec = exerciseLoads?.spec ?? (exerciseLoads ? findSpec(gym, exerciseLoads.equipment) : null);
    const active = await repos.getLatestProgrammeVersion();
    const day = active ? await db.get<{ id: string }>(
      `SELECT d.id FROM programme_day d JOIN programme_day_exercise pde ON pde.programme_day_id = d.id
        WHERE d.programme_version_id = ? AND pde.exercise_id = ?
          AND d.deleted_at IS NULL AND pde.deleted_at IS NULL LIMIT 1`,
      [active.versionId, line.exercise_id]) : null;
    // Use the same resolved rep ceiling as the logger, including the lifter's GAIN-ceilings setting.
    const exercise = day ? (await repos.listDayExercises(day.id)).find(e => e.exerciseId === line.exercise_id) : null;
    return personalMilestone([...bySession.values()], [], spec, line.measure, exercise?.repMin ?? 6, exercise?.repMax ?? 12, now());
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
      "SELECT ws.id, e.measure FROM workout_set ws JOIN session s ON s.id = ws.session_id JOIN exercise e ON e.id = ws.exercise_id WHERE ws.id = ? AND ws.deleted_at IS NULL AND s.status = 'finished' AND s.deleted_at IS NULL",
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

  /**
   * Delete an entire FINISHED workout in a single SQLite transaction.
   * Tombstone the session, every logged set, any per-exercise state, and targets/decision logs
   * bound to it. These updates propagate to opt-in sync; ML evaluation triggers invalidate
   * predictions tied to removed sets/session. Never touch an in-progress or planned workout.
   */
  async function deleteWorkout(sessionId: string): Promise<void> {
    await db.transaction(async () => {
      const session = await db.get<{ status: string }>(
        "SELECT status FROM session WHERE id = ? AND deleted_at IS NULL",
        [sessionId],
      );
      if (!session || session.status !== "finished") throw new HistoryInvalid("missing");
      const t = now();
      await db.run(
        "UPDATE decision_log SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL AND target_id IN (SELECT id FROM target WHERE session_id = ?)",
        [t, t, sessionId],
      );
      await db.run(
        "UPDATE target SET deleted_at = ?, updated_at = ? WHERE session_id = ? AND deleted_at IS NULL",
        [t, t, sessionId],
      );
      await db.run(
        "UPDATE session_exercise SET deleted_at = ?, updated_at = ? WHERE session_id = ? AND deleted_at IS NULL",
        [t, t, sessionId],
      );
      await db.run(
        "UPDATE workout_set SET deleted_at = ?, updated_at = ? WHERE session_id = ? AND deleted_at IS NULL",
        [t, t, sessionId],
      );
      // Last so a session-level ML prediction invalidation covers any still-pending forecasts.
      await db.run(
        "UPDATE session SET deleted_at = ?, updated_at = ? WHERE id = ? AND status = 'finished' AND deleted_at IS NULL",
        [t, t, sessionId],
      );
    });
    // Planned workout targets must no longer include data from the deleted workout.
    await resync();
  }

  /** Remove a logged set from a finished session (soft delete, kept for sync). */
  async function removeSet(setId: string): Promise<void> {
    const t = now();
    const r = await db.run(
      "UPDATE workout_set SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL AND session_id IN (SELECT id FROM session WHERE status = 'finished' AND deleted_at IS NULL)",
      [t, t, setId],
    );
    if (r.changes === 0) throw new HistoryInvalid("missing");
    await resync();
  }

  async function weekExerciseSets(fromMs: number, toMs: number): Promise<{ exerciseId: string; pattern: string; seedKey: string | null; equipment: import("@gain/engine").EquipmentType; sets: LoggedSet[] }[]> {
    const rows = await db.all<{
      exercise_id: string;
      pattern: string;
      seed_key: string | null;
      equipment: import("@gain/engine").EquipmentType;
      load: number;
      reps: number;
      duration_s: number | null;
      distance_m: number | null;
      rir: number | null;
      is_warmup: number;
      tags_json: string;
      outlier_status: OutlierStatus;
    }>(
      `SELECT e.id AS exercise_id, e.pattern, e.seed_key, e.equipment, ws.load, ws.reps, ws.duration_s, ws.distance_m, ws.rir, ws.is_warmup, ws.tags_json, ws.outlier_status
         FROM workout_set ws JOIN session s ON s.id = ws.session_id JOIN exercise e ON e.id = ws.exercise_id
        WHERE s.status = 'finished' AND s.deleted_at IS NULL AND ws.deleted_at IS NULL
          AND s.finished_at IS NOT NULL AND s.finished_at >= ? AND s.finished_at < ?
        ORDER BY e.id, ws.position`,
      [fromMs, toMs],
    );
    const byEx = new Map<string, { exerciseId: string; pattern: string; seedKey: string | null; equipment: import("@gain/engine").EquipmentType; sets: LoggedSet[] }>();
    for (const r of rows) {
      let row = byEx.get(r.exercise_id);
      if (!row) {
        row = { exerciseId: r.exercise_id, pattern: r.pattern, seedKey: r.seed_key, equipment: r.equipment, sets: [] };
        byEx.set(r.exercise_id, row);
      }
      row.sets.push({
        load: r.load,
        reps: r.reps,
        ...(r.duration_s !== null ? { durationS: r.duration_s } : {}),
        ...(r.distance_m !== null ? { distanceM: r.distance_m } : {}),
        rir: r.rir,
        warmup: r.is_warmup === 1,
        tags: JSON.parse(r.tags_json) as string[],
        outlierStatus: r.outlier_status,
      });
    }
    return [...byEx.values()];
  }

  return { getPersonalProgress, getAchievementDays, getStrengthBreakthroughs, getReachedWeightGoals, listSessions, countSessions, getSession, listLifts, getLiftTrend, getLiftGoal, weekExerciseSets, updateSet, removeSet, deleteWorkout };
}
export type HistoryRepo = ReturnType<typeof createHistoryRepo>;
