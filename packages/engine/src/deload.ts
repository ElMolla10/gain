import { floorLoad, allowsZero } from "./loads";
import { isTrustedWorkingSet } from "./outlier";
import type { GymLoadSpec, HistorySession, LoggedSet, SetupType } from "./types";

export const DELOAD_SESSIONS = 3;
export const HIGH_EFFORT_RIR = 2;
export const DELOAD_LOAD_FACTOR = 0.9;

export interface DeloadSession {
  load: number;
  reps: number;
  rir: number | null;
  failure: boolean;
}

const harderLoad = (setup: SetupType, a: number, b: number): boolean => (setup === "assisted" ? a < b : a > b);

export function isHighEffort(s: Pick<DeloadSession, "rir" | "failure">): boolean {
  return s.failure || (s.rir != null && s.rir <= HIGH_EFFORT_RIR);
}

function weaker(setup: SetupType, later: DeloadSession, earlier: DeloadSession): boolean {
  if (harderLoad(setup, earlier.load, later.load)) return true;
  return later.load === earlier.load && later.reps < earlier.reps;
}

export function topSetOf(sets: LoggedSet[], setup: SetupType): DeloadSession | null {
  const work = sets.filter((s) => isTrustedWorkingSet(s) && s.reps >= 1 && Number.isFinite(s.load));
  if (work.length === 0) return null;
  const top = work.reduce((best, s) => (harderLoad(setup, s.load, best.load) || (s.load === best.load && s.reps > best.reps) ? s : best), work[0]!);
  return {
    load: top.load,
    reps: top.reps,
    rir: top.rir ?? null,
    failure: !!top.tags?.includes("failure"),
  };
}

export function topSetsOfHistory(history: HistorySession[], setup: SetupType): DeloadSession[] {
  return history
    .slice()
    .sort((a, b) => Date.parse(a.performedAt) - Date.parse(b.performedAt))
    .flatMap((h) => {
      const top = topSetOf(h.sets, setup);
      return top ? [top] : [];
    });
}

/**
 * Possible deload: the last three consecutive trusted sessions got weaker while effort stayed high
 * (RIR ≤ 2 or a failure tag). One or two bad workouts are never enough. Missing effort data is not "high".
 */
export function detectDeload(sessions: DeloadSession[], setup: SetupType = "free"): boolean {
  if (sessions.length < DELOAD_SESSIONS) return false;
  const last = sessions.slice(-DELOAD_SESSIONS);
  if (!last.every(isHighEffort)) return false;
  for (let i = 1; i < last.length; i++) {
    if (!weaker(setup, last[i]!, last[i - 1]!)) return false;
  }
  return true;
}

/** Gym load at or below 90% of the current working load. */
export function scaleDeloadLoad(load: number, spec: GymLoadSpec | null, setup: SetupType = "free"): number {
  const cap = load * DELOAD_LOAD_FACTOR;
  if (!spec) return Math.round(cap * 4) / 4;
  return floorLoad(spec, cap, allowsZero(setup)) ?? Math.round(cap * 4) / 4;
}

export function reduceSetsByOne(sets: number): number {
  return Math.max(1, sets - 1);
}
