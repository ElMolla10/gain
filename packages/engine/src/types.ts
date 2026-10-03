/** Shared types for the Next Set progression engine. Pure data, JSON-serialisable. All loads are kilograms. */

export type EquipmentType = "dumbbell" | "barbell" | "plate" | "cable" | "machine" | "assisted";
export type SetupType = "free" | "assisted" | "bodyweight_plus_added";
export type Currency = "reps" | "effort" | "quality" | "load" | "none";
export type QualityChange = "pause" | "slow_eccentric" | "extra_set";
export type OutlierStatus = "none" | "unconfirmed" | "confirmed" | "rejected";
export type Confidence = "none" | "low" | "medium" | "high";
/**
 * What an exercise is counted in. `reps` (default): load x reps. `time`: a hold, in seconds (plank, dead hang, wall sit), optional added load.
 * `distance`: metres carried or walked (farmer's walk), with the load carried. See timed.ts.
 */
export type Measure = "reps" | "time" | "distance";

/**
 * What loads exist for one equipment type in one gym.
 * Either an explicit `loads` list (e.g. the dumbbell pairs on the rack) or an `increment` grid
 * (barbell 2.5 / 1.25, cable stack jump 5) starting at `min` and optionally capped at `max`.
 */
export interface GymLoadSpec {
  equipment: EquipmentType;
  loads?: number[];
  increment?: number;
  /** First rung of an increment grid (e.g. 20 for an Olympic bar). Defaults to `increment` (0 for assisted). */
  min?: number;
  max?: number;
}

export interface GymFingerprint {
  gymId: string;
  loads: GymLoadSpec[];
}

/** One history stream: exercise + gym + setup. Streams never mix. */
export interface LineIdentity {
  exerciseId: string;
  gymId: string;
  setup: SetupType;
}

export interface LoggedSet {
  /** Measure "time" sets: seconds held. `reps` is 1 for a timed or distance set (one hold / one carry), so reps-based code never divides by zero. */
  durationS?: number | null;
  /** Measure "distance" sets: metres. */
  distanceM?: number | null;
  /** Free: bar/dumbbell/stack load. Assisted: assistance removed (less = harder). Bodyweight_plus_added: added load. */
  load: number;
  reps: number;
  /** Optional reps in reserve. */
  rir?: number | null;
  warmup?: boolean;
  /** e.g. "drop", "failure", "superset", "pause", "slow_eccentric", "extra_set" */
  tags?: string[];
  outlierStatus?: OutlierStatus;
}

export interface HistorySession {
  line: LineIdentity;
  /** ISO date or datetime. */
  performedAt: string;
  sets: LoggedSet[];
}

export interface RepRange {
  min: number;
  max: number;
}

export type BodyRegion = "upper" | "lower";
/**
 * Presets. `acsm_2009` is the DEFAULT (ACSM 2009 position stand, 2-10% when the target is reached; target = the lift's rep ceiling).
 * The others are alternatives; `coaching_conventions` bundles the extra conventions of the earlier rule-v0.2 draft (opt-in).
 */
export type PresetName = "acsm_2009" | "acsm_2009_strict" | "double_progression" | "two_for_two" | "coaching_conventions";

/** What kind of lift decides the default rep ceiling. */
export type CeilingClass = "upper" | "lower" | "lateral_raise";
/** Reps at which the load goes up, per kind of lift. Editable as app-wide defaults and overridable per lift (`LiftProgressionConfig.repCeiling`). */
export type RepCeilings = Record<CeilingClass, number>;

/** When is a lift "ready" for more load? See docs/PROGRESSION-RULES.md for which parts are evidence and which are convention. */
export interface TriggerConfig {
  /** Reps beyond the TOP of the rep range needed to count a session as qualifying (0 = reached the top; ACSM says 1-2 over; 2-for-2 says 2). */
  extraReps: number;
  /** Consecutive qualifying sessions at the same load before load goes up (ACSM and 2-for-2: 2). */
  sessions: number;
  /** all_sets: the weakest working set at the top load must qualify. last_set: only the final set (the published 2-for-2 wording). */
  repsBasis: "all_sets" | "last_set";
  /** If reps in reserve are logged and the qualifying session left at least this many in reserve, one session is enough. null = off. */
  fastTrackRir: number | null;
}

