import type {
  BodyRegion,
  CeilingClass,
  IncrementConfig,
  OversizedStep,
  LiftProgression,
  LiftProgressionConfig,
  PresetName,
  RepCeilings,
  StallConfig,
  TriggerConfig,
} from "./types";

/**
 * Progression policy. DEFAULT RULE is BASED ON the ACSM 2009 position stand (Ratamess et al., "Progression Models in Resistance Training for
 * Healthy Adults", grade B): raise the load 2-10% when the lifter can do the target. It is not a literal implementation: the rep ceilings,
 * the one-session trigger and the snapping to standard steps are GAIN conventions.
 * The target is the lift's REP CEILING, which is the lifter's own configuration on top (10 upper, 12 legs, 15 lateral raises) and
 * a single session reaching it is enough. Everything else (RIR fast track, stall deload, step-down) is off by default and only
 * available as opt-in conventions. See docs/PROGRESSION-RULES.md.
 */

/** ACSM 2009: 2-10% load increase, for every body region. */
export const ACSM_INCREMENT: IncrementConfig = { minPct: 0.02, maxPct: 0.1 };

/** Convention, opt-in via the `coaching_conventions` preset: upper 2-5%, lower 5-10% (NASM wording, inside ACSM's 2-10%). */
export const INCREMENT_BY_REGION: Record<BodyRegion, IncrementConfig> = {
  upper: { minPct: 0.02, maxPct: 0.05 },
  lower: { minPct: 0.05, maxPct: 0.1 },
};

/** The lifter's own ceilings: reps the weakest working set must reach before load goes up. Not from a study. */
export const DEFAULT_REP_CEILINGS: RepCeilings = { upper: 10, lower: 12, lateral_raise: 15 };

/** Default trigger: the weakest working set at the current load reaches the ceiling, once. */
export const DEFAULT_TRIGGER: TriggerConfig = {
  extraReps: 0,
  sessions: 1,
  repsBasis: "all_sets",
  fastTrackRir: null,
};

export const DEFAULT_PRESET: PresetName = "acsm_2009";

/** Opt-in convention (not default): after this many sessions at one load with no rep gain, deload. */
export const DEFAULT_STALL: StallConfig = { sessions: 4, deloadPct: 0.1 };
/** Opt-in convention (not default): step the load down after this many sessions below the bottom of the range. */
export const DEFAULT_STEP_DOWN_AFTER_MISSES = 3;

export interface Preset {
  trigger: Partial<TriggerConfig>;
  increment?: Partial<IncrementConfig>;
  /** Use the upper 2-5% / lower 5-10% bands instead of one band for everyone. */
  regionBands?: boolean;
  /** Default `load`: at the ceiling an oversized real step is still proposed. */
  oversizedStep?: OversizedStep;
  stepDownAfterMisses?: number | null;
  stall?: Partial<StallConfig> | null;
}

export const PRESETS: Record<PresetName, Preset> = {
  /**
   * DEFAULT. ACSM 2009: raise load 2-10% when the target is reached. Target = the lift's rep ceiling.
   * Deviation from the ACSM wording, by the lifter's choice: reaching the ceiling once is enough (ACSM: 1-2 reps over, two consecutive sessions).
   */
  acsm_2009: { trigger: { extraReps: 0, sessions: 1, repsBasis: "all_sets", fastTrackRir: null } },
  /** ACSM 2009 as literally worded: 1-2 reps over the desired number on two consecutive sessions (lower bound, 1 rep, used). */
  acsm_2009_strict: { trigger: { extraReps: 1, sessions: 2, repsBasis: "all_sets", fastTrackRir: null } },
  /** Convention: add load the first time every set reaches the ceiling. Same trigger as the default; kept as a named alias. */
  double_progression: { trigger: { extraReps: 0, sessions: 1 } },
  /** The 2-for-2 rule as worded by Suchomel et al. 2021: >=2 reps over the goal on the LAST set, two consecutive sessions. */
  two_for_two: { trigger: { extraReps: 2, sessions: 2, repsBasis: "last_set" } },
  /**
   * Convention bundle from the earlier rule-v0.2 draft, all opt-in: two sessions at the top, RIR fast track (3), region step bands
   * (upper 2-5%, lower 5-10%), 4-session stall deload (10%), step down after 3 misses. None of these has controlled evidence.
   */
  coaching_conventions: {
    trigger: { extraReps: 0, sessions: 2, repsBasis: "all_sets", fastTrackRir: 3 },
    regionBands: true,
    oversizedStep: "spend_first",
    stepDownAfterMisses: DEFAULT_STEP_DOWN_AFTER_MISSES,
    stall: DEFAULT_STALL,
  },
};

