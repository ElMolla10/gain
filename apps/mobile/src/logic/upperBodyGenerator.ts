import { CATALOG } from "../db/libraryDraft";
import { GROUP_OF_MUSCLE, type CatalogEntry } from "../db/library/types";
import type { GenerateInput } from "./programGenerator";
import type { LibraryLookup, Template, TemplateDay } from "./templates";
import { DAYS_OPTIONS } from "./onboarding";

// Positive metadata checks also exclude lower-back hinges, full-body lifts and
// ambiguous "other" movements (e.g. loaded carries), without matching names.
const MUSCLES = new Set(["chest", "lats", "upper_back", "front_delts", "side_delts", "rear_delts", "biceps", "triceps", "forearms"]);
const PATTERNS = new Set(["horizontal_push", "incline_push", "vertical_push", "horizontal_pull", "vertical_pull", "shoulder_isolation", "rear_delt", "elbow_flexion", "elbow_extension"]);
export const isUpperBodyExercise = (exercise: CatalogEntry): boolean => MUSCLES.has(exercise.muscle) && PATTERNS.has(exercise.pattern) && exercise.ceilingClass !== "lower";

type Slot = "chest" | "back" | "shoulders" | "rear_delts" | "biceps" | "triceps" | "forearms";
type Emphasis = { en: string; ar: string; slots: Slot[] };
const upperA: Emphasis = { en: "Upper A", ar: "جزء علوي أ", slots: ["chest", "back", "shoulders", "triceps"] };
const upperB: Emphasis = { en: "Upper B", ar: "جزء علوي ب", slots: ["back", "chest", "biceps", "shoulders"] };
const push: Emphasis = { en: "Push", ar: "دفع", slots: ["chest", "shoulders", "triceps", "chest"] };
const pull: Emphasis = { en: "Pull", ar: "سحب", slots: ["back", "biceps", "rear_delts", "back"] };
const upper: Emphasis = { en: "Upper", ar: "جزء علوي", slots: ["chest", "back", "shoulders", "biceps"] };
const arms: Emphasis = { en: "Shoulders & Arms", ar: "كتف ودراع", slots: ["shoulders", "biceps", "triceps", "forearms"] };
const chestBack: Emphasis = { en: "Chest & Back", ar: "صدر وضهر", slots: ["back", "chest", "rear_delts", "triceps"] };
const SCHEDULES: Record<number, Emphasis[]> = {
  2: [upperA, upperB],
  3: [push, pull, upper],
  4: [push, pull, chestBack, arms],
  5: [push, pull, upper, arms, chestBack],
  6: [
    { ...push, en: "Push A", ar: "دفع أ", slots: ["chest", "triceps", "shoulders", "chest"] },
    { ...pull, en: "Pull A", ar: "سحب أ" },
    arms,
    { ...push, en: "Push B", ar: "دفع ب", slots: ["shoulders", "chest", "triceps", "chest"] },
    { ...pull, en: "Pull B", ar: "سحب ب", slots: ["back", "rear_delts", "biceps", "back"] },
    upper,
  ],
};

/** Construct all requested days before instantiation; never delete a Legs day or
 * reallocate its sets. Higher frequencies divide a bounded weekly set budget. */
export function upperBodyTemplate(input: GenerateInput, lib: LibraryLookup, avoided: (entry: CatalogEntry) => boolean): Template | null {
  if (!DAYS_OPTIONS.some(n => n === input.daysPerWeek) || !Number.isFinite(input.sessionMinutes) || input.sessionMinutes < 12) return null;
  const schedule = SCHEDULES[input.daysPerWeek]!;
  const available = CATALOG.filter(c => isUpperBodyExercise(c) && input.equipment.includes(c.equipment) && lib.byKey.get(c.key)?.equipment === c.equipment && !avoided(c));
  const used = new Map<string, number>();
  const count = input.daysPerWeek >= 5 ? (input.experience === "beginner" ? 2 : 3) : (input.experience === "beginner" ? 3 : 4);
  const sets = Math.max(2, Math.min(4, Math.floor((input.experience === "beginner" ? 24 : 36) / input.daysPerWeek / count), Math.floor(input.sessionMinutes / 3 / count)));
  const matches = (c: CatalogEntry, slot: Slot) => slot === "rear_delts" ? c.muscle === slot : GROUP_OF_MUSCLE[c.muscle] === slot;
  const days: TemplateDay[] = [];
  for (const emphasis of schedule) {
    const chosen: CatalogEntry[] = [];
    for (const slot of emphasis.slots.slice(0, count)) {
      const candidates = available.filter(c => !chosen.some(e => e.key === c.key));
      const preferred = candidates.filter(c => matches(c, slot));
      const pool = preferred.length ? preferred : candidates.filter(c => emphasis.slots.some(s => matches(c, s)));
      pool.sort((a,b) => (used.get(a.key) ?? 0) - (used.get(b.key) ?? 0));
      const next = pool[0];
      if (!next) return null;
      chosen.push(next);
      used.set(next.key, (used.get(next.key) ?? 0) + 1);
    }
    days.push({ en: emphasis.en, ar: emphasis.ar, exercises: chosen.map(c => ({ key: c.key, sets, repMin: input.goal === "strength" ? 4 : input.goal === "general" ? 8 : 6, ...(input.goal === "strength" ? { ceiling: 6 } : {}) })) });
  }
  return { id: `upper_only_${input.daysPerWeek}`, en: `Upper body, ${input.daysPerWeek} days`, ar: `جزء علوي، ${input.daysPerWeek} أيام`, days: input.daysPerWeek, schedule: days, level: input.experience, gear: "gym", goal: input.goal, arDraft: true, reviewed: false };
}
