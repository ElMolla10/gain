import type { HistorySession, LineIdentity, SetupType } from "./types";

export const lineKey = (l: LineIdentity): string => `${l.exerciseId}|${l.gymId}|${l.setup}`;

/** Two sets of history are comparable only on the same exercise, same gym and same setup. */
export const sameLine = (a: LineIdentity, b: LineIdentity): boolean => lineKey(a) === lineKey(b);

export function splitComparable(
  line: LineIdentity,
  history: HistorySession[],
): { comparable: HistorySession[]; incomparable: HistorySession[] } {
  const comparable: HistorySession[] = [];
  const incomparable: HistorySession[] = [];
  for (const s of history) (sameLine(line, s.line) ? comparable : incomparable).push(s);
  return { comparable, incomparable };
}

/** Newest first. Unparseable dates sort last. */
export function sortNewestFirst<T extends { performedAt: string }>(items: T[]): T[] {
  const t = (s: string) => {
    const n = Date.parse(s);
    return Number.isNaN(n) ? -Infinity : n;
  };
  return [...items].sort((a, b) => t(b.performedAt) - t(a.performedAt));
}

/** Epley estimated one-rep max. Only a within-line yardstick, never shown as a claim. */
export const epley = (load: number, reps: number): number => (reps <= 1 ? load : load * (1 + reps / 30));

/**
 * The load the lifter actually moved, when bodyweight is known.
 * Free: the load. Bodyweight_plus_added: bodyweight + added. Assisted: bodyweight - assistance.
 * Returns null when it cannot be known (never guessed).
 */
export function effectiveLoad(setup: SetupType, load: number, bodyweightKg?: number | null): number | null {
  if (setup === "free") return load;
  if (bodyweightKg === undefined || bodyweightKg === null || !(bodyweightKg > 0)) return null;
  return setup === "bodyweight_plus_added" ? bodyweightKg + load : bodyweightKg - load;
}

export const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
