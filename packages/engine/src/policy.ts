import type { BodyRegion, IncrementConfig, LiftProgression, LiftProgressionConfig, PresetName, StallConfig, TriggerConfig } from "./types";

/**
 * Progression policy. Every number here is labelled in docs/PROGRESSION-RULES.md as EVIDENCE (published, with the grade the
 * source gives it) or CONVENTION (widely used coaching practice, no controlled evidence found). Nothing here was tuned on
 * any one lifter's history.
 */

/** Default load-step band per body region. Upper 2-5% and lower 5-10% are coaching convention (NASM, CSCS texts); the outer 2-10% envelope is ACSM 2009 (grade B). */
export const INCREMENT_BY_REGION: Record<BodyRegion, IncrementConfig> = {
  upper: { minPct: 0.02, maxPct: 0.05 },
  lower: { minPct: 0.05, maxPct: 0.1 },
};

export const DEFAULT_TRIGGER: TriggerConfig = {
  extraReps: 0,
  sessions: 2,
  repsBasis: "all_sets",
  fastTrackRir: 3,
};

export const DEFAULT_STALL: StallConfig = { sessions: 4, deloadPct: 0.1 };
export const DEFAULT_STEP_DOWN_AFTER_MISSES = 3;

export interface Preset {
  trigger: Partial<TriggerConfig>;
  increment?: Partial<IncrementConfig>;
}

export const PRESETS: Record<PresetName, Preset> = {
  /** Convention: add load the first time every set reaches the top of the range. */
  double_progression: { trigger: { extraReps: 0, sessions: 1 } },
  /** ACSM 2009: 1-2 reps over the target on two consecutive sessions, 2-10% more load. Lower bound of the 1-2 reps used. */
  acsm_2009: { trigger: { extraReps: 1, sessions: 2 }, increment: { minPct: 0.02, maxPct: 0.1 } },
  /** The 2-for-2 rule as worded by Suchomel et al. 2021: >=2 reps over the goal on the LAST set, two consecutive sessions. */
  two_for_two: { trigger: { extraReps: 2, sessions: 2, repsBasis: "last_set" } },
};

export function resolveProgression(region: BodyRegion = "upper", cfg: LiftProgressionConfig = {}): LiftProgression {
  const preset = cfg.preset ? PRESETS[cfg.preset] : undefined;
  if (cfg.preset && !preset) throw new Error(`unknown progression preset: ${cfg.preset}`);
  const trigger: TriggerConfig = { ...DEFAULT_TRIGGER, ...preset?.trigger, ...cfg.trigger };
  const increment: IncrementConfig = { ...INCREMENT_BY_REGION[region], ...preset?.increment, ...cfg.increment };
  const stall: StallConfig | null = cfg.stall === null ? null : { ...DEFAULT_STALL, ...cfg.stall };
  const stepDownAfterMisses = cfg.stepDownAfterMisses ?? DEFAULT_STEP_DOWN_AFTER_MISSES;

  if (!Number.isInteger(trigger.sessions) || trigger.sessions < 1) throw new Error("trigger.sessions must be an integer >= 1");
  if (!(trigger.extraReps >= 0)) throw new Error("trigger.extraReps must be >= 0");
  if (trigger.fastTrackRir !== null && !(trigger.fastTrackRir >= 1)) throw new Error("trigger.fastTrackRir must be null or >= 1");
  if (!(increment.minPct >= 0) || !(increment.maxPct >= increment.minPct)) throw new Error("increment needs 0 <= minPct <= maxPct");
  if (!Number.isInteger(stepDownAfterMisses) || stepDownAfterMisses < 1) throw new Error("stepDownAfterMisses must be an integer >= 1");
  if (stall && (!Number.isInteger(stall.sessions) || stall.sessions < 2 || !(stall.deloadPct > 0 && stall.deloadPct < 0.5)))
    throw new Error("stall needs sessions >= 2 and 0 < deloadPct < 0.5");
  return { bodyRegion: region, trigger, increment, stepDownAfterMisses, stall };
}

const LOWER = /squat|leg |lunge|deadlift|hip thrust|glute|calf|hack|romanian|rdl|good morning|step.?up|hamstring|quad|adductor|abductor/i;

/** Best-effort body region from an exercise name (used by the Hevy backtest, where the export has no muscle group). */
export function bodyRegionFromTitle(title: string): BodyRegion {
  return LOWER.test(title) ? "lower" : "upper";
}
