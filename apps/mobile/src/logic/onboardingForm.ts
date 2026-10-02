import type { EquipmentType } from "@gain/engine";
import type { MuscleGroup } from "./exposure";
import { normalizeDigits } from "./gymInput";
import { optionalNumber, validateProfile, type GoalInput, type Profile, type ProfileProblemCode } from "./onboarding";
import { parseNumber } from "./gymInput";

/** What the onboarding screens hold while the lifter answers. Text stays text until `buildProfile`. */
export interface OnboardingForm {
  language: "en" | "ar";
  days: number | null;
  minutes: number | null;
  equipment: EquipmentType[];
  goalKind: "lift" | "bodyweight" | "muscle" | null;
  goalExerciseId: string | null;
  goalLoadText: string;
  goalRepsText: string;
  goalDateText: string;
  goalWeightText: string;
  goalMuscle: MuscleGroup | null;
  heightText: string;
  bodyweightText: string;
}

export const emptyOnboardingForm = (language: "en" | "ar"): OnboardingForm => ({
  language,
  days: null,
  minutes: null,
  equipment: [],
  goalKind: null,
  goalExerciseId: null,
  goalLoadText: "",
  goalRepsText: "",
  goalDateText: "",
  goalWeightText: "",
  goalMuscle: null,
  heightText: "",
  bodyweightText: "",
});

export type FormProblemCode = ProfileProblemCode | "goal_missing" | "goal_muscle_missing";

export interface BuildResult {
  profile: Profile | null;
  problems: FormProblemCode[];
}

const int = (s: string): number => {
  const n = parseNumber(s);
  return n !== null && Number.isInteger(n) ? n : Number.NaN;
};

/** Turns the answers into a Profile, or says what is missing / wrong. Never fills a gap with a guess. */
export function buildProfile(f: OnboardingForm, nowMs: number): BuildResult {
  const problems: FormProblemCode[] = [];
  let goal: GoalInput | null = null;
  if (f.goalKind === null) problems.push("goal_missing");
  else if (f.goalKind === "lift")
    goal = { kind: "lift", exerciseId: f.goalExerciseId ?? "", targetLoad: parseNumber(f.goalLoadText) ?? Number.NaN, targetReps: int(f.goalRepsText), targetDate: f.goalDateText.trim() === "" ? null : normalizeDigits(f.goalDateText).trim() };
  else if (f.goalKind === "bodyweight")
    goal = { kind: "bodyweight", targetWeightKg: parseNumber(f.goalWeightText) ?? Number.NaN, targetDate: f.goalDateText.trim() === "" ? null : normalizeDigits(f.goalDateText).trim() };
  else if (f.goalMuscle === null) problems.push("goal_muscle_missing");
  else goal = { kind: "muscle", muscle: f.goalMuscle };

  const height = optionalNumber(f.heightText);
  const bw = optionalNumber(f.bodyweightText);
  const profile: Profile = {
    language: f.language,
    units: "kg",
    daysPerWeek: f.days ?? 0,
    sessionMinutes: f.minutes ?? 0,
    equipment: f.equipment,
    goal: goal ?? { kind: "muscle", muscle: "other" },
    heightCm: height,
    bodyweightKg: bw,
  };
  problems.push(...validateProfile(profile, nowMs).map((p) => p.code));
  return { profile: problems.length === 0 ? profile : null, problems };
}

export type Step = "language" | "units" | "basics" | "goal" | "programme" | "gym" | "review";
export const STEPS: Step[] = ["language", "units", "basics", "goal", "programme", "gym", "review"];

/** Problems that block leaving a step (later steps are checked when they are reached, and all again at the end). */
export function stepProblems(step: Step, f: OnboardingForm, nowMs: number): FormProblemCode[] {
  const all = buildProfile(f, nowMs).problems;
  const basics: FormProblemCode[] = ["days_bad", "minutes_bad", "no_equipment"];
  const goal: FormProblemCode[] = ["goal_missing", "goal_muscle_missing", "goal_exercise_missing", "goal_load_bad", "goal_reps_bad", "goal_weight_bad", "goal_date_bad", "bodyweight_required", "bodyweight_bad", "height_bad"];
  if (step === "basics") return all.filter((p) => basics.includes(p));
  if (step === "goal") return all.filter((p) => goal.includes(p));
  return [];
}
