import { RULE_VERSION } from "./version";
import { effectiveLoad, epley, lineKey, sortNewestFirst, splitComparable } from "./line";
import { isTrustedWorkingSet } from "./outlier";
import { findSpec, nextLoadAbove, nextLoadBelow, norm, roundToGymLoad, allowsZero } from "./loads";
import { isJumpBlocked, recordsForLine, REJECTION_THRESHOLD, rejectionCount, emptyRejectionMemory } from "./rejection";
import type {
  Confidence,
  Currency,
  DecisionInputs,
  ExerciseSpec,
  GymFingerprint,
  HistorySession,
  LineIdentity,
  NeedsModelReason,
  Proposal,
  QualityChange,
  ReasonText,
  RejectionMemory,
  SessionSummary,
} from "./types";

export interface ProgressionOptions {
  /** A load step bigger than this share of the current load is "too big": spend reps/effort/quality first. */
  maxJumpRatio: number;
  /** History older than this many days lowers confidence. */
  staleDays: number;
  /** Never ask for fewer reps in reserve than this (recommendations do not require failure). */
  rirFloor: number;
  /** Sessions in a row below the bottom of the range, at the same load, before stepping the load down. */
  stepDownAfterMisses: number;
  rejectionThreshold: number;
  /** Coefficient of variation of recent top-set strength estimates above which confidence drops. */
  highVarianceCv: number;
}

export const DEFAULT_OPTIONS: ProgressionOptions = {
  maxJumpRatio: 0.05,
  staleDays: 28,
  rirFloor: 1,
  stepDownAfterMisses: 2,
  rejectionThreshold: REJECTION_THRESHOLD,
  highVarianceCv: 0.15,
};

export interface ProposeContext {
  exercise: ExerciseSpec;
  gym: GymFingerprint;
  history: HistorySession[];
  rejections?: RejectionMemory;
  /** ISO date "now" (explicit so results are reproducible). */
  asOf: string;
  bodyweightKg?: number | null;
  options?: Partial<ProgressionOptions>;
}

const DAY = 86_400_000;
const LEVELS: Confidence[] = ["low", "medium", "high"];

export const jumpKindLoad = (dir: "harder" | "easier", delta: number): string => `load:${dir}:${norm(delta)}`;
export const jumpKindEffort = (rir: number): string => `effort:rir${rir}`;
export const jumpKindQuality = (q: QualityChange): string => `quality:${q}`;

/** Per-session summary of the hardest trusted working load. Null when the session has no trusted working set. */
function summarize(
  s: HistorySession,
  setup: LineIdentity["setup"],
  counts: { warmup: number; drop: number; outlier: number },
): SessionSummary | null {
  for (const x of s.sets) {
    if (x.warmup) counts.warmup++;
    else if (x.tags?.includes("drop")) counts.drop++;
    else if (x.outlierStatus === "unconfirmed" || x.outlierStatus === "rejected") counts.outlier++;
  }
  const trusted = s.sets.filter((x) => isTrustedWorkingSet(x) && x.reps >= 1 && Number.isFinite(x.load));
  if (trusted.length === 0) return null;
  const harder = (a: number, b: number) => (setup === "assisted" ? a < b : a > b);
  let top = trusted[0]!.load;
  for (const x of trusted) if (harder(x.load, top)) top = x.load;
  const atTop = trusted.filter((x) => Math.abs(x.load - top) < 1e-6);
  const rirs = atTop.map((x) => x.rir).filter((r): r is number => typeof r === "number");
  const tags = [...new Set(atTop.flatMap((x) => x.tags ?? []))];
  return {
    performedAt: s.performedAt,
    topLoad: top,
    repsAtTop: Math.min(...atTop.map((x) => x.reps)),
    setsAtTop: atTop.length,
    rir: rirs.length ? Math.min(...rirs) : null,
    tags,
  };
}

function jumpBase(setup: LineIdentity["setup"], anchor: number, jump: number, bw: number | null | undefined): number {
  const eff = effectiveLoad(setup, anchor, bw);
  if (setup === "free") return anchor;
  if (eff !== null && eff > 0) return eff;
  return Math.max(anchor, jump); // bodyweight unknown: be conservative, never guess it
}

