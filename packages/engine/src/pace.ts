/**
 * Goal pace ("two clocks"): is the goal still on pace? Pure functions, no I/O, no UI.
 *
 * This is an ESTIMATE from the lifter's own history, not a prediction or a promise. Every result carries the numbers it used so the
 * screen can show them. Two clocks run side by side:
 *   - the calendar clock: the date the lifter set (optional);
 *   - the exposure clock: how often they actually trained the lift or muscle in the last four weeks. A missed week lowers the
 *     exposures per week, which moves the projected date later (or raises the rate needed to hit the fixed date).
 *
 * Thresholds below are DEFAULTS pending Mohamed's confirmation of what "on pace" should mean (MASTER-PLAN Step 2).
 */

import { epley, median } from "./line";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/** rate / required rate at or above this is "ahead". */
export const AHEAD_RATIO = 1.25;
/** rate / required rate at or above this (and below ahead) is "on pace"; below it is "behind". */
export const ON_PACE_RATIO = 0.85;
/** Minimum lift exposures before a lift pace is claimed. */
export const MIN_LIFT_EXPOSURES = 4;
/** Minimum bodyweight entries (over at least 7 days) before a bodyweight slope is claimed. */
export const MIN_BW_ENTRIES = 3;
export const MIN_BW_SPAN_DAYS = 7;
/** Bodyweight within this many kg of the goal counts as reached. */
export const BW_REACHED_TOLERANCE_KG = 0.3;
/** Window for how often the lifter really trains it. */
export const FREQUENCY_WINDOW_DAYS = 28;

export type PaceStatus = "reached" | "ahead" | "on_pace" | "behind" | "too_thin";

const round = (x: number, d = 2): number => {
  const f = 10 ** d;
  return Math.round(x * f) / f;
};

/** Theil-Sen slope: the median of all pairwise slopes. One odd point cannot move it much. Null if x never changes. */
export function theilSen(points: { x: number; y: number }[]): number | null {
  const slopes: number[] = [];
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[j]!.x - points[i]!.x;
      if (dx !== 0) slopes.push((points[j]!.y - points[i]!.y) / dx);
    }
  return slopes.length === 0 ? null : median(slopes);
}

// ---------------------------------------------------------------------------------------------------------------- lift pace

export interface LiftExposure {
  /** When the session finished, unix ms. */
  at: number;
  /** Best estimated 1RM of that session's working sets (kg). */
  e1rm: number;
}

export interface LiftGoal {
  targetLoad: number;
  targetReps: number;
  /** YYYY-MM-DD or null. */
  targetDate: string | null;
}

export interface LiftPace {
  status: PaceStatus;
  /** Why the status is too_thin, when it is. */
  thin?: "few_exposures" | "no_history";
  targetE1rm: number;
  /** Median of the last three sessions' estimates (kg). Null when there is no history. */
  currentE1rm: number | null;
  exposures: number;
  /** Exposures per week over the last 28 days (or since the first one if shorter, at least one week). */
  exposuresPerWeek: number | null;
  /** Estimated kg of e1RM gained per exposure (Theil-Sen over the last 8 sessions). */
  ratePerExposure: number | null;
  /** Kg of e1RM per exposure needed to reach the target by the date. Null with no date. */
  requiredPerExposure: number | null;
  /** Exposures left before the date at the recent weekly rate. Null with no date. */
  exposuresLeft: number | null;
  /** Projected date (YYYY-MM-DD) at the current rate and weekly frequency. Null if flat/declining or too thin. */
  projectedDate: string | null;
  dateGone: boolean;
}

export const toDateString = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
export const dateStringToMs = (s: string): number => Date.parse(`${s}T00:00:00Z`);

function exposuresPerWeek(times: number[], nowMs: number): number | null {
  if (times.length === 0) return null;
  const windowMs = FREQUENCY_WINDOW_DAYS * DAY_MS;
  const first = Math.min(...times);
  const span = Math.min(windowMs, Math.max(WEEK_MS, nowMs - first));
  const inWindow = times.filter((t) => t > nowMs - span && t <= nowMs).length;
  return round((inWindow / span) * WEEK_MS, 3);
}

export function liftPace(goal: LiftGoal, history: LiftExposure[], nowMs: number): LiftPace {
  const targetE1rm = round(epley(goal.targetLoad, goal.targetReps), 2);
  const sorted = [...history].filter((h) => h.at <= nowMs).sort((a, b) => a.at - b.at);
  const base: LiftPace = {
    status: "too_thin",
    targetE1rm,
    currentE1rm: null,
    exposures: sorted.length,
    exposuresPerWeek: exposuresPerWeek(sorted.map((h) => h.at), nowMs),
    ratePerExposure: null,
    requiredPerExposure: null,
    exposuresLeft: null,
    projectedDate: null,
    dateGone: false,
  };
  if (sorted.length === 0) return { ...base, thin: "no_history" };
  const current = round(median(sorted.slice(-3).map((h) => h.e1rm)), 2);
  base.currentE1rm = current;
  if (current >= targetE1rm) return { ...base, status: "reached" };
  if (sorted.length < MIN_LIFT_EXPOSURES) return { ...base, thin: "few_exposures" };

  const recent = sorted.slice(-8);
  const rate = theilSen(recent.map((h, i) => ({ x: i, y: h.e1rm })));
  base.ratePerExposure = rate === null ? null : round(rate, 3);
  const perWeek = base.exposuresPerWeek ?? 0;
  const remaining = targetE1rm - current;

  if (rate !== null && rate > 0 && perWeek > 0) {
    const weeks = remaining / rate / perWeek;
    base.projectedDate = toDateString(nowMs + weeks * WEEK_MS);
  }

  if (goal.targetDate === null) {
    // No date to be late for: judge only whether it is moving at all.
    return { ...base, status: rate !== null && rate > 0 ? "on_pace" : "behind" };
  }

  const dateMs = dateStringToMs(goal.targetDate) + DAY_MS - 1;
  if (dateMs <= nowMs) return { ...base, status: "behind", dateGone: true };
  const left = round(((dateMs - nowMs) / WEEK_MS) * perWeek, 2);
  base.exposuresLeft = left;
  if (left <= 0) return { ...base, status: "behind" };
  const required = remaining / left;
  base.requiredPerExposure = round(required, 3);
  if (rate === null || rate <= 0) return { ...base, status: "behind" };
  const ratio = rate / required;
  return { ...base, status: ratio >= AHEAD_RATIO ? "ahead" : ratio >= ON_PACE_RATIO ? "on_pace" : "behind" };
}

