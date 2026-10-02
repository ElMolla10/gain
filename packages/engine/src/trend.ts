import { isTrustedWorkingSet } from "./outlier";
import { theilSen } from "./pace";
import type { HistorySession, LoggedSet, SetupType } from "./types";

/**
 * The ONE trend measure (Step 6): per finished session, the top working set = the hardest trusted working set,
 * shown with its reps. Free weights and added-load: the heaviest load. Assisted: the least assistance (lower is harder).
 * Ties go to more reps. Warm-ups, drop sets and unconfirmed outliers never count. It is NOT an estimated 1RM:
 * what you see is what you lifted. Lines are per exercise + gym + setup, so setups are never mixed.
 */
export const TREND_MEASURE = "top_set" as const;

export interface TrendPoint {
  /** Unix ms of the session. */
  at: number;
  load: number;
  reps: number;
  /** Trusted working sets that day. */
  sets: number;
  imported?: boolean;
}

export type TrendDirection = "better" | "flat" | "worse" | "thin";

export interface LiftTrend {
  measure: typeof TREND_MEASURE;
  setup: SetupType;
  points: TrendPoint[];
  direction: TrendDirection;
  /** Change of the top-set load per 30 days (kg; Theil-Sen over the last points), raw sign. Null when thin. */
  loadChangePer30d: number | null;
  /** The hardest top set ever, and the latest one. */
  best: TrendPoint | null;
  latest: TrendPoint | null;
}

export const TREND_MIN_POINTS = 3;
export const TREND_MIN_SPAN_DAYS = 14;
export const TREND_WINDOW = 10;
/** A change smaller than this share of the latest load per 30 days is "flat". */
export const TREND_FLAT_SHARE = 0.01;
const DAY_MS = 86_400_000;

const harderThan = (setup: SetupType, a: LoggedSet, b: LoggedSet): boolean =>
  a.load !== b.load ? (setup === "assisted" ? a.load < b.load : a.load > b.load) : a.reps > b.reps;

/** The top working set of one session, or null if no trusted working set. */
export function topSet(sets: LoggedSet[], setup: SetupType): LoggedSet | null {
  let top: LoggedSet | null = null;
  for (const s of sets) {
    if (!isTrustedWorkingSet(s) || !(s.reps >= 1) || !Number.isFinite(s.load)) continue;
    if (top === null || harderThan(setup, s, top)) top = s;
  }
  return top;
}

export function liftTrend(history: HistorySession[], setup: SetupType, importedAt: ReadonlySet<number> = new Set()): LiftTrend {
  const points: TrendPoint[] = [];
  for (const h of history) {
    const top = topSet(h.sets, setup);
    if (!top) continue;
    const at = Date.parse(h.performedAt);
    if (!Number.isFinite(at)) continue;
    const pt: TrendPoint = { at, load: top.load, reps: top.reps, sets: h.sets.filter(isTrustedWorkingSet).length };
    if (importedAt.has(at)) pt.imported = true;
    points.push(pt);
  }
  points.sort((a, b) => a.at - b.at);
  const latest = points[points.length - 1] ?? null;
  let best: TrendPoint | null = null;
  for (const p of points) if (best === null || harderThan(setup, p, best)) best = p;

  const base = { measure: TREND_MEASURE, setup, points, best, latest };
  const win = points.slice(-TREND_WINDOW);
  const spanDays = win.length > 1 ? (win[win.length - 1]!.at - win[0]!.at) / DAY_MS : 0;
  if (win.length < TREND_MIN_POINTS || spanDays < TREND_MIN_SPAN_DAYS) return { ...base, direction: "thin", loadChangePer30d: null };
  const slope = theilSen(win.map((p) => ({ x: p.at / DAY_MS, y: p.load })));
  if (slope === null) return { ...base, direction: "thin", loadChangePer30d: null };
  const per30 = Math.round(slope * 30 * 1000) / 1000;
  const scale = Math.max(Math.abs(latest!.load), 1);
  if (Math.abs(per30) < scale * TREND_FLAT_SHARE) return { ...base, direction: "flat", loadChangePer30d: per30 };
  const harder = setup === "assisted" ? per30 < 0 : per30 > 0;
  return { ...base, direction: harder ? "better" : "worse", loadChangePer30d: per30 };
}
