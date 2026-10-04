/**
 * Pilot numbers from a lifter's own JSON backup (Steps 20/29; definitions in docs/PILOT-RETENTION-METRICS.md). Pure code, no I/O, not used by the app:
 * it runs on the pilot runner's computer through `npm run pilot-metrics -w @gain/mobile -- <backup.json> ...`. GAIN has no analytics; this reads a
 * file the lifter chose to hand over.
 *
 * Choices the doc leaves open (stated here so they can be argued with): "local time of the phone" is a minutes-east-of-UTC offset given by the
 * caller (a backup does not record it); "the load actually logged" for a target is the HEAVIEST non-warm-up, non-drop, non-rejected set of that
 * exercise line in the target's session; "same as target" means within 0.01 kg of the app's own target load.
 *
 * Like the engine, history is only comparable on the same exercise, the same gym and the same setup (`lineKey`): the "repeat the last load"
 * baseline uses the previous finished session of the target's own line, never the same exercise at another gym or in another setup.
 * Loads are compared in EFFECTIVE-load terms: for an assisted exercise the number logged is the assistance, which LOWERS the load, so the
 * heaviest set is the one with the least assistance and "more" means less assistance; with a bodyweight entry the effective load is
 * bodyweight - assistance (or bodyweight + added), without any it is the signed load relative to bodyweight (-assistance / +added).
 */
import { effectiveLoad, lineKey, type SetupType } from "@gain/engine";
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
  /**
   * Like-for-like check against "repeat the last load" (the baseline of docs/BACKTEST-HEVY.md): only targets that are comparable AND whose exercise
   * had an earlier finished session (imported history counts) with a counted working set. Among those: `bothAppSame` = the lifter loaded the app's
   * number, `bothRepeatSame` = the lifter loaded the heaviest counted working set of that exercise's previous session.
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
const asSetup = (v: unknown): SetupType => (v === "assisted" || v === "bodyweight_plus_added" ? v : "free");
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

  // Which exercise, gym and setup a line_id stands for (the engine's lineKey). A line missing from the backup falls back to its own id plus the
  // exercise's setup, so older or partial files still work; they just cannot be compared across gyms.
  const lineRows = new Map((b.tables.exercise_line ?? []).filter(live).map((l) => [String(l.id), l] as const));
  const exerciseSetup = new Map((b.tables.exercise ?? []).map((e) => [String(e.id), asSetup(e.setup)] as const));
  const keyOfLine = (lineId: string, exerciseId: string): { key: string; setup: SetupType } => {
    const l = lineRows.get(lineId);
    if (l) {
      const setup = asSetup(l.setup);
      return { key: lineKey({ exerciseId: String(l.exercise_id), gymId: String(l.gym_id), setup }), setup };
    }
    return { key: `line:${lineId}`, setup: exerciseSetup.get(exerciseId) ?? "free" };
  };
  // Bodyweight at a moment: the latest entry at or before it, else the earliest entry; null when the backup has none (then loads are compared
  // relative to bodyweight, which is the same thing within one session).
  const bwEntries = (b.tables.bodyweight_entry ?? [])
    .filter(live)
    .map((e) => ({ at: num(e.measured_at), kg: num(e.weight_kg) }))
    .filter((e): e is { at: number; kg: number } => e.at !== null && e.kg !== null && e.kg > 0)
    .sort((x, y) => x.at - y.at);
  const bodyweightAt = (ms: number): number | null => {
    if (bwEntries.length === 0) return null;
    let kg = bwEntries[0]!.kg;
    for (const e of bwEntries) if (e.at <= ms) kg = e.kg;
    return kg;
  };
  /** Effective load: larger = harder, for every setup. */
  const effective = (setup: SetupType, load: number, at: number): number => {
    const bw = bodyweightAt(at);
    if (bw !== null) return effectiveLoad(setup, load, bw) ?? load;
    return setup === "assisted" ? -load : load;
  };
  const sessionFinish = new Map(sessions.map((s) => [String(s.id), num(s.finished_at)] as const));

  // Heaviest (highest effective load) counted working set per (session, line_id), and per (session, lineKey) for the baseline.
  const logged = new Map<string, number>();
  const loggedByLine = new Map<string, number>();
  for (const st of (b.tables.workout_set ?? []).filter(live)) {
    if (st.is_warmup === 1 || st.outlier_status === "rejected") continue;
    let tags: unknown = [];
    try { tags = JSON.parse(String(st.tags_json ?? "[]")); } catch { tags = []; }
    if (Array.isArray(tags) && tags.includes("drop")) continue;
    const load = num(st.load);
    if (load === null) continue;
    const { key: lk, setup } = keyOfLine(String(st.line_id), String(st.exercise_id));
    const eff = effective(setup, load, sessionFinish.get(String(st.session_id)) ?? exportedAt);
    const key = `${st.session_id}|${st.line_id}`;
    logged.set(key, Math.max(logged.get(key) ?? -Infinity, eff));
    const exKey = `${st.session_id}|${lk}`;
    loggedByLine.set(exKey, Math.max(loggedByLine.get(exKey) ?? -Infinity, eff));
  }
  const finishedAt = new Map(everFinished.map((s) => [String(s.id), num(s.finished_at)!] as const));
  const byFinish = [...everFinished].sort((a, b2) => num(b2.finished_at)! - num(a.finished_at)!);
  /** The effective load "repeat last" would give for a line before a session: the newest earlier finished session that has a counted set of that same line. */
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
    const target = num(t.load);
    const did = logged.get(`${t.session_id}|${t.line_id}`);
    if (target !== null && did !== undefined) {
      const { key: lk, setup } = keyOfLine(String(t.line_id), String(t.exercise_id));
      const at = sessionFinish.get(String(t.session_id)) ?? exportedAt;
      const targetEff = effective(setup, target, at);
      row.comparable++;
      if (Math.abs(did - targetEff) <= sameKg) row.same++;
      else if (did > targetEff) row.more++;
      else row.less++;
      const prev = previousLoad(String(t.session_id), lk);
      if (prev !== null) {
        row.both++;
        if (Math.abs(did - targetEff) <= sameKg) row.bothAppSame++;
        if (Math.abs(did - prev) <= sameKg) row.bothRepeatSame++;
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
  /** Targets with a number and a logged working set. */
  comparable: number;
  same: number;
  more: number;
  less: number;
  /** The like-for-like subset that also has a previous load: how often "the app's number" and "repeat the last load" matched what was loaded. */
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