function lower(c: Confidence): Confidence {
  const i = LEVELS.indexOf(c);
  return LEVELS[Math.max(0, i - 1)] ?? "low";
}

export function proposeNext(ctx: ProposeContext): Proposal {
  const opt: ProgressionOptions = { ...DEFAULT_OPTIONS, ...ctx.options };
  const { exercise, gym } = ctx;
  const { min: lo, max: hi } = exercise.repRange;
  if (!(lo >= 1) || hi < lo) throw new Error("repRange must satisfy 1 <= min <= max");
  const rejections = ctx.rejections ?? emptyRejectionMemory();
  const setup = exercise.setup;
  const zero = allowsZero(setup);
  const line: LineIdentity = { exerciseId: exercise.exerciseId, gymId: gym.gymId, setup };
  const key = lineKey(line);
  const bw = ctx.bodyweightKg ?? null;
  const harderDir: "above" | "below" = setup === "assisted" ? "below" : "above";

  // 1. Only comparable history: same exercise, gym and setup. Everything else is excluded and counted.
  const { comparable, incomparable } = splitComparable(line, ctx.history);
  const counts = { warmup: 0, drop: 0, outlier: 0 };
  const sorted = sortNewestFirst(comparable);
  const summaries: SessionSummary[] = [];
  for (const s of sorted) {
    const sm = summarize(s, setup, counts);
    if (sm) summaries.push(sm);
  }
  const newestSession = sorted[0];
  const pendingOutlier = !!newestSession?.sets.some((x) => !x.warmup && x.outlierStatus === "unconfirmed");

  const spec = findSpec(gym, exercise.equipment);
  const emptyGym: DecisionInputs["gym"] = {
    equipment: exercise.equipment,
    anchorLoad: null,
    anchorOnGymLoads: null,
    nextHarderLoad: null,
    nextEasierLoad: null,
    jump: null,
    jumpRatio: null,
    jumpTooBig: null,
    maxJumpRatio: opt.maxJumpRatio,
  };
  const baseInputs = (): DecisionInputs => ({
    lineKey: key,
    line,
    asOf: ctx.asOf,
    repRange: exercise.repRange,
    isGoalLift: !!exercise.isGoalLift,
    trackEffort: !!exercise.trackEffort,
    bodyweightKg: bw,
    sessions: summaries.slice(0, 3),
    excluded: {
      incomparableSessions: incomparable.length,
      warmupSets: counts.warmup,
      dropSets: counts.drop,
      unconfirmedOutlierSets: counts.outlier,
    },
    gym: emptyGym,
    rejections: recordsForLine(rejections, key).map((r) => ({
      jumpKind: r.jumpKind,
      count: r.count,
      blocked: r.count >= opt.rejectionThreshold,
    })),
    confidenceFactors: [],
  });

  const none = (status: "no_history" | "no_gym_loads", reason: ReasonText, warnings: string[]): Proposal => ({
    status,
    load: null,
    reps: null,
    targetRir: null,
    quality: null,
    sets: null,
    currency: "none",
    jumpKind: null,
    reason,
    confidence: "none",
    needsModel: { needed: false, reasons: [] },
    ruleVersion: RULE_VERSION,
    inputs: baseInputs(),
    warnings: pendingOutlier ? [...warnings, "pending_outlier"] : warnings,
  });

  if (summaries.length === 0) {
    return none("no_history", { key: "no_history", params: {} }, incomparable.length ? ["only_incomparable_history"] : []);
  }
  if (!spec) {
    return none("no_gym_loads", { key: "no_gym_loads", params: { equipment: exercise.equipment } }, []);
  }

  const last = summaries[0]!;
  const streakTags = new Set<string>();
  for (const s of summaries) {
    if (Math.abs(s.topLoad - last.topLoad) >= 1e-6) break;
    for (const t of s.tags) streakTags.add(t);
  }

  // 2. Snap the last load to a load that exists here (towards the easier side when it does not).
  const snap = roundToGymLoad(spec, last.topLoad, { mode: setup === "assisted" ? "up" : "down", zero });
  const anchor = snap.load ?? last.topLoad;
  const warnings: string[] = [];
  if (!snap.exact) warnings.push("anchor_off_gym_loads");
  if (pendingOutlier) warnings.push("pending_outlier");

  const nextHarder = harderDir === "above" ? nextLoadAbove(spec, anchor, zero) : nextLoadBelow(spec, anchor, zero);
  const nextEasier = harderDir === "above" ? nextLoadBelow(spec, anchor, zero) : nextLoadAbove(spec, anchor, zero);
  const jump = nextHarder === null ? null : norm(Math.abs(nextHarder - anchor));
  const ratio = jump === null ? null : jump / jumpBase(setup, anchor, jump, bw);
  const tooBig = ratio === null ? null : ratio > opt.maxJumpRatio;

  // 3. Confidence.
  let confidence: Confidence = summaries.length >= 3 ? "high" : summaries.length === 2 ? "medium" : "low";
  const factors: string[] = [`sessions:${summaries.length}`];
  const modelReasons: NeedsModelReason[] = [];
  if (summaries.length === 1) modelReasons.push("single_session");
  const ageDays = (Date.parse(ctx.asOf) - Date.parse(last.performedAt)) / DAY;
  if (Number.isFinite(ageDays) && ageDays > opt.staleDays) {
    confidence = lower(confidence);
    factors.push(`stale:${Math.round(ageDays)}d`);
    modelReasons.push("stale_history");
  }
  if (summaries.length >= 3) {
    const e = summaries.slice(0, 3).map((s) => epley(s.topLoad, s.repsAtTop));
    const mean = e.reduce((a, b) => a + b, 0) / e.length;
    if (mean > 0) {
      const sd = Math.sqrt(e.reduce((a, b) => a + (b - mean) ** 2, 0) / e.length);
      if (sd / mean > opt.highVarianceCv) {
        confidence = lower(confidence);
        factors.push("high_variance");
        modelReasons.push("high_variance");
      }
    }
  }
  if (pendingOutlier) {
    confidence = lower(confidence);
    factors.push("pending_outlier");
    modelReasons.push("pending_outlier");
  }
  if (!snap.exact) {
    factors.push("anchor_off_gym_loads");
    modelReasons.push("anchor_off_gym_loads");
  }
  if (confidence === "low") modelReasons.unshift("low_confidence");
  const needsModel = { needed: confidence === "low", reasons: [...new Set(modelReasons)] };

  const inputs: DecisionInputs = {
    ...baseInputs(),
    gym: {
      equipment: exercise.equipment,
      anchorLoad: anchor,
      anchorOnGymLoads: snap.exact,
      nextHarderLoad: nextHarder,
      nextEasierLoad: nextEasier,
      jump,
      jumpRatio: ratio === null ? null : Math.round(ratio * 10000) / 10000,
      jumpTooBig: tooBig,
      maxJumpRatio: opt.maxJumpRatio,
    },
    confidenceFactors: factors,
  };

  const r = last.repsAtTop;
  const baseParams = { load: anchor, unit: "kg", equipment: exercise.equipment, lo, hi, lastReps: r };
  const make = (p: {
    load: number;
    reps: number;
    currency: Currency;
    jumpKind: string;
    reason: ReasonText;
    targetRir?: number | null;
    quality?: QualityChange | null;
    sets?: number | null;
  }): Proposal => ({
    status: "proposed",
    load: p.load,
    reps: p.reps,
    targetRir: p.targetRir ?? null,
    quality: p.quality ?? null,
    sets: p.sets ?? exercise.plannedSets ?? null,
    currency: p.currency,
    jumpKind: p.jumpKind,
    reason: p.reason,
    confidence,
    needsModel,
    ruleVersion: RULE_VERSION,
    inputs,
    warnings,
  });

  // 4. Low confidence: a smaller suggestion, never a jump. Say why.
  if (confidence === "low") {
    const reps = Math.min(hi, Math.max(lo, r));
    return make({
      load: anchor,
      reps,
      currency: "reps",
      jumpKind: "repeat",
      reason: { key: "low_confidence_repeat", params: { ...baseParams, reps } },
    });
  }

  // 5. Repeated misses below the range at the same load: step the load down one real step.
  let misses = 0;
  for (const s of summaries) {
    if (Math.abs(s.topLoad - last.topLoad) < 1e-6 && s.repsAtTop < lo) misses++;
    else break;
  }
  if (misses >= opt.stepDownAfterMisses && nextEasier !== null) {
    return make({
      load: nextEasier,
      reps: lo,
      currency: "load",
      jumpKind: jumpKindLoad("easier", Math.abs(anchor - nextEasier)),
      reason: { key: "step_down", params: { ...baseParams, load: nextEasier, prevLoad: anchor, reps: lo } },
    });
  }

  // 6. Currency 1: reps inside the range.
  if (r < lo) {
    return make({
      load: anchor,
      reps: lo,
      currency: "reps",
      jumpKind: "reps",
      reason: { key: "reps_rebuild", params: { ...baseParams, reps: lo } },
    });
  }
  if (r < hi) {
    const reps = r + 1;
    const params: ReasonText["params"] = { ...baseParams, reps };
    if (nextHarder !== null) params.nextLoad = nextHarder;
    return make({ load: anchor, reps, currency: "reps", jumpKind: "reps", reason: { key: "reps_in_range", params } });
  }

  // 7. Top of the range: spend effort, then quality, then the next real load (load first when the jump is small).
  const loadKind = jump === null ? null : jumpKindLoad("harder", jump);
  const loadBlocked = loadKind !== null && isJumpBlocked(rejections, key, loadKind, opt.rejectionThreshold);
  const nextParams: Record<string, number> = nextHarder === null ? {} : { nextLoad: nextHarder };

  const tryEffort = (): Proposal | null => {
    if (!exercise.trackEffort || last.rir === null || last.rir <= opt.rirFloor) return null;
    const target = last.rir - 1;
    const kind = jumpKindEffort(target);
    if (isJumpBlocked(rejections, key, kind, opt.rejectionThreshold)) return null;
    return make({
      load: anchor,
      reps: hi,
      currency: "effort",
      jumpKind: kind,
      targetRir: target,
      reason: { key: "effort_harder", params: { ...baseParams, reps: hi, rir: target, ...nextParams } },
    });
  };
  const tryQuality = (allowRepeat: boolean): Proposal | null => {
    const defaults: QualityChange[] = ["pause", "slow_eccentric", ...(exercise.isGoalLift ? (["extra_set"] as const) : [])];
    const options = (exercise.qualityOptions ?? defaults).filter((q) => q !== "extra_set" || exercise.isGoalLift);
    const fresh = options.filter((q) => !streakTags.has(q));
    const pool = fresh.length > 0 || !allowRepeat ? fresh : options;
    const q = pool.find((x) => !isJumpBlocked(rejections, key, jumpKindQuality(x), opt.rejectionThreshold));
    if (!q) return null;
    return make({
      load: anchor,
      reps: hi,
      currency: "quality",
      jumpKind: jumpKindQuality(q),
      quality: q,
      sets: q === "extra_set" && exercise.plannedSets ? exercise.plannedSets + 1 : (exercise.plannedSets ?? null),
      reason: { key: "quality_change", params: { ...baseParams, reps: hi, quality: q, ...nextParams } },
    });
  };
  const tryLoad = (): Proposal | null => {
    if (nextHarder === null || loadBlocked || loadKind === null) return null;
    return make({
      load: nextHarder,
      reps: lo,
      currency: "load",
      jumpKind: loadKind,
      reason: { key: "load_up", params: { ...baseParams, load: nextHarder, prevLoad: anchor, reps: lo } },
    });
  };

  const order =
    tooBig === false ? [tryLoad, tryEffort, () => tryQuality(loadBlocked)] : [tryEffort, () => tryQuality(false), tryLoad];
  for (const t of order) {
    const p = t();
    if (p) return p;
  }
  if (loadBlocked) {
    const p = tryQuality(true);
    if (p) return p;
    return make({
      load: anchor,
      reps: hi,
      currency: "reps",
      jumpKind: "hold",
      reason: {
        key: "hold_jump_declined",
        params: { ...baseParams, reps: hi, nextLoad: nextHarder ?? anchor, count: rejectionCount(rejections, key, loadKind!) },
      },
    });
  }
  return make({
    load: anchor,
    reps: hi,
    currency: "reps",
    jumpKind: "hold",
    reason: {
      key: setup === "assisted" ? "hold_assisted_floor" : "hold_no_heavier_load",
      params: { ...baseParams, reps: hi },
    },
  });
}
