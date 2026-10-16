import { epley } from "./line";
import { isTrustedWorkingSet } from "./outlier";
import type { HistorySession, LoggedSet, SetupType } from "./types";

/** Rep counts the summary table always includes when the lifter actually did them. */
export const FEATURED_REP_COUNTS = [1, 5, 6, 8, 10, 12] as const;

export interface LocatedSet {
  at: number;
  setIndex: number;
  load: number;
  reps: number;
}

export type PrKind = "heaviest" | "volume" | "rep";

export const setVolume = (s: Pick<LoggedSet, "load" | "reps">): number => s.load * s.reps;

const harderLoad = (setup: SetupType, a: number, b: number): boolean => (setup === "assisted" ? a < b : a > b);

function walkTrusted(history: HistorySession[], visit: (s: LoggedSet, at: number, setIndex: number) => void): void {
  for (const h of history) {
    const at = Date.parse(h.performedAt);
    if (!Number.isFinite(at)) continue;
    h.sets.forEach((s, setIndex) => {
      if (!isTrustedWorkingSet(s) || !(s.reps >= 1) || !Number.isFinite(s.load)) return;
      visit(s, at, setIndex);
    });
  }
}

/** Heaviest trusted working set (least assistance on assisted lines). */
export function heaviestSet(history: HistorySession[], setup: SetupType): LocatedSet | null {
  let best: LocatedSet | null = null;
  walkTrusted(history, (s, at, setIndex) => {
    if (!best || harderLoad(setup, s.load, best.load) || (s.load === best.load && s.reps > best.reps)) {
      best = { at, setIndex, load: s.load, reps: s.reps };
    }
  });
  return best;
}

/** Highest load × reps among trusted working sets. */
export function bestSetVolume(history: HistorySession[]): { set: LocatedSet; volume: number } | null {
  let best: { set: LocatedSet; volume: number } | null = null;
  walkTrusted(history, (s, at, setIndex) => {
    const volume = setVolume(s);
    if (!best || volume > best.volume) best = { set: { at, setIndex, load: s.load, reps: s.reps }, volume };
  });
  return best;
}

/** Highest sum of trusted working-set volume in one session. */
export function bestSessionVolume(history: HistorySession[]): { at: number; volume: number } | null {
  let best: { at: number; volume: number } | null = null;
  for (const h of history) {
    const at = Date.parse(h.performedAt);
    if (!Number.isFinite(at)) continue;
    let volume = 0;
    for (const s of h.sets) {
      if (!isTrustedWorkingSet(s) || !(s.reps >= 1) || !Number.isFinite(s.load)) continue;
      volume += setVolume(s);
    }
    if (volume <= 0) continue;
    if (!best || volume > best.volume) best = { at, volume };
  }
  return best;
}

/** Highest Epley estimated 1RM among trusted working sets. Not a substitute for the actual best set. */
export function bestEstimated1rm(history: HistorySession[]): { set: LocatedSet; e1rm: number } | null {
  let best: { set: LocatedSet; e1rm: number } | null = null;
  walkTrusted(history, (s, at, setIndex) => {
    const value = epley(s.load, s.reps);
    if (!best || value > best.e1rm) best = { set: { at, setIndex, load: s.load, reps: s.reps }, e1rm: value };
  });
  return best;
}

/**
 * Heaviest load at each exact rep count the lifter performed. Featured counts (1, 5, 6, 8, 10, 12) come first when
 * present; other performed counts follow in ascending order.
 */
export function repMaxes(history: HistorySession[], setup: SetupType): { reps: number; set: LocatedSet }[] {
  const byRep = new Map<number, LocatedSet>();
  walkTrusted(history, (s, at, setIndex) => {
    const cur = byRep.get(s.reps);
    if (!cur || harderLoad(setup, s.load, cur.load)) byRep.set(s.reps, { at, setIndex, load: s.load, reps: s.reps });
  });
  const featured = new Set<number>(FEATURED_REP_COUNTS);
  const featuredRows = FEATURED_REP_COUNTS.flatMap((reps) => {
    const set = byRep.get(reps);
    return set ? [{ reps, set }] : [];
  });
  const others = [...byRep.values()]
    .filter((s) => !featured.has(s.reps))
    .sort((a, b) => a.reps - b.reps)
    .map((set) => ({ reps: set.reps, set }));
  return [...featuredRows, ...others];
}

export function prKindsForSet(
  records: {
    heaviest: LocatedSet | null;
    bestSetVolume: { set: LocatedSet } | null;
    repMaxes: { reps: number; set: LocatedSet }[];
  },
  at: number,
  setIndex: number,
): PrKind[] {
  const kinds: PrKind[] = [];
  if (records.heaviest && records.heaviest.at === at && records.heaviest.setIndex === setIndex) kinds.push("heaviest");
  if (records.bestSetVolume && records.bestSetVolume.set.at === at && records.bestSetVolume.set.setIndex === setIndex) kinds.push("volume");
  if (records.repMaxes.some((r) => r.set.at === at && r.set.setIndex === setIndex)) kinds.push("rep");
  return kinds;
}
