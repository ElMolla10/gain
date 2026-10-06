/**
 * Turn one finished workout into a program-day preview. Pure: nothing is written, and no next-session weight or
 * top-set scheme is chosen here. The lifter reviews the result and saves it through programmeRepo.saveWorkoutAsDay.
 */
import type { Measure, OutlierStatus } from "@gain/engine";
import type { DraftExercise } from "./programmeDraft";
import { orderSlots, supersetLabels, type StateMap } from "./superset";

export interface WorkoutSetSource {
  /** Exercise the set was logged against (the lift that was performed). */
  exerciseId: string;
  deleted: boolean;
  warmup: boolean;
  tags: readonly string[];
  outlier: OutlierStatus;
  reps: number;
  durationS: number | null;
  distanceM: number | null;
}

export interface WorkoutSlotSource {
  slot: string;
  removed: boolean;
  added: boolean;
  position: number | null;
  superset: string | null;
  /** Lift swapped in for this slot today. Null = the slot's own exercise. */
  replacedBy: string | null;
}

export interface PrescriptionRow {
  exerciseId: string;
  /** Working sets only. May be above the program cap of 12; the preview shows that count and save refuses it. */
  sets: number;
  repMin: number;
  repMax: number;
  /** More than one slot performed this lift. Their working sets are one row, counted once. */
  combined: boolean;
  /**
   * Review-only superset letter. The program day has no superset column, so this is not saved.
   * Null when the group does not still contain two different exercises.
   */
  superset: string | null;
}

const performedId = (slot: WorkoutSlotSource | undefined, slotId: string): string => slot?.replacedBy ?? slotId;

/** A set that counts toward the prescribed sets and the rep range. Warm-ups, drop sets, and sets still waiting do not. */
function isWorkingSet(set: WorkoutSetSource, measure: Measure): boolean {
  if (set.deleted || set.warmup || set.tags.includes("drop")) return false;
  if (set.outlier !== "none" && set.outlier !== "confirmed") return false;
  if (measure === "time") return typeof set.durationS === "number" && set.durationS >= 1;
  if (measure === "distance") return typeof set.distanceM === "number" && set.distanceM > 0;
  return Number.isInteger(set.reps) && set.reps >= 1;
}

/** Whole units stored in rep_min / rep_max: reps, seconds, or metres rounded to the nearest metre (at least 1). */
function quantity(set: WorkoutSetSource, measure: Measure): number {
  if (measure === "time") return Math.max(1, Math.round(set.durationS!));
  if (measure === "distance") return Math.max(1, Math.round(set.distanceM!));
  return set.reps;
}

/**
 * One program line per performed exercise, in workout display order (supersets stay together, removed exercises drop out).
 * Sets are one pool per exercise id: a later slot that performed the same lift is merged into the first row and not counted twice.
 * An exercise with no working sets is left out. An empty list cannot be saved.
 */
export function prescriptionFromSession(input: {
  programmeSlots: readonly string[];
  slots: readonly WorkoutSlotSource[];
  sets: readonly WorkoutSetSource[];
  measureOf: (exerciseId: string) => Measure;
}): PrescriptionRow[] {
  const states: StateMap = {};
  for (const s of input.slots) {
    states[s.slot] = { slot: s.slot, removed: s.removed, added: s.added, position: s.position, superset: s.superset };
  }
  const order = orderSlots(input.programmeSlots, states);
  const slotById = new Map(input.slots.map((s) => [s.slot, s]));
  const labels = supersetLabels(order, states);
  const byExercise = new Map<string, WorkoutSetSource[]>();
  for (const set of input.sets) {
    const list = byExercise.get(set.exerciseId) ?? [];
    list.push(set);
    byExercise.set(set.exerciseId, list);
  }

  const built: { exerciseId: string; sets: number; repMin: number; repMax: number; combined: boolean; group: string | null }[] = [];
  const indexOf = new Map<string, number>();
  for (const slotId of order) {
    const slot = slotById.get(slotId);
    const exerciseId = performedId(slot, slotId);
    const seen = indexOf.get(exerciseId);
    if (seen !== undefined) {
      built[seen]!.combined = true;
      continue;
    }
    const measure = input.measureOf(exerciseId);
    const working = (byExercise.get(exerciseId) ?? []).filter((set) => isWorkingSet(set, measure));
    if (working.length === 0) continue;
    const amounts = working.map((set) => quantity(set, measure));
    let repMin = Math.min(...amounts);
    let repMax = Math.max(...amounts);
    if (repMax < repMin) repMax = repMin;
    indexOf.set(exerciseId, built.length);
    built.push({
      exerciseId,
      sets: working.length,
      repMin,
      repMax,
      combined: false,
      group: labels[slotId] ? slot?.superset ?? null : null,
    });
  }

  const groupSize = new Map<string, number>();
  for (const row of built) if (row.group) groupSize.set(row.group, (groupSize.get(row.group) ?? 0) + 1);
  const letter = new Map<string, string>();
  return built.map((row) => {
    let superset: string | null = null;
    if (row.group && (groupSize.get(row.group) ?? 0) >= 2) {
      if (!letter.has(row.group)) letter.set(row.group, String.fromCharCode(65 + (letter.size % 26)));
      superset = letter.get(row.group)!;
    }
    return { exerciseId: row.exerciseId, sets: row.sets, repMin: row.repMin, repMax: row.repMax, combined: row.combined, superset };
  });
}

/** The preview row as a straight-set program exercise. No target load, ceiling, goal, effort, or top-set count is copied. */
export function draftExerciseFromPreview(row: Pick<PrescriptionRow, "exerciseId" | "sets" | "repMin" | "repMax">): DraftExercise {
  return {
    exerciseId: row.exerciseId,
    sets: row.sets,
    repMin: row.repMin,
    repMax: row.repMax,
    repCeiling: null,
    isGoalLift: false,
    trackEffort: false,
    topSets: null,
  };
}
