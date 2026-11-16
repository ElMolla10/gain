import { epley } from "./line";
import { theilSen } from "./pace";
import { TREND_FLAT_SHARE, TREND_MIN_POINTS, TREND_MIN_SPAN_DAYS, TREND_WINDOW, type TrendPoint } from "./trend";

/**
 * Strength projection for the exercise Summary: where the estimated 1RM is heading if progression stays the same.
 * Linear, from the same robust trend the app already uses for "change per month" (Theil-Sen over the last TREND_WINDOW
 * sessions, at least TREND_MIN_POINTS over TREND_MIN_SPAN_DAYS), applied to each session's top-set Epley e1RM instead of
 * the raw load. No model, no curve fitting: one slope, drawn forward from the latest session.
 */

const DAY_MS = 86_400_000;
/** Average month (365.25 / 12 days). */
export const MONTH_DAYS = 30.4375;
/** The projection and goal need this many sessions inside PROJECTION_RECENT_DAYS, so a long gap never draws a confident line. */
export const PROJECTION_MIN_SESSIONS = 4;
export const PROJECTION_RECENT_DAYS = 56;
/** The no-goal caption looks this far ahead. */
export const PROJECTION_HORIZON_DAYS = 90;
/** A goal further away than this reads "Over 12 months at this pace" (no false precision). */
export const GOAL_MAX_DAYS = 365;

export interface E1rmPoint {
  at: number;
  /** Estimated 1RM of that session's top set (kg). */
  e1rm: number;
  imported?: boolean;
}

export interface StrengthProjection {
  points: E1rmPoint[];
  /** Latest session's e1RM (kg) and when. Null with no sessions. */
  current: number | null;
  currentAt: number | null;
  /** Highest e1RM of any session (kg). */
  best: number | null;
  /** e1RM change per 30 days (kg), robust (Theil-Sen). Null when the history is too thin for a trend. */
  perMonth: number | null;
  /** True when there is enough recent training to project (≥ 4 sessions in 8 weeks and a trend). */
  canProject: boolean;
  /** True when the trend is flat or going down (no honest date for a higher goal). */
  notOnPace: boolean;
}

/** Each top-set point as an e1RM point, oldest first. */
export function e1rmPoints(points: readonly TrendPoint[]): E1rmPoint[] {
  return [...points]
    .filter((p) => Number.isFinite(p.at) && Number.isFinite(p.load) && p.reps >= 1)
    .sort((a, b) => a.at - b.at)
    .map((p) => ({ at: p.at, e1rm: epley(p.load, p.reps), ...(p.imported ? { imported: true } : {}) }));
}

/** e1RM change per 30 days with the trend's own rules (window, minimum points and span). Null when thin. */
export function e1rmChangePer30d(points: readonly E1rmPoint[]): number | null {
  const win = points.slice(-TREND_WINDOW);
  const spanDays = win.length > 1 ? (win[win.length - 1]!.at - win[0]!.at) / DAY_MS : 0;
  if (win.length < TREND_MIN_POINTS || spanDays < TREND_MIN_SPAN_DAYS) return null;
  const slope = theilSen(win.map((p) => ({ x: p.at / DAY_MS, y: p.e1rm })));
  return slope === null ? null : Math.round(slope * 30 * 1000) / 1000;
}

export function strengthProjection(trendPoints: readonly TrendPoint[], now: number): StrengthProjection {
  const points = e1rmPoints(trendPoints);
  const last = points[points.length - 1] ?? null;
  const best = points.length ? Math.max(...points.map((p) => p.e1rm)) : null;
  const perMonth = e1rmChangePer30d(points);
  const recent = points.filter((p) => p.at >= now - PROJECTION_RECENT_DAYS * DAY_MS && p.at <= now + DAY_MS).length;
  const canProject = perMonth !== null && last !== null && recent >= PROJECTION_MIN_SESSIONS;
  const notOnPace = perMonth !== null && last !== null && perMonth < Math.max(Math.abs(last.e1rm), 1) * TREND_FLAT_SHARE;
  return { points, current: last?.e1rm ?? null, currentAt: last?.at ?? null, best, perMonth, canProject, notOnPace };
}

/** The projected e1RM at `at` (kg): a straight line from the latest session at `perMonth`. Null when it cannot project. */
export function projectE1rm(p: StrengthProjection, at: number): number | null {
  if (!p.canProject || p.current === null || p.currentAt === null || p.perMonth === null) return null;
  return p.current + (p.perMonth / 30) * ((at - p.currentAt) / DAY_MS);
}

export type GoalEta =
  | { kind: "reached" }
  | { kind: "eta"; at: number; days: number }
  | { kind: "beyond" }
  | { kind: "notOnPace" }
  | { kind: "unknown" };

/**
 * When the e1RM reaches `goalKg` at the current pace. "reached" when a session already got there; "notOnPace" for a flat or
 * falling trend; "beyond" past GOAL_MAX_DAYS; "unknown" without enough recent training to project.
 */
export function goalEta(p: StrengthProjection, goalKg: number, now: number): GoalEta {
  if (!(goalKg > 0)) return { kind: "unknown" };
  if (p.best !== null && p.best >= goalKg) return { kind: "reached" };
  if (!p.canProject || p.current === null || p.currentAt === null || p.perMonth === null) return { kind: "unknown" };
  if (p.notOnPace) return { kind: "notOnPace" };
  const at = Math.max(now, p.currentAt + ((goalKg - p.current) / (p.perMonth / 30)) * DAY_MS);
  const days = (at - now) / DAY_MS;
  if (days > GOAL_MAX_DAYS) return { kind: "beyond" };
  return { kind: "eta", at, days };
}

/** "early" (1–10), "mid" (11–20) or "late" (21+) part of the month, for "early Jan" style dates. */
export function partOfMonth(at: number): "early" | "mid" | "late" {
  const d = new Date(at).getDate();
  return d <= 10 ? "early" : d <= 20 ? "mid" : "late";
}
