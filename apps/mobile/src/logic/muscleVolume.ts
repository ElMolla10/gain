import type { EquipmentType, LoggedSet } from "@gain/engine";
import { weekMuscleVolume, type MuscleVolumeRow } from "@gain/engine";
import { groupOfPattern, type MuscleGroup, type ExposureRow } from "./exposure";
import { metaOf } from "./exerciseSearch";

const EXPOSURE_OF: Record<string, MuscleGroup | undefined> = {
  chest: "chest",
  back: "back",
  shoulders: "shoulders",
  biceps: "biceps",
  triceps: "triceps",
  forearms: "forearms",
  quads: "quads",
  hamstrings: "hamstrings",
  glutes: "glutes",
  calves: "calves",
};

export function muscleGroupOf(ex: { seedKey: string | null; pattern: string; equipment: EquipmentType }): MuscleGroup {
  const g = metaOf(ex).group;
  return (g && EXPOSURE_OF[g]) || groupOfPattern(ex.pattern);
}

export function muscleVolumeRows(
  exercises: { seedKey: string | null; pattern: string; equipment: EquipmentType; sets: LoggedSet[] }[],
  planned: ExposureRow[],
): MuscleVolumeRow[] {
  return weekMuscleVolume(
    exercises.map((ex) => ({ group: muscleGroupOf(ex), sets: ex.sets })),
    planned.map((p) => ({ group: p.group, planned: p.setsPerWeek })),
  );
}
