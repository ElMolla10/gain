/** Shared types for the Next Set progression engine. Pure data, JSON-serialisable. All loads are kilograms. */

export type EquipmentType = "dumbbell" | "barbell" | "plate" | "cable" | "machine" | "assisted";
export type SetupType = "free" | "assisted" | "bodyweight_plus_added";
export type Currency = "reps" | "effort" | "quality" | "load" | "none";
export type QualityChange = "pause" | "slow_eccentric" | "extra_set";
export type OutlierStatus = "none" | "unconfirmed" | "confirmed" | "rejected";
export type Confidence = "none" | "low" | "medium" | "high";

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
export type PresetName = "double_progression" | "acsm_2009" | "two_for_two";

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
  /** Sessions in a row below the bottom of the range, at the same load, before stepping the load down one real step. */
  stepDownAfterMisses?: number;
  /** Partial overrides, or null to switch stall handling off for this lift. */
  stall?: Partial<StallConfig> | null;
}

export interface LiftProgression {
  bodyRegion: BodyRegion;
  trigger: TriggerConfig;
  increment: IncrementConfig;
  stepDownAfterMisses: number;
  stall: StallConfig | null;
}

export interface ExerciseSpec {
  exerciseId: string;
  equipment: EquipmentType;
  setup: SetupType;
  repRange: RepRange;
  /** Chooses the default load-step band (upper 2-5%, lower 5-10%). Defaults to upper. */
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
  | "no_gym_loads";

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
  lineKey: string;
  line: LineIdentity;
  asOf: string;
  repRange: RepRange;
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
