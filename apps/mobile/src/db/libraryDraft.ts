/**
 * DRAFT LIBRARY GROWTH (Step 8). Nothing here has been reviewed by a native Egyptian lifter or trainer.
 *  - English names are the common gym names of the movement. No cues, no setup text, no demos, no media, no claims.
 *  - Arabic names are my literal / transliterated drafts. Aliases are only spellings and short forms of those names,
 *    not slang I have heard. They may be wrong, missing, or different in another city.
 *  - "Draft" labels stay until two native reviewers sign off (docs/ARABIC-REVIEW-SHEET.md). Nothing here removes them.
 * Patterns are the app's own movement groups (logic/exposure.ts). Hip thrust and trap/abs work use "other" on purpose,
 * so the weekly-sets arithmetic does not credit them to a muscle group it cannot justify.
 */
import { withMeta } from "./library/existing";
import { HEVY_STYLE_LIBRARY, type CatalogEntry } from "./library";
import { SAMPLE_EXERCISES, type SeedExercise } from "./seedData";

export const LIBRARY_VERSION = 2;

const LEGACY_DRAFT: SeedExercise[] = [
  { key: "incline_bench_barbell", en: "Incline Barbell Bench Press", ar: "بنش مائل بالبار", aliasesAr: ["بنش مائل", "انكلاين بار"], pattern: "incline_push", equipment: "barbell", setup: "free" },
  { key: "db_bench", en: "Dumbbell Bench Press", ar: "بنش بالدمبل", aliasesAr: ["ضغط صدر بالدمبل", "دمبل بنش"], pattern: "horizontal_push", equipment: "dumbbell", setup: "free" },
  { key: "close_grip_bench", en: "Close-Grip Bench Press", ar: "بنش ضيق", aliasesAr: ["بنش قبضة ضيقة"], pattern: "horizontal_push", equipment: "barbell", setup: "free" },
  { key: "cable_fly", en: "Cable Fly", ar: "فلاي كابل", aliasesAr: ["فتح صدر كابل"], pattern: "horizontal_push", equipment: "cable", setup: "free" },
  { key: "pec_deck", en: "Pec Deck (machine fly)", ar: "بك ديك", aliasesAr: ["فلاي ماكينة", "فتح صدر ماكينة"], pattern: "horizontal_push", equipment: "machine", setup: "free" },
  { key: "overhead_press_barbell", en: "Barbell Overhead Press", ar: "ضغط كتف بالبار", aliasesAr: ["أوفر هيد بريس", "شولدر بريس بار"], pattern: "vertical_push", equipment: "barbell", setup: "free" },
  { key: "machine_shoulder_press", en: "Machine Shoulder Press", ar: "ضغط كتف بالماكينة", aliasesAr: ["شولدر بريس ماكينة"], pattern: "vertical_push", equipment: "machine", setup: "free" },
  { key: "cable_lateral_raise", en: "Cable Lateral Raise", ar: "رفرفة جانبي كابل", aliasesAr: ["لاترال كابل"], pattern: "shoulder_isolation", equipment: "cable", setup: "free" },
  { key: "rear_delt_fly_db", en: "Dumbbell Rear Delt Fly", ar: "رفرفة خلفي بالدمبل", aliasesAr: ["ريير دلت", "كتف خلفي"], pattern: "rear_delt", equipment: "dumbbell", setup: "free" },
  { key: "reverse_pec_deck", en: "Reverse Pec Deck", ar: "رفرفة خلفي ماكينة", aliasesAr: ["ريفرس بك ديك", "كتف خلفي ماكينة"], pattern: "rear_delt", equipment: "machine", setup: "free" },
  { key: "skullcrusher", en: "Lying Triceps Extension (skullcrusher)", ar: "سكل كراشر", aliasesAr: ["ترايسبس مستلقي"], pattern: "elbow_extension", equipment: "barbell", setup: "free" },
  { key: "overhead_triceps_cable", en: "Cable Overhead Triceps Extension", ar: "ترايسبس فوق الراس كابل", aliasesAr: ["أوفر هيد ترايسبس"], pattern: "elbow_extension", equipment: "cable", setup: "free" },
  { key: "pullup", en: "Pull-Up (bodyweight + added)", ar: "عقلة", aliasesAr: ["بول أب", "عقلة بوزن إضافي"], pattern: "vertical_pull", equipment: "plate", setup: "bodyweight_plus_added" },
  { key: "barbell_row", en: "Barbell Row", ar: "تجديف بالبار", aliasesAr: ["بار رو", "تجديف بار"], pattern: "horizontal_pull", equipment: "barbell", setup: "free" },
  { key: "machine_row", en: "Machine Row", ar: "تجديف ماكينة", aliasesAr: ["رو ماكينة"], pattern: "horizontal_pull", equipment: "machine", setup: "free" },
  { key: "straight_arm_pulldown", en: "Straight-Arm Cable Pulldown", ar: "سحب بذراع مفرودة كابل", aliasesAr: ["ستريت آرم"], pattern: "vertical_pull", equipment: "cable", setup: "free" },
  { key: "barbell_curl", en: "Barbell Biceps Curl", ar: "باي بالبار", aliasesAr: ["كيرل بار", "تبادل بار"], pattern: "elbow_flexion", equipment: "barbell", setup: "free" },
  { key: "cable_curl", en: "Cable Biceps Curl", ar: "باي كابل", aliasesAr: ["كيرل كابل"], pattern: "elbow_flexion", equipment: "cable", setup: "free" },
  { key: "front_squat", en: "Barbell Front Squat", ar: "سكوات أمامي", aliasesAr: ["فرونت سكوات"], pattern: "squat", equipment: "barbell", setup: "free" },
  { key: "goblet_squat", en: "Goblet Squat", ar: "جوبلت سكوات", aliasesAr: ["سكوات بدمبل"], pattern: "squat", equipment: "dumbbell", setup: "free" },
  { key: "hack_squat", en: "Machine Hack Squat", ar: "هاك سكوات", aliasesAr: ["هاك سكوات ماكينة"], pattern: "squat", equipment: "machine", setup: "free" },
  { key: "bulgarian_split_squat", en: "Dumbbell Bulgarian Split Squat", ar: "سبليت سكوات بلغاري", aliasesAr: ["بلغاري", "سبليت سكوات"], pattern: "squat", equipment: "dumbbell", setup: "free" },
  { key: "db_lunge", en: "Dumbbell Lunge", ar: "لانج بالدمبل", aliasesAr: ["لانجز", "طعن بالدمبل"], pattern: "squat", equipment: "dumbbell", setup: "free" },
  { key: "deadlift", en: "Conventional Deadlift", ar: "ديدلفت", aliasesAr: ["ديدلفت بالبار", "رفعة ميتة"], pattern: "hinge", equipment: "barbell", setup: "free" },
  { key: "db_rdl", en: "Dumbbell Romanian Deadlift", ar: "ديدلفت روماني بالدمبل", aliasesAr: ["رومانيان دمبل"], pattern: "hinge", equipment: "dumbbell", setup: "free" },
  { key: "hip_thrust", en: "Barbell Hip Thrust", ar: "هيب ثراست", aliasesAr: ["هيب ثرست"], pattern: "other", equipment: "barbell", setup: "free" },
  { key: "lying_leg_curl", en: "Lying Leg Curl", ar: "ليج كيرل نائم", aliasesAr: ["رجل خلفي نائم"], pattern: "knee_flexion", equipment: "machine", setup: "free" },
  { key: "standing_calf_raise", en: "Standing Calf Raise", ar: "سمانة واقف", aliasesAr: ["كالف واقف"], pattern: "calf", equipment: "machine", setup: "free" },
  { key: "db_shrug", en: "Dumbbell Shrug", ar: "شراج بالدمبل", aliasesAr: ["رفع كتف بالدمبل"], pattern: "other", equipment: "dumbbell", setup: "free" },
  { key: "cable_crunch", en: "Cable Crunch", ar: "بطن كابل", aliasesAr: ["كرنش كابل"], pattern: "other", equipment: "cable", setup: "free" },
];

/**
 * v0.12.0: the big Hevy-style library (src/db/library/*). It is topped up by seed_key, so a phone that already has a lifter's own
 * or edited row for the same key keeps it untouched. Entries whose movement the app already shipped under another name are not
 * repeated (tested), so an import title never matches two rows.
 */
export const DRAFT_LIBRARY: SeedExercise[] = [...LEGACY_DRAFT, ...HEVY_STYLE_LIBRARY];

/** Everything the app ships: the sample program's exercises plus the draft growth. One list for search tests and the review sheet. */
export const ALL_LIBRARY: SeedExercise[] = [...SAMPLE_EXERCISES, ...DRAFT_LIBRARY];

/** Every shipped exercise with its picker metadata (muscle, gear, ceiling class), by seed_key. */
export const CATALOG: CatalogEntry[] = [...SAMPLE_EXERCISES, ...LEGACY_DRAFT].map(withMeta).concat(HEVY_STYLE_LIBRARY);
export const CATALOG_BY_KEY: ReadonlyMap<string, CatalogEntry> = new Map(CATALOG.map((e) => [e.key, e]));
