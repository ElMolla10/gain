import type { EquipmentType } from "@gain/engine";
import type { LibraryExercise } from "../db/programmeRepo";
import { metaOf } from "./exerciseSearch";
import { isIsolationPattern } from "./warmups";

export interface SubstitutionQuery {
  current: Pick<LibraryExercise, "id" | "pattern" | "equipment" | "seedKey"> & Partial<Pick<LibraryExercise, "measure" | "setup">>;
  library: readonly LibraryExercise[];
  gymEquipment: readonly EquipmentType[];
  /** Same muscle, prefer isolation / a different pattern (the current compound feels off). */
  fatigue?: boolean;
  exclude?: readonly string[];
}

function available(eq: EquipmentType, gym: ReadonlySet<EquipmentType>): boolean {
  return gym.has(eq);
}

/**
 * Exercises that can stand in for the current one on this gym: same movement pattern or same muscle,
 * and equipment that exists here (or the candidate carries its own load grid). Never auto-applied; the caller still asks.
 */
export function substitutionCandidates(q: SubstitutionQuery): LibraryExercise[] {
  if (q.current.pattern === "other") return [];
  const gym = new Set(q.gymEquipment);
  const skip = new Set([q.current.id, ...(q.exclude ?? [])]);
  const cur = metaOf(q.current);
  const out: { ex: LibraryExercise; score: number }[] = [];
  for (const ex of q.library) {
    if (skip.has(ex.id)) continue;
    if (!available(ex.equipment, gym) && !ex.loadSpec) continue;
    if (q.current.measure && ex.measure !== q.current.measure) continue;
    if (q.current.setup && ex.setup !== q.current.setup) continue;
    const meta = metaOf(ex);
    const samePattern = ex.pattern === q.current.pattern;
    const sameMuscle = cur.group !== null && meta.group === cur.group;
    if (!samePattern && !sameMuscle) continue;
    let score = samePattern ? 0 : 2;
    if (q.fatigue) {
      if (isIsolationPattern(ex.pattern) && sameMuscle) score = 0;
      else if (sameMuscle && !samePattern) score = 1;
      else score = 3;
    }
    out.push({ ex, score });
  }
  out.sort((a, b) => a.score - b.score || a.ex.nameEn.localeCompare(b.ex.nameEn));
  return out.map((x) => x.ex);
}
