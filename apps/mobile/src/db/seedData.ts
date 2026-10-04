/**
 * SAMPLE DATA ONLY. Nothing here is real: the gym is a placeholder rack, the program is a generic upper/lower example,
 * and the Arabic names/aliases are a DRAFT that must be reviewed by Egyptian lifters/trainers before release.
 * Every sample row is stored with is_sample = 1 and named "(sample)" so it can never be mistaken for the user's data.
 */
import type { EquipmentType, SetupType } from "@gain/engine";

export const SEED_VERSION = 1;

export interface SeedGymLoad {
  equipment: EquipmentType;
  loads?: number[];
  increment?: number;
  min?: number;
  max?: number;
}

/** SAMPLE gym fingerprint: dumbbell pairs on a rack, 2.5 kg barbell steps, 5 kg cable/machine jumps. */
export const SAMPLE_GYM = {
  name: "Sample gym (placeholder, edit to match your real gym)",
  loads: [
    { equipment: "dumbbell", loads: [5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 40, 45, 50] },
    { equipment: "barbell", increment: 2.5, min: 20, max: 200 },
    { equipment: "plate", increment: 2.5, min: 2.5, max: 60 },
    { equipment: "cable", increment: 5, min: 5, max: 100 },
    { equipment: "machine", increment: 5, min: 5, max: 160 },
    { equipment: "assisted", increment: 5, min: 0, max: 70 },
  ] satisfies SeedGymLoad[],
};

export interface SeedExercise {
  key: string;
  en: string;
  ar: string;
  /** DRAFT Egyptian-gym aliases, to be reviewed. */
  aliasesAr: string[];
  pattern: string;
  equipment: EquipmentType;
  setup: SetupType;
}

export const SAMPLE_EXERCISES: SeedExercise[] = [
  { key: "bench_press", en: "Barbell Bench Press", ar: "بنش برس بالبار", aliasesAr: ["بنش", "بنش بريس", "ضغط صدر بالبار"], pattern: "horizontal_push", equipment: "barbell", setup: "free" },
  { key: "incline_db_press", en: "Incline Dumbbell Press", ar: "ضغط علوي بالدمبل", aliasesAr: ["انكلاين", "إنكلاين دمبل", "صدر علوي"], pattern: "incline_push", equipment: "dumbbell", setup: "free" },
  { key: "chest_press_machine", en: "Machine Chest Press", ar: "ضغط صدر بالماكينة", aliasesAr: ["تشيست بريس", "ماكينة صدر"], pattern: "horizontal_push", equipment: "machine", setup: "free" },
  { key: "shoulder_press_db", en: "Seated Dumbbell Shoulder Press", ar: "ضغط كتف بالدمبل", aliasesAr: ["شولدر بريس", "ضغط كتف"], pattern: "vertical_push", equipment: "dumbbell", setup: "free" },
  { key: "lateral_raise_db", en: "Dumbbell Lateral Raise", ar: "رفرفة جانبي بالدمبل", aliasesAr: ["لاترال", "رفرفة", "رفرفة جانبي"], pattern: "shoulder_isolation", equipment: "dumbbell", setup: "free" },
  { key: "triceps_pushdown", en: "Cable Triceps Pushdown", ar: "ترايسبس كابل", aliasesAr: ["تراي كابل", "بوش داون", "ترايسبس نزول"], pattern: "elbow_extension", equipment: "cable", setup: "free" },
  { key: "lat_pulldown", en: "Lat Pulldown", ar: "سحب أمامي (لات)", aliasesAr: ["لات", "لات بول داون", "سحب عالي"], pattern: "vertical_pull", equipment: "cable", setup: "free" },
  { key: "seated_cable_row", en: "Seated Cable Row", ar: "تجديف كابل جالس", aliasesAr: ["روينج كابل", "تجديف", "سحب أفقي"], pattern: "horizontal_pull", equipment: "cable", setup: "free" },
  { key: "db_row", en: "One-Arm Dumbbell Row", ar: "تجديف دمبل بذراع واحدة", aliasesAr: ["دمبل رو", "تجديف دمبل"], pattern: "horizontal_pull", equipment: "dumbbell", setup: "free" },
  { key: "face_pull", en: "Face Pull", ar: "سحب للوجه (فيس بول)", aliasesAr: ["فيس بول", "سحب للوجه"], pattern: "rear_delt", equipment: "cable", setup: "free" },
  { key: "db_curl", en: "Dumbbell Biceps Curl", ar: "تبادل بالدمبل (باي)", aliasesAr: ["باي", "بايسبس", "تبادل", "باي دمبل"], pattern: "elbow_flexion", equipment: "dumbbell", setup: "free" },
  { key: "hammer_curl", en: "Hammer Curl", ar: "هامر كيرل", aliasesAr: ["هامر", "مطرقة"], pattern: "elbow_flexion", equipment: "dumbbell", setup: "free" },
  { key: "back_squat", en: "Barbell Back Squat", ar: "سكوات بالبار", aliasesAr: ["سكوات", "قرفصاء"], pattern: "squat", equipment: "barbell", setup: "free" },
  { key: "leg_press", en: "Leg Press", ar: "ليج بريس", aliasesAr: ["ليج بريس", "ضغط أرجل"], pattern: "squat", equipment: "machine", setup: "free" },
  { key: "romanian_deadlift", en: "Romanian Deadlift", ar: "ديدلفت روماني", aliasesAr: ["رومانيان", "ديدلفت", "آر دي إل"], pattern: "hinge", equipment: "barbell", setup: "free" },
  { key: "leg_curl", en: "Seated Leg Curl", ar: "رجل خلفي (ليج كيرل)", aliasesAr: ["ليج كيرل", "رجل خلفي", "هامسترنج"], pattern: "knee_flexion", equipment: "machine", setup: "free" },
  { key: "leg_extension", en: "Leg Extension", ar: "رجل أمامي (ليج اكستنشن)", aliasesAr: ["ليج اكستنشن", "رجل أمامي", "كوادريسبس"], pattern: "knee_extension", equipment: "machine", setup: "free" },
  { key: "calf_raise", en: "Seated Calf Raise", ar: "سمانة جالس", aliasesAr: ["سمانة", "كالف"], pattern: "calf", equipment: "machine", setup: "free" },
  { key: "assisted_pullup", en: "Assisted Pull-Up (machine)", ar: "عقلة بمساعدة الجهاز", aliasesAr: ["عقلة مساعدة", "بول أب مساعد"], pattern: "vertical_pull", equipment: "assisted", setup: "assisted" },
  { key: "dip", en: "Dip (bodyweight + added)", ar: "باراليل", aliasesAr: ["ديبس", "متوازي"], pattern: "vertical_push", equipment: "plate", setup: "bodyweight_plus_added" },
];

