import type { SeedExercise } from "../seedData";
import { ENGINE_EQUIPMENT, GEARS, type CatalogEntry, type Gear, type Muscle } from "./types";

/** Picker metadata for the exercises that shipped before v0.12.0 (their names are not Hevy-style and are never renamed: rows may already be on phones). */
const MUSCLE_OF: Record<string, Muscle> = {
  bench_press: "chest", incline_db_press: "chest", chest_press_machine: "chest", shoulder_press_db: "front_delts", lateral_raise_db: "side_delts",
  triceps_pushdown: "triceps", lat_pulldown: "lats", seated_cable_row: "upper_back", db_row: "upper_back", face_pull: "rear_delts", db_curl: "biceps",
  hammer_curl: "biceps", back_squat: "quads", leg_press: "quads", romanian_deadlift: "hamstrings", leg_curl: "hamstrings", leg_extension: "quads",
  calf_raise: "calves", assisted_pullup: "lats", dip: "triceps",
  incline_bench_barbell: "chest", db_bench: "chest", close_grip_bench: "chest", cable_fly: "chest", pec_deck: "chest", overhead_press_barbell: "front_delts",
  machine_shoulder_press: "front_delts", cable_lateral_raise: "side_delts", rear_delt_fly_db: "rear_delts", reverse_pec_deck: "rear_delts",
  skullcrusher: "triceps", overhead_triceps_cable: "triceps", pullup: "lats", barbell_row: "upper_back", machine_row: "upper_back",
  straight_arm_pulldown: "lats", barbell_curl: "biceps", cable_curl: "biceps", front_squat: "quads", goblet_squat: "quads", hack_squat: "quads",
  bulgarian_split_squat: "quads", db_lunge: "quads", deadlift: "hamstrings", db_rdl: "hamstrings", hip_thrust: "glutes", lying_leg_curl: "hamstrings",
  standing_calf_raise: "calves", db_shrug: "traps", cable_crunch: "abs",
};

const LOWER: Muscle[] = ["quads", "hamstrings", "glutes", "calves", "adductors", "abductors", "hip_flexors"];

export function withMeta(e: SeedExercise): CatalogEntry {
  const muscle = MUSCLE_OF[e.key];
  if (!muscle) throw new Error(`No picker metadata for library exercise ${e.key}`);
  const gear: Gear = e.equipment === "plate" ? "bodyweight" : e.equipment;
  if (!GEARS.includes(gear) || ENGINE_EQUIPMENT[gear] !== e.equipment) throw new Error(`Gear mismatch for ${e.key}`);
  const lateral = muscle === "side_delts";
  return { ...e, muscle, gear, ceilingClass: lateral ? "lateral_raise" : LOWER.includes(muscle) ? "lower" : "upper", draftAr: true };
}
