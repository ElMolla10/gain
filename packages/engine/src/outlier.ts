import { effectiveLoad, epley, median, sortNewestFirst, splitComparable } from "./line";
import { nextLoadAbove, nextLoadBelow } from "./loads";
import type { GymLoadSpec, HistorySession, LineIdentity, LoggedSet, OutlierStatus } from "./types";

export const OUTLIER_LOAD_RATIO = 0.3;
export const OUTLIER_E1RM_RATIO = 0.25;
export const OUTLIER_MIN_SETS = 2;
export const OUTLIER_RECENT_SESSIONS = 3;
export const MAX_PLAUSIBLE_REPS = 100;

export type OutlierReason = "invalid_value" | "load_far_from_line" | "e1rm_far_from_line" | "reps_far_from_line" | "quantity_far_from_line";

export interface OutlierResult {
  /** ok: fits the line. unconfirmed: ask the lifter. insufficient_history: cannot judge, treated as ok. */
  verdict: "ok" | "unconfirmed" | "insufficient_history";
  /** Value to store in set.outlier_status. */
  outlierStatus: OutlierStatus;
  reasons: OutlierReason[];
  expected: { medianLoad: number; medianReps: number; medianE1rm: number | null; sampleSize: number } | null;
}

export interface OutlierContext {
  line: LineIdentity;
  history: HistorySession[];
  bodyweightKg?: number | null;
  gymSpec?: GymLoadSpec | null;
}

/** Sets that may anchor a line: working sets, not drop sets, not unconfirmed/rejected outliers. */
export function isTrustedWorkingSet(s: LoggedSet): boolean {
  if (s.warmup) return false;
  if (s.tags?.includes("drop")) return false;
  return s.outlierStatus !== "unconfirmed" && s.outlierStatus !== "rejected";
}

export function recentTrustedSets(line: LineIdentity, history: HistorySession[]): LoggedSet[] {
  const { comparable } = splitComparable(line, history);
  const sets: LoggedSet[] = [];
  for (const s of sortNewestFirst(comparable).slice(0, OUTLIER_RECENT_SESSIONS)) {
    sets.push(...s.sets.filter(isTrustedWorkingSet));
  }
  return sets;
}

/**
 * Is a newly logged set far from the recent line? If so it is flagged `unconfirmed` and must NOT move the next target
 * until the lifter confirms it (wrong plate, wrong machine, typo).
 */
export function checkOutlier(set: LoggedSet, ctx: OutlierContext): OutlierResult {
  const reasons: OutlierReason[] = [];
  const invalid =
    !Number.isFinite(set.load) ||
    !Number.isFinite(set.reps) ||
    set.reps < 1 ||
    set.reps > MAX_PLAUSIBLE_REPS ||
    set.load < 0 ||
    (ctx.line.setup === "free" && set.load <= 0);
  if (invalid) {
    return { verdict: "unconfirmed", outlierStatus: "unconfirmed", reasons: ["invalid_value"], expected: null };
  }

  const recent = recentTrustedSets(ctx.line, ctx.history);
  if (recent.length < OUTLIER_MIN_SETS) {
    return { verdict: "insufficient_history", outlierStatus: "none", reasons: [], expected: null };
  }

  const setup = ctx.line.setup;
  const bw = ctx.bodyweightKg ?? null;
  const medianLoad = median(recent.map((s) => s.load));
  const medianReps = median(recent.map((s) => s.reps));

  const metric = (s: LoggedSet): number | null => {
    const eff = effectiveLoad(setup, s.load, bw);
    return eff !== null && eff > 0 ? epley(eff, s.reps) : null;
  };
  const histMetrics = recent.map(metric).filter((x): x is number => x !== null);
  const medianE1rm = histMetrics.length === recent.length ? median(histMetrics) : null;

  // Load check: relative AND bigger than two steps of this gym's loads (so one small step is never an outlier).
  let step = 2.5;
  if (ctx.gymSpec) {
    const up = nextLoadAbove(ctx.gymSpec, medianLoad, setup !== "free");
    const down = nextLoadBelow(ctx.gymSpec, medianLoad, setup !== "free");
    step = up !== null ? up - medianLoad : down !== null ? medianLoad - down : step;
  }
  const loadDiff = Math.abs(set.load - medianLoad);
  if (loadDiff / Math.max(medianLoad, step) > OUTLIER_LOAD_RATIO && loadDiff > 2 * step) {
    reasons.push("load_far_from_line");
  }

  const m = metric(set);
  if (m !== null && medianE1rm !== null) {
    if (Math.abs(m - medianE1rm) / medianE1rm > OUTLIER_E1RM_RATIO) reasons.push("e1rm_far_from_line");
  } else if (setup !== "free" && bw === null) {
    // Bodyweight-style line with no bodyweight on file: compare reps (never guess bodyweight).
    if (Math.abs(set.reps - medianReps) > Math.max(5, medianReps * 0.5)) reasons.push("reps_far_from_line");
  }

  const expected = { medianLoad, medianReps, medianE1rm, sampleSize: recent.length };
  if (reasons.length > 0) return { verdict: "unconfirmed", outlierStatus: "unconfirmed", reasons, expected };
  return { verdict: "ok", outlierStatus: "none", reasons: [], expected };
}
