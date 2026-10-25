import type { Unit } from "./units";

/** The ids of every exercise the workout can show: the day's slots plus any exercise swapped in. Sorted and joined, so it only changes when the set changes. */
export function shownExerciseIdsKey(slots: readonly { exerciseId: string }[], states: Record<string, { replacedBy?: string | null } | undefined>): string {
  const ids = new Set(slots.map((s) => s.exerciseId));
  for (const st of Object.values(states)) if (st?.replacedBy) ids.add(st.replacedBy);
  return [...ids].sort().join("|");
}

/** Ids from the key whose remembered unit has not been read yet. */
export function unitIdsToRead(key: string, read: ReadonlySet<string>): string[] {
  return key ? key.split("|").filter((id) => !read.has(id)) : [];
}

/** Saved units fill in; a choice already made in this workout (prev) wins. */
export const mergeExerciseUnits = (prev: Record<string, Unit>, saved: Record<string, Unit>): Record<string, Unit> => ({ ...saved, ...prev });
