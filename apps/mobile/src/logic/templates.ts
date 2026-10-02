import type { EquipmentType } from "@gain/engine";
import { newExercise, type DraftDay, type ProgrammeDraft } from "./programmeDraft";

/**
 * Programme templates built ONLY from the exercises already in the library.
 *
 * REVIEW STATUS: every template here is `reviewed: false`. PRODUCT.md says a trainer reviews templates before any coaching
 * claim is made; no trainer has reviewed these yet, so the app labels them "draft, not yet reviewed by a trainer". They are
 * ordinary, common ways to arrange a week, not a recommendation for any person. Arabic names are draft translations.
 */
export type TemplateId = "full_body_2" | "full_body_3" | "upper_lower_2" | "upper_lower_4" | "ppl_3" | "ppl_6" | "mix_4";

export interface TemplateExercise {
  /** Library seed_key. */
  key: string;
  sets: number;
  repMin: number;
  /** Goal lifts are marked by the lifter's goal during onboarding, not by the template. */
  mainLift?: boolean;
}
export interface TemplateDay {
  en: string;
  ar: string;
  exercises: TemplateExercise[];
}
export interface Template {
  id: TemplateId;
  /** Days of training per week this template is arranged for. */
  days: number;
  en: string;
  ar: string;
  reviewed: false;
  schedule: TemplateDay[];
}

const x = (key: string, sets: number, repMin: number, mainLift = false): TemplateExercise => ({ key, sets, repMin, ...(mainLift ? { mainLift } : {}) });

const FULL_A: TemplateDay = { en: "Full body A", ar: "جسم كامل أ", exercises: [x("back_squat", 3, 8, true), x("bench_press", 3, 6, true), x("seated_cable_row", 3, 8), x("shoulder_press_db", 2, 8), x("db_curl", 2, 8)] };
const FULL_B: TemplateDay = { en: "Full body B", ar: "جسم كامل ب", exercises: [x("romanian_deadlift", 3, 8), x("incline_db_press", 3, 8), x("lat_pulldown", 3, 8, true), x("lateral_raise_db", 2, 10), x("triceps_pushdown", 2, 8)] };
const FULL_C: TemplateDay = { en: "Full body C", ar: "جسم كامل ج", exercises: [x("leg_press", 3, 8), x("chest_press_machine", 3, 8), x("db_row", 3, 8), x("face_pull", 2, 8), x("hammer_curl", 2, 8), x("calf_raise", 2, 8)] };

const UPPER_A: TemplateDay = { en: "Upper A", ar: "علوي أ", exercises: [x("bench_press", 3, 6, true), x("lat_pulldown", 3, 8), x("incline_db_press", 3, 8), x("seated_cable_row", 3, 8), x("lateral_raise_db", 3, 10), x("triceps_pushdown", 3, 8)] };
const LOWER_A: TemplateDay = { en: "Lower A", ar: "سفلي أ", exercises: [x("back_squat", 3, 8, true), x("romanian_deadlift", 3, 8), x("leg_press", 3, 8), x("leg_curl", 3, 8), x("calf_raise", 3, 8)] };
const UPPER_B: TemplateDay = { en: "Upper B", ar: "علوي ب", exercises: [x("shoulder_press_db", 3, 8), x("db_row", 3, 8), x("chest_press_machine", 3, 8), x("face_pull", 3, 8), x("db_curl", 2, 8), x("hammer_curl", 2, 8)] };
const LOWER_B: TemplateDay = { en: "Lower B", ar: "سفلي ب", exercises: [x("leg_press", 3, 8), x("romanian_deadlift", 3, 8), x("leg_extension", 3, 8), x("leg_curl", 3, 8), x("calf_raise", 3, 8)] };

