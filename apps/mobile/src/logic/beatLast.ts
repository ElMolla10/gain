/**
 * "↑" beside a logged set (logger spec PR C): the set beat the same set last time. Pure. More load at the same or more reps, or the same
 * load with more reps. Timed and distance sets compare their quantity (stored in `reps`). Warm-up and drop rows never count. This is a
 * plain comparison with last time, not a record: no "best", no streaks.
 */
import type { Measure } from "@gain/engine";

export interface BeatSet {
  load: number;
  reps: number;
  warmup?: boolean;
  tags?: readonly string[];
}

const EPS = 1e-6;
const plain = (s: BeatSet) => !s.warmup && !s.tags?.includes("drop");

export function beatLast(saved: BeatSet, last: BeatSet | null | undefined, measure: Measure = "reps"): boolean {
  if (!last || !plain(saved) || !plain(last)) return false;
  if (measure !== "reps") return saved.reps > last.reps && saved.load >= last.load - EPS;
  if (saved.load > last.load + EPS) return saved.reps >= last.reps;
  if (Math.abs(saved.load - last.load) < EPS) return saved.reps > last.reps;
  return false;
}
