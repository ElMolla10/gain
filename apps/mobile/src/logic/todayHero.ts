/**
 * Today 10x, "Today's Bar" (spec §1.1): what the hero draws for the lead lift. Pure. All plate math goes through the engine helpers
 * (barbellPlates / calculatePlates / platesOf / generateWarmups via warmupOffer); nothing here divides loads by hand. When the plates
 * cannot make the shown load exactly (or there is no gym spec), the hero falls back to the number only: plates never lie about a load.
 */
import { barbellPlates, calculatePlates, platesOf, specForExercise, type EquipmentType, type GymFingerprint, type GymLoadSpec, type Measure, type PlateCalc, type SetupType } from "@gain/engine";
import { isIsolationPattern, warmupOffer, warmupsUsuallySkipped } from "./warmups";

export interface HeroWarmupStep {
  load: number;
  reps: number;
  /** Plates on one side for this step (heaviest first); [] = the empty bar. */
  perSide: number[];
}

interface HeroBase {
  exerciseId: string;
  nameEn: string;
  nameAr: string;
  isGoal: boolean;
  measure: Measure;
  reps: number | null;
  durationS: number | null;
  distanceM: number | null;
}

export type TodayHero =
  | (HeroBase & { kind: "barbell"; load: number; calc: PlateCalc; ghost: number[] | null; normalLoad: number | null; warmups: HeroWarmupStep[]; skippedHint: boolean })
  | (HeroBase & { kind: "dumbbell"; load: number })
  | (HeroBase & { kind: "stack"; load: number; pinIndex: number | null })
  | (HeroBase & { kind: "assisted"; load: number; pinIndex: number | null })
  /** Plate-loaded machine: the load is the TOTAL on the machine, drawn half per horn (Mohamed, 2026-10-18). */
  | (HeroBase & { kind: "horn"; load: number; perSide: number[] })
  | (HeroBase & { kind: "belt"; added: number; plates: number[] })
  | (HeroBase & { kind: "hold"; load: number; object: "dumbbell" | "bar" | "none" })
  /** The number only: no gym, no spec, or plates that cannot make this load. */
  | (HeroBase & { kind: "noGym"; load: number; reason: "no_gym" | "no_spec" | "not_loadable" })
  | { kind: "firstRun" };

export interface HeroTarget {
  exerciseId: string;
  load: number | null;
  reps: number | null;
  measure: Measure;
  durationS?: number | null;
  distanceM?: number | null;
}

export interface HeroExercise {
  exerciseId: string;
  nameEn: string;
  nameAr: string;
  equipment: EquipmentType;
  setup: SetupType;
  measure: Measure;
  pattern?: string;
  loadSpec?: GymLoadSpec | null;
  isGoalLift: boolean;
}

export interface HeroInput {
  target: HeroTarget | null;
  exercise: HeroExercise | null;
  gym: GymFingerprint | null;
  /** The normal (un-deloaded) load when a lighter week scaled this one (applyLoadDeload). */
  normalLoad?: number | null;
  /** 0-based position of the exercise in today's order (for "usually skipped here"). */
  position?: number;
  /** The starter programme with no numbers yet: the first-run bar. */
  isSample?: boolean;
}

const EPS = 1e-6;

/** 1-based position of `load` on the spec's grid (a `loads` list or min + n·increment); null when the grid is unknown or the load is off it. */
export function pinIndex(spec: GymLoadSpec | null, load: number): number | null {
  if (!spec) return null;
  if (spec.loads && spec.loads.length > 0) {
    const sorted = [...spec.loads].sort((a, b) => a - b);
    const i = sorted.findIndex((l) => Math.abs(l - load) < 1e-3);
    return i >= 0 ? i + 1 : null;
  }
  if (spec.min === undefined || !(spec.increment && spec.increment > 0)) return null;
  const steps = (load - spec.min) / spec.increment;
  const n = Math.round(steps);
  return Math.abs(n - steps) < 1e-3 && n >= 0 ? n + 1 : null;
}

export function todayHero(input: HeroInput): TodayHero | null {
  const { target, exercise } = input;
  if (!target || target.load === null || !exercise) return input.isSample ? { kind: "firstRun" } : null;
  const load = target.load;
  const base: HeroBase = {
    exerciseId: exercise.exerciseId,
    nameEn: exercise.nameEn,
    nameAr: exercise.nameAr,
    isGoal: exercise.isGoalLift,
    measure: target.measure,
    reps: target.reps,
    durationS: target.durationS ?? null,
    distanceM: target.distanceM ?? null,
  };
  if (!input.gym) return { ...base, kind: "noGym", load, reason: "no_gym" };
  const spec = specForExercise(input.gym, { equipment: exercise.equipment, loadOverride: exercise.loadSpec ?? null });
  if (!spec) return { ...base, kind: "noGym", load, reason: "no_spec" };
  const numberOnly = { ...base, kind: "noGym" as const, load, reason: "not_loadable" as const };

  if (target.measure !== "reps") {
    return { ...base, kind: "hold", load, object: exercise.equipment === "dumbbell" ? "dumbbell" : exercise.equipment === "barbell" ? "bar" : "none" };
  }
  if (exercise.setup === "bodyweight_plus_added") {
    if (!(load > EPS)) return numberOnly;
    // Plates that sum to the added load: calculatePlates of twice the load on a zero bar gives one side = the load.
    const calc = calculatePlates(2 * load, 0, platesOf(spec));
    return calc && calc.exact && calc.perSide.length > 0 ? { ...base, kind: "belt", added: load, plates: calc.perSide } : numberOnly;
  }
  if (exercise.setup === "assisted" || exercise.equipment === "assisted") return { ...base, kind: "assisted", load, pinIndex: pinIndex(spec, load) };
  if (exercise.equipment === "barbell") {
    const calc = barbellPlates(spec, load);
    if (!calc) return numberOnly;
    const normal = input.normalLoad != null && input.normalLoad > load + EPS ? input.normalLoad : null;
    const ghost = normal !== null ? barbellPlates(spec, normal)?.perSide ?? null : null;
    const offer = warmupOffer({ workingLoad: calc.load, spec, setup: exercise.setup, loggedToday: 0, isolation: isIsolationPattern(exercise.pattern) });
    const warmups =
      offer.kind === "offer"
        ? offer.sets.map((s) => ({ load: s.load, reps: s.reps, perSide: barbellPlates(spec, s.load)?.perSide ?? [] }))
        : [];
    return { ...base, kind: "barbell", load, calc, ghost, normalLoad: normal, warmups, skippedHint: warmupsUsuallySkipped(input.position ?? 0, exercise.pattern) };
  }
  if (exercise.equipment === "plate") {
    // The machine's load is the total; calculatePlates on a zero "bar" splits it half per horn.
    const calc = calculatePlates(load, 0, platesOf(spec));
    return calc && calc.exact && calc.perSide.length > 0 ? { ...base, kind: "horn", load, perSide: calc.perSide } : numberOnly;
  }
  if (exercise.equipment === "dumbbell") return { ...base, kind: "dumbbell", load };
  return { ...base, kind: "stack", load, pinIndex: pinIndex(spec, load) };
}
