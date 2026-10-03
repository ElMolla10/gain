import { tpl, x, type Template, type TemplateDay } from "../templateTypes";

/** The seven templates that shipped before v0.14.0 (ids and exercises unchanged; only the level / gear / goal tags are new). */
const FULL_A: TemplateDay = { en: "Full body A", ar: "جسم كامل أ", exercises: [x("back_squat", 3, 8, true), x("bench_press", 3, 6, true), x("seated_cable_row", 3, 8), x("shoulder_press_db", 2, 8), x("db_curl", 2, 8)] };
const FULL_B: TemplateDay = { en: "Full body B", ar: "جسم كامل ب", exercises: [x("romanian_deadlift", 3, 8), x("incline_db_press", 3, 8), x("lat_pulldown", 3, 8, true), x("lateral_raise_db", 2, 10), x("triceps_pushdown", 2, 8)] };
const FULL_C: TemplateDay = { en: "Full body C", ar: "جسم كامل ج", exercises: [x("leg_press", 3, 8), x("chest_press_machine", 3, 8), x("db_row", 3, 8), x("face_pull", 2, 8), x("hammer_curl", 2, 8), x("calf_raise", 2, 8)] };

const UPPER_A: TemplateDay = { en: "Upper A", ar: "علوي أ", exercises: [x("bench_press", 3, 6, true), x("lat_pulldown", 3, 8), x("incline_db_press", 3, 8), x("seated_cable_row", 3, 8), x("lateral_raise_db", 3, 10), x("triceps_pushdown", 3, 8)] };
const LOWER_A: TemplateDay = { en: "Lower A", ar: "سفلي أ", exercises: [x("back_squat", 3, 8, true), x("romanian_deadlift", 3, 8), x("leg_press", 3, 8), x("leg_curl", 3, 8), x("calf_raise", 3, 8)] };
const UPPER_B: TemplateDay = { en: "Upper B", ar: "علوي ب", exercises: [x("shoulder_press_db", 3, 8), x("db_row", 3, 8), x("chest_press_machine", 3, 8), x("face_pull", 3, 8), x("db_curl", 2, 8), x("hammer_curl", 2, 8)] };
const LOWER_B: TemplateDay = { en: "Lower B", ar: "سفلي ب", exercises: [x("leg_press", 3, 8), x("romanian_deadlift", 3, 8), x("leg_extension", 3, 8), x("leg_curl", 3, 8), x("calf_raise", 3, 8)] };

const PUSH: TemplateDay = { en: "Push", ar: "دفع", exercises: [x("bench_press", 3, 6, true), x("shoulder_press_db", 3, 8), x("incline_db_press", 3, 8), x("lateral_raise_db", 3, 10), x("triceps_pushdown", 3, 8)] };
const PULL: TemplateDay = { en: "Pull", ar: "سحب", exercises: [x("lat_pulldown", 3, 8, true), x("seated_cable_row", 3, 8), x("db_row", 3, 8), x("face_pull", 3, 8), x("db_curl", 3, 8), x("hammer_curl", 2, 8)] };
const LEGS: TemplateDay = { en: "Legs", ar: "أرجل", exercises: [x("back_squat", 3, 8, true), x("romanian_deadlift", 3, 8), x("leg_press", 3, 8), x("leg_curl", 3, 8), x("leg_extension", 3, 8), x("calf_raise", 3, 8)] };
const PUSH_B: TemplateDay = { en: "Push B", ar: "دفع ب", exercises: [x("chest_press_machine", 3, 8), x("incline_db_press", 3, 8), x("shoulder_press_db", 3, 8), x("lateral_raise_db", 3, 10), x("triceps_pushdown", 3, 8)] };
const PULL_B: TemplateDay = { en: "Pull B", ar: "سحب ب", exercises: [x("assisted_pullup", 3, 6), x("db_row", 3, 8), x("seated_cable_row", 3, 8), x("face_pull", 3, 8), x("hammer_curl", 3, 8)] };
const LEGS_B: TemplateDay = { en: "Legs B", ar: "أرجل ب", exercises: [x("leg_press", 3, 8), x("romanian_deadlift", 3, 8), x("leg_extension", 3, 8), x("leg_curl", 3, 8), x("calf_raise", 3, 8)] };

const MIX_1: TemplateDay = { en: "Chest and triceps", ar: "صدر وتراي", exercises: [x("bench_press", 3, 6, true), x("incline_db_press", 3, 8), x("chest_press_machine", 3, 8), x("triceps_pushdown", 3, 8)] };
const MIX_2: TemplateDay = { en: "Back and biceps", ar: "ضهر وباي", exercises: [x("lat_pulldown", 3, 8, true), x("seated_cable_row", 3, 8), x("db_row", 3, 8), x("db_curl", 3, 8), x("hammer_curl", 2, 8)] };
const MIX_3: TemplateDay = { en: "Legs", ar: "أرجل", exercises: [x("back_squat", 3, 8, true), x("leg_press", 3, 8), x("romanian_deadlift", 3, 8), x("leg_curl", 3, 8), x("calf_raise", 3, 8)] };
const MIX_4: TemplateDay = { en: "Shoulders and arms", ar: "كتف ودراعات", exercises: [x("shoulder_press_db", 3, 8), x("lateral_raise_db", 3, 10), x("face_pull", 3, 8), x("db_curl", 3, 8), x("triceps_pushdown", 3, 8)] };

export const CORE_TEMPLATES: Template[] = [
  tpl({ id: "full_body_2", days: 2, en: "Full body, 2 days", ar: "جسم كامل، يومين", level: "beginner", gear: "gym", goal: "general", schedule: [FULL_A, FULL_B] }),
  tpl({ id: "full_body_3", days: 3, en: "Full body, 3 days", ar: "جسم كامل، 3 أيام", level: "beginner", gear: "gym", goal: "general", schedule: [FULL_A, FULL_B, FULL_C] }),
  tpl({ id: "upper_lower_2", days: 2, en: "Upper / lower, 2 days", ar: "علوي / سفلي، يومين", level: "beginner", gear: "gym", goal: "general", schedule: [UPPER_A, LOWER_A] }),
  tpl({ id: "upper_lower_4", days: 4, en: "Upper / lower, 4 days", ar: "علوي / سفلي، 4 أيام", level: "intermediate", gear: "gym", goal: "general", schedule: [UPPER_A, LOWER_A, UPPER_B, LOWER_B] }),
  tpl({ id: "ppl_3", days: 3, en: "Push / pull / legs, 3 days", ar: "دفع / سحب / أرجل، 3 أيام", level: "intermediate", gear: "gym", goal: "general", schedule: [PUSH, PULL, LEGS] }),
  tpl({ id: "ppl_6", days: 6, en: "Push / pull / legs, 6 days", ar: "دفع / سحب / أرجل، 6 أيام", level: "intermediate", gear: "gym", goal: "hypertrophy", schedule: [PUSH, PULL, LEGS, PUSH_B, PULL_B, LEGS_B] }),
  tpl({ id: "mix_4", days: 4, en: "Four-day mix (body-part split)", ar: "مزيج 4 أيام (تقسيم عضلات)", level: "intermediate", gear: "gym", goal: "hypertrophy", schedule: [MIX_1, MIX_2, MIX_3, MIX_4] }),
];
