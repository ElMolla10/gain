import { DEFAULT_REST_SECONDS } from "./restTimer";

/**
 * Session length ESTIMATE (never a promise). A set is not 3 minutes flat: it is the work itself, the rest after it, moving between
 * exercises and the warm-up before the first lifts. All of that is counted, and every number is a named constant so it can be argued with.
 *
 *   minutes = ( sets x (SET_WORK + rest)  +  exercises x TRANSITION  +  warm-up sets x (WARMUP_WORK + WARMUP_REST) ) / 60
 *
 * Warm-ups: WARMUP_SETS_FIRST before the first lift and WARMUP_SETS_SECOND before the second (later exercises are assumed to need none).
 */
export const SET_WORK_S = 45;
export const TRANSITION_S = 90;
export const WARMUP_WORK_S = 30;
export const WARMUP_REST_S = 60;
export const WARMUP_SETS_FIRST = 2;
export const WARMUP_SETS_SECOND = 1;

export interface DayLoad {
  exercises: number;
  /** Working sets. */
  sets: number;
}

export function warmupSetsFor(exercises: number): number {
  return (exercises >= 1 ? WARMUP_SETS_FIRST : 0) + (exercises >= 2 ? WARMUP_SETS_SECOND : 0);
}

/** Estimated minutes for one session, rounded up to the next whole minute (so "45 min" never means 46). */
export function estimateDayMinutes(d: DayLoad, restSeconds: number = DEFAULT_REST_SECONDS): number {
  if (d.exercises <= 0 && d.sets <= 0) return 0;
  const seconds = d.sets * (SET_WORK_S + restSeconds) + d.exercises * TRANSITION_S + warmupSetsFor(d.exercises) * (WARMUP_WORK_S + WARMUP_REST_S);
  return Math.ceil(seconds / 60);
}
