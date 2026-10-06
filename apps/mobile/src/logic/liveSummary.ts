/**
 * The numbers in the active workout's summary row (Duration / Volume / Sets) and the "PREVIOUS" column. Pure, so they are tested
 * without a phone. Volume and Sets count working sets only: warm-ups and sets the lifter rejected as typos never count.
 */
import { kgToUnit, type Unit } from "./units";

export interface CountableSet {
  load: number;
  reps: number;
  warmup: boolean;
  outlierStatus?: string;
  /** A hold or carry: no reps, so it adds nothing to the volume. */
  durationS?: number | null;
  distanceM?: number | null;
}

const counts = (s: CountableSet): boolean => !s.warmup && s.outlierStatus !== "rejected";

export function liveSummary(sets: readonly CountableSet[], startedAt: number | null, now: number): { durationMs: number; volumeKg: number; sets: number } {
  const working = sets.filter(counts);
  return {
    durationMs: startedAt === null ? 0 : Math.max(0, now - startedAt),
    volumeKg: working.reduce((n, s) => n + (s.durationS != null || s.distanceM != null ? 0 : s.load * s.reps), 0),
    sets: working.length,
  };
}

/** "5s", "12m 05s", "1h 05m". Unit letters come from the language (Arabic letters are drafts). */
export function formatDuration(ms: number, u: { h: string; m: string; s: string } = { h: "h", m: "m", s: "s" }): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}${u.h} ${two(m)}${u.m}`;
  if (m > 0) return `${m}${u.m} ${two(s)}${u.s}`;
  return `${s}${u.s}`;
}

/** Volume in the lifter's unit, rounded to a whole number ("1,240" has no separators here: plain digits read the same in both scripts). */
export const volumeText = (volumeKg: number, unit: Unit): string => String(Math.round(kgToUnit(volumeKg, unit)));

/**
 * The PREVIOUS cell for a set row: the same-numbered WORKING set of the last finished session of this exercise at this gym and setup
 * (the same line), as "90kg x 12". Warm-up rows and rows past the last session's sets show a dash. `lastWorking` has no warm-ups.
 */
export function previousText(lastWorking: readonly ({ load: number; reps: number } | null | undefined)[] | null, workingIndex: number | null, unit: Unit, unitText: string): string {
  if (!lastWorking || workingIndex === null) return "—";
  const s = lastWorking[workingIndex];
  if (!s) return "—";
  return `${kgToUnit(s.load, unit)}${unitText} x ${s.reps}`;
}

/** 0-based index among working rows for each row (null for warm-ups and drop sets): lines up with `rowLabels` and with the last session's working sets. */
export function workingIndexes(rows: readonly { warmup: boolean; tags?: readonly string[] }[]): (number | null)[] {
  let n = 0;
  return rows.map((r) => (r.warmup || r.tags?.includes("drop") ? null : n++));
}
