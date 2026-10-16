import type { Measure } from "@gain/engine";
import type { LibraryExercise } from "../db/programmeRepo";
import type { DayEx, Disp } from "./workoutTypes";
import { DEFAULT_TIMED_RANGE } from "../db/library/measures";

/** Preserve the workout's set count, but never reinterpret reps as seconds/metres. */
export function replacementRange(source: { measure: Measure; repMin: number; repMax: number }, measure: Measure) {
  if (source.measure === measure) return { repMin:source.repMin, repMax:source.repMax };
  return measure === "reps" ? { repMin:6, repMax:10 }
    : { repMin:DEFAULT_TIMED_RANGE[measure].min, repMax:DEFAULT_TIMED_RANGE[measure].max };
}

/** A replacement owns its pattern, load grid and history; none transfers from the outgoing lift. */
export function replacementDisplay(slot: DayEx, exercise: LibraryExercise): Disp {
  const range = replacementRange({...slot,repMin:slot.programmeRepMin ?? slot.repMin,repMax:slot.programmeRepMax ?? slot.repMax}, exercise.measure);
  return { ...slot, ...range, programmeRepMin:range.repMin, programmeRepMax:range.repMax,
    exerciseId:exercise.id,nameEn:exercise.nameEn,nameAr:exercise.nameAr,aliasesAr:exercise.aliasesAr,
    pattern:exercise.pattern,seedKey:exercise.seedKey,equipment:exercise.equipment,setup:exercise.setup,measure:exercise.measure,
    loadSpec:exercise.loadSpec ?? null,isGoalLift:false,repCeiling:range.repMax,repCeilingIsCustom:false,
    trackEffort:exercise.measure === "reps" && slot.trackEffort,
    topSets:exercise.measure === "reps" && slot.measure === "reps" ? slot.topSets : null,slot:slot.exerciseId };
}
