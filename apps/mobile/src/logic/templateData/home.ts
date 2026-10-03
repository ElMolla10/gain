import { day, tpl, x, type Template } from "../templateTypes";

/**
 * Home programmes (v0.14.0): dumbbell / kettlebell, resistance-band and bodyweight-only arrangements, so they need no gym. Common
 * community / coaching shapes written with library exercises only. Bodyweight pulling needs a pull-up bar (or a sturdy bar / table
 * edge for rows). Band exercises use GAIN's cable load model (no kg scale: the lifter types a number they understand). Not
 * trainer-reviewed. Arabic is draft.
 */
export const DUMBBELL_TEMPLATES: Template[] = [
  tpl({
    id: "db_full_2", days: 2, en: "Dumbbells at home: full body, 2 days", ar: "دمبل في البيت: جسم كامل، يومين", level: "beginner", gear: "dumbbell", goal: "general",
    schedule: [
      day("Full body A", "جسم كامل أ", [x("goblet_squat", 3, 10), x("db_bench", 3, 10), x("db_row", 3, 10), x("shoulder_press_db", 2, 10), x("db_curl", 2, 10)]),
      day("Full body B", "جسم كامل ب", [x("db_rdl", 3, 10), x("incline_db_press", 3, 10), x("bent_over_row_dumbbell", 3, 10), x("lateral_raise_db", 2, 12), x("overhead_triceps_extension_dumbbell", 2, 10), x("reverse_lunge_dumbbell", 2, 10)]),
    ],
  }),
  tpl({
    id: "db_full_3", days: 3, en: "Dumbbells at home: full body, 3 days", ar: "دمبل في البيت: جسم كامل، 3 أيام", level: "beginner", gear: "dumbbell", goal: "general",
    schedule: [
      day("Full body A", "جسم كامل أ", [x("goblet_squat", 3, 10), x("db_bench", 3, 10), x("db_row", 3, 10), x("lateral_raise_db", 2, 12), x("db_curl", 2, 10)]),
      day("Full body B", "جسم كامل ب", [x("db_rdl", 3, 10), x("shoulder_press_db", 3, 10), x("bent_over_row_dumbbell", 3, 10), x("reverse_lunge_dumbbell", 2, 10), x("overhead_triceps_extension_dumbbell", 2, 10)]),
      day("Full body C", "جسم كامل ج", [x("bulgarian_split_squat", 3, 10), x("incline_db_press", 3, 10), x("hip_thrust_dumbbell", 3, 12), x("rear_delt_fly_db", 2, 12), x("hammer_curl", 2, 10), x("pullover_dumbbell", 2, 12)]),
    ],
  }),
  tpl({
    id: "db_full_4", days: 4, en: "Dumbbells at home: full body, 4 days", ar: "دمبل في البيت: جسم كامل، 4 أيام", level: "intermediate", gear: "dumbbell", goal: "general",
    schedule: [
      day("Full body A", "جسم كامل أ", [x("squat_dumbbell", 3, 8), x("db_bench", 3, 8), x("db_row", 3, 8), x("lateral_raise_db", 2, 12)]),
      day("Full body B", "جسم كامل ب", [x("db_rdl", 3, 8), x("shoulder_press_db", 3, 8), x("chin_up", 3, 6), x("db_curl", 2, 10), x("triceps_kickback_dumbbell", 2, 12)]),
      day("Full body C", "جسم كامل ج", [x("bulgarian_split_squat", 3, 8), x("incline_db_press", 3, 8), x("bent_over_row_dumbbell", 3, 8), x("hammer_curl", 2, 10), x("standing_calf_raise_dumbbell", 3, 12)]),
      day("Full body D", "جسم كامل د", [x("hip_thrust_dumbbell", 3, 10), x("floor_press_dumbbell", 3, 10), x("chest_supported_row_dumbbell", 3, 10), x("rear_delt_fly_db", 2, 12), x("overhead_triceps_extension_dumbbell", 2, 10), x("step_up_dumbbell", 2, 10)]),
    ],
  }),
  tpl({
    id: "db_ul_4", days: 4, en: "Dumbbells at home: upper / lower, 4 days", ar: "دمبل في البيت: علوي / سفلي، 4 أيام", level: "intermediate", gear: "dumbbell", goal: "hypertrophy",
    schedule: [
      day("Upper A", "علوي أ", [x("db_bench", 4, 8), x("db_row", 4, 8), x("shoulder_press_db", 3, 10), x("chest_fly_dumbbell", 2, 12), x("db_curl", 3, 10), x("skullcrusher_dumbbell", 3, 10)]),
      day("Lower A", "سفلي أ", [x("squat_dumbbell", 4, 10), x("db_rdl", 3, 10), x("reverse_lunge_dumbbell", 3, 10), x("standing_calf_raise_dumbbell", 4, 12)]),
      day("Upper B", "علوي ب", [x("incline_db_press", 4, 8), x("bent_over_row_dumbbell", 4, 8), x("arnold_press_dumbbell", 3, 10), x("rear_delt_fly_db", 3, 12), x("lateral_raise_db", 3, 12), x("hammer_curl", 3, 10), x("overhead_triceps_extension_dumbbell", 3, 10)]),
      day("Lower B", "سفلي ب", [x("bulgarian_split_squat", 3, 10), x("single_leg_romanian_deadlift_dumbbell", 3, 10), x("hip_thrust_dumbbell", 3, 10), x("step_up_dumbbell", 3, 10), x("single_leg_standing_calf_raise_dumbbell", 3, 12)]),
    ],
  }),
  tpl({
    id: "db_ppl_3", days: 3, en: "Dumbbells at home: push / pull / legs, 3 days", ar: "دمبل في البيت: دفع / سحب / أرجل، 3 أيام", level: "intermediate", gear: "dumbbell", goal: "general",
    schedule: [
      day("Push", "دفع", [x("db_bench", 3, 8), x("shoulder_press_db", 3, 8), x("incline_db_press", 3, 10), x("lateral_raise_db", 3, 12), x("overhead_triceps_extension_dumbbell", 3, 10)]),
      day("Pull", "سحب", [x("db_row", 3, 8), x("bent_over_row_dumbbell", 3, 10), x("pullup", 3, 6), x("rear_delt_fly_db", 3, 12), x("db_curl", 3, 10), x("hammer_curl", 2, 10)]),
      day("Legs", "أرجل", [x("squat_dumbbell", 4, 10), x("db_rdl", 3, 10), x("bulgarian_split_squat", 3, 10), x("hip_thrust_dumbbell", 3, 12), x("standing_calf_raise_dumbbell", 3, 12)]),
    ],
  }),
  tpl({
    id: "db_ppl_6", days: 6, en: "Dumbbells at home: push / pull / legs, 6 days", ar: "دمبل في البيت: دفع / سحب / أرجل، 6 أيام", level: "intermediate", gear: "dumbbell", goal: "hypertrophy",
    schedule: [
      day("Push A", "دفع أ", [x("db_bench", 4, 8), x("shoulder_press_db", 3, 10), x("chest_fly_dumbbell", 3, 12), x("lateral_raise_db", 3, 12), x("skullcrusher_dumbbell", 3, 10)]),
      day("Pull A", "سحب أ", [x("db_row", 4, 8), x("pullup", 3, 6), x("rear_delt_fly_db", 3, 12), x("db_curl", 3, 10), x("db_shrug", 2, 12)]),
      day("Legs A", "أرجل أ", [x("squat_dumbbell", 4, 10), x("db_rdl", 3, 10), x("db_lunge", 3, 10), x("standing_calf_raise_dumbbell", 4, 12)]),
      day("Push B", "دفع ب", [x("incline_db_press", 4, 8), x("arnold_press_dumbbell", 3, 10), x("floor_press_dumbbell", 3, 10), x("seated_lateral_raise_dumbbell", 3, 12), x("overhead_triceps_extension_dumbbell", 3, 10)]),
      day("Pull B", "سحب ب", [x("bent_over_row_dumbbell", 4, 8), x("chin_up", 3, 6), x("pullover_dumbbell", 3, 12), x("hammer_curl", 3, 10), x("seated_incline_curl_dumbbell", 2, 10)]),
      day("Legs B", "أرجل ب", [x("bulgarian_split_squat", 4, 10), x("single_leg_romanian_deadlift_dumbbell", 3, 10), x("hip_thrust_dumbbell", 3, 10), x("step_up_dumbbell", 3, 10), x("single_leg_standing_calf_raise_dumbbell", 3, 12)]),
    ],
  }),
  tpl({
    id: "db_ul_ppl_5", days: 5, en: "Dumbbells at home: upper / lower + push / pull / legs, 5 days", ar: "دمبل في البيت: علوي / سفلي + دفع / سحب / أرجل، 5 أيام", level: "intermediate", gear: "dumbbell", goal: "hypertrophy",
    schedule: [
      day("Upper", "علوي", [x("db_bench", 3, 8), x("db_row", 3, 8), x("shoulder_press_db", 3, 10), x("chin_up", 3, 6), x("db_curl", 2, 10), x("overhead_triceps_extension_dumbbell", 2, 10)]),
      day("Lower", "سفلي", [x("squat_dumbbell", 4, 10), x("db_rdl", 3, 10), x("reverse_lunge_dumbbell", 3, 10), x("standing_calf_raise_dumbbell", 3, 12)]),
      day("Push", "دفع", [x("incline_db_press", 3, 8), x("chest_fly_dumbbell", 3, 12), x("arnold_press_dumbbell", 3, 10), x("lateral_raise_db", 3, 12), x("skullcrusher_dumbbell", 2, 10)]),
      day("Pull", "سحب", [x("bent_over_row_dumbbell", 3, 8), x("pullup", 3, 6), x("rear_delt_fly_db", 3, 12), x("hammer_curl", 3, 10), x("db_shrug", 2, 12)]),
      day("Legs", "أرجل", [x("bulgarian_split_squat", 3, 10), x("single_leg_romanian_deadlift_dumbbell", 3, 10), x("hip_thrust_dumbbell", 3, 10), x("step_up_dumbbell", 3, 10), x("single_leg_standing_calf_raise_dumbbell", 3, 12)]),
    ],
  }),
  tpl({
    id: "db_glutes_3", days: 3, en: "Dumbbells at home: glute focus, 3 days", ar: "دمبل في البيت: تركيز على الجلوتس، 3 أيام", level: "beginner", gear: "dumbbell", goal: "glutes",
    schedule: [
      day("Glutes A", "جلوتس أ", [x("hip_thrust_dumbbell", 4, 10, true), x("db_rdl", 3, 10), x("bulgarian_split_squat", 3, 10), x("glute_bridge", 3, 12)]),
      day("Upper body and core", "علوي وبطن", [x("incline_db_press", 3, 10), x("db_row", 3, 10), x("shoulder_press_db", 3, 10), x("bent_over_row_dumbbell", 3, 10), x("crunch", 2, 15)]),
      day("Glutes B", "جلوتس ب", [x("sumo_squat_dumbbell", 3, 10), x("curtsy_lunge_dumbbell", 3, 10), x("single_leg_hip_thrust", 3, 10), x("kettlebell_swing", 3, 15), x("reverse_lunge_dumbbell", 2, 10)]),
    ],
  }),
  tpl({
    id: "db_arms_shoulders_4", days: 4, en: "Dumbbells at home: arms and shoulders emphasis, 4 days", ar: "دمبل في البيت: تركيز على الدراعات والكتف، 4 أيام", level: "intermediate", gear: "dumbbell", goal: "arms_shoulders",
    schedule: [
      day("Shoulders and triceps", "كتف وتراي", [x("shoulder_press_db", 4, 8), x("lateral_raise_db", 4, 12), x("rear_delt_fly_db", 3, 12), x("overhead_triceps_extension_dumbbell", 3, 10), x("skullcrusher_dumbbell", 3, 10)]),
      day("Back and biceps", "ضهر وباي", [x("db_row", 3, 10), x("chin_up", 3, 6), x("bent_over_row_dumbbell", 3, 10), x("db_curl", 3, 10), x("hammer_curl", 3, 10)]),
      day("Legs and chest", "أرجل وصدر", [x("squat_dumbbell", 3, 10), x("db_rdl", 3, 10), x("db_bench", 3, 10), x("incline_db_press", 3, 10)]),
      day("Arms and delts", "دراعات وكتف", [x("arnold_press_dumbbell", 3, 10), x("seated_lateral_raise_dumbbell", 4, 12), x("concentration_curl", 3, 10), x("seated_incline_curl_dumbbell", 3, 10), x("triceps_kickback_dumbbell", 3, 12), x("tate_press_dumbbell", 3, 10)]),
    ],
  }),
  tpl({
    id: "db_strength_3", days: 3, en: "Dumbbells at home: heavy and low-rep, 3 days", ar: "دمبل في البيت: تقيل وعدّات قليلة، 3 أيام", level: "intermediate", gear: "dumbbell", goal: "strength",
    schedule: [
      day("Heavy A", "تقيل أ", [x("squat_dumbbell", 4, 6, true, 8), x("db_bench", 4, 6, true, 8), x("db_row", 4, 6, false, 8)]),
      day("Heavy B", "تقيل ب", [x("deadlift_dumbbell", 3, 6, true, 8), x("shoulder_press_db", 4, 6, true, 8), x("chin_up", 3, 5)]),
      day("Volume", "حجم", [x("bulgarian_split_squat", 3, 8), x("incline_db_press", 3, 6), x("bent_over_row_dumbbell", 3, 8), x("hammer_curl", 2, 10), x("overhead_triceps_extension_dumbbell", 2, 10)]),
    ],
  }),
];

