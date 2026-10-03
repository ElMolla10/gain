import { day, tpl, x, type Template } from "../templateTypes";

/**
 * Gym split programmes (v0.14.0): PPL variants, upper/lower hybrids, PHUL- and PHAT-style, bro split, Arnold split, torso/limbs,
 * volume and "bulking-phase" emphasis, glute and arms/shoulders specialisation. Common community / coaching arrangements written with
 * library exercises only. "PHUL-style", "PHAT-style" and "Arnold split" name a SHAPE (which muscles on which day), simplified to what the
 * library and GAIN's rule-v0.3 can express: no speed days, no percentage waves. Not trainer-reviewed. Arabic is draft.
 */
export const GYM_SPLIT_TEMPLATES: Template[] = [
  tpl({
    id: "ul_ppl_5", days: 5, en: "Upper / lower + push / pull / legs, 5 days", ar: "علوي / سفلي + دفع / سحب / أرجل، 5 أيام", level: "intermediate", gear: "gym", goal: "hypertrophy",
    schedule: [
      day("Upper", "علوي", [x("bench_press", 3, 6, true), x("lat_pulldown", 3, 8), x("shoulder_press_db", 3, 8), x("seated_cable_row", 3, 8), x("db_curl", 2, 10), x("triceps_pushdown", 2, 10)]),
      day("Lower", "سفلي", [x("back_squat", 3, 6, true), x("romanian_deadlift", 3, 8), x("leg_press", 3, 10), x("leg_curl", 3, 10), x("calf_raise", 3, 10)]),
      day("Push", "دفع", [x("incline_db_press", 3, 8), x("cable_fly", 2, 12), x("machine_shoulder_press", 3, 10), x("lateral_raise_db", 3, 12), x("overhead_triceps_cable", 3, 10)]),
      day("Pull", "سحب", [x("assisted_pullup", 3, 6), x("db_row", 3, 8), x("reverse_pec_deck", 3, 12), x("hammer_curl", 3, 10)]),
      day("Legs", "أرجل", [x("hack_squat", 3, 8), x("hip_thrust", 3, 8), x("leg_extension", 3, 12), x("lying_leg_curl", 3, 10), x("standing_calf_raise", 3, 12)]),
    ],
  }),
  tpl({
    id: "ppl_5", days: 5, en: "Push / pull / legs / push / pull, 5 days", ar: "دفع / سحب / أرجل / دفع / سحب، 5 أيام", level: "intermediate", gear: "gym", goal: "hypertrophy",
    schedule: [
      day("Push A", "دفع أ", [x("bench_press", 4, 6, true), x("shoulder_press_db", 3, 8), x("incline_db_press", 3, 8), x("lateral_raise_db", 3, 12), x("triceps_pushdown", 3, 10)]),
      day("Pull A", "سحب أ", [x("lat_pulldown", 3, 8, true), x("barbell_row", 3, 8), x("face_pull", 3, 12), x("db_curl", 3, 10), x("hammer_curl", 2, 10)]),
      day("Legs", "أرجل", [x("back_squat", 4, 6, true), x("romanian_deadlift", 3, 8), x("leg_press", 3, 10), x("leg_curl", 3, 10), x("calf_raise", 4, 10)]),
      day("Push B", "دفع ب", [x("overhead_press_barbell", 3, 6), x("chest_press_machine", 3, 10), x("cable_fly", 3, 12), x("cable_lateral_raise", 3, 12), x("overhead_triceps_cable", 3, 10)]),
      day("Pull B", "سحب ب", [x("assisted_pullup", 3, 6), x("db_row", 3, 10), x("straight_arm_pulldown", 3, 12), x("rear_delt_fly_db", 3, 12), x("cable_curl", 3, 10)]),
    ],
  }),
  tpl({
    id: "phul_4", days: 4, en: "Power + hypertrophy upper / lower, 4 days (PHUL-style)", ar: "قوة + تضخيم علوي / سفلي، 4 أيام (على طريقة PHUL)", level: "intermediate", gear: "gym", goal: "strength",
    schedule: [
      day("Power upper", "علوي قوة", [x("bench_press", 4, 4, true, 6), x("barbell_row", 3, 5, false, 8), x("incline_db_press", 3, 6), x("lat_pulldown", 2, 8), x("overhead_press_barbell", 3, 5, false, 8), x("db_curl", 2, 8), x("skullcrusher", 2, 8)]),
      day("Power lower", "سفلي قوة", [x("back_squat", 4, 4, true, 6), x("deadlift", 3, 4, true, 6), x("leg_press", 3, 8), x("leg_curl", 2, 8), x("calf_raise", 3, 8)]),
      day("Hypertrophy upper", "علوي تضخيم", [x("incline_bench_barbell", 4, 8), x("cable_fly", 3, 10), x("seated_cable_row", 4, 8), x("neutral_grip_lat_pulldown_cable", 3, 10), x("lateral_raise_db", 3, 12), x("triceps_rope_pushdown", 3, 10), x("hammer_curl", 3, 10)]),
      day("Hypertrophy lower", "سفلي تضخيم", [x("front_squat", 3, 8), x("walking_lunge_dumbbell", 3, 10), x("leg_extension", 3, 12), x("lying_leg_curl", 3, 10), x("standing_calf_raise", 4, 10)]),
    ],
  }),
  tpl({
    id: "phat_5", days: 5, en: "Power + hypertrophy, 5 days (PHAT-style)", ar: "قوة + تضخيم، 5 أيام (على طريقة PHAT)", level: "advanced", gear: "gym", goal: "hypertrophy",
    schedule: [
      day("Upper power", "علوي قوة", [x("bench_press", 3, 4, true, 6), x("barbell_row", 3, 5, false, 8), x("pullup", 2, 6), x("shoulder_press_db", 3, 6), x("barbell_curl", 2, 6), x("skullcrusher", 2, 6)]),
      day("Lower power", "سفلي قوة", [x("back_squat", 3, 4, true, 6), x("hack_squat", 2, 6), x("leg_extension", 2, 10), x("romanian_deadlift", 3, 6), x("lying_leg_curl", 2, 8), x("calf_raise", 3, 8)]),
      day("Back and shoulders", "ضهر وكتف", [x("t_bar_row", 3, 8), x("neutral_grip_lat_pulldown_cable", 3, 10), x("seated_cable_row", 3, 10), x("machine_shoulder_press", 3, 10), x("lateral_raise_db", 3, 12), x("rear_delt_fly_db", 2, 12)]),
      day("Lower hypertrophy", "سفلي تضخيم", [x("leg_press", 3, 10), x("bulgarian_split_squat", 3, 10), x("leg_extension_single_leg_machine", 2, 12), x("standing_leg_curl_machine", 3, 10), x("standing_calf_raise", 4, 12)]),
      day("Chest and arms", "صدر وذراعين", [x("incline_db_press", 3, 8), x("chest_press_machine", 3, 10), x("cable_fly", 3, 12), x("preacher_curl_ez_bar", 3, 10), x("hammer_curl", 2, 10), x("overhead_triceps_cable", 3, 10), x("triceps_rope_pushdown", 2, 10)]),
    ],
  }),
  tpl({
    id: "bro_5", days: 5, en: "Body-part split, 5 days (bro split)", ar: "تقسيم عضلات، 5 أيام", level: "intermediate", gear: "gym", goal: "hypertrophy",
    schedule: [
      day("Chest", "صدر", [x("bench_press", 4, 8, true), x("incline_db_press", 3, 10), x("cable_fly", 3, 12), x("dip", 3, 8)]),
      day("Back", "ضهر", [x("lat_pulldown", 4, 10, true), x("barbell_row", 3, 8), x("seated_cable_row", 3, 10), x("db_row", 3, 10), x("straight_arm_pulldown", 2, 12)]),
      day("Shoulders", "كتف", [x("shoulder_press_db", 4, 8), x("lateral_raise_db", 4, 12), x("rear_delt_fly_db", 3, 12), x("db_shrug", 3, 10)]),
      day("Arms", "دراعات", [x("barbell_curl", 3, 8), x("skullcrusher", 3, 8), x("hammer_curl", 3, 10), x("triceps_pushdown", 3, 10), x("seated_incline_curl_dumbbell", 2, 10), x("overhead_triceps_cable", 2, 10)]),
      day("Legs", "أرجل", [x("back_squat", 4, 8, true), x("leg_press", 3, 10), x("romanian_deadlift", 3, 8), x("leg_extension", 3, 12), x("leg_curl", 3, 10), x("calf_raise", 4, 10)]),
    ],
  }),
  tpl({
    id: "arnold_6", days: 6, en: "Arnold split, 6 days", ar: "تقسيم أرنولد، 6 أيام", level: "advanced", gear: "gym", goal: "hypertrophy",
    schedule: [
      day("Chest and back A", "صدر وضهر أ", [x("bench_press", 4, 8, true), x("incline_db_press", 3, 10), x("cable_fly", 3, 12), x("pullup", 3, 8), x("barbell_row", 3, 8), x("seated_cable_row", 3, 10)]),
      day("Shoulders and arms A", "كتف ودراعات أ", [x("overhead_press_barbell", 4, 8), x("lateral_raise_db", 3, 12), x("rear_delt_fly_db", 3, 12), x("barbell_curl", 3, 10), x("skullcrusher", 3, 10)]),
      day("Legs A", "أرجل أ", [x("back_squat", 4, 8, true), x("leg_press", 3, 10), x("romanian_deadlift", 3, 8), x("leg_curl", 3, 10), x("calf_raise", 4, 10)]),
      day("Chest and back B", "صدر وضهر ب", [x("chest_press_machine", 3, 10), x("incline_bench_barbell", 3, 8), x("pec_deck", 3, 12), x("lat_pulldown", 3, 10), x("db_row", 3, 10), x("seated_row_machine", 3, 10)]),
      day("Shoulders and arms B", "كتف ودراعات ب", [x("shoulder_press_db", 3, 10), x("cable_lateral_raise", 3, 12), x("reverse_pec_deck", 3, 12), x("cable_curl", 3, 10), x("overhead_triceps_cable", 3, 10), x("triceps_pushdown", 2, 12)]),
      day("Legs B", "أرجل ب", [x("hack_squat", 4, 8), x("bulgarian_split_squat", 3, 10), x("lying_leg_curl", 3, 10), x("leg_extension", 3, 12), x("standing_calf_raise", 4, 12)]),
    ],
  }),
  tpl({
    id: "arnold_3", days: 3, en: "Arnold split, 3 days", ar: "تقسيم أرنولد، 3 أيام", level: "intermediate", gear: "gym", goal: "hypertrophy",
    schedule: [
      day("Chest and back", "صدر وضهر", [x("bench_press", 3, 8, true), x("incline_db_press", 3, 10), x("lat_pulldown", 3, 10), x("seated_cable_row", 3, 10), x("cable_fly", 2, 12)]),
      day("Shoulders and arms", "كتف ودراعات", [x("shoulder_press_db", 3, 8), x("lateral_raise_db", 3, 12), x("face_pull", 3, 12), x("db_curl", 3, 10), x("triceps_pushdown", 3, 10)]),
      day("Legs", "أرجل", [x("back_squat", 3, 8, true), x("romanian_deadlift", 3, 8), x("leg_press", 3, 10), x("leg_curl", 3, 10), x("calf_raise", 3, 10)]),
    ],
  }),
  tpl({
    id: "torso_limbs_4", days: 4, en: "Torso / limbs, 4 days", ar: "جذع / أطراف، 4 أيام", level: "intermediate", gear: "gym", goal: "hypertrophy",
    schedule: [
      day("Torso A", "جذع أ", [x("bench_press", 3, 6, true), x("barbell_row", 3, 8), x("shoulder_press_db", 3, 8), x("lat_pulldown", 3, 10), x("lateral_raise_db", 3, 12)]),
      day("Limbs A", "أطراف أ", [x("back_squat", 3, 8, true), x("romanian_deadlift", 3, 8), x("db_curl", 3, 10), x("triceps_pushdown", 3, 10), x("calf_raise", 3, 10)]),
      day("Torso B", "جذع ب", [x("incline_db_press", 3, 8), x("seated_cable_row", 3, 10), x("machine_shoulder_press", 3, 10), x("assisted_pullup", 3, 8), x("face_pull", 3, 12)]),
      day("Limbs B", "أطراف ب", [x("leg_press", 3, 10), x("leg_curl", 3, 10), x("hammer_curl", 3, 10), x("overhead_triceps_cable", 3, 10), x("leg_extension", 3, 12)]),
    ],
  }),
  tpl({
    id: "hypertrophy_ul_4", days: 4, en: "Upper / lower for muscle size, 4 days (higher volume)", ar: "علوي / سفلي لتضخيم العضلات، 4 أيام (حجم أعلى)", level: "intermediate", gear: "gym", goal: "hypertrophy",
    schedule: [
      day("Upper 1", "علوي 1", [x("incline_db_press", 4, 8), x("lat_pulldown", 4, 10), x("chest_press_machine", 3, 10), x("seated_cable_row", 3, 10), x("lateral_raise_db", 3, 12), x("db_curl", 3, 10), x("triceps_pushdown", 3, 10)]),
      day("Lower 1", "سفلي 1", [x("hack_squat", 4, 8), x("romanian_deadlift", 3, 8), x("leg_extension", 3, 12), x("leg_curl", 3, 10), x("calf_raise", 4, 10)]),
      day("Upper 2", "علوي 2", [x("shoulder_press_db", 4, 8), x("assisted_pullup", 3, 8), x("cable_fly", 3, 12), x("db_row", 3, 10), x("rear_delt_fly_db", 3, 12), x("hammer_curl", 3, 10), x("overhead_triceps_cable", 3, 10)]),
      day("Lower 2", "سفلي 2", [x("back_squat", 3, 8), x("hip_thrust", 3, 10), x("leg_press", 3, 10), x("lying_leg_curl", 3, 10), x("standing_calf_raise", 4, 12)]),
    ],
  }),
  tpl({
    id: "bulk_ul_4", days: 4, en: "Bulking phase: upper / lower, 4 days (extra volume)", ar: "فترة التضخيم: علوي / سفلي، 4 أيام (حجم زيادة)", level: "intermediate", gear: "gym", goal: "bulking",
    schedule: [
      day("Upper A", "علوي أ", [x("bench_press", 4, 6, true), x("barbell_row", 4, 6), x("shoulder_press_db", 3, 8), x("lat_pulldown", 3, 8), x("db_curl", 3, 10), x("skullcrusher", 3, 10)]),
      day("Lower A", "سفلي أ", [x("back_squat", 4, 6, true), x("romanian_deadlift", 4, 6), x("leg_press", 3, 10), x("leg_curl", 3, 10), x("calf_raise", 4, 10)]),
      day("Upper B", "علوي ب", [x("incline_bench_barbell", 4, 8), x("assisted_pullup", 4, 6), x("chest_press_machine", 3, 10), x("seated_cable_row", 3, 10), x("lateral_raise_db", 4, 12), x("hammer_curl", 3, 10), x("triceps_pushdown", 3, 10)]),
      day("Lower B", "سفلي ب", [x("deadlift", 3, 5, true), x("hack_squat", 4, 8), x("hip_thrust", 3, 8), x("leg_extension", 3, 12), x("standing_calf_raise", 4, 10)]),
    ],
  }),
  tpl({
    id: "bulk_ppl_6", days: 6, en: "Bulking phase: push / pull / legs, 6 days (extra volume)", ar: "فترة التضخيم: دفع / سحب / أرجل، 6 أيام (حجم زيادة)", level: "advanced", gear: "gym", goal: "bulking",
    schedule: [
      day("Push A", "دفع أ", [x("bench_press", 4, 6, true), x("incline_db_press", 4, 8), x("shoulder_press_db", 3, 8), x("lateral_raise_db", 4, 12), x("triceps_pushdown", 3, 10), x("overhead_triceps_cable", 3, 10)]),
      day("Pull A", "سحب أ", [x("barbell_row", 4, 6, true), x("lat_pulldown", 4, 8), x("seated_cable_row", 3, 10), x("face_pull", 3, 12), x("barbell_curl", 3, 8), x("hammer_curl", 3, 10)]),
      day("Legs A", "أرجل أ", [x("back_squat", 4, 6, true), x("romanian_deadlift", 4, 8), x("leg_press", 3, 10), x("leg_curl", 3, 10), x("calf_raise", 4, 10)]),
      day("Push B", "دفع ب", [x("overhead_press_barbell", 4, 6), x("incline_bench_barbell", 3, 8), x("cable_fly", 3, 12), x("cable_lateral_raise", 4, 12), x("skullcrusher", 3, 10), x("triceps_rope_pushdown", 3, 12)]),
      day("Pull B", "سحب ب", [x("pullup", 4, 6), x("db_row", 4, 8), x("seated_row_machine", 3, 10), x("reverse_pec_deck", 3, 12), x("cable_curl", 3, 10), x("preacher_curl_ez_bar", 3, 10)]),
      day("Legs B", "أرجل ب", [x("hack_squat", 4, 8), x("hip_thrust", 3, 8), x("bulgarian_split_squat", 3, 10), x("leg_extension", 3, 12), x("lying_leg_curl", 3, 10), x("standing_calf_raise", 4, 12)]),
    ],
  }),
  tpl({
    id: "glutes_3", days: 3, en: "Glute and lower-body focus, 3 days", ar: "تركيز على الجلوتس والرجلين، 3 أيام", level: "beginner", gear: "gym", goal: "glutes",
    schedule: [
      day("Glutes and hamstrings", "جلوتس وخلفي", [x("hip_thrust", 4, 8, true), x("romanian_deadlift", 3, 8), x("bulgarian_split_squat", 3, 10), x("glute_kickback_cable", 3, 12), x("hip_abductor_machine", 2, 15)]),
      day("Upper body and core", "علوي وبطن", [x("lat_pulldown", 3, 10), x("incline_db_press", 3, 10), x("seated_cable_row", 3, 10), x("shoulder_press_db", 3, 10), x("cable_crunch", 2, 12)]),
      day("Quads and glutes", "أمامي وجلوتس", [x("leg_press", 3, 10), x("sumo_squat_dumbbell", 3, 10), x("walking_lunge_dumbbell", 3, 10), x("pull_through_cable", 3, 12), x("leg_curl", 3, 12), x("hip_abduction_cable", 2, 15)]),
    ],
  }),
  tpl({
    id: "glutes_4", days: 4, en: "Glute focus with upper days, 4 days", ar: "تركيز على الجلوتس مع أيام علوي، 4 أيام", level: "intermediate", gear: "gym", goal: "glutes",
    schedule: [
      day("Glutes A", "جلوتس أ", [x("hip_thrust", 4, 8, true), x("romanian_deadlift", 3, 8), x("bulgarian_split_squat", 3, 10), x("glute_kickback_cable", 3, 12), x("hip_abduction_cable", 3, 15)]),
      day("Upper A", "علوي أ", [x("incline_db_press", 3, 10), x("lat_pulldown", 3, 10), x("shoulder_press_db", 3, 10), x("seated_cable_row", 3, 10), x("triceps_pushdown", 2, 12), x("db_curl", 2, 12)]),
      day("Glutes B", "جلوتس ب", [x("leg_press", 3, 10), x("sumo_squat_dumbbell", 3, 10), x("hip_thrust_machine", 3, 10), x("reverse_hyperextension_machine", 3, 12), x("leg_curl", 3, 12), x("calf_raise", 2, 12)]),
      day("Upper B", "علوي ب", [x("chest_press_machine", 3, 10), x("db_row", 3, 10), x("lateral_raise_db", 3, 12), x("face_pull", 3, 12), x("cable_crunch", 2, 12), x("hammer_curl", 2, 12)]),
    ],
  }),
  tpl({
    id: "arms_shoulders_4", days: 4, en: "Arms and shoulders emphasis, 4 days", ar: "تركيز على الدراعات والكتف، 4 أيام", level: "intermediate", gear: "gym", goal: "arms_shoulders",
    schedule: [
      day("Shoulders and triceps", "كتف وتراي", [x("shoulder_press_db", 4, 8), x("lateral_raise_db", 4, 12), x("rear_delt_fly_db", 3, 12), x("skullcrusher", 3, 10), x("triceps_pushdown", 3, 10)]),
      day("Back and biceps", "ضهر وباي", [x("lat_pulldown", 3, 10, true), x("seated_cable_row", 3, 10), x("face_pull", 3, 12), x("barbell_curl", 3, 8), x("hammer_curl", 3, 10)]),
      day("Legs and chest", "أرجل وصدر", [x("back_squat", 3, 8, true), x("romanian_deadlift", 3, 8), x("incline_db_press", 3, 10), x("chest_press_machine", 3, 10), x("calf_raise", 2, 10)]),
      day("Arms and delts", "دراعات وكتف", [x("cable_lateral_raise", 4, 12), x("overhead_triceps_cable", 3, 10), x("cable_curl", 3, 10), x("preacher_curl_ez_bar", 3, 10), x("triceps_rope_pushdown", 3, 10), x("reverse_curl_ez_bar", 2, 12)]),
    ],
  }),
];