export interface ClassifiedLift {
  bodyRegion: BodyRegion;
  lateralRaise: boolean;
}

const norm = (name: string) =>
  name
    .toLowerCase()
    .replace(/[_\-/.,()\[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Lateral raise, any variant: dumbbell, cable, single-arm, machine, seated, "side raise". Rear-delt "reverse" variants are NOT lateral raises. Arabic: رفرفة جانبي / لاترال. */
const LATERAL_RAISE = /\b(lateral|side)\s+(delt\s+)?raises?\b|\blat\s+raises?\b|\bside\s+lateral\b|\braises?\s+lateral\b|رفرفة جانبي|لاترال/;
const NOT_LATERAL = /\b(reverse|rear|bent|incline\s+rear)\b/;

/**
 * Legs: squat (incl. hack, split, goblet, front), leg press/extension/curl/any "leg" move, lunge, RDL and every deadlift variant,
 * calf raise, hip thrust, glute anything, hamstring/quad/adductor/abductor, good morning, step-up, kettlebell swing, Nordic curl,
 * back extension, glute-band work, sleds, jumps, tibialis raise, hip flexor/circle work (v0.12.0 library names).
 * "Leg raise" (abs) is upper. Lat. Everything else is upper.
 */
const LOWER =
  /squat|\blegs?\b(?!\s+raises?)|\blunges?\b|deadlift|\brdl\b|romanian|hip thrust|\bglutes?\b|\bcalf\b|\bcalves\b|hamstring|\bquads?\b|quadricep|adductor|abductor|good morning|step up|kettlebell swing|nordic|hip extension|hip abduction|hip adduction|hip flexion|hip flexor|hip circle|back extension|hyperextension|pull through|frog pump|donkey|fire hydrant|clamshell|band walk|monster walk|copenhagen|wall sit|box jump|broad jump|jump squat|\bsled\b|rack pull|thruster|wall ball|tire flip|tibialis|standing knee raise|سكوات|ليج|سمانة|رجل|ديدلفت/;

/** Best-effort classification from an exercise name (Hevy imports have no muscle group). Lateral raise is checked by name first. */
export function classifyLift(name: string): ClassifiedLift {
  const n = norm(name);
  const lateralRaise = LATERAL_RAISE.test(n) && !NOT_LATERAL.test(n);
  if (lateralRaise) return { bodyRegion: "upper", lateralRaise: true };
  return { bodyRegion: LOWER.test(n) ? "lower" : "upper", lateralRaise: false };
}

export function isLateralRaise(name: string): boolean {
  return classifyLift(name).lateralRaise;
}

/** Best-effort body region from an exercise name. */
export function bodyRegionFromTitle(title: string): BodyRegion {
  return classifyLift(title).bodyRegion;
}

export function validateRepCeiling(n: number, what = "repCeiling"): void {
  if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error(`${what} must be an integer between 1 and 100`);
}

/** App-wide defaults, optionally edited by the lifter (settings), merged over the built-in ceilings and validated. */
export function mergeRepCeilings(over?: Partial<RepCeilings> | null): RepCeilings {
  const out: RepCeilings = { ...DEFAULT_REP_CEILINGS, ...(over ?? {}) };
  for (const k of Object.keys(out) as CeilingClass[]) validateRepCeiling(out[k], `repCeilings.${k}`);
  return out;
}

export interface ResolveOptions {
  /** Exercise name (or id) used to find the default ceiling class. */
  name?: string;
  /** Edited app-wide default ceilings. */
  ceilings?: Partial<RepCeilings> | null;
}

/** The default ceiling class for a lift. An explicit body region wins; a lateral-raise name makes an upper-body lift a lateral raise. */
export function ceilingClassOf(region: BodyRegion | undefined, name?: string): CeilingClass {
  const c = name ? classifyLift(name) : { bodyRegion: "upper" as BodyRegion, lateralRaise: false };
  const r = region ?? c.bodyRegion;
  return r === "upper" && c.lateralRaise ? "lateral_raise" : r;
}

export function resolveProgression(region: BodyRegion = "upper", cfg: LiftProgressionConfig = {}, opts: ResolveOptions = {}): LiftProgression {
  const presetName = cfg.preset ?? DEFAULT_PRESET;
  const preset = PRESETS[presetName];
  if (!preset) throw new Error(`unknown progression preset: ${cfg.preset}`);
  const trigger: TriggerConfig = { ...DEFAULT_TRIGGER, ...preset.trigger, ...cfg.trigger };
  const base = preset.regionBands ? INCREMENT_BY_REGION[region] : ACSM_INCREMENT;
  const increment: IncrementConfig = { ...base, ...preset.increment, ...cfg.increment };
  const oversizedStep: OversizedStep = cfg.oversizedStep ?? preset.oversizedStep ?? "load";
  if (oversizedStep !== "load" && oversizedStep !== "spend_first") throw new Error("oversizedStep must be load or spend_first");
  const stallCfg = cfg.stall === undefined ? preset.stall : cfg.stall;
  const stall: StallConfig | null = stallCfg === null || stallCfg === undefined ? null : { ...DEFAULT_STALL, ...stallCfg };
  const stepDownAfterMisses = cfg.stepDownAfterMisses === undefined ? (preset.stepDownAfterMisses ?? null) : cfg.stepDownAfterMisses;

  if (!Number.isInteger(trigger.sessions) || trigger.sessions < 1) throw new Error("trigger.sessions must be an integer >= 1");
  if (!(trigger.extraReps >= 0)) throw new Error("trigger.extraReps must be >= 0");
  if (trigger.fastTrackRir !== null && !(trigger.fastTrackRir >= 1)) throw new Error("trigger.fastTrackRir must be null or >= 1");
  if (!(increment.minPct >= 0) || !(increment.maxPct >= increment.minPct)) throw new Error("increment needs 0 <= minPct <= maxPct");
  if (stepDownAfterMisses !== null && (!Number.isInteger(stepDownAfterMisses) || stepDownAfterMisses < 1))
    throw new Error("stepDownAfterMisses must be null or an integer >= 1");
  if (stall && (!Number.isInteger(stall.sessions) || stall.sessions < 2 || !(stall.deloadPct > 0 && stall.deloadPct < 0.5)))
    throw new Error("stall needs sessions >= 2 and 0 < deloadPct < 0.5");

  const ceilingClass = ceilingClassOf(region, opts.name);
  const ceilings = mergeRepCeilings(opts.ceilings);
  if (cfg.repCeiling !== undefined) validateRepCeiling(cfg.repCeiling);
  const repCeiling = cfg.repCeiling ?? ceilings[ceilingClass];
  return {
    preset: presetName,
    bodyRegion: region,
    ceilingClass,
    repCeiling,
    ceilingSource: cfg.repCeiling !== undefined ? "lift" : "default",
    trigger,
    increment,
    oversizedStep,
    stepDownAfterMisses,
    stall,
  };
}
