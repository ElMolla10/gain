import { isTrustedWorkingSet } from "./outlier";
import type { LoggedSet } from "./types";

export interface MuscleVolumeInput {
  group: string;
  /** Trusted working sets of one exercise this week. Supersets: pass the exercise once. */
  sets: LoggedSet[];
}

export interface MuscleVolumeTarget {
  group: string;
  planned: number | null;
}

export interface MuscleVolumeRow {
  group: string;
  completed: number;
  min: number;
  max: number;
}

/** Default hypertrophy-style weekly working-set windows when the program has no number. */
export const DEFAULT_VOLUME_RANGE: Record<string, [number, number]> = {
  chest: [8, 12],
  back: [10, 14],
  shoulders: [8, 12],
  biceps: [8, 12],
  triceps: [8, 12],
  forearms: [6, 10],
  quads: [8, 12],
  hamstrings: [8, 12],
  glutes: [8, 12],
  calves: [6, 10],
  other: [6, 10],
};

export function volumeTargetRange(planned: number | null, group: string): [number, number] {
  if (planned != null && planned > 0) {
    const n = Math.round(planned);
    return [Math.max(1, Math.round(n * 0.8)), Math.max(n, Math.round(n * 1.2))];
  }
  return DEFAULT_VOLUME_RANGE[group] ?? DEFAULT_VOLUME_RANGE.other!;
}

/**
 * Completed trusted working sets this week per muscle, versus a target range.
 * Each exercise is counted once (callers pass one row per exercise, so a superset pair is not double-counted).
 */
export function weekMuscleVolume(exercises: MuscleVolumeInput[], targets: MuscleVolumeTarget[]): MuscleVolumeRow[] {
  const completed = new Map<string, number>();
  for (const ex of exercises) {
    const n = ex.sets.filter(isTrustedWorkingSet).length;
    if (n <= 0) continue;
    completed.set(ex.group, (completed.get(ex.group) ?? 0) + n);
  }
  const planned = new Map(targets.map((t) => [t.group, t.planned]));
  const groups = [...new Set([...completed.keys(), ...planned.keys()])].filter((g) => g !== "other" || (completed.get(g) ?? 0) > 0);
  return groups
    .map((group) => {
      const [min, max] = volumeTargetRange(planned.get(group) ?? null, group);
      return { group, completed: completed.get(group) ?? 0, min, max };
    })
    .sort((a, b) => a.group.localeCompare(b.group));
}
