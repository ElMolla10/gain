import type { FormProblemCode } from "./onboardingForm";

/**
 * Onboarding at large text (Plate O-2 / O-4). Above 1.3× system text the three-button sticky footer would cover the step's own
 * options, so it scrolls with the content instead. Validation problems render under the group they belong to; a failed Next scrolls
 * to the first of them in screen order.
 */
export type FooterMode = "sticky" | "inline";
export const footerMode = (fontScale: number): FooterMode => (fontScale > 1.3 ? "inline" : "sticky");

export type ProblemGroup = "days" | "minutes" | "goalKind" | "exercise" | "load" | "reps" | "goalWeight" | "goalDate" | "muscle" | "height" | "birth" | "bodyweight";

export const PROBLEM_GROUP: Record<FormProblemCode, ProblemGroup> = {
  days_bad: "days",
  minutes_bad: "minutes",
  goal_missing: "goalKind",
  goal_exercise_missing: "exercise",
  goal_load_bad: "load",
  goal_reps_bad: "reps",
  goal_weight_bad: "goalWeight",
  goal_date_bad: "goalDate",
  goal_muscle_missing: "muscle",
  height_bad: "height",
  birth_bad: "birth",
  bodyweight_required: "bodyweight",
  bodyweight_bad: "bodyweight",
};

/** Top-to-bottom order of the groups on the basics and goal steps. */
const ORDER: ProblemGroup[] = ["days", "minutes", "goalKind", "exercise", "load", "reps", "goalWeight", "goalDate", "muscle", "height", "birth", "bodyweight"];

export const problemsFor = (group: ProblemGroup, problems: readonly string[]): FormProblemCode[] =>
  problems.filter((c): c is FormProblemCode => c in PROBLEM_GROUP && PROBLEM_GROUP[c as FormProblemCode] === group);

export const firstInvalidGroup = (problems: readonly string[]): ProblemGroup | null => ORDER.find((g) => problemsFor(g, problems).length > 0) ?? null;
