import type { LibraryGroup } from "../db/library/types";

/** How much weekly work a muscle should get in a generated program and in the volume window. */
export type MuscleRank = "priority" | "normal" | "maintenance" | "reduced";

export const MUSCLE_RANKS: readonly MuscleRank[] = ["priority", "normal", "maintenance", "reduced"];

/** Muscles the lifter can rank. Matches the volume / generator groups. */
export const RANKABLE_MUSCLES: readonly LibraryGroup[] = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
];

export const SET_FACTOR: Record<MuscleRank, number> = {
  priority: 1.5,
  normal: 1,
  maintenance: 0.67,
  reduced: 0.4,
};

export type MusclePriorities = Partial<Record<LibraryGroup, MuscleRank>>;

export const MUSCLE_PRIORITY_SETTING = "muscle_priorities";

export function rankOf(priorities: MusclePriorities | null | undefined, group: string): MuscleRank {
  const r = priorities?.[group as LibraryGroup];
  return r && MUSCLE_RANKS.includes(r) ? r : "normal";
}

export function scaleSets(sets: number, rank: MuscleRank, max = 12): number {
  return Math.max(1, Math.min(max, Math.round(sets * SET_FACTOR[rank])));
}

export function parseMusclePriorities(raw: string | null | undefined): MusclePriorities {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as MusclePriorities;
    if (!v || typeof v !== "object") return {};
    const out: MusclePriorities = {};
    for (const g of RANKABLE_MUSCLES) {
      const r = v[g];
      if (r && MUSCLE_RANKS.includes(r)) out[g] = r;
    }
    return out;
  } catch {
    return {};
  }
}

export const serializeMusclePriorities = (p: MusclePriorities): string => JSON.stringify(p);
