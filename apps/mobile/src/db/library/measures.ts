import type { Measure } from "@gain/engine";

/**
 * Library rows that are counted in seconds or metres instead of reps (seed_key -> measure). Everything else is counted in reps.
 * Used (a) when the library is topped up, (b) once by migration 9 for rows a phone already has (only rows with no logged sets and no
 * place in a programme, so nothing the lifter already did or planned changes meaning), (c) as the default when a row is added to a programme.
 */
export const TIMED_LIBRARY: Readonly<Record<string, "time" | "distance">> = {
  plank: "time",
  weighted_plank: "time",
  side_plank: "time",
  incline_plank: "time",
  copenhagen_plank: "time",
  hollow_hold: "time",
  l_sit_hold: "time",
  handstand_hold: "time",
  wall_sit: "time",
  dead_hang: "time",
  farmers_walk: "distance",
  farmers_walk_trap_bar: "distance",
  farmers_carry_dumbbell: "distance",
  kettlebell_farmers_carry: "distance",
  suitcase_carry_dumbbell: "distance",
  overhead_carry_dumbbell: "distance",
  sandbag_carry: "distance",
};

export const measureOfKey = (seedKey: string | null | undefined): Measure => (seedKey ? TIMED_LIBRARY[seedKey] ?? "reps" : "reps");

/** Starting range (seconds or metres) when a timed exercise is added to a programme. A suggestion the lifter edits, not a prescription. */
export const DEFAULT_TIMED_RANGE: Record<"time" | "distance", { min: number; max: number; sets: number }> = {
  time: { min: 30, max: 60, sets: 3 },
  distance: { min: 20, max: 40, sets: 3 },
};
