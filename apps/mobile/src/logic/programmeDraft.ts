/**
 * An editable copy of a program version. Pure data + pure functions, so every edit is testable without a database.
 * Saving a draft never changes the version it came from: it writes a NEW version (see programmeRepo).
 */
import type { Measure } from "@gain/engine";
import { DEFAULT_TIMED_RANGE } from "../db/library/measures";

export interface DraftExercise {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  /** Per-lift rep ceiling; null = follow the default for the kind of lift. */
  repCeiling: number | null;
  isGoalLift: boolean;
  trackEffort: boolean;
  /** null = straight sets. n >= 1 = top set + back-offs: only the n heaviest sets are judged, the lighter sets after them never block progression. */
  topSets?: number | null;
}
export interface DraftDay {
  name: string;
  exercises: DraftExercise[];
}
export interface ProgrammeDraft {
  name: string;
  days: DraftDay[];
}

export const MAX_DAYS = 7;
export const MAX_SETS = 12;

export const newExercise = (exerciseId: string, over: Partial<DraftExercise> = {}): DraftExercise => ({
  exerciseId,
  sets: 3,
  repMin: 6,
  repMax: 10,
  repCeiling: null,
  isGoalLift: false,
  trackEffort: false,
  topSets: null,
  ...over,
});

/** A top-set count that makes sense for the number of sets: needs at least one back-off set, so 1..sets-1; anything else means straight sets (null). */
export const normTopSets = (sets: number, topSets: number | null | undefined): number | null =>
  typeof topSets === "number" && Number.isInteger(topSets) && topSets >= 1 && Number.isInteger(sets) && sets >= 2 ? Math.min(topSets, sets - 1) : null;

/** A new slot for an exercise counted in seconds or metres starts at the usual hold / carry range (the lifter edits it); reps exercises keep the plain defaults. */
export const newExerciseFor = (exerciseId: string, measure: Measure, over: Partial<DraftExercise> = {}): DraftExercise =>
  measure === "reps" ? newExercise(exerciseId, over) : newExercise(exerciseId, { sets: DEFAULT_TIMED_RANGE[measure].sets, repMin: DEFAULT_TIMED_RANGE[measure].min, repMax: DEFAULT_TIMED_RANGE[measure].max, ...over });

/** Switching an exercise to another way of counting resets its range in every slot of the draft (old reps would be nonsense as seconds). */
export const resetRangeFor = (d: ProgrammeDraft, exerciseId: string, measure: Measure): ProgrammeDraft => ({
  ...d,
  days: d.days.map((day) => ({
    ...day,
    exercises: day.exercises.map((e) =>
      e.exerciseId !== exerciseId ? e : measure === "reps" ? { ...e, repMin: 6, repMax: 10, repCeiling: null } : { ...e, repMin: DEFAULT_TIMED_RANGE[measure].min, repMax: DEFAULT_TIMED_RANGE[measure].max, repCeiling: null, isGoalLift: false, trackEffort: false, topSets: null },
    ),
  })),
});

const move = <T,>(xs: T[], from: number, to: number): T[] => {
  if (from < 0 || from >= xs.length || to < 0 || to >= xs.length || from === to) return xs;
  const out = [...xs];
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x!);
  return out;
};

const mapDay = (d: ProgrammeDraft, i: number, f: (day: DraftDay) => DraftDay): ProgrammeDraft => ({ ...d, days: d.days.map((day, j) => (j === i ? f(day) : day)) });

