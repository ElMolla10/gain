/**
 * Weekly one-decision review. Pure rule: observed numbers in, ONE proposed change out (keep / move the date / one more exposure /
 * a two-week variation / an easier week). The lifter taps to accept, edit or skip; nothing here changes a plan.
 *
 * It never claims to measure fatigue or recovery. "An easier week" is offered only when the lifter's own logged numbers fell in
 * consecutive sessions, and the wording says the app cannot tell why. Rule version: weekly-v1.
 */
import { DAY_MS_EXPORT, toDateString, type PaceStatus } from "./pace";

export const WEEKLY_RULE_VERSION = "weekly-v1";

export type WeeklyGoalKind = "lift" | "bodyweight" | "muscle";

export interface WeeklyInput {
  /** Monday-style first day (YYYY-MM-DD) of the week being reviewed. Only used to label the result. */
  weekStart: string;
  /** Days per week the lifter said they train, or null when unknown. */
  plannedSessions: number | null;
  /** Finished sessions inside the reviewed week. */
  sessionsDone: number;
  /** Finished sessions in each of the 2 weeks before it (oldest first). */
  priorWeeks: number[];
  /** Days between the first logged session and the end of the reviewed week. Under 14 means the history is thin. */
  historyDays: number;
  goal: null | {
    kind: WeeklyGoalKind;
    status: PaceStatus;
    /** YYYY-MM-DD or null. */
    targetDate: string | null;
    dateGone: boolean;
    /** The pace function's projected date, when it has one. */
    projectedDate: string | null;
    /** Lift goals only: kg of estimated 1RM per session (Theil-Sen), null when unknown. */
    ratePerExposure: number | null;
    /** Lift goals only: the estimated 1RM of the last three sessions, oldest first. */
    lastE1rm: number[];
  };
}

export type WeeklyChange =
  | { kind: "keep" }
  | { kind: "new_goal" }
  | { kind: "move_date"; newDate: string }
  | { kind: "extra_exposure" }
  | { kind: "variation"; weeks: 2 }
  | { kind: "easier_week" };

export interface WeeklyObserved {
  sessionsDone: number;
  plannedSessions: number | null;
  /** Share of planned sessions done, null when planned is unknown. */
  attendance: number | null;
  goalStatus: PaceStatus | null;
}

export interface WeeklyReview {
  ruleVersion: typeof WEEKLY_RULE_VERSION;
  weekStart: string;
  /** True when there is too little to judge: the change is `keep` and the reason says why. */
  thin: boolean;
  observed: WeeklyObserved;
  change: WeeklyChange;
  /** Key of the sentence that explains the change (the UI owns the wording and the translation). */
  reason: WeeklyReason;
}

export type WeeklyReason =
  | "thin_history"
  | "no_goal"
  | "goal_reached"
  | "on_track"
  | "goal_too_thin"
  | "short_week_keep"
  | "date_slipping"
  | "flat_full_attendance"
  | "behind_add_exposure"
  | "numbers_fell";

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Two falls in a row in the last three estimates, each by at least 2% of the earlier value. */
export function fellTwice(last: number[]): boolean {
  if (last.length < 3) return false;
  const [a, b, c] = last.slice(-3) as [number, number, number];
  return b <= a * 0.98 && c <= b * 0.98;
}

/** Slipping = the projected date is more than 28 days after the target date (or the date has passed). */
const SLIP_DAYS = 28;

export function reviewWeek(i: WeeklyInput): WeeklyReview {
  const planned = i.plannedSessions;
  const attendance = planned && planned > 0 ? round2(i.sessionsDone / planned) : null;
  const observed: WeeklyObserved = { sessionsDone: i.sessionsDone, plannedSessions: planned, attendance, goalStatus: i.goal?.status ?? null };
  const out = (change: WeeklyChange, reason: WeeklyReason, thin = false): WeeklyReview => ({ ruleVersion: WEEKLY_RULE_VERSION, weekStart: i.weekStart, thin, observed, change, reason });

  if (i.historyDays < 14 || (i.sessionsDone === 0 && i.priorWeeks.every((n) => n === 0))) return out({ kind: "keep" }, "thin_history", true);
  const g = i.goal;
  if (!g) return out({ kind: "keep" }, "no_goal");
  if (g.status === "reached") return out({ kind: "new_goal" }, "goal_reached");
  if (g.status === "too_thin") return out({ kind: "keep" }, "goal_too_thin", true);

  const fullWeek = planned === null ? i.sessionsDone >= 1 : i.sessionsDone >= planned;
  const shortWeek = planned !== null && i.sessionsDone < planned - 1;

  // Two weeks of full attendance and the goal lift's own numbers fell twice: offer an easier week; the app cannot tell why.
  const twoFullWeeks = planned !== null && i.sessionsDone >= planned && i.priorWeeks.length >= 1 && i.priorWeeks[i.priorWeeks.length - 1]! >= planned;
  if (g.kind === "lift" && twoFullWeeks && fellTwice(g.lastE1rm)) return out({ kind: "easier_week" }, "numbers_fell");

  if (g.status === "ahead" || g.status === "on_pace") return out({ kind: "keep" }, "on_track");

  // Behind pace from here on.
  if (g.targetDate !== null) {
    const slipped = g.dateGone || (g.projectedDate !== null && Date.parse(g.projectedDate) > Date.parse(g.targetDate) + SLIP_DAYS * DAY_MS_EXPORT);
    if (shortWeek && !g.dateGone) return out({ kind: "keep" }, "short_week_keep");
    if (slipped) {
      // A later date is only proposed when there is an honest projection to base it on.
      const base = g.projectedDate ?? null;
      if (base !== null) return out({ kind: "move_date", newDate: base }, "date_slipping");
    }
  } else if (shortWeek) return out({ kind: "keep" }, "short_week_keep");

  if (g.kind === "lift" && fullWeek && (g.ratePerExposure === null || g.ratePerExposure <= 0)) return out({ kind: "variation", weeks: 2 }, "flat_full_attendance");
  if (g.kind === "lift" || g.kind === "muscle") return out({ kind: "extra_exposure" }, "behind_add_exposure");
  return out({ kind: "keep" }, "short_week_keep");
}

/** Monday (UTC date string) of the week that contains `ms`. `weekStartsOn`: 0 = Sunday ... 6 = Saturday; default Monday. */
export function weekStartOf(ms: number, weekStartsOn = 1): string {
  const d = new Date(ms);
  const day = d.getUTCDay();
  const back = (day - weekStartsOn + 7) % 7;
  return toDateString(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back));
}
