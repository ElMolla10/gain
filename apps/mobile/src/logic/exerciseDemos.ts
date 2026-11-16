import type { ImageSourcePropType } from "react-native";

/** Exact, reviewed mappings from GAIN's stable exercise seed keys to CC0 exercise illustrations. */
const DEMO_IMAGE_BY_SEED_KEY: Readonly<Record<string, string>> = {
  bench_press: "bench-press",
  incline_db_press: "incline-dumbbell-press",
  chest_press_machine: "chest-press-machine",
  shoulder_press_db: "dumbbell-shoulder-press",
  lateral_raise_db: "lateral-raises",
  lat_pulldown: "lat-pulldown",
  seated_cable_row: "seated-cable-row",
  db_row: "dumbbell-row",
  face_pull: "face-pulls",
  db_curl: "biceps-curl",
  hammer_curl: "hammer-curls",
  back_squat: "squat",
  leg_press: "leg-press",
  romanian_deadlift: "romanian-deadlift",
  leg_curl: "seated-leg-curl",
  leg_extension: "leg-extension",
  calf_raise: "seated-calf-raise-machine",
  assisted_pullup: "assisted-pull-up",
  dip: "dips",
  triceps_pushdown: "tricep-pushdowns",
  incline_bench_barbell: "incline-bench-press",
  db_bench: "dumbbell-chest-press",
  close_grip_bench: "close-grip-bench-press",
  pec_deck: "pec-deck",
  overhead_press_barbell: "overhead-press",
  machine_shoulder_press: "shoulder-press-machine",
  cable_lateral_raise: "cable-lateral-raise",
  rear_delt_fly_db: "rear-delt-fly",
  reverse_pec_deck: "reverse-pec-deck",
  overhead_triceps_cable: "cable-overhead-triceps-extension",
  pullup: "pull-up",
  barbell_row: "bent-over-row",
  machine_row: "machine-row",
  straight_arm_pulldown: "straight-arm-pulldown",
  barbell_curl: "barbell-curl",
  cable_curl: "cable-curl",
  front_squat: "front-squat",
  goblet_squat: "goblet-squat",
  hack_squat: "hack-squat",
  bulgarian_split_squat: "bulgarian-split-squat",
  deadlift: "deadlift",
  db_rdl: "dumbbell-romanian-deadlift",
  hip_thrust: "hip-thrusts",
  db_shrug: "dumbbell-shrug",
  cable_crunch: "cable-crunch",
};

export function exerciseDemoImageId(seedKey: string | null | undefined): string | null {
  return seedKey ? DEMO_IMAGE_BY_SEED_KEY[seedKey] ?? null : null;
}

/** Static requires keep all illustrations bundled for offline workout use. */
export function exerciseDemoImage(seedKey: string | null | undefined): ImageSourcePropType | null {
  switch (exerciseDemoImageId(seedKey)) {
    case "bench-press": return require("../../assets/exercise-demos/bench-press.webp");
    case "incline-dumbbell-press": return require("../../assets/exercise-demos/incline-dumbbell-press.webp");
    case "chest-press-machine": return require("../../assets/exercise-demos/chest-press-machine.webp");
    case "dumbbell-shoulder-press": return require("../../assets/exercise-demos/dumbbell-shoulder-press.webp");
    case "lateral-raises": return require("../../assets/exercise-demos/lateral-raises.webp");
    case "lat-pulldown": return require("../../assets/exercise-demos/lat-pulldown.webp");
    case "seated-cable-row": return require("../../assets/exercise-demos/seated-cable-row.webp");
    case "dumbbell-row": return require("../../assets/exercise-demos/dumbbell-row.webp");
    case "face-pulls": return require("../../assets/exercise-demos/face-pulls.webp");
    case "biceps-curl": return require("../../assets/exercise-demos/biceps-curl.webp");
    case "hammer-curls": return require("../../assets/exercise-demos/hammer-curls.webp");
    case "squat": return require("../../assets/exercise-demos/squat.webp");
    case "leg-press": return require("../../assets/exercise-demos/leg-press.webp");
    case "romanian-deadlift": return require("../../assets/exercise-demos/romanian-deadlift.webp");
    case "seated-leg-curl": return require("../../assets/exercise-demos/seated-leg-curl.webp");
    case "leg-extension": return require("../../assets/exercise-demos/leg-extension.webp");
    case "seated-calf-raise-machine": return require("../../assets/exercise-demos/seated-calf-raise-machine.webp");
    case "assisted-pull-up": return require("../../assets/exercise-demos/assisted-pull-up.webp");
    case "dips": return require("../../assets/exercise-demos/dips.webp");
    case "tricep-pushdowns": return require("../../assets/exercise-demos/tricep-pushdowns.webp");
    case "incline-bench-press": return require("../../assets/exercise-demos/incline-bench-press.webp");
    case "dumbbell-chest-press": return require("../../assets/exercise-demos/dumbbell-chest-press.webp");
    case "close-grip-bench-press": return require("../../assets/exercise-demos/close-grip-bench-press.webp");
    case "pec-deck": return require("../../assets/exercise-demos/pec-deck.webp");
    case "overhead-press": return require("../../assets/exercise-demos/overhead-press.webp");
    case "shoulder-press-machine": return require("../../assets/exercise-demos/shoulder-press-machine.webp");
    case "cable-lateral-raise": return require("../../assets/exercise-demos/cable-lateral-raise.webp");
    case "rear-delt-fly": return require("../../assets/exercise-demos/rear-delt-fly.webp");
    case "reverse-pec-deck": return require("../../assets/exercise-demos/reverse-pec-deck.webp");
    case "cable-overhead-triceps-extension": return require("../../assets/exercise-demos/cable-overhead-triceps-extension.webp");
    case "pull-up": return require("../../assets/exercise-demos/pull-up.webp");
    case "bent-over-row": return require("../../assets/exercise-demos/bent-over-row.webp");
    case "machine-row": return require("../../assets/exercise-demos/machine-row.webp");
    case "straight-arm-pulldown": return require("../../assets/exercise-demos/straight-arm-pulldown.webp");
    case "barbell-curl": return require("../../assets/exercise-demos/barbell-curl.webp");
    case "cable-curl": return require("../../assets/exercise-demos/cable-curl.webp");
    case "front-squat": return require("../../assets/exercise-demos/front-squat.webp");
    case "goblet-squat": return require("../../assets/exercise-demos/goblet-squat.webp");
    case "hack-squat": return require("../../assets/exercise-demos/hack-squat.webp");
    case "bulgarian-split-squat": return require("../../assets/exercise-demos/bulgarian-split-squat.webp");
    case "deadlift": return require("../../assets/exercise-demos/deadlift.webp");
    case "dumbbell-romanian-deadlift": return require("../../assets/exercise-demos/dumbbell-romanian-deadlift.webp");
    case "hip-thrusts": return require("../../assets/exercise-demos/hip-thrusts.webp");
    case "dumbbell-shrug": return require("../../assets/exercise-demos/dumbbell-shrug.webp");
    case "cable-crunch": return require("../../assets/exercise-demos/cable-crunch.webp");
    default: return null;
  }
}
