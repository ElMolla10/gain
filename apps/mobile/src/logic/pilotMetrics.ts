/**
 * Pilot numbers from a lifter's own JSON backup (Steps 20/29; definitions in docs/PILOT-RETENTION-METRICS.md). Pure code, no I/O, not used by the app:
 * it runs on the pilot runner's computer through `npm run pilot-metrics -w @gain/mobile -- <backup.json> ...`. GAIN has no analytics; this reads a
 * file the lifter chose to hand over.
 *
 * Choices the doc leaves open (stated here so they can be argued with): "local time of the phone" is a minutes-east-of-UTC offset given by the
 * caller (a backup does not record it); "the load actually logged" for a target is the hardest trusted working set (non-warm-up, non-drop,
 * neither unconfirmed nor rejected as an outlier) of that exercise line in the target's session; "same as target" means within 0.01 kg of the
 * app's own target load. Reps are not part of this comparison.
 *
 * Like the engine, history is only comparable on the same exercise, the same gym and the same setup (`lineKey`); the exercise row supplies
 * the equipment. Missing or invalid line/exercise metadata is excluded, never guessed. The number compared is the weight the lifter set:
 * the bar or machine load, the added plate, or the assistance pin. It is not bodyweight plus or minus that number. Bodyweight is often absent,
 * and folding a different bodyweight into the comparison would invent a change the lifter did not load. Assisted setup: a smaller pin is harder.
 * Any other setup: a larger number is harder. Equipment `assisted` with a non-assisted setup is contradictory and excluded, so an assistance
 * pin is never read as ordinary lifted weight.
 */
import { lineKey, type EquipmentType, type SetupType } from "@gain/engine";
import type { BackupFile } from "./backup";

const DAY = 86_400_000;
type Row = Record<string, string | number | null>;

export interface WeekRow {
  week: number;
  /** Finished, non-imported sessions whose finished_at falls in this week. */
  sessions: number;
  active: boolean;
  /** Targets of sessions finished in this week, by the status the lifter gave them. */
  accepted: number;
  edited: number;
  rejected: number;
  /** Never acted on. */
  proposed: number;
  /** Compared with the load actually logged (targets with a valid load and at least one trusted working set on a usable line only). */
  comparable: number;
  same: number;
  more: number;
  less: number;
  /**
   * Like-for-like check against "repeat the last weight" (the baseline of docs/BACKTEST-HEVY.md): only targets that are comparable AND whose exact
   * line has a counted working set in an earlier finished session (imported history counts). Among those: `bothAppSame` = the lifter set the app's
   * number, `bothRepeatSame` = the lifter set that previous number. Same means the same stored load, not the same bodyweight-adjusted load.
   */
  both: number;
  bothAppSame: number;
  bothRepeatSame: number;
}

