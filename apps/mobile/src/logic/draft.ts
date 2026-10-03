import { kgToUnit, unitToKg, type Unit } from "./units";
import { nextLoadAbove, nextLoadBelow, type GymLoadSpec, type SetupType } from "@gain/engine";

export interface SetDraft {
  load: number | null;
  reps: number | null;
  rir: number | null;
  warmup: boolean;
}

export interface Prefill {
  /** Sets already logged today for this exercise, oldest first. */
  today: { load: number; reps: number; rir: number | null; warmup: boolean }[];
  target: { load: number | null; reps: number | null } | null;
  last: { load: number; reps: number } | null;
}

/**
 * What the logger shows before the next set is typed. Never invented:
 * the previous set today wins (repeat is the common case), then today's target, then last time, else empty.
 */
export function initialDraft(p: Prefill): SetDraft {
  const prevWorking = [...p.today].reverse().find((s) => !s.warmup);
  if (prevWorking) return { load: prevWorking.load, reps: prevWorking.reps, rir: prevWorking.rir, warmup: false };
  if (p.target && p.target.load !== null && p.target.reps !== null) return { load: p.target.load, reps: p.target.reps, rir: null, warmup: false };
  if (p.last) return { load: p.last.load, reps: p.last.reps, rir: null, warmup: false };
  return { load: null, reps: null, rir: null, warmup: false };
}

/** Repeat the last set exactly (the one-tap case). Null when nothing has been logged yet. */
export function repeatLast(today: Prefill["today"]): SetDraft | null {
  const last = today[today.length - 1];
  return last ? { load: last.load, reps: last.reps, rir: last.rir, warmup: last.warmup } : null;
}

/** Step the load to the next/previous standard step for this equipment. Without gym loads, fall back to 2.5 kg (5 lb in lb mode) and say so. Loads are kg. */
export function stepLoad(
  spec: GymLoadSpec | null,
  current: number | null,
  dir: 1 | -1,
  setup: SetupType = "free",
  unit: Unit = "kg",
): { load: number; exact: boolean } {
  const zero = setup !== "free";
  const from = current ?? 0;
  if (!spec) {
    if (unit === "lb") return { load: Math.max(0, unitToKg(Math.round(kgToUnit(from, "lb") + dir * 5), "lb")), exact: false };
    return { load: Math.max(0, Math.round((from + dir * 2.5) * 100) / 100), exact: false };
  }
  const next = dir === 1 ? nextLoadAbove(spec, from, zero) : nextLoadBelow(spec, from, zero);
  return { load: next ?? from, exact: true };
}

export const stepReps = (current: number | null, dir: 1 | -1): number => Math.max(1, Math.min(100, (current ?? 0) + dir));

export function canLog(d: SetDraft): d is SetDraft & { load: number; reps: number } {
  return d.load !== null && d.reps !== null && d.reps >= 1 && d.load >= 0;
}

/** RIR choices shown as chips; null means "not tracked for this set". */
export const RIR_CHOICES: (number | null)[] = [null, 0, 1, 2, 3, 4];
