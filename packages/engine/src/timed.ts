
import { lineKey, sortNewestFirst, splitComparable } from "./line";
import { isTrustedWorkingSet } from "./outlier";
import { allowsZero, specForExercise, nextLoadAbove, nextLoadBelow, norm, roundToGymLoad } from "./loads";
import { classifyLift, resolveProgression } from "./policy";
import { median } from "./line";
import { recentTrustedSets, type OutlierResult } from "./outlier";
import { isJumpBlocked, recordsForLine, REJECTION_THRESHOLD, rejectionCount, emptyRejectionMemory } from "./rejection";
import { jumpKindLoad, proposeNext, type ProposeContext } from "./progression";
import type {
  Confidence,
  DecisionInputs,
  ExerciseSpec,
  HistorySession,
  LineIdentity,
  LoggedSet,
  Measure,
  Proposal,
  ReasonText,
  SessionSummary,
} from "./types";

/**
 * Time-based and distance-based exercises (plank, dead hang, wall sit, farmer's walk). DRAFT rule `timed-v0.1`, NOT reviewed by a trainer.
 *
 * Same shape as the reps rule, with the quantity measured in seconds (`time`) or metres (`distance`) instead of reps:
 *  - the rep range of the program slot is read as the seconds / metres range (e.g. 30-60 s);
 *  - only working sets at the same line (exercise + gym + setup) count; warm-ups, drop sets and rejected sets never do;
 *  - session quantity = the WEAKEST working set at the heaviest load (conservative, like the reps rule);
 *  - one session of history is a low-confidence repeat; below the range = rebuild to the bottom; below the top = a small step longer
 *    (about 10%, never less than 5, from the last multiple of 5, never past the top); at the top the load goes up one real gym step only after
 *    2 sessions at the top (the same two-session trigger as the reps rule), then the target restarts at the bottom of the range;
 *  - no real heavier load (bodyweight holds, nothing on the rack) = stay at the top and say so. The range is the lifter's to raise.
 * The percentage band and effort / quality currencies of the reps rule do not apply here.
 */
export const TIMED_RULE_VERSION = "timed-v0.1";
export const TIMED_SESSIONS_AT_TOP = 2;
export const MAX_SECONDS = 3600;
export const MAX_METRES = 5000;

export const isTimedMeasure = (m: Measure | undefined | null): m is "time" | "distance" => m === "time" || m === "distance";
export const quantityUnit = (m: "time" | "distance"): "s" | "m" => (m === "time" ? "s" : "m");

/** The seconds (time) or metres (distance) of a logged set, or null when it has none. */
export function quantityOf(set: LoggedSet, measure: "time" | "distance"): number | null {
  const q = measure === "time" ? set.durationS : set.distanceM;
  return typeof q === "number" && Number.isFinite(q) && q > 0 ? q : null;
}

/** The step "a little longer" means: about 10% of the last quantity, at least 5, in multiples of 5. 30 -> 5, 60 -> 5, 90 -> 10, 120 -> 10, 200 -> 20. */
export function timedStep(last: number): number {
  return Math.max(5, Math.round((last * 0.1) / 5) * 5);
}

function summarizeTimed(s: HistorySession, measure: "time" | "distance", setup: LineIdentity["setup"]): SessionSummary | null {
  const trusted = s.sets.filter((x) => isTrustedWorkingSet(x) && quantityOf(x, measure) !== null && Number.isFinite(x.load));
  if (trusted.length === 0) return null;
  const harder = (a: number, b: number) => (setup === "assisted" ? a < b : a > b);
  let top = trusted[0]!.load;
  for (const x of trusted) if (harder(x.load, top)) top = x.load;
  const atTop = trusted.filter((x) => Math.abs(x.load - top) < 1e-6);
  const qs = atTop.map((x) => quantityOf(x, measure)!);
  return {
    performedAt: s.performedAt,
    topLoad: top,
    repsAtTop: Math.min(...qs),
    lastSetReps: qs[qs.length - 1]!,
    setsAtTop: atTop.length,
    workingSets: trusted.length,
    rir: null,
    tags: [],
  };
}

