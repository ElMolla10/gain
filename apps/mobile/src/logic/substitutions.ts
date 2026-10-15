import type { EquipmentType } from "@gain/engine";
import type { LibraryExercise } from "../db/programmeRepo";
import { metaOf } from "./exerciseSearch";

/** Suggestions are movement matches, not injury advice or inferred strength ratios. */
export function substitutionCandidates(source: LibraryExercise, library: readonly LibraryExercise[], equipment: readonly EquipmentType[], exclude: readonly string[] = []): LibraryExercise[] {
  if (source.pattern === "other") return [];
  const hidden = new Set([source.id, ...exclude]);
  const muscle = metaOf(source).muscle;
  return library.filter(ex => !hidden.has(ex.id) && ex.pattern === source.pattern && ex.measure === source.measure
    && ex.setup === source.setup && (equipment.includes(ex.equipment) || !!ex.loadSpec))
    .map((ex, index) => ({ex,index,score:(ex.equipment === source.equipment ? 2 : 0) + (muscle && metaOf(ex).muscle === muscle ? 1 : 0)}))
    .sort((a,b) => b.score - a.score || a.index - b.index).slice(0,3).map(row => row.ex);
}