const PUSH: TemplateDay = { en: "Push", ar: "دفع", exercises: [x("bench_press", 3, 6, true), x("shoulder_press_db", 3, 8), x("incline_db_press", 3, 8), x("lateral_raise_db", 3, 10), x("triceps_pushdown", 3, 8)] };
const PULL: TemplateDay = { en: "Pull", ar: "سحب", exercises: [x("lat_pulldown", 3, 8, true), x("seated_cable_row", 3, 8), x("db_row", 3, 8), x("face_pull", 3, 8), x("db_curl", 3, 8), x("hammer_curl", 2, 8)] };
const LEGS: TemplateDay = { en: "Legs", ar: "أرجل", exercises: [x("back_squat", 3, 8, true), x("romanian_deadlift", 3, 8), x("leg_press", 3, 8), x("leg_curl", 3, 8), x("leg_extension", 3, 8), x("calf_raise", 3, 8)] };
const PUSH_B: TemplateDay = { en: "Push B", ar: "دفع ب", exercises: [x("chest_press_machine", 3, 8), x("incline_db_press", 3, 8), x("shoulder_press_db", 3, 8), x("lateral_raise_db", 3, 10), x("triceps_pushdown", 3, 8)] };
const PULL_B: TemplateDay = { en: "Pull B", ar: "سحب ب", exercises: [x("assisted_pullup", 3, 6), x("db_row", 3, 8), x("seated_cable_row", 3, 8), x("face_pull", 3, 8), x("hammer_curl", 3, 8)] };
const LEGS_B: TemplateDay = { en: "Legs B", ar: "أرجل ب", exercises: [x("leg_press", 3, 8), x("romanian_deadlift", 3, 8), x("leg_extension", 3, 8), x("leg_curl", 3, 8), x("calf_raise", 3, 8)] };

const MIX_1: TemplateDay = { en: "Chest and triceps", ar: "صدر وتراي", exercises: [x("bench_press", 3, 6, true), x("incline_db_press", 3, 8), x("chest_press_machine", 3, 8), x("triceps_pushdown", 3, 8)] };
const MIX_2: TemplateDay = { en: "Back and biceps", ar: "ضهر وباي", exercises: [x("lat_pulldown", 3, 8, true), x("seated_cable_row", 3, 8), x("db_row", 3, 8), x("db_curl", 3, 8), x("hammer_curl", 2, 8)] };
const MIX_3: TemplateDay = { en: "Legs", ar: "أرجل", exercises: [x("back_squat", 3, 8, true), x("leg_press", 3, 8), x("romanian_deadlift", 3, 8), x("leg_curl", 3, 8), x("calf_raise", 3, 8)] };
const MIX_4: TemplateDay = { en: "Shoulders and arms", ar: "كتف ودراعات", exercises: [x("shoulder_press_db", 3, 8), x("lateral_raise_db", 3, 10), x("face_pull", 3, 8), x("db_curl", 3, 8), x("triceps_pushdown", 3, 8)] };

export const TEMPLATES: Template[] = [
  { id: "full_body_2", days: 2, en: "Full body, 2 days", ar: "جسم كامل، يومين", reviewed: false, schedule: [FULL_A, FULL_B] },
  { id: "full_body_3", days: 3, en: "Full body, 3 days", ar: "جسم كامل، 3 أيام", reviewed: false, schedule: [FULL_A, FULL_B, FULL_C] },
  { id: "upper_lower_2", days: 2, en: "Upper / lower, 2 days", ar: "علوي / سفلي، يومين", reviewed: false, schedule: [UPPER_A, LOWER_A] },
  { id: "upper_lower_4", days: 4, en: "Upper / lower, 4 days", ar: "علوي / سفلي، 4 أيام", reviewed: false, schedule: [UPPER_A, LOWER_A, UPPER_B, LOWER_B] },
  { id: "ppl_3", days: 3, en: "Push / pull / legs, 3 days", ar: "دفع / سحب / أرجل، 3 أيام", reviewed: false, schedule: [PUSH, PULL, LEGS] },
  { id: "ppl_6", days: 6, en: "Push / pull / legs, 6 days", ar: "دفع / سحب / أرجل، 6 أيام", reviewed: false, schedule: [PUSH, PULL, LEGS, PUSH_B, PULL_B, LEGS_B] },
  { id: "mix_4", days: 4, en: "Four-day mix (body-part split)", ar: "مزيج 4 أيام (تقسيم عضلات)", reviewed: false, schedule: [MIX_1, MIX_2, MIX_3, MIX_4] },
];