export interface SeedDayExercise {
  key: string;
  sets: number;
  repMin: number;
  repMax: number;
  goalLift?: boolean;
}

/**
 * SAMPLE program: a generic 4-day upper/lower example, not a recommendation.
 * The top of each range is the lift's default REP CEILING (the reps that earn more load): 10 upper body, 12 legs,
 * 15 lateral raises. The ceiling actually used is resolved from the exercise name and any per-lift edit, not from repMax.
 */
export const SAMPLE_PROGRAMME = {
  name: "Upper/Lower (sample)",
  days: [
    {
      name: "Upper A",
      exercises: [
        { key: "bench_press", sets: 3, repMin: 6, repMax: 10, goalLift: true },
        { key: "lat_pulldown", sets: 3, repMin: 8, repMax: 10 },
        { key: "incline_db_press", sets: 3, repMin: 8, repMax: 10 },
        { key: "seated_cable_row", sets: 3, repMin: 8, repMax: 10 },
        { key: "lateral_raise_db", sets: 3, repMin: 10, repMax: 15 },
        { key: "triceps_pushdown", sets: 3, repMin: 8, repMax: 10 },
      ],
    },
    {
      name: "Lower A",
      exercises: [
        { key: "back_squat", sets: 3, repMin: 8, repMax: 12, goalLift: true },
        { key: "romanian_deadlift", sets: 3, repMin: 8, repMax: 12 },
        { key: "leg_press", sets: 3, repMin: 8, repMax: 12 },
        { key: "leg_curl", sets: 3, repMin: 8, repMax: 12 },
        { key: "calf_raise", sets: 3, repMin: 8, repMax: 12 },
      ],
    },
    {
      name: "Upper B",
      exercises: [
        { key: "shoulder_press_db", sets: 3, repMin: 8, repMax: 10 },
        { key: "assisted_pullup", sets: 3, repMin: 6, repMax: 10 },
        { key: "chest_press_machine", sets: 3, repMin: 8, repMax: 10 },
        { key: "db_row", sets: 3, repMin: 8, repMax: 10 },
        { key: "db_curl", sets: 3, repMin: 8, repMax: 10 },
        { key: "hammer_curl", sets: 2, repMin: 8, repMax: 10 },
        { key: "face_pull", sets: 3, repMin: 8, repMax: 10 },
      ],
    },
    {
      name: "Lower B",
      exercises: [
        { key: "leg_press", sets: 3, repMin: 8, repMax: 12 },
        { key: "romanian_deadlift", sets: 3, repMin: 8, repMax: 12 },
        { key: "leg_extension", sets: 3, repMin: 8, repMax: 12 },
        { key: "leg_curl", sets: 3, repMin: 8, repMax: 12 },
        { key: "dip", sets: 3, repMin: 6, repMax: 10 },
      ],
    },
  ] satisfies { name: string; exercises: SeedDayExercise[] }[],
};