export const renameProgramme = (d: ProgrammeDraft, name: string): ProgrammeDraft => ({ ...d, name });
export const addDay = (d: ProgrammeDraft, name: string): ProgrammeDraft => (d.days.length >= MAX_DAYS ? d : { ...d, days: [...d.days, { name, exercises: [] }] });
export const removeDay = (d: ProgrammeDraft, i: number): ProgrammeDraft => ({ ...d, days: d.days.filter((_, j) => j !== i) });
export const renameDay = (d: ProgrammeDraft, i: number, name: string): ProgrammeDraft => mapDay(d, i, (day) => ({ ...day, name }));
export const moveDay = (d: ProgrammeDraft, from: number, to: number): ProgrammeDraft => ({ ...d, days: move(d.days, from, to) });
/** Adding an exercise already in that day is a no-op (the same lift twice in a day would double its line). */
export const addExercise = (d: ProgrammeDraft, dayIndex: number, ex: DraftExercise): ProgrammeDraft =>
  mapDay(d, dayIndex, (day) => (day.exercises.some((e) => e.exerciseId === ex.exerciseId) ? day : { ...day, exercises: [...day.exercises, ex] }));
export const removeExercise = (d: ProgrammeDraft, dayIndex: number, exIndex: number): ProgrammeDraft =>
  mapDay(d, dayIndex, (day) => ({ ...day, exercises: day.exercises.filter((_, j) => j !== exIndex) }));
export const moveExercise = (d: ProgrammeDraft, dayIndex: number, from: number, to: number): ProgrammeDraft => mapDay(d, dayIndex, (day) => ({ ...day, exercises: move(day.exercises, from, to) }));
export const updateExercise = (d: ProgrammeDraft, dayIndex: number, exIndex: number, patch: Partial<DraftExercise>): ProgrammeDraft =>
  mapDay(d, dayIndex, (day) => ({
    ...day,
    exercises: day.exercises.map((e, j) => {
      if (j !== exIndex) return e;
      const n = { ...e, ...patch };
      return { ...n, topSets: normTopSets(n.sets, n.topSets) }; // fewer sets than top sets + 1 turns it back into straight sets
    }),
  }));

export type DraftProblemCode = "name_empty" | "no_days" | "day_name_empty" | "day_empty" | "sets_bad" | "reps_bad" | "ceiling_bad" | "topsets_bad" | "duplicate_exercise";
export interface DraftProblem {
  code: DraftProblemCode;
  day?: number;
  exercise?: number;
}

export function validateDraft(d: ProgrammeDraft): DraftProblem[] {
  const out: DraftProblem[] = [];
  if (d.name.trim() === "") out.push({ code: "name_empty" });
  if (d.days.length === 0) out.push({ code: "no_days" });
  d.days.forEach((day, di) => {
    if (day.name.trim() === "") out.push({ code: "day_name_empty", day: di });
    if (day.exercises.length === 0) out.push({ code: "day_empty", day: di });
    const seen = new Set<string>();
    day.exercises.forEach((e, ei) => {
      if (seen.has(e.exerciseId)) out.push({ code: "duplicate_exercise", day: di, exercise: ei });
      seen.add(e.exerciseId);
      if (!Number.isInteger(e.sets) || e.sets < 1 || e.sets > MAX_SETS) out.push({ code: "sets_bad", day: di, exercise: ei });
      if (!Number.isInteger(e.repMin) || !Number.isInteger(e.repMax) || e.repMin < 1 || e.repMax < e.repMin) out.push({ code: "reps_bad", day: di, exercise: ei });
      if (e.repCeiling !== null && (!Number.isInteger(e.repCeiling) || e.repCeiling < 1 || e.repCeiling > 100)) out.push({ code: "ceiling_bad", day: di, exercise: ei });
      if (e.topSets !== null && e.topSets !== undefined && normTopSets(e.sets, e.topSets) !== e.topSets) out.push({ code: "topsets_bad", day: di, exercise: ei });
    });
  });
  return out;
}

/** Stable text of the parts of a draft that matter, to tell whether an edit changed anything. */
export const draftFingerprint = (d: ProgrammeDraft): string =>
  JSON.stringify([d.name.trim(), d.days.map((day) => [day.name.trim(), day.exercises.map((e) => [e.exerciseId, e.sets, e.repMin, e.repMax, e.repCeiling, e.isGoalLift, e.trackEffort, e.topSets ?? null])])]);
