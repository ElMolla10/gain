import type { MuscleGroup } from "./exposure";
import { emptyOnboardingForm, buildProfile, type FormProblemCode } from "./onboardingForm";
import type { GoalInput } from "./onboarding";
import { weightText as formatWeight, type Unit } from "./units";

/** What the Goals screen holds while the lifter edits one goal. Text stays text until `buildGoal`. */
export interface GoalForm {
  kind: "lift" | "bodyweight" | "muscle" | null;
  exerciseId: string | null;
  loadText: string;
  repsText: string;
  dateText: string;
  weightText: string;
  muscle: MuscleGroup | null;
}

export const emptyGoalForm = (): GoalForm => ({ kind: null, exerciseId: null, loadText: "", repsText: "", dateText: "", weightText: "", muscle: null });

const GOAL_CODES: FormProblemCode[] = ["goal_missing", "goal_muscle_missing", "goal_exercise_missing", "goal_load_bad", "goal_reps_bad", "goal_weight_bad", "goal_date_bad"];

/** A goal from the typed answers, using the same rules as onboarding (ranges, real date, not in the past). Never guesses a gap. */
export function buildGoal(f: GoalForm, unit: Unit, nowMs: number): { goal: GoalInput | null; problems: FormProblemCode[] } {
  const o = {
    ...emptyOnboardingForm("en", unit),
    days: 3,
    minutes: 60,
    equipment: ["barbell" as const],
    goalKind: f.kind,
    goalExerciseId: f.exerciseId,
    goalLoadText: f.loadText,
    goalRepsText: f.repsText,
    goalDateText: f.dateText,
    goalWeightText: f.weightText,
    goalMuscle: f.muscle,
    // The bodyweight goal rule asks for a current weight; the Goals screen has the weigh-ins instead, so a valid placeholder is passed.
    bodyweightText: unit === "kg" ? "80" : "176",
  };
  const built = buildProfile(o, nowMs);
  const problems = built.problems.filter((p) => GOAL_CODES.includes(p));
  return { goal: problems.length === 0 && built.profile ? built.profile.goal : null, problems };
}

/** A typed bodyweight in the lifter's unit as kilograms, or null if it is not a plausible adult weight (30-300 kg). */
export function parseWeighIn(text: string, unit: Unit, toKg: (v: number, u: Unit) => number, parse: (s: string) => number | null): number | null {
  const n = parse(text);
  if (n === null) return null;
  const kg = toKg(n, unit);
  return kg >= 30 && kg <= 300 ? kg : null;
}

/** The kilograms behind the prefilled text, so an untouched field saves exactly what was stored (no lb rounding drift). */
export interface GoalPrefillKg {
  loadText?: string;
  loadKg?: number;
  weightText?: string;
  weightKg?: number;
}

/** The edit form started from the current goal, weights shown with the app's display rounding in the lifter's unit (19). */
export function prefillFromGoal(g: GoalInput, unit: Unit): { form: GoalForm; kept: GoalPrefillKg } {
  const f = emptyGoalForm();
  f.kind = g.kind;
  const kept: GoalPrefillKg = {};
  if (g.kind === "lift") {
    Object.assign(f, { exerciseId: g.exerciseId, loadText: formatWeight(g.targetLoad, unit), repsText: String(g.targetReps), dateText: g.targetDate ?? "" });
    Object.assign(kept, { loadText: f.loadText, loadKg: g.targetLoad });
  }
  if (g.kind === "bodyweight") {
    Object.assign(f, { weightText: formatWeight(g.targetWeightKg, unit), dateText: g.targetDate ?? "" });
    Object.assign(kept, { weightText: f.weightText, weightKg: g.targetWeightKg });
  }
  if (g.kind === "muscle") f.muscle = g.muscle;
  return { form: f, kept };
}

/** A built goal whose load / weight text is still the prefilled text keeps the original kilograms exactly. */
export function keepOriginalKg(goal: GoalInput, form: GoalForm, kept: GoalPrefillKg): GoalInput {
  if (goal.kind === "lift" && kept.loadKg !== undefined && form.loadText === kept.loadText) return { ...goal, targetLoad: kept.loadKg };
  if (goal.kind === "bodyweight" && kept.weightKg !== undefined && form.weightText === kept.weightText) return { ...goal, targetWeightKg: kept.weightKg };
  return goal;
}
