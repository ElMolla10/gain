/**
 * Same-muscle (or same-exercise) work earlier in today's session modestly lowers the next-set
 * expectation. Policy only: it never changes a load decision, a typed load, or trained model features.
 */
export interface SessionOrderSlot {
  exerciseId: string;
  name: string;
  /** Muscle group key (chest, back, …). `"other"` never matches another `"other"`. */
  muscle: string;
  /** True when this slot already has a trusted working set today. */
  done: boolean;
}

export interface SessionOrderFatigue {
  /** First earlier same-muscle exercise that already has work today. */
  earlierName: string;
  earlierCount: number;
  /** 1 or 2 fewer expected reps. */
  penaltyReps: number;
}

export const ORDER_PENALTY_MAX = 2;

/** Optional session flag. Never a recovery percentage; never a model feature. */
export type ReadinessFlag = "normal" | "fatigued" | "returning";

export function parseReadiness(raw: string | null | undefined): ReadinessFlag | null {
  return raw === "normal" || raw === "fatigued" || raw === "returning" ? raw : null;
}

/** Fatigued = 1, returning = 2: the same 1–2 rep band as same-muscle session order. */
export function readinessPenaltyReps(flag: ReadinessFlag | null | undefined): number {
  if (flag === "fatigued") return 1;
  if (flag === "returning") return 2;
  return 0;
}

/** Combined session-order + readiness drop, still capped at two reps. */
export function expectationPenaltyReps(orderPenalty: number, readinessPenalty: number): number {
  const order = Number.isFinite(orderPenalty) ? Math.max(0, Math.round(orderPenalty)) : 0;
  const ready = Number.isFinite(readinessPenalty) ? Math.max(0, Math.round(readinessPenalty)) : 0;
  return Math.min(ORDER_PENALTY_MAX, order + ready);
}

function sharesMuscle(a: SessionOrderSlot, b: SessionOrderSlot): boolean {
  if (a.exerciseId === b.exerciseId) return true;
  return a.muscle !== "other" && a.muscle === b.muscle;
}

/** Null when `currentExerciseId` is the first done (or only) slot for its muscle in session order. */
export function sessionOrderFatigue(slots: readonly SessionOrderSlot[], currentExerciseId: string): SessionOrderFatigue | null {
  const idx = slots.findIndex((s) => s.exerciseId === currentExerciseId);
  if (idx < 0) return null;
  const current = slots[idx]!;
  const earlier = slots.slice(0, idx).filter((s) => s.done && sharesMuscle(s, current));
  if (earlier.length === 0) return null;
  return {
    earlierName: earlier[0]!.name,
    earlierCount: earlier.length,
    penaltyReps: Math.min(ORDER_PENALTY_MAX, earlier.length),
  };
}

/**
 * Modest rep-expectation drop. `protect` keeps a clear PR / user-entered target unchanged.
 * Unknown or non-positive bases are returned as given.
 */
export function orderAdjustedReps(baseReps: number, penaltyReps: number, protect = false): number {
  if (protect || !Number.isFinite(baseReps) || baseReps < 1) return baseReps;
  if (!Number.isFinite(penaltyReps) || penaltyReps <= 0) return baseReps;
  return Math.max(1, Math.round(baseReps) - Math.min(ORDER_PENALTY_MAX, Math.max(0, Math.round(penaltyReps))));
}