/** Share of the current load a real load step should be, as fractions (0.02 = 2%). */
export interface IncrementConfig {
  minPct: number;
  maxPct: number;
}

/**
 * What to do at the ceiling when even the smallest real load step is bigger than the band's max (e.g. a 2.5 kg dumbbell jump at light loads).
 * `load` (default): propose the load increase anyway; the lifter earned it and nothing smaller exists. `spend_first`: spend effort / quality first (opt-in convention).
 */
export type OversizedStep = "load" | "spend_first";

export interface StallConfig {
  /** Sessions at one load with no rep gain before a deload is proposed. */
  sessions: number;
  /** How much lighter the deload load is, as a fraction of the current load (snapped to a load that exists). */
  deloadPct: number;
}

/** Per-lift progression policy, resolved from a body-region default, an optional named preset, and explicit overrides (in that order). */
export interface LiftProgressionConfig {
  preset?: PresetName;
  trigger?: Partial<TriggerConfig>;
  increment?: Partial<IncrementConfig>;
  /** Oversized real step at the ceiling (bigger than `increment.maxPct`). Omitted = the preset's choice; default `load`. */
  oversizedStep?: OversizedStep;
  /** Sessions in a row below the bottom of the range, at the same load, before stepping the load down one real step. null = off (default). */
  stepDownAfterMisses?: number | null;
  /** Partial overrides, or null to switch stall handling off for this lift (default: off). */
  stall?: Partial<StallConfig> | null;
  /**
   * THE REP CEILING for this lift: the reps the weakest working set must reach before load goes up. Replaces the top of `repRange`.
   * Omitted = the default for the kind of lift (upper 10, legs 12, lateral raises 15; see `DEFAULT_REP_CEILINGS`).
   */
  repCeiling?: number;
}

export interface LiftProgression {
  preset: PresetName;
  bodyRegion: BodyRegion;
  /** Which default ceiling applies (lateral raises are an upper-body exception). */
  ceilingClass: CeilingClass;
  /** The resolved rep ceiling: reps the weakest working set must reach to earn more load. */
  repCeiling: number;
  /** "lift" = set on this lift; "default" = the default for its kind of lift. */
  ceilingSource: "lift" | "default";
  trigger: TriggerConfig;
  increment: IncrementConfig;
  oversizedStep: OversizedStep;
  stepDownAfterMisses: number | null;
  stall: StallConfig | null;
}

export interface ExerciseSpec {
  exerciseId: string;
  /** Display name (e.g. "Lateral Raise (Cable)"). Used to classify the lift for its default rep ceiling; falls back to exerciseId. */
  name?: string;
  equipment: EquipmentType;
  setup: SetupType;
  repRange: RepRange;
  /** Upper or lower body. Chooses the default rep ceiling (10 / 12). Defaults to a guess from the name, else upper. */
  bodyRegion?: BodyRegion;
  /** Per-lift progression policy overrides. */
  progression?: LiftProgressionConfig;
  /** Goal lifts may get an extra set as a quality change. */
  isGoalLift?: boolean;
  /** The user tracks reps in reserve for this lift. */
  trackEffort?: boolean;
  /** Quality changes allowed, in preference order. Defaults to pause, slow_eccentric (+ extra_set for goal lifts). */
  qualityOptions?: QualityChange[];
  /** Planned working sets (informational; extra_set adds one). */
  plannedSets?: number;
  /** How the exercise is counted. Omitted = reps. For time / distance, `repRange` is read as seconds / metres. */
  measure?: Measure;
}

export interface RejectionRecord {
  lineKey: string;
  jumpKind: string;
  count: number;
  lastRejectedAt: string;
}

export interface RejectionMemory {
  records: RejectionRecord[];
}

export interface ReasonText {
  key: ReasonKey;
  params: Record<string, string | number>;
}