export interface TimedContext extends Omit<ProposeContext, "exercise"> {
  exercise: ExerciseSpec & { measure: "time" | "distance" };
}

export function proposeTimed(ctx: TimedContext): Proposal {
  const { exercise, gym } = ctx;
  const measure = exercise.measure;
  const qunit = quantityUnit(measure);
  const setup = exercise.setup;
  const zero = allowsZero(setup);
  const lo = exercise.repRange.min;
  const hi = exercise.repRange.max ?? NaN; // a timed range always has a top (the app stores one)
  if (!(lo >= 1) || !(hi >= lo)) throw new Error("range must satisfy 1 <= min <= max");
  const cap = measure === "time" ? MAX_SECONDS : MAX_METRES;
  const rejections = ctx.rejections ?? emptyRejectionMemory();
  const threshold = ctx.options?.rejectionThreshold ?? REJECTION_THRESHOLD;
  const line: LineIdentity = { exerciseId: exercise.exerciseId, gymId: gym.gymId, setup };
  const key = lineKey(line);
  const staleDays = ctx.options?.staleDays ?? 28;
  const region = exercise.bodyRegion ?? classifyLift(exercise.name ?? exercise.exerciseId).bodyRegion;
  const policy = resolveProgression(region, exercise.progression);

  const { comparable, incomparable } = splitComparable(line, ctx.history);
  const counts = { warmup: 0, drop: 0, outlier: 0 };
  const summaries: SessionSummary[] = [];
  for (const s of sortNewestFirst(comparable)) {
    for (const x of s.sets) {
      if (x.warmup) counts.warmup++;
      else if (x.tags?.includes("drop")) counts.drop++;
      else if (x.outlierStatus === "unconfirmed" || x.outlierStatus === "rejected") counts.outlier++;
    }
    const sm = summarizeTimed(s, measure, setup);
    if (sm) summaries.push(sm);
  }
  const spec = specForExercise(gym, exercise);
  const loadRec: Pick<DecisionInputs["gym"], "loadSource" | "loadSpec"> = exercise.loadOverride ? { loadSource: "exercise", loadSpec: exercise.loadOverride } : {};
  const baseInputs = (): DecisionInputs => ({
    measure,
    lineKey: key,
    line,
    asOf: ctx.asOf,
    repRange: { min: lo, max: hi },
    isGoalLift: !!exercise.isGoalLift,
    trackEffort: false,
    bodyweightKg: ctx.bodyweightKg ?? null,
    sessions: summaries.slice(0, 3),
    excluded: { incomparableSessions: incomparable.length, warmupSets: counts.warmup, dropSets: counts.drop, unconfirmedOutlierSets: counts.outlier },
    gym: {
      equipment: exercise.equipment,
      anchorLoad: null,
      anchorOnGymLoads: null,
      nextHarderLoad: null,
      nextEasierLoad: null,
      jump: null,
      jumpRatio: null,
      jumpTooBig: null,
      maxJumpRatio: policy.increment.maxPct,
      minJumpRatio: policy.increment.minPct,
      ...loadRec,
    },
    policy,
    readiness: { targetReps: hi, qualifyingSessions: 0, requiredSessions: TIMED_SESSIONS_AT_TOP, fastTracked: false, stalled: false },
    rejections: recordsForLine(rejections, key).map((r) => ({ jumpKind: r.jumpKind, count: r.count, blocked: r.count >= threshold })),
    confidenceFactors: [],
  });

  const qtyFields = (q: number | null) => (measure === "time" ? { durationS: q, distanceM: null } : { durationS: null, distanceM: q });

  if (summaries.length === 0) {
    return {
      status: "no_history",
      load: null,
      reps: null,
      ...qtyFields(null),
      targetRir: null,
      quality: null,
      sets: null,
      currency: "none",
      jumpKind: null,
      reason: { key: "no_history", params: {} },
      confidence: "none",
      needsModel: { needed: false, reasons: [] },
      ruleVersion: TIMED_RULE_VERSION,
      inputs: baseInputs(),
      warnings: incomparable.length ? ["only_incomparable_history"] : [],
    };
  }

  const last = summaries[0]!;
  const warnings: string[] = [];
  // The last load, snapped to one that exists here when the gym knows this equipment (towards the easier side); otherwise kept as logged.
  let anchor = last.topLoad;
  let onGym: boolean | null = null;
  if (spec) {
    const snap = roundToGymLoad(spec, last.topLoad, { mode: setup === "assisted" ? "up" : "down", zero });
    onGym = snap.exact;
    if (snap.load !== null) anchor = snap.load;
    if (!snap.exact) warnings.push("anchor_off_gym_loads");
  }
  const harderDir = setup === "assisted" ? "below" : "above";
  const nextHarder = spec ? (harderDir === "above" ? nextLoadAbove(spec, anchor, zero) : nextLoadBelow(spec, anchor, zero)) : null;
  const nextEasier = spec ? (harderDir === "above" ? nextLoadBelow(spec, anchor, zero) : nextLoadAbove(spec, anchor, zero)) : null;
  const jump = nextHarder === null ? null : norm(Math.abs(nextHarder - anchor));

  let confidence: Confidence = summaries.length >= 3 ? "high" : summaries.length === 2 ? "medium" : "low";
  const factors: string[] = [`sessions:${summaries.length}`];
  const ageDays = (Date.parse(ctx.asOf) - Date.parse(last.performedAt)) / 86_400_000;
  if (Number.isFinite(ageDays) && ageDays > staleDays) {
    confidence = confidence === "high" ? "medium" : "low";
    factors.push(`stale:${Math.round(ageDays)}d`);
  }
  const needsModel = { needed: confidence === "low", reasons: confidence === "low" ? (["low_confidence"] as const).slice() : [] };

  let qualifying = 0;
  for (const s of summaries) {
    if (Math.abs(s.topLoad - last.topLoad) < 1e-6 && s.repsAtTop >= hi) qualifying++;
    else break;
  }
  const inputs: DecisionInputs = {
    ...baseInputs(),
    gym: {
      ...baseInputs().gym,
      anchorLoad: anchor,
      anchorOnGymLoads: onGym,
      nextHarderLoad: nextHarder,
      nextEasierLoad: nextEasier,
      jump,
    },
    readiness: { targetReps: hi, qualifyingSessions: qualifying, requiredSessions: TIMED_SESSIONS_AT_TOP, fastTracked: false, stalled: false },
    confidenceFactors: factors,
  };

  const q = last.repsAtTop;
  const base = { load: anchor, unit: "kg", equipment: exercise.equipment, lo, hi, last: q, qunit };
  const make = (p: { load: number; qty: number; currency: "reps" | "load"; jumpKind: string; reason: ReasonText }): Proposal => ({
    status: "proposed",
    load: p.load,
    reps: null,
    ...qtyFields(Math.min(cap, p.qty)),
    targetRir: null,
    quality: null,
    sets: exercise.plannedSets ?? null,
    currency: p.currency,
    jumpKind: p.jumpKind,
    reason: p.reason,
    confidence,
    needsModel: { needed: needsModel.needed, reasons: [...needsModel.reasons] },
    ruleVersion: TIMED_RULE_VERSION,
    inputs,
    warnings,
  });

  if (confidence === "low") {
    const target = Math.min(hi, Math.max(lo, q));
    return make({ load: anchor, qty: target, currency: "reps", jumpKind: "repeat", reason: { key: "timed_repeat", params: { ...base, target } } });
  }
  if (q < lo) return make({ load: anchor, qty: lo, currency: "reps", jumpKind: "reps", reason: { key: "timed_rebuild", params: { ...base, target: lo } } });
  if (q < hi) {
    const target = Math.min(hi, Math.floor(q / 5) * 5 + timedStep(q));
    return make({ load: anchor, qty: target, currency: "reps", jumpKind: "reps", reason: { key: "timed_longer", params: { ...base, target } } });
  }
  // At the top of the range.
  if (qualifying < TIMED_SESSIONS_AT_TOP) {
    return make({
      load: anchor,
      qty: hi,
      currency: "reps",
      jumpKind: "confirm",
      reason: { key: "timed_confirm", params: { ...base, target: hi, have: qualifying, need: TIMED_SESSIONS_AT_TOP } },
    });
  }
  const loadKind = jump === null ? null : jumpKindLoad("harder", jump);
  if (nextHarder !== null && loadKind !== null && !isJumpBlocked(rejections, key, loadKind, threshold)) {
    return make({
      load: nextHarder,
      qty: lo,
      currency: "load",
      jumpKind: loadKind,
      reason: { key: "timed_load_up", params: { ...base, load: nextHarder, prevLoad: anchor, target: lo } },
    });
  }
  if (loadKind !== null && nextHarder !== null) {
    return make({
      load: anchor,
      qty: hi,
      currency: "reps",
      jumpKind: "hold",
      reason: { key: "timed_hold_declined", params: { ...base, target: hi, nextLoad: nextHarder, count: rejectionCount(rejections, key, loadKind) } },
    });
  }
  return make({ load: anchor, qty: hi, currency: "reps", jumpKind: "hold", reason: { key: "timed_hold_top", params: { ...base, target: hi } } });
}

