import type { EquipmentType } from "@gain/engine";
import { newExercise, type DraftDay, type ProgrammeDraft } from "./programmeDraft";
import { CORE_TEMPLATES } from "./templateData/core";
import { GYM_BASIC_TEMPLATES } from "./templateData/gymBasic";
import { GYM_SPLIT_TEMPLATES } from "./templateData/gymSplits";
import type { Template } from "./templateTypes";

export * from "./templateTypes";

/**
 * Programme templates built ONLY from the exercises already in the library.
 *
 * REVIEW STATUS: every template here is `reviewed: false`. PRODUCT.md says a trainer reviews templates before any coaching
 * claim is made; no trainer has reviewed these yet, so the app labels them "draft, not yet reviewed by a trainer". They are
 * ordinary, common community / coaching ways to arrange a week, not a recommendation for any person. Arabic names are draft
 * translations (`arDraft`). Sources and rationale: docs/TEMPLATES.md.
 */
export const TEMPLATES: Template[] = [...CORE_TEMPLATES, ...GYM_BASIC_TEMPLATES, ...GYM_SPLIT_TEMPLATES];

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
        // A template's own ceiling (strength templates: the top of the rep target) is stored per lift; otherwise the lift follows the default for its kind.
        const ceiling = e.ceiling ?? opts.ceilingFor(e.key);
        return newExercise(meta.exerciseId, { sets: e.sets, repMin: Math.min(e.repMin, ceiling), repMax: ceiling, repCeiling: e.ceiling ?? null, isGoalLift: opts.goalLiftKey === e.key });
      }),
    });
  }
  return { draft: { name: opts.lang === "ar" ? t.ar : t.en, days }, dropped };
}
