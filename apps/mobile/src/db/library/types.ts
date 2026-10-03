import type { EquipmentType, SetupType } from "@gain/engine";
import type { SeedExercise } from "../seedData";

/** What the picker filters on. Not stored in the database: looked up from the shipped catalogue by seed_key (see libraryCatalog.ts). */
export const MUSCLES = [
  "chest", "lats", "upper_back", "lower_back", "front_delts", "side_delts", "rear_delts", "biceps", "triceps", "forearms",
  "quads", "hamstrings", "glutes", "calves", "abs", "obliques", "traps", "neck", "adductors", "abductors", "hip_flexors", "full_body",
] as const;
export type Muscle = (typeof MUSCLES)[number];

/** The picker's muscle chips: a few fine muscles share one chip. */
export const MUSCLE_GROUPS = ["chest", "back", "shoulders", "biceps", "triceps", "forearms", "quads", "hamstrings", "glutes", "calves", "core", "traps", "neck", "hips", "full_body"] as const;
export type LibraryGroup = (typeof MUSCLE_GROUPS)[number];

export const GROUP_OF_MUSCLE: Record<Muscle, LibraryGroup> = {
  chest: "chest", lats: "back", upper_back: "back", lower_back: "back",
  front_delts: "shoulders", side_delts: "shoulders", rear_delts: "shoulders",
  biceps: "biceps", triceps: "triceps", forearms: "forearms",
  quads: "quads", hamstrings: "hamstrings", glutes: "glutes", calves: "calves",
  abs: "core", obliques: "core", traps: "traps", neck: "neck",
  adductors: "hips", abductors: "hips", hip_flexors: "hips", full_body: "full_body",
};

/** The kind of gear as the lifter thinks of it (picker filter). The engine only knows six equipment types; see ENGINE_EQUIPMENT. */
export const GEARS = ["barbell", "ez_bar", "trap_bar", "dumbbell", "kettlebell", "cable", "band", "machine", "plate_loaded", "smith", "bodyweight", "suspension", "assisted"] as const;
export type Gear = (typeof GEARS)[number];

/** Engine equipment per gear. Kettlebells load like dumbbells (fixed steps), bands like cables (no kg scale: the lifter's own number), Smith and plate-loaded like machines. */
export const ENGINE_EQUIPMENT: Record<Gear, EquipmentType> = {
  barbell: "barbell", ez_bar: "barbell", trap_bar: "barbell", dumbbell: "dumbbell", kettlebell: "dumbbell", cable: "cable", band: "cable",
  machine: "machine", plate_loaded: "machine", smith: "machine", bodyweight: "plate", suspension: "plate", assisted: "assisted",
};

export const ENGINE_SETUP: Record<Gear, SetupType> = {
  barbell: "free", ez_bar: "free", trap_bar: "free", dumbbell: "free", kettlebell: "free", cable: "free", band: "free",
  machine: "free", plate_loaded: "free", smith: "free", bodyweight: "bodyweight_plus_added", suspension: "bodyweight_plus_added", assisted: "assisted",
};

export type CeilingClass = "upper" | "lower" | "lateral_raise";

/** A library exercise with its picker metadata. */
export interface CatalogEntry extends SeedExercise {
  muscle: Muscle;
  gear: Gear;
  /** Which default rep ceiling applies (10 upper, 12 legs, 15 lateral raise). Must agree with the engine's name classifier (tested). */
  ceilingClass: CeilingClass;
  /** Every Arabic name and alias in the library is a draft until two native reviewers sign off. */
  draftAr: true;
}

const LOWER_MUSCLES: Muscle[] = ["quads", "hamstrings", "glutes", "calves", "adductors", "abductors", "hip_flexors"];

const LOWER_PATTERNS = ["squat", "hinge", "knee_extension", "knee_flexion", "calf"];

const GEAR_AR: Record<Gear, string> = {
  barbell: "بالبار", ez_bar: "بالبار (EZ)", trap_bar: "بالترب بار", dumbbell: "بالدمبل", kettlebell: "بالكيتل بيل", cable: "كابل", band: "بالأستيك",
  machine: "ماكينة", plate_loaded: "ماكينة بالأطباق", smith: "سميث", bodyweight: "", suspension: "(TRX)", assisted: "بمساعدة الجهاز",
};

/**
 * One row: [English name (Hevy style), gear, primary muscle, movement pattern, Arabic base, extra Arabic aliases "a|b"].
 * The Arabic name is the base plus the gear word ("=" in front of the base means: use as written). The base alone is always an alias.
 * ALL ARABIC IS DRAFT. Aliases are spellings and short forms, not slang heard in a particular gym.
 */
export type Row = [en: string, gear: Gear, muscle: Muscle, pattern: string, ar: string, aliases?: string];

export function slug(en: string): string {
  return en.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function build(rows: Row[], ceilingOverride: Record<string, CeilingClass> = {}): CatalogEntry[] {
  return rows.map(([en, gear, muscle, pattern, arBase, aliases]) => {
    const key = slug(en);
    const asWritten = arBase.startsWith("=");
    const base = asWritten ? arBase.slice(1) : arBase;
    const ar = asWritten || GEAR_AR[gear] === "" ? base : `${base} ${GEAR_AR[gear]}`;
    const al = [...(base !== ar ? [base] : []), ...(aliases ? aliases.split("|") : [])];
    const lateral = muscle === "side_delts" && /(lateral|side) raise/i.test(en);
    const ceilingClass: CeilingClass = ceilingOverride[key] ?? (lateral ? "lateral_raise" : LOWER_MUSCLES.includes(muscle) || LOWER_PATTERNS.includes(pattern) ? "lower" : "upper");
    return { key, en, ar, aliasesAr: al.length ? al : [ar], pattern, equipment: ENGINE_EQUIPMENT[gear], setup: ENGINE_SETUP[gear], muscle, gear, ceilingClass, draftAr: true as const };
  });
}
