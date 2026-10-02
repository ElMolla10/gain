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

export interface ExerciseSpec {
  exerciseId: string;
  equipment: EquipmentType;
  setup: SetupType;
  repRange: RepRange;
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
