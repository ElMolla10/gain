import type { EquipmentType } from "@gain/engine";
import { parseNumber } from "./gymInput";
import type { Unit } from "./units";
import type { MuscleGroup } from "./exposure";
import type { ProgrammeDraft } from "./programmeDraft";

/** Everything onboarding asks, in the order it asks. Only what is needed to write a first session; the rest is optional. */
export type Units = Unit;

export type GoalInput =
  | { kind: "lift"; exerciseId: string; targetLoad: number; targetReps: number; targetDate: string | null }
  | { kind: "bodyweight"; targetWeightKg: number; targetDate: string | null }
  | { kind: "muscle"; muscle: MuscleGroup };

export interface Profile {
  language: "en" | "ar";
  units: Units;
  daysPerWeek: number;
  sessionMinutes: number;
  equipment: EquipmentType[];
  /** Optional: null = no goal for now (set one later in Goals). */
  goal: GoalInput | null;
  /** Optional unless the goal is a bodyweight goal. */
  heightCm: number | null;
  bodyweightKg: number | null;
  /** Optional birthday, YYYY-MM-DD, picked from the date selectors. */
  birthDate?: string | null;
}

export const DAYS_OPTIONS = [2, 3, 4, 5, 6] as const;
export const MINUTES_OPTIONS = [30, 45, 60, 75, 90, 120] as const;

export type ProfileProblemCode =
  | "days_bad"
  | "minutes_bad"
  | "goal_exercise_missing"
  | "goal_load_bad"
  | "goal_reps_bad"
  | "goal_weight_bad"
  | "goal_date_bad"
  | "bodyweight_required"
  | "bodyweight_bad"
  | "height_bad"
  | "birth_bad";
export interface ProfileProblem {
  code: ProfileProblemCode;
}

/** A calendar date typed as YYYY-MM-DD (Arabic digits are accepted upstream by normalizeDigits). */
export function parseDate(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? { y, m: mo, d } : null;
}

/** True when the date is a real calendar date that is not before `nowMs`'s day. */
export function isTodayOrLater(s: string, nowMs: number): boolean {
  const p = parseDate(s);
  if (!p) return false;
  return Date.UTC(p.y, p.m - 1, p.d) >= Math.floor(nowMs / 86_400_000) * 86_400_000;
}

export function validateProfile(p: Profile, nowMs: number): ProfileProblem[] {
  const out: ProfileProblem[] = [];
  if (!Number.isInteger(p.daysPerWeek) || p.daysPerWeek < 1 || p.daysPerWeek > 7) out.push({ code: "days_bad" });
  if (!Number.isInteger(p.sessionMinutes) || p.sessionMinutes < 15 || p.sessionMinutes > 240) out.push({ code: "minutes_bad" });
  const g = p.goal;
  if (g === null) {
    /* no goal: nothing to check */
  } else if (g.kind === "lift") {
    if (!g.exerciseId) out.push({ code: "goal_exercise_missing" });
    if (!(g.targetLoad > 0) || g.targetLoad > 1000) out.push({ code: "goal_load_bad" });
    if (!Number.isInteger(g.targetReps) || g.targetReps < 1 || g.targetReps > 30) out.push({ code: "goal_reps_bad" });
    if (g.targetDate !== null && !isTodayOrLater(g.targetDate, nowMs)) out.push({ code: "goal_date_bad" });
  } else if (g.kind === "bodyweight") {
    if (!(g.targetWeightKg >= 30 && g.targetWeightKg <= 300)) out.push({ code: "goal_weight_bad" });
    if (g.targetDate !== null && !isTodayOrLater(g.targetDate, nowMs)) out.push({ code: "goal_date_bad" });
    if (p.bodyweightKg === null) out.push({ code: "bodyweight_required" });
  }
  if (p.bodyweightKg !== null && !(p.bodyweightKg >= 30 && p.bodyweightKg <= 300)) out.push({ code: "bodyweight_bad" });
  if (p.heightCm !== null && !(p.heightCm >= 100 && p.heightCm <= 250)) out.push({ code: "height_bad" });
  if (p.birthDate) {
    const b = parseDate(p.birthDate);
    if (!b || Date.UTC(b.y, b.m - 1, b.d) > nowMs || b.y < new Date(nowMs).getUTCFullYear() - 110) out.push({ code: "birth_bad" });
  }
  return out;
}

/** Optional number field: "" -> null (skipped); junk -> NaN so validation can say so. */
export function optionalNumber(text: string): number | null {
  if (text.trim() === "") return null;
  return parseNumber(text) ?? Number.NaN;
}

/** Marks `exerciseId` as the goal lift wherever it appears, and clears the flag on every other lift. */
export function markGoalLift(draft: ProgrammeDraft, exerciseId: string | null): ProgrammeDraft {
  return { ...draft, days: draft.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e, isGoalLift: exerciseId !== null && e.exerciseId === exerciseId })) })) };
}

export const draftHasExercise = (draft: ProgrammeDraft, exerciseId: string): boolean => draft.days.some((d) => d.exercises.some((e) => e.exerciseId === exerciseId));

/** What onboarding shows after a template is chosen: only the day titles, in order (the full split is edited later in the Programme tab). */
export const dayTitles = (draft: ProgrammeDraft): string[] => draft.days.map((d) => d.name);
