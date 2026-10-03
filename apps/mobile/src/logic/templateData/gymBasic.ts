import { day, tpl, x, type Template } from "../templateTypes";

/**
 * Gym full-body, minimal and strength-first templates (v0.14.0). Common community / coaching arrangements written with library
 * exercises only; names such as "StrongLifts-style" describe the SHAPE (days, lifts, sets x reps), not the original paid or
 * branded programme, and carry none of its progression rules: progression is always GAIN's rule-v0.3 (load goes up when every
 * set reaches the lift's rep ceiling). Not trainer-reviewed. Arabic is draft.
 */
export const GYM_BASIC_TEMPLATES: Template[] = [
  tpl({
    id: "full_body_4", days: 4, en: "Full body, 4 days", ar: "جسم كامل، 4 أيام", level: "intermediate", gear: "gym", goal: "general",
    schedule: [
      day("Full body A", "جسم كامل أ", [x("back_squat", 3, 6, true), x("bench_press", 3, 6, true), x("seated_cable_row", 3, 8), x("lateral_raise_db", 2, 10), x("triceps_pushdown", 2, 8)]),
      day("Full body B", "جسم كامل ب", [x("romanian_deadlift", 3, 8), x("shoulder_press_db", 3, 8), x("lat_pulldown", 3, 8, true), x("leg_curl", 2, 10), x("db_curl", 2, 8)]),
      day("Full body C", "جسم كامل ج", [x("leg_press", 3, 8), x("incline_db_press", 3, 8), x("db_row", 3, 8), x("face_pull", 2, 10), x("calf_raise", 3, 8)]),
      day("Full body D", "جسم كامل د", [x("bulgarian_split_squat", 3, 8), x("chest_press_machine", 3, 8), x("assisted_pullup", 3, 6), x("hammer_curl", 2, 8), x("cable_crunch", 2, 10)]),
    ],
  }),
  tpl({
    id: "full_body_3_machines", days: 3, en: "Full body on machines, 3 days (beginner)", ar: "جسم كامل على الماكينات، 3 أيام (مبتدئ)", level: "beginner", gear: "gym", goal: "general",
    schedule: [
      day("Machines A", "ماكينات أ", [x("leg_press", 3, 10), x("chest_press_machine", 3, 10), x("lat_pulldown", 3, 10), x("machine_shoulder_press", 2, 10), x("leg_curl", 2, 10)]),
      day("Machines B", "ماكينات ب", [x("squat_machine", 3, 10), x("seated_row_machine", 3, 10), x("pec_deck", 2, 12), x("leg_extension", 2, 12), x("triceps_pushdown", 2, 10), x("cable_curl", 2, 10)]),
      day("Machines C", "ماكينات ج", [x("hip_thrust_machine", 3, 10), x("incline_chest_press_plate_loaded", 3, 10), x("lat_pulldown_machine", 3, 10), x("lateral_raise_machine", 2, 12), x("calf_press_machine", 2, 12), x("crunch_machine", 2, 12)]),
    ],
  }),
  tpl({
    id: "minimal_2", days: 2, en: "Minimal 2 days (about 35 min)", ar: "الحد الأدنى يومين (حوالي 35 دقيقة)", level: "beginner", gear: "gym", goal: "general",
    schedule: [
      day("Minimal A", "مختصر أ", [x("back_squat", 3, 6, true), x("bench_press", 3, 6, true), x("seated_cable_row", 3, 8), x("lateral_raise_db", 2, 10)]),
      day("Minimal B", "مختصر ب", [x("romanian_deadlift", 3, 8), x("shoulder_press_db", 3, 8), x("lat_pulldown", 3, 8, true), x("triceps_pushdown", 2, 10)]),
    ],
  }),
  tpl({
    id: "express_3", days: 3, en: "Express full body, 3 x 30 min", ar: "جسم كامل سريع، 3 × 30 دقيقة", level: "beginner", gear: "gym", goal: "general",
    schedule: [
      day("Express A", "سريع أ", [x("leg_press", 3, 10), x("chest_press_machine", 3, 10), x("lat_pulldown", 3, 10)]),
      day("Express B", "سريع ب", [x("goblet_squat", 3, 10), x("shoulder_press_db", 3, 10), x("seated_cable_row", 3, 10)]),
      day("Express C", "سريع ج", [x("romanian_deadlift", 3, 8), x("incline_db_press", 3, 10), x("db_row", 3, 10)]),
    ],
  }),
  tpl({
    id: "general_fitness_3", days: 3, en: "General fitness, 3 days (glute-friendly)", ar: "لياقة عامة، 3 أيام (مناسب للجلوتس)", level: "beginner", gear: "gym", goal: "general",
    schedule: [
      day("Fitness A", "لياقة أ", [x("goblet_squat", 3, 10), x("incline_db_press", 3, 10), x("lat_pulldown", 3, 10), x("glute_bridge", 3, 12), x("cable_crunch", 2, 12)]),
      day("Fitness B", "لياقة ب", [x("db_rdl", 3, 10), x("shoulder_press_db", 3, 10), x("seated_cable_row", 3, 10), x("reverse_lunge_dumbbell", 2, 10), x("lateral_raise_db", 2, 12)]),
      day("Fitness C", "لياقة ج", [x("leg_press", 3, 10), x("chest_press_machine", 3, 10), x("db_row", 3, 10), x("hip_thrust_machine", 3, 12), x("face_pull", 2, 12), x("cable_curl", 2, 12)]),
    ],
  }),
  tpl({
    id: "sl_5x5_3", days: 3, en: "5x5 strength A/B, 3 days (StrongLifts-style)", ar: "قوة 5×5 أ/ب، 3 أيام (على طريقة ستونج ليفتس)", level: "beginner", gear: "gym", goal: "strength",
    schedule: [
      day("5x5 A", "5×5 أ", [x("back_squat", 5, 5, true, 5), x("bench_press", 5, 5, true, 5), x("barbell_row", 5, 5, false, 5)]),
      day("5x5 B", "5×5 ب", [x("back_squat", 5, 5, true, 5), x("overhead_press_barbell", 5, 5, true, 5), x("deadlift", 1, 5, true, 5)]),
    ],
  }),
  tpl({
    id: "ss_3", days: 3, en: "3x5 novice strength, 3 days (Starting Strength-style)", ar: "قوة مبتدئين 3×5، 3 أيام (على طريقة ستارتينج ستريندث)", level: "beginner", gear: "gym", goal: "strength",
    schedule: [
      day("3x5 A", "3×5 أ", [x("back_squat", 3, 5, true, 5), x("bench_press", 3, 5, true, 5), x("deadlift", 1, 5, true, 5)]),
      day("3x5 B", "3×5 ب", [x("back_squat", 3, 5, true, 5), x("overhead_press_barbell", 3, 5, true, 5), x("chin_up", 3, 5), x("deadlift", 1, 5, true, 5)]),
    ],
  }),
  tpl({
    id: "strength_ul_4", days: 4, en: "Upper / lower strength, 4 days", ar: "علوي / سفلي قوة، 4 أيام", level: "intermediate", gear: "gym", goal: "strength",
    schedule: [
      day("Upper heavy", "علوي تقيل", [x("bench_press", 4, 4, true, 6), x("barbell_row", 3, 6), x("shoulder_press_db", 3, 6), x("lat_pulldown", 3, 8), x("triceps_pushdown", 2, 8), x("db_curl", 2, 8)]),
      day("Lower heavy", "سفلي تقيل", [x("back_squat", 4, 4, true, 6), x("romanian_deadlift", 3, 6), x("leg_press", 3, 8), x("leg_curl", 2, 8), x("calf_raise", 3, 8)]),
      day("Upper volume", "علوي حجم", [x("overhead_press_barbell", 4, 4, true, 6), x("incline_db_press", 3, 6), x("seated_cable_row", 3, 8), x("face_pull", 3, 10), x("hammer_curl", 2, 8)]),
      day("Lower volume", "سفلي حجم", [x("deadlift", 3, 3, true, 5), x("hack_squat", 3, 6), x("hip_thrust", 3, 8), x("leg_curl", 3, 8), x("calf_raise", 2, 8)]),
    ],
  }),
];