export type ReasonKey =
  | "reps_in_range"
  | "reps_rebuild"
  | "effort_harder"
  | "quality_change"
  | "load_up"
  | "step_down"
  | "stall_deload"
  | "confirm_top_of_range"
  | "hold_jump_declined"
  | "hold_no_heavier_load"
  | "hold_assisted_floor"
  | "low_confidence_repeat"
  | "no_history"
  | "no_gym_loads"
  | "timed_longer"
  | "timed_rebuild"
  | "timed_repeat"
  | "timed_confirm"
  | "timed_load_up"
  | "timed_hold_top"
  | "timed_hold_declined";

export type NeedsModelReason =
  | "low_confidence"
  | "single_session"
  | "stale_history"
  | "high_variance"
  | "pending_outlier"
  | "anchor_off_gym_loads";

/**
 * Flag for cases where the rule is unsure. In this version nothing calls a model;
 * a later layer may read this and offer a model-written estimate, which still has to be accepted by the user.
 */
export interface NeedsModel {
  needed: boolean;
  reasons: NeedsModelReason[];
}

export interface SessionSummary {
  performedAt: string;
  topLoad: number;
  /** Minimum reps across working sets at the top load (conservative). */
  repsAtTop: number;
  /** Reps of the final working set at the top load (the 2-for-2 rule is worded on the last set). */
  lastSetReps: number;
  setsAtTop: number;
  /** Lowest RIR logged at the top load, if any. */
  rir: number | null;
  tags: string[];
}

export interface DecisionInputs {
  /** Omitted = reps. For time / distance exercises `repRange` is the seconds / metres range and `SessionSummary.repsAtTop` is the weakest set's seconds / metres. */
  measure?: Measure;
  lineKey: string;
  line: LineIdentity;
  asOf: string;
  /** The range the rule USED: its top is the rep ceiling (the lift's own, else the app-wide default for its kind). */
  repRange: RepRange;
  /** The range the programme asked for, before the ceiling replaced its top. Absent in decisions stored before the fixes release. */
  programmeRepRange?: RepRange;
  isGoalLift: boolean;
  trackEffort: boolean;
  bodyweightKg: number | null;
  /** Most recent comparable sessions used, newest first (max 3). */
  sessions: SessionSummary[];
  excluded: {
    incomparableSessions: number;
    warmupSets: number;
    dropSets: number;
    unconfirmedOutlierSets: number;
  };
  gym: {
    equipment: EquipmentType;
    anchorLoad: number | null;
    anchorOnGymLoads: boolean | null;
    nextHarderLoad: number | null;
    nextEasierLoad: number | null;
    jump: number | null;
    jumpRatio: number | null;
    jumpTooBig: boolean | null;
    maxJumpRatio: number;
    minJumpRatio: number;
  };
  /** The resolved policy and how close the lift is to earning more load. */
  policy: LiftProgression;
  readiness: {
    /** Reps a session must reach at the top load to count (top of range + extraReps). */
    targetReps: number;
    qualifyingSessions: number;
    requiredSessions: number;
    fastTracked: boolean;
    stalled: boolean;
  };
  rejections: { jumpKind: string; count: number; blocked: boolean }[];
  confidenceFactors: string[];
}

export interface Proposal {
  status: "proposed" | "no_history" | "no_gym_loads";
  load: number | null;
  reps: number | null;
  /** Time exercises: target seconds per set (reps is null then). */
  durationS?: number | null;
  /** Distance exercises: target metres per set (reps is null then). */
  distanceM?: number | null;
  /** Reps in reserve to aim for, when effort is the currency spent. */
  targetRir: number | null;
  quality: QualityChange | null;
  sets: number | null;
  currency: Currency;
  /** Identifies the kind of jump so rejection memory can count it. Null when nothing is proposed. */
  jumpKind: string | null;
  reason: ReasonText;
  confidence: Confidence;
  needsModel: NeedsModel;
  ruleVersion: string;
  inputs: DecisionInputs;
  warnings: string[];
}