export interface LifterMetrics {
  /** Local midnight of the day of the first finished, non-imported session; null when there is none. */
  week0Start: number | null;
  /** Backup export time (ms): "now" for this lifter. */
  exportedAt: number;
  /** Highest week whose first day is on or before the export (week 0 = first 7 days); -1 with no sessions. */
  reachedWeek: number;
  weeks: WeekRow[];
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const validLoad = (v: unknown): number | null => {
  const n = num(v);
  return n !== null && n >= 0 ? n : null;
};
const text = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const asSetup = (v: unknown): SetupType | null => (v === "free" || v === "assisted" || v === "bodyweight_plus_added" ? v : null);
const asEquipment = (v: unknown): EquipmentType | null =>
  v === "dumbbell" || v === "barbell" || v === "plate" || v === "cable" || v === "machine" || v === "assisted" ? v : null;
const live = (r: Row) => r.deleted_at === null || r.deleted_at === undefined;

export function computeLifterMetrics(b: BackupFile, opts: { tzMinutes?: number; sameKg?: number } = {}): LifterMetrics {
  const tz = (opts.tzMinutes ?? 0) * 60_000;
  const sameKg = opts.sameKg ?? 0.01;
  const exportedAt = Date.parse(b.exportedAt);
  const sessions = (b.tables.session ?? []).filter(live);
  // Every live finished session (imported ones too) for the "repeat last load" baseline; `finished` below is the real, non-imported ones only.
  const everFinished = sessions.filter((s) => s.status === "finished" && num(s.finished_at) !== null);
  const finished = sessions.filter((s) => s.status === "finished" && num(s.finished_at) !== null && (s.import_key === null || s.import_key === undefined));
  if (finished.length === 0) return { week0Start: null, exportedAt, reachedWeek: -1, weeks: [] };

  const localMidnight = (ms: number) => Math.floor((ms + tz) / DAY) * DAY - tz;
  const first = Math.min(...finished.map((s) => num(s.finished_at)!));
  const week0Start = localMidnight(first);
  const weekOf = (ms: number) => Math.floor((ms - week0Start) / (7 * DAY));
  const reachedWeek = Math.max(0, weekOf(exportedAt));
  const lastWeek = Math.max(reachedWeek, ...finished.map((s) => weekOf(num(s.finished_at)!)));
  const weeks: WeekRow[] = Array.from({ length: lastWeek + 1 }, (_, week) => ({ week, sessions: 0, active: false, accepted: 0, edited: 0, rejected: 0, proposed: 0, comparable: 0, same: 0, more: 0, less: 0, both: 0, bothAppSame: 0, bothRepeatSame: 0 }));
  const sessionWeek = new Map<string, number>();
  for (const s of finished) {
    const w = weekOf(num(s.finished_at)!);
    sessionWeek.set(String(s.id), w);
    weeks[w]!.sessions++;
  }
  for (const w of weeks) w.active = w.sessions > 0;

  // Backups contain soft-deleted rows so old sessions stay readable. They remain authoritative metadata for those historical sets.
  const lineRows = new Map<string, Row>();
  for (const l of b.tables.exercise_line ?? []) {
    const id = text(l.id);
    if (id !== null) lineRows.set(id, l);
  }
  const exerciseRows = new Map<string, Row>();
  for (const e of b.tables.exercise ?? []) {
    const id = text(e.id);
    if (id !== null) exerciseRows.set(id, e);
  }
  const keyOfLine = (lineIdValue: unknown, exerciseIdValue: unknown): { key: string; setup: SetupType; gymId: string } | null => {
    const lineId = text(lineIdValue);
    const exerciseId = text(exerciseIdValue);
    if (lineId === null || exerciseId === null) return null;
    const l = lineRows.get(lineId);
    const lineExerciseId = text(l?.exercise_id);
    const gymId = text(l?.gym_id);
    const setup = asSetup(l?.setup);
    if (lineExerciseId === null || lineExerciseId !== exerciseId || gymId === null || setup === null) return null;
    const equipment = asEquipment(exerciseRows.get(exerciseId)?.equipment);
    if (equipment === null) return null;
    // The pin on an assisted machine is not a weight that was lifted. If the line calls that equipment something else, the backup
    // disagrees with itself; leave it out rather than pick an interpretation.
    if (equipment === "assisted" && setup !== "assisted") return null;
    return { key: `${lineKey({ exerciseId, gymId, setup })}|${equipment}`, setup, gymId };
  };
  const sessionById = new Map<string, Row>();
  for (const s of sessions) {
    const id = text(s.id);
    if (id !== null) sessionById.set(id, s);
  }
  /**
   * The line carries the gym the history stream was logged under. A session gym is used only when the backup actually has one:
   * absent means the line gym stands, and a present value that is not that gym (or is not a usable id) drops the set.
   */
  const sessionGymAgrees = (sessionId: unknown, lineGym: string): boolean => {
    const id = text(sessionId);
    const s = id === null ? undefined : sessionById.get(id);
    if (!s || !("gym_id" in s) || s.gym_id === null || s.gym_id === undefined) return true;
    const gymId = text(s.gym_id);
    return gymId !== null && gymId === lineGym;
  };
  /** Harder stored load. Assisted: less assistance. Every other setup: more weight on the bar, machine or belt. */
  const harder = (setup: SetupType, candidate: number, current: number) => (setup === "assisted" ? candidate < current : candidate > current);
  const relation = (actual: number, reference: number, setup: SetupType): "same" | "more" | "less" => {
    if (Math.abs(actual - reference) <= sameKg) return "same";
    return harder(setup, actual, reference) ? "more" : "less";
  };

  // Hardest counted working set per (session, line_id), and per (session, line identity) for the baseline.
  const logged = new Map<string, number>();
  const loggedByLine = new Map<string, number>();
  const keepHardest = (map: Map<string, number>, key: string, load: number, setup: SetupType) => {
    const prev = map.get(key);
    if (prev === undefined || harder(setup, load, prev)) map.set(key, load);
  };
  for (const st of (b.tables.workout_set ?? []).filter(live)) {
    if (st.is_warmup === 1 || (st.outlier_status !== "none" && st.outlier_status !== "confirmed")) continue;
    let tags: unknown = [];
    try { tags = JSON.parse(String(st.tags_json ?? "[]")); } catch { tags = []; }
    if (Array.isArray(tags) && tags.includes("drop")) continue;
    const load = validLoad(st.load);
    if (load === null) continue;
    const line = keyOfLine(st.line_id, st.exercise_id);
    if (line === null || !sessionGymAgrees(st.session_id, line.gymId)) continue;
    const { key: lk, setup } = line;
    keepHardest(logged, `${st.session_id}|${st.line_id}`, load, setup);
    keepHardest(loggedByLine, `${st.session_id}|${lk}`, load, setup);
  }
  const finishedAt = new Map(everFinished.map((s) => [String(s.id), num(s.finished_at)!] as const));
  const byFinish = [...everFinished].sort((a, b2) => num(b2.finished_at)! - num(a.finished_at)!);
  /** The stored load "repeat last" would set for a line before a session: the newest earlier finished session with a counted set of that same line. */
  const previousLoad = (sessionId: string, lk: string): number | null => {
    const at = finishedAt.get(sessionId);
    if (at === undefined) return null;
    for (const s of byFinish) {
      if (num(s.finished_at)! >= at || s.id === sessionId) continue;
      const v = loggedByLine.get(`${s.id}|${lk}`);
      if (v !== undefined) return v;
    }
    return null;
  };

  for (const t of (b.tables.target ?? []).filter(live)) {
    const w = sessionWeek.get(String(t.session_id));
    if (w === undefined) continue; // the session was never finished (planned, skipped, imported or deleted)
    const row = weeks[w]!;
    const status = String(t.status);
    if (status === "accepted" || status === "edited" || status === "rejected" || status === "proposed") row[status]++;
    const target = validLoad(t.load);
    const did = logged.get(`${t.session_id}|${t.line_id}`);
    const line = keyOfLine(t.line_id, t.exercise_id);
    if (target !== null && did !== undefined && line !== null) {
      const { key: lk, setup } = line;
      row.comparable++;
      const vsTarget = relation(did, target, setup);
      if (vsTarget === "same") row.same++;
      else if (vsTarget === "more") row.more++;
      else row.less++;
      const prev = previousLoad(String(t.session_id), lk);
      if (prev !== null) {
        row.both++;
        if (vsTarget === "same") row.bothAppSame++;
        if (relation(did, prev, setup) === "same") row.bothRepeatSame++;
      }
    }
  }
  return { week0Start, exportedAt, reachedWeek, weeks };
}

export const SHEET_HEADER = ["pilot_code", "week", "sessions_done", "active", "targets_accepted", "targets_edited", "targets_rejected", "targets_never_acted_on", "comparable", "loaded_same", "loaded_more", "loaded_less", "both_comparable", "both_app_same", "both_repeat_same", "days_planned", "app_version", "on_pace_status", "bugs_quotes"] as const;

/** Rows for the pilot sheet (docs/PILOT-RETENTION-METRICS.md). The last four columns are filled by hand from the weekly check-in. */
export function sheetCsv(lifters: { code: string; metrics: LifterMetrics }[]): string {
  const lines: string[] = [SHEET_HEADER.join(",")];
  for (const { code, metrics } of lifters) {
    for (const w of metrics.weeks) {
      if (w.week > metrics.reachedWeek) continue;
      lines.push([csvCell(code), w.week, w.sessions, w.active ? 1 : 0, w.accepted, w.edited, w.rejected, w.proposed, w.comparable, w.same, w.more, w.less, w.both, w.bothAppSame, w.bothRepeatSame, "", "", "", ""].join(","));
    }
  }
  return lines.join("\n") + "\n";
}

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export interface RetentionLine {
  week: number;
  /** Lifters whose calendar has reached this week. */
  reached: number;
  retained: number;
}

/** "Retained out of reached": a lifter who has not yet reached week N is not counted as lost. */
export function retention(all: LifterMetrics[], weeksToReport: number[] = [1, 2, 6]): RetentionLine[] {
  return weeksToReport.map((week) => {
    const reachedBy = all.filter((m) => m.week0Start !== null && m.reachedWeek >= week);
    return { week, reached: reachedBy.length, retained: reachedBy.filter((m) => m.weeks[week]?.active).length };
  });
}

export interface AgreementTotals {
  /** Targets with a valid stored load, a trusted working set and complete like-for-like line metadata. */
  comparable: number;
  same: number;
  more: number;
  less: number;
  /** The like-for-like subset that also has a previous stored load: how often "the app's number" and "repeat the last weight" matched what was set. */
  both: number;
  bothAppSame: number;
  bothRepeatSame: number;
}

/** Counts over every lifter and week (counts, not percentages; see docs/PILOT-RETENTION-METRICS.md "How to read the numbers"). */
export function agreementTotals(all: LifterMetrics[]): AgreementTotals {
  const t: AgreementTotals = { comparable: 0, same: 0, more: 0, less: 0, both: 0, bothAppSame: 0, bothRepeatSame: 0 };
  for (const m of all) for (const w of m.weeks) for (const k of Object.keys(t) as (keyof AgreementTotals)[]) t[k] += w[k];
  return t;
}
