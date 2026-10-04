/**
 * Program template model. Templates are built ONLY from exercises already in the library (by seed_key) and are common
 * community / coaching ways to arrange a training week, NOT trainer-reviewed advice (see docs/TEMPLATES.md).
 */
export type TemplateId = string;

/** Who the arrangement is written for. A judgement of how much structure/volume a lifter handles, not a medical or coaching verdict. */
export type TemplateLevel = "beginner" | "intermediate" | "advanced";
export const TEMPLATE_LEVELS: readonly TemplateLevel[] = ["beginner", "intermediate", "advanced"];

/**
 * What the program needs. "gym": any gear in the library. "dumbbell": dumbbells (and kettlebells) plus bodyweight moves only.
 * "band": resistance bands plus bodyweight moves only. "bodyweight": bodyweight moves only (a bar or sturdy edge for pulling).
 */
export type TemplateGear = "gym" | "dumbbell" | "band" | "bodyweight";
export const TEMPLATE_GEARS: readonly TemplateGear[] = ["gym", "dumbbell", "band", "bodyweight"];

/** Where it can be done. Home = bodyweight, dumbbells or bands only; Gym = anywhere with the gear (a gym has all of it, so home programs also show under Gym). */
export type TemplateVenue = "home" | "gym";
export const TEMPLATE_VENUES: readonly TemplateVenue[] = ["home", "gym"];

/** What the arrangement leans toward. "bulking" = a higher-volume muscle-gain emphasis; GAIN gives no food or calorie advice. */
export type TemplateGoal = "general" | "strength" | "hypertrophy" | "bulking" | "glutes" | "arms_shoulders";
export const TEMPLATE_GOALS: readonly TemplateGoal[] = ["general", "strength", "hypertrophy", "bulking", "glutes", "arms_shoulders"];

export interface TemplateExercise {
  /** Library seed_key. */
  key: string;
  sets: number;
  repMin: number;
  /** Goal lifts are marked by the lifter's goal during onboarding, not by the template. */
  mainLift?: boolean;
  /**
   * Per-lift rep ceiling (the rep count at which the ACSM-based rule, rule-v0.4, raises the load). Omitted = the default for the kind
   * of lift (10 upper, 12 legs, 15 lateral raises). Low-rep strength templates set it to the top of their rep target (e.g. 5), so
   * "hit 5 reps on every set" is what earns more weight.
   */
  ceiling?: number;
}
export interface TemplateDay {
  en: string;
  ar: string;
  exercises: TemplateExercise[];
}
export interface Template {
  id: TemplateId;
  /** Days of training per week this template is arranged for. The schedule may be shorter (an A/B rotation trained 3 days a week alternates). */
  days: number;
  en: string;
  /** Draft Arabic name: not reviewed by a native speaker. */
  ar: string;
  arDraft: true;
  reviewed: false;
  level: TemplateLevel;
  gear: TemplateGear;
  goal: TemplateGoal;
  schedule: TemplateDay[];
}

export const x = (key: string, sets: number, repMin: number, mainLift = false, ceiling?: number): TemplateExercise => ({ key, sets, repMin, ...(mainLift ? { mainLift } : {}), ...(ceiling !== undefined ? { ceiling } : {}) });

/** Shorthand for the many templates: a day. */
export const day = (en: string, ar: string, exercises: TemplateExercise[]): TemplateDay => ({ en, ar, exercises });

/** Shorthand: a template with the fields every one of ours shares. */
export const tpl = (t: Omit<Template, "arDraft" | "reviewed">): Template => ({ ...t, arDraft: true, reviewed: false });
