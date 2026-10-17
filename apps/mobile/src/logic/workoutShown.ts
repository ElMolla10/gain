import type { ExerciseState } from "../db/workoutRepo";
import { orderSlots } from "./superset";
import type { DayEx, Disp } from "./workoutTypes";

/** The exercises the logger shows, in order (programme slots not added mid-workout, superset-ordered, replacements applied). */
export function shownExercises(slots: readonly DayEx[], exState: Record<string, ExerciseState>, makeDisp: (slotEx: DayEx, st?: ExerciseState) => Disp): { order: string[]; shown: Disp[] } {
  const programmeIds = slots.filter((s) => !exState[s.exerciseId]?.added).map((s) => s.exerciseId);
  const order = orderSlots(programmeIds, exState);
  const shown = order.flatMap((slot) => {
    const s = slots.find((x) => x.exerciseId === slot);
    return s ? [makeDisp(s, exState[slot])] : [];
  });
  return { order, shown };
}