export const BODYWEIGHT_TEMPLATES: Template[] = [
  tpl({
    id: "bw_full_2", days: 2, en: "No equipment: full body, 2 days", ar: "من غير أدوات: جسم كامل، يومين", level: "beginner", gear: "bodyweight", goal: "general",
    schedule: [
      day("Full body A", "جسم كامل أ", [x("squat_bodyweight", 3, 15), x("push_up", 3, 10), x("inverted_row", 3, 10), x("glute_bridge", 3, 15), x("crunch", 2, 15)]),
      day("Full body B", "جسم كامل ب", [x("lunge_bodyweight", 3, 12), x("pike_push_up", 3, 8), x("chin_up", 3, 5), x("hip_thrust_bodyweight", 3, 15), x("bicycle_crunch", 2, 15)]),
    ],
  }),
  tpl({
    id: "bw_full_3", days: 3, en: "No equipment: full body, 3 days", ar: "من غير أدوات: جسم كامل، 3 أيام", level: "beginner", gear: "bodyweight", goal: "general",
    schedule: [
      day("Full body A", "جسم كامل أ", [x("squat_bodyweight", 3, 15), x("push_up", 3, 10), x("inverted_row", 3, 10), x("glute_bridge", 3, 15), x("reverse_crunch", 2, 15)]),
      day("Full body B", "جسم كامل ب", [x("lunge_bodyweight", 3, 12), x("pike_push_up", 3, 8), x("chin_up", 3, 5), x("single_leg_glute_bridge", 3, 12), x("superman", 2, 12)]),
      day("Full body C", "جسم كامل ج", [x("bulgarian_split_squat_bodyweight", 3, 10), x("decline_push_up", 3, 10), x("scapular_pull_up", 3, 8), x("hip_thrust_bodyweight", 3, 15), x("hanging_leg_raise", 2, 8)]),
    ],
  }),
  tpl({
    id: "bw_ul_4", days: 4, en: "No equipment: upper / lower, 4 days", ar: "من غير أدوات: علوي / سفلي، 4 أيام", level: "intermediate", gear: "bodyweight", goal: "general",
    schedule: [
      day("Upper A", "علوي أ", [x("push_up", 4, 12), x("pike_push_up", 3, 8), x("chin_up", 4, 6), x("inverted_row", 3, 10), x("diamond_push_up", 3, 10)]),
      day("Lower A", "سفلي أ", [x("squat_bodyweight", 4, 15), x("bulgarian_split_squat_bodyweight", 3, 10), x("hip_thrust_bodyweight", 3, 15), x("nordic_hamstring_curl", 3, 5), x("standing_calf_raise_bodyweight", 4, 15)]),
      day("Upper B", "علوي ب", [x("decline_push_up", 4, 10), x("close_grip_push_up", 3, 10), x("neutral_grip_pull_up", 4, 5), x("scapular_pull_up", 3, 8), x("back_extension_hyperextension", 3, 12)]),
      day("Lower B", "سفلي ب", [x("step_up_bodyweight", 3, 12), x("single_leg_glute_bridge", 3, 12), x("slider_leg_curl", 3, 10), x("sissy_squat", 3, 8), x("standing_calf_raise_bodyweight", 3, 15)]),
    ],
  }),
  tpl({
    id: "bw_ppl_3", days: 3, en: "No equipment: push / pull / legs, 3 days", ar: "من غير أدوات: دفع / سحب / أرجل، 3 أيام", level: "intermediate", gear: "bodyweight", goal: "general",
    schedule: [
      day("Push", "دفع", [x("push_up", 4, 12), x("pike_push_up", 3, 8), x("decline_push_up", 3, 10), x("bench_dip", 3, 12)]),
      day("Pull", "سحب", [x("chin_up", 4, 6), x("inverted_row", 4, 10), x("wide_pull_up", 3, 5), x("superman", 3, 12)]),
      day("Legs", "أرجل", [x("squat_bodyweight", 4, 15), x("bulgarian_split_squat_bodyweight", 3, 10), x("hip_thrust_bodyweight", 3, 15), x("nordic_hamstring_curl", 3, 5), x("standing_calf_raise_bodyweight", 4, 15)]),
    ],
  }),
];