/** Chooses the rule by how the exercise is counted: the reps rule (rule-v0.3) or the time / distance rule (timed-v0.1). */
export function proposeForMeasure(ctx: ProposeContext): Proposal {
  const m = ctx.exercise.measure;
  if (isTimedMeasure(m)) return proposeTimed({ ...ctx, exercise: { ...ctx.exercise, measure: m } });
  return proposeNext(ctx);
}



/** A timed set this many times longer or shorter than the recent median (and at least this many seconds / metres away) is asked about first. */
export const TIMED_OUTLIER_RATIO = 3;
export const TIMED_OUTLIER_MIN_DIFF = 15;

/**
 * Is a new timed / distance set far from the recent line (60 typed for 6, 600 for 60)? Same contract as `checkOutlier`: `unconfirmed`
 * sets are shown but never move the next target until the lifter confirms them. Needs 2 earlier working sets to judge; the number
 * must always be a positive amount no bigger than an hour / 5 km.
 */
export function checkTimedOutlier(set: LoggedSet, measure: "time" | "distance", ctx: { line: LineIdentity; history: HistorySession[] }): OutlierResult {
  const q = quantityOf(set, measure);
  const cap = measure === "time" ? MAX_SECONDS : MAX_METRES;
  if (q === null || q > cap || !Number.isFinite(set.load) || set.load < 0) {
    return { verdict: "unconfirmed", outlierStatus: "unconfirmed", reasons: ["invalid_value"], expected: null };
  }
  const recent = recentTrustedSets(ctx.line, ctx.history).map((x) => quantityOf(x, measure)).filter((x): x is number => x !== null);
  if (recent.length < 2) return { verdict: "insufficient_history", outlierStatus: "none", reasons: [], expected: null };
  const med = median(recent);
  const far = Math.abs(q - med) >= TIMED_OUTLIER_MIN_DIFF && (q > med * TIMED_OUTLIER_RATIO || q < med / TIMED_OUTLIER_RATIO);
  const expected = { medianLoad: 0, medianReps: med, medianE1rm: null, sampleSize: recent.length };
  if (far) return { verdict: "unconfirmed", outlierStatus: "unconfirmed", reasons: ["quantity_far_from_line"], expected };
  return { verdict: "ok", outlierStatus: "none", reasons: [], expected };
}