export interface TemplateOffer {
  template: Template;
  /** "exact": arranged for the days the lifter trains. "fewer": needs fewer days than they have (never more). */
  fit: "exact" | "fewer";
}

/**
 * Templates for the days a lifter actually attends. Exact matches first; if none, the ones with fewer days (never more
 * days than they train, because a missed day is not a completed day). Fewer than 2 days: none, the lifter builds their own.
 */
export function templatesForDays(daysPerWeek: number): TemplateOffer[] {
  const exact = TEMPLATES.filter((t) => t.days === daysPerWeek).map((template) => ({ template, fit: "exact" as const }));
  if (exact.length > 0) return exact;
  const biggest = Math.max(0, ...TEMPLATES.filter((t) => t.days < daysPerWeek).map((t) => t.days));
  return TEMPLATES.filter((t) => t.days === biggest && biggest > 0).map((template) => ({ template, fit: "fewer" as const }));
}

export interface LibraryLookup {
  /** seed_key -> exercise id and equipment. */
  byKey: Map<string, { exerciseId: string; equipment: EquipmentType }>;
}

export interface InstantiateOptions {
  lang: "en" | "ar";
  /** Equipment the lifter said they use. Exercises needing anything else are left out. Omitted = everything. */
  equipment?: EquipmentType[];
  /** Estimated minutes per session (3 min per set). Accessories (last exercises of a day) are dropped first; main lifts never. */
  sessionMinutes?: number | null;
  /** seed_key of the lift to mark as the goal lift (if it is in the template). */
  goalLiftKey?: string | null;
  /** Default rep ceiling for a lift (the top of its rep range), from the progression policy. */
  ceilingFor: (key: string) => number;
}

export interface Instantiated {
  draft: ProgrammeDraft;
  /** What was left out and why, so the lifter sees it. Nothing is cut silently. */
  dropped: { day: string; key: string; reason: "equipment" | "time" }[];
}

export function estimateSessionMinutes(sets: number): number {
  return sets * 3;
}

/** A template turned into an editable draft for this lifter. */
export function instantiateTemplate(t: Template, lib: LibraryLookup, opts: InstantiateOptions): Instantiated {
  const dropped: Instantiated["dropped"] = [];
  const days: DraftDay[] = [];
  for (const day of t.schedule) {
    const dayName = opts.lang === "ar" ? day.ar : day.en;
    let list = day.exercises.filter((e) => {
      const meta = lib.byKey.get(e.key);
      if (!meta) return false; // not in the library: never invented
      if (opts.equipment && !opts.equipment.includes(meta.equipment)) {
        dropped.push({ day: dayName, key: e.key, reason: "equipment" });
        return false;
      }
      return true;
    });
    if (opts.sessionMinutes && opts.sessionMinutes > 0) {
      const total = () => estimateSessionMinutes(list.reduce((n, e) => n + e.sets, 0));
      while (total() > opts.sessionMinutes) {
        // Drop the last accessory; stop when only main lifts remain.
        let idx = -1;
        for (let i = list.length - 1; i >= 0; i--) if (!list[i]!.mainLift && opts.goalLiftKey !== list[i]!.key) { idx = i; break; }
        if (idx < 0) break;
        dropped.push({ day: dayName, key: list[idx]!.key, reason: "time" });
        list = list.filter((_, i) => i !== idx);
      }
    }
    if (list.length === 0) continue; // a day with nothing the lifter can do here is left out
    days.push({
      name: dayName,
      exercises: list.map((e) => {
        const meta = lib.byKey.get(e.key)!;
        return newExercise(meta.exerciseId, { sets: e.sets, repMin: Math.min(e.repMin, opts.ceilingFor(e.key)), repMax: opts.ceilingFor(e.key), isGoalLift: opts.goalLiftKey === e.key });
      }),
    });
  }
  return { draft: { name: opts.lang === "ar" ? t.ar : t.en, days }, dropped };
}