// ----------------------------------------------------------------------------------------------------------- bodyweight pace

export interface BodyweightEntry {
  at: number;
  kg: number;
}

export interface BodyweightGoal {
  targetKg: number;
  targetDate: string | null;
}

export interface BodyweightPace {
  status: PaceStatus;
  thin?: "no_entries" | "few_entries" | "stale";
  /** Median of the entries in the last 7 days; the single heaviest or lightest day cannot move it much. */
  trendKg: number | null;
  entries: number;
  /** Kg per week, Theil-Sen over the last 28 days. Negative = losing. */
  slopeKgPerWeek: number | null;
  /** Signed kg per week needed to reach the goal by the date. Null with no date. */
  requiredKgPerWeek: number | null;
  projectedDate: string | null;
  dateGone: boolean;
}

export function bodyweightPace(goal: BodyweightGoal, entries: BodyweightEntry[], nowMs: number): BodyweightPace {
  const sorted = [...entries].filter((e) => e.at <= nowMs).sort((a, b) => a.at - b.at);
  const base: BodyweightPace = { status: "too_thin", trendKg: null, entries: sorted.length, slopeKgPerWeek: null, requiredKgPerWeek: null, projectedDate: null, dateGone: false };
  if (sorted.length === 0) return { ...base, thin: "no_entries" };
  const lastWeek = sorted.filter((e) => e.at > nowMs - WEEK_MS);
  const lastTwoWeeks = sorted.filter((e) => e.at > nowMs - 2 * WEEK_MS);
  if (lastTwoWeeks.length === 0) return { ...base, thin: "stale" };
  // The trend is the median of the last 7 days; with nothing that recent, the median of the last 14 days.
  const trend = round(median((lastWeek.length > 0 ? lastWeek : lastTwoWeeks).map((e) => e.kg)), 2);
  base.trendKg = trend;
  if (Math.abs(trend - goal.targetKg) <= BW_REACHED_TOLERANCE_KG) return { ...base, status: "reached" };
  const direction = Math.sign(goal.targetKg - trend);

  const win = sorted.filter((e) => e.at > nowMs - FREQUENCY_WINDOW_DAYS * DAY_MS);
  const spanDays = win.length > 1 ? (win[win.length - 1]!.at - win[0]!.at) / DAY_MS : 0;
  if (win.length < MIN_BW_ENTRIES || spanDays < MIN_BW_SPAN_DAYS) return { ...base, thin: "few_entries" };
  const slope = theilSen(win.map((e) => ({ x: e.at / WEEK_MS, y: e.kg })));
  if (slope === null) return { ...base, thin: "few_entries" };
  base.slopeKgPerWeek = round(slope, 3);
  const toward = slope * direction; // positive = moving toward the goal
  if (toward > 0) base.projectedDate = toDateString(nowMs + (Math.abs(goal.targetKg - trend) / toward) * WEEK_MS);

  if (goal.targetDate === null) return { ...base, status: toward > 0 ? "on_pace" : "behind" };
  const dateMs = dateStringToMs(goal.targetDate) + DAY_MS - 1;
  if (dateMs <= nowMs) return { ...base, status: "behind", dateGone: true };
  const required = (goal.targetKg - trend) / ((dateMs - nowMs) / WEEK_MS);
  base.requiredKgPerWeek = round(required, 3);
  if (toward <= 0) return { ...base, status: "behind" };
  const ratio = toward / Math.abs(required);
  return { ...base, status: ratio >= AHEAD_RATIO ? "ahead" : ratio >= ON_PACE_RATIO ? "on_pace" : "behind" };
}

// ------------------------------------------------------------------------------------------------------------ muscle exposure

export interface MusclePace {
  status: "on_pace" | "behind" | "too_thin";
  /** Sessions that trained the muscle per week over the last 28 days (or since the first one, at least a week). */
  sessionsPerWeek: number | null;
  /** The weekly floor compared against. */
  floorPerWeek: number;
  sessions: number;
}

/** Default weekly floor for a muscle-exposure goal: twice a week. A default, not a finding. */
export const MUSCLE_FLOOR_PER_WEEK = 2;

export function musclePace(sessionTimes: number[], nowMs: number, programmeStartMs: number | null): MusclePace {
  const times = sessionTimes.filter((t) => t <= nowMs);
  const first = times.length > 0 ? Math.min(...times) : programmeStartMs;
  if (first === null || nowMs - first < WEEK_MS) {
    return { status: "too_thin", sessionsPerWeek: exposuresPerWeek(times, nowMs), floorPerWeek: MUSCLE_FLOOR_PER_WEEK, sessions: times.length };
  }
  const perWeek = exposuresPerWeek(times, nowMs) ?? 0;
  return { status: perWeek >= MUSCLE_FLOOR_PER_WEEK ? "on_pace" : "behind", sessionsPerWeek: perWeek, floorPerWeek: MUSCLE_FLOOR_PER_WEEK, sessions: times.length };
}