export const BAND_TEMPLATES: Template[] = [
  tpl({
    id: "band_full_2", days: 2, en: "Resistance bands: full body, 2 days", ar: "أستيك مقاومة: جسم كامل، يومين", level: "beginner", gear: "band", goal: "general",
    schedule: [
      day("Full body A", "جسم كامل أ", [x("squat_band", 3, 12), x("chest_press_band", 3, 12), x("seated_row_band", 3, 12), x("shoulder_press_band", 2, 12), x("bicep_curl_band", 2, 12)]),
      day("Full body B", "جسم كامل ب", [x("deadlift_band", 3, 12), x("lat_pulldown_band", 3, 12), x("chest_fly_band", 2, 15), x("lateral_raise_band", 2, 15), x("triceps_pushdown_band", 2, 12), x("glute_bridge_band", 3, 15)]),
    ],
  }),
  tpl({
    id: "band_full_3", days: 3, en: "Resistance bands: full body, 3 days", ar: "أستيك مقاومة: جسم كامل، 3 أيام", level: "beginner", gear: "band", goal: "general",
    schedule: [
      day("Full body A", "جسم كامل أ", [x("squat_band", 3, 12), x("chest_press_band", 3, 12), x("seated_row_band", 3, 12), x("lateral_raise_band", 2, 15), x("bicep_curl_band", 2, 12)]),
      day("Full body B", "جسم كامل ب", [x("deadlift_band", 3, 12), x("shoulder_press_band", 3, 12), x("lat_pulldown_band", 3, 12), x("triceps_pushdown_band", 2, 12), x("leg_extension_band", 2, 15)]),
      day("Full body C", "جسم كامل ج", [x("hip_thrust_band", 3, 15), x("chest_fly_band", 3, 15), x("face_pull_band", 3, 15), x("leg_curl_band", 3, 12), x("band_pull_apart", 2, 15)]),
    ],
  }),
  tpl({
    id: "band_ul_4", days: 4, en: "Resistance bands: upper / lower, 4 days", ar: "أستيك مقاومة: علوي / سفلي، 4 أيام", level: "intermediate", gear: "band", goal: "hypertrophy",
    schedule: [
      day("Upper A", "علوي أ", [x("chest_press_band", 4, 12), x("seated_row_band", 4, 12), x("shoulder_press_band", 3, 12), x("lat_pulldown_band", 3, 12), x("bicep_curl_band", 3, 12), x("triceps_pushdown_band", 3, 12)]),
      day("Lower A", "سفلي أ", [x("squat_band", 4, 12), x("deadlift_band", 4, 12), x("leg_extension_band", 3, 15), x("hip_thrust_band", 3, 15)]),
      day("Upper B", "علوي ب", [x("chest_fly_band", 3, 15), x("face_pull_band", 3, 15), x("lateral_raise_band", 3, 15), x("band_pull_apart", 3, 15), x("triceps_extension_band", 3, 12), x("lat_pulldown_band", 3, 15)]),
      day("Lower B", "سفلي ب", [x("squat_band", 3, 15), x("leg_curl_band", 3, 12), x("glute_kickback_band", 3, 15), x("hip_abduction_band", 3, 15), x("glute_bridge_band", 3, 15)]),
    ],
  }),
  tpl({
    id: "band_glutes_3", days: 3, en: "Resistance bands: glute focus, 3 days", ar: "أستيك مقاومة: تركيز على الجلوتس، 3 أيام", level: "beginner", gear: "band", goal: "glutes",
    schedule: [
      day("Glutes A", "جلوتس أ", [x("hip_thrust_band", 4, 15), x("glute_bridge_band", 3, 15), x("glute_kickback_band", 3, 15), x("hip_abduction_band", 3, 15)]),
      day("Legs and glutes", "أرجل وجلوتس", [x("squat_band", 3, 15), x("deadlift_band", 3, 12), x("monster_walk_band", 3, 12), x("clamshell_band", 3, 15)]),
      day("Upper body", "علوي", [x("chest_press_band", 3, 12), x("seated_row_band", 3, 12), x("shoulder_press_band", 3, 12), x("fire_hydrant_band", 3, 15), x("lat_pulldown_band", 3, 12)]),
    ],
  }),
];
