import type { Measure, ReasonText } from "@gain/engine";
import type { Db } from "./driver";
import type { TargetStatus } from "./finishRepo";

export interface DecisionListItem {
  targetId: string;
  decidedAt: number;
  exerciseId: string;
  nameEn: string;
  nameAr: string;
  gymName: string;
  setup: string;
  dayName: string;
  /** planned = the workout it was written for has not been done yet. */
  sessionStatus: string;
  load: number | null;
  reps: number | null;
  /** How the exercise is counted, and the target seconds / metres when it is not reps. */
  measure: Measure;
  durationS: number | null;
  distanceM: number | null;
  currency: string;
  status: TargetStatus;
  editedLoad: number | null;
  reason: ReasonText;
  confidence: string;
  ruleVersion: string;
  path: string;
}

export interface DecisionLift {
  exerciseId: string;
  nameEn: string;
  nameAr: string;
  count: number;
}

/** Read-only list of every stored decision (one per target). Each row's inputs open in the "Why this weight?" screen. */
export function createDecisionRepo(db: Db) {
  const BASE = `FROM decision_log d JOIN target t ON t.id = d.target_id AND t.deleted_at IS NULL
       JOIN exercise e ON e.id = t.exercise_id JOIN exercise_line l ON l.id = t.line_id JOIN gym g ON g.id = l.gym_id
       JOIN session s ON s.id = t.session_id AND s.deleted_at IS NULL JOIN programme_day pd ON pd.id = s.programme_day_id
       WHERE d.deleted_at IS NULL`;

  async function list(opts: { exerciseId?: string | null; limit?: number; offset?: number } = {}): Promise<DecisionListItem[]> {
    const params: (string | number)[] = [];
    let where = "";
    if (opts.exerciseId) {
      where = " AND t.exercise_id = ?";
      params.push(opts.exerciseId);
    }
    params.push(opts.limit ?? 40, opts.offset ?? 0);
    const rows = await db.all<{
      target_id: string; created_at: number; exercise_id: string; name_en: string; name_ar: string; gym_name: string; setup: string; day_name: string;
      session_status: string; load: number | null; reps: number | null; measure: Measure; duration_s: number | null; distance_m: number | null; currency: string; status: TargetStatus; edited_load: number | null;
      reason_key: string; reason_params_json: string; confidence: string; rule_version: string; path: string;
    }>(
      `SELECT t.id AS target_id, d.created_at, t.exercise_id, e.name_en, e.name_ar, g.name AS gym_name, l.setup, pd.name AS day_name,
              s.status AS session_status, t.load, t.reps, e.measure, t.duration_s, t.distance_m, t.currency, t.status, t.edited_load, t.reason_key, t.reason_params_json,
              t.confidence, d.rule_version, d.path
       ${BASE}${where} ORDER BY d.created_at DESC, d.rowid DESC LIMIT ? OFFSET ?`,
      params,
    );
    return rows.map((r) => ({
      targetId: r.target_id, decidedAt: r.created_at, exerciseId: r.exercise_id, nameEn: r.name_en, nameAr: r.name_ar, gymName: r.gym_name,
      setup: r.setup, dayName: r.day_name, sessionStatus: r.session_status, load: r.load, reps: r.reps, measure: r.measure, durationS: r.duration_s, distanceM: r.distance_m, currency: r.currency, status: r.status,
      editedLoad: r.edited_load, reason: { key: r.reason_key, params: safeJson(r.reason_params_json) } as ReasonText, confidence: r.confidence,
      ruleVersion: r.rule_version, path: r.path,
    }));
  }

  async function count(exerciseId?: string | null): Promise<number> {
    const where = exerciseId ? " AND t.exercise_id = ?" : "";
    return (await db.get<{ n: number }>(`SELECT COUNT(*) AS n ${BASE}${where}`, exerciseId ? [exerciseId] : []))!.n;
  }

  /** Lifts that have at least one decision, for the filter. */
  async function lifts(): Promise<DecisionLift[]> {
    const rows = await db.all<{ exercise_id: string; name_en: string; name_ar: string; n: number }>(
      `SELECT t.exercise_id, e.name_en, e.name_ar, COUNT(*) AS n ${BASE} GROUP BY t.exercise_id ORDER BY MAX(d.created_at) DESC`,
    );
    return rows.map((r) => ({ exerciseId: r.exercise_id, nameEn: r.name_en, nameAr: r.name_ar, count: r.n }));
  }

  return { list, count, lifts };
}
export type DecisionRepo = ReturnType<typeof createDecisionRepo>;

function safeJson(s: string): Record<string, string | number> {
  try {
    const v = JSON.parse(s) as unknown;
    return v && typeof v === "object" ? (v as Record<string, string | number>) : {};
  } catch {
    return {};
  }
}
