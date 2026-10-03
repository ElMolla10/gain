/**
 * Pilot numbers from a lifter's own JSON backup (Steps 20/29; definitions in docs/PILOT-RETENTION-METRICS.md). Pure code, no I/O, not used by the app:
 * it runs on the pilot runner's computer through `npm run pilot-metrics -w @gain/mobile -- <backup.json> ...`. GAIN has no analytics; this reads a
 * file the lifter chose to hand over.
 *
 * Choices the doc leaves open (stated here so they can be argued with): "local time of the phone" is a minutes-east-of-UTC offset given by the
 * caller (a backup does not record it); "the load actually logged" for a target is the HEAVIEST non-warm-up, non-drop, non-rejected set of that
 * exercise line in the target's session; "same as target" means within 0.01 kg of the app's own target load.
 */
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
  /** Compared with the load actually logged (targets with a number and at least one logged working set only). */
  comparable: number;
  same: number;
  more: number;
  less: number;
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
const live = (r: Row) => r.deleted_at === null || r.deleted_at === undefined;

export function computeLifterMetrics(b: BackupFile, opts: { tzMinutes?: number; sameKg?: number } = {}): LifterMetrics {
  const tz = (opts.tzMinutes ?? 0) * 60_000;
  const sameKg = opts.sameKg ?? 0.01;
  const exportedAt = Date.parse(b.exportedAt);
  const sessions = (b.tables.session ?? []).filter(live);
  const finished = sessions.filter((s) => s.status === "finished" && num(s.finished_at) !== null && (s.import_key === null || s.import_key === undefined));
  if (finished.length === 0) return { week0Start: null, exportedAt, reachedWeek: -1, weeks: [] };

  const localMidnight = (ms: number) => Math.floor((ms + tz) / DAY) * DAY - tz;
  const first = Math.min(...finished.map((s) => num(s.finished_at)!));
  const week0Start = localMidnight(first);
  const weekOf = (ms: number) => Math.floor((ms - week0Start) / (7 * DAY));
  const reachedWeek = Math.max(0, weekOf(exportedAt));
  const lastWeek = Math.max(reachedWeek, ...finished.map((s) => weekOf(num(s.finished_at)!)));
  const weeks: WeekRow[] = Array.from({ length: lastWeek + 1 }, (_, week) => ({ week, sessions: 0, active: false, accepted: 0, edited: 0, rejected: 0, proposed: 0, comparable: 0, same: 0, more: 0, less: 0 }));
  const sessionWeek = new Map<string, number>();
  for (const s of finished) {
    const w = weekOf(num(s.finished_at)!);
    sessionWeek.set(String(s.id), w);
    weeks[w]!.sessions++;
  }
  for (const w of weeks) w.active = w.sessions > 0;

  // Heaviest counted working set per (session, line).
  const logged = new Map<string, number>();
  for (const st of (b.tables.workout_set ?? []).filter(live)) {
    if (st.is_warmup === 1 || st.outlier_status === "rejected") continue;
    let tags: unknown = [];
    try { tags = JSON.parse(String(st.tags_json ?? "[]")); } catch { tags = []; }
    if (Array.isArray(tags) && tags.includes("drop")) continue;
    const load = num(st.load);
    if (load === null) continue;
    const key = `${st.session_id}|${st.line_id}`;
    logged.set(key, Math.max(logged.get(key) ?? -Infinity, load));
  }

  for (const t of (b.tables.target ?? []).filter(live)) {
    const w = sessionWeek.get(String(t.session_id));
    if (w === undefined) continue; // the session was never finished (planned, skipped, imported or deleted)
    const row = weeks[w]!;
    const status = String(t.status);
    if (status === "accepted" || status === "edited" || status === "rejected" || status === "proposed") row[status]++;
    const target = num(t.load);
    const did = logged.get(`${t.session_id}|${t.line_id}`);
    if (target !== null && did !== undefined) {
      row.comparable++;
      if (Math.abs(did - target) <= sameKg) row.same++;
      else if (did > target) row.more++;
      else row.less++;
    }
  }
  return { week0Start, exportedAt, reachedWeek, weeks };
}

export const SHEET_HEADER = ["pilot_code", "week", "sessions_done", "active", "targets_accepted", "targets_edited", "targets_rejected", "targets_never_acted_on", "comparable", "loaded_same", "loaded_more", "loaded_less", "days_planned", "app_version", "on_pace_status", "bugs_quotes"] as const;

/** Rows for the pilot sheet (docs/PILOT-RETENTION-METRICS.md). The last four columns are filled by hand from the weekly check-in. */
export function sheetCsv(lifters: { code: string; metrics: LifterMetrics }[]): string {
  const lines: string[] = [SHEET_HEADER.join(",")];
  for (const { code, metrics } of lifters) {
    for (const w of metrics.weeks) {
      if (w.week > metrics.reachedWeek) continue;
      lines.push([csvCell(code), w.week, w.sessions, w.active ? 1 : 0, w.accepted, w.edited, w.rejected, w.proposed, w.comparable, w.same, w.more, w.less, "", "", "", ""].join(","));
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
