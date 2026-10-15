import { buildLiveAdaptationFeatures, type SetContext } from './liveAdaptationFeatures';
import type { FeatureMap } from './liveAdaptationInference';
import { isGymLoad, nextLoadAbove, nextLoadBelow } from './loads';
import type { GymLoadSpec } from './types';

export type Action = 'increase' | 'maintain' | 'decrease' | 'stop';
/** Stable keys translated by the mobile app; the regressor does not assess injury risk. */
export type LiveReason = 'within_range' | 'above_range' | 'below_range' | 'no_lighter_load' | 'performance_stop' | 'reported_symptoms' | 'no_suitable_increase';
export interface Decision { action: Action; suggestedWeightKg: number; reason: LiveReason; predictedReps: number; /** False for an observed stop before inference; predictedReps must not be displayed/scored. */ predictionAvailable?: boolean }
export interface DecisionInput {
  predictedReps: number; previousReps: number; targetMin: number; targetMax: number; currentWeightKg: number;
  nextAvailableWeightKg?: number; lowerAvailableWeightKg?: number; previousSetRpe?: number | null;
  firstWorkingSetWeightKg?: number; previousSetWeightKg?: number;
  firstWorkingSetReps?: number; workingSetsBefore?: number;
  severePain?: boolean; dizziness?: boolean; consecutiveVeryLowSets?: number;
}

function validateInput(x: DecisionInput): void {
  if (![x.predictedReps, x.previousReps, x.currentWeightKg, x.targetMin, x.targetMax].every(Number.isFinite)
      || x.predictedReps < 0 || x.predictedReps > 50 || x.previousReps < 0 || x.currentWeightKg <= 0
      || x.targetMin < 1 || x.targetMax < x.targetMin || x.targetMax > 50) throw new Error('Invalid set inputs');
}
function stopReason(x: DecisionInput): LiveReason | null {
  if (x.severePain === true || x.dizziness === true) return 'reported_symptoms';
  // Low rep targets are legitimate. Stop is based on observed deterioration, never inferred symptoms.
  // A deliberate heavier set can have fewer reps without being a fatigue collapse.
  const comparable = x.firstWorkingSetWeightKg === undefined || x.previousSetWeightKg === undefined
    || (Number.isFinite(x.firstWorkingSetWeightKg) && Number.isFinite(x.previousSetWeightKg)
      && x.firstWorkingSetWeightKg > 0 && x.previousSetWeightKg <= x.firstWorkingSetWeightKg);
  const severeObserved = comparable && (x.workingSetsBefore ?? 0) >= 2 && (x.firstWorkingSetReps ?? 0) >= 6
    && x.previousReps <= 2 && x.previousReps <= (x.firstWorkingSetReps ?? 0) / 2;
  if (x.targetMin >= 4 && (severeObserved || (comparable && (x.consecutiveVeryLowSets ?? 0) >= 2))) return 'performance_stop';
  return null;
}

/** A forecast alone cannot justify adding load. Unknown effort needs clear observed
 * headroom; reported high effort, invalid RPE, or a rep decline veto an increase. */
function supportsIncrease(x: DecisionInput): boolean {
  if (x.firstWorkingSetReps !== undefined && (!Number.isFinite(x.firstWorkingSetReps)
      || x.previousReps < x.firstWorkingSetReps)) return false;
  if (x.previousSetRpe == null) return x.previousReps >= x.targetMax + 2;
  return Number.isFinite(x.previousSetRpe) && x.previousSetRpe >= 1 && x.previousSetRpe < 9
    && x.previousReps >= x.targetMax;
}

/** Compatibility policy: callers must supply actual available loads; no percentage-based fabrication. */
export function decideNextSet(x: DecisionInput): Decision {
  validateInput(x);
  const result = (action: Action, weight: number, reason: LiveReason): Decision => ({action, suggestedWeightKg: weight, reason, predictedReps: x.predictedReps});
  const stop = stopReason(x);
  if (stop) return result('stop', x.currentWeightKg, stop);
  if (x.predictedReps < x.targetMin) {
    const lower = x.lowerAvailableWeightKg;
    return lower !== undefined && Number.isFinite(lower) && lower > 0 && lower < x.currentWeightKg
      ? result('decrease', lower, 'below_range') : result('maintain', x.currentWeightKg, 'no_lighter_load');
  }
  const upper = x.nextAvailableWeightKg;
  if (x.predictedReps > x.targetMax + 1 && supportsIncrease(x)
      && upper !== undefined && Number.isFinite(upper) && upper > x.currentWeightKg && upper <= x.currentWeightKg * 1.05 + 1e-6) {
    return result('increase', upper, 'above_range');
  }
  return result('maintain', x.currentWeightKg, x.predictedReps > x.targetMax ? 'no_suitable_increase' : 'within_range');
}

export interface LiveRecommendationInput {
  context: SetContext; targetMin: number; targetMax: number; loadSpec: GymLoadSpec;
  /** Returns clipped next-set reps from the real locally cached model. */
  predict: (features: FeatureMap) => number;
  severePain?: boolean; dizziness?: boolean; consecutiveVeryLowSets?: number;
}
/** At most five model evaluations, using selectable equipment rungs and the actual proposed next load. */
export function recommendLiveSet(x: LiveRecommendationInput): Decision {
  const current = x.context.proposedWeightKg;
  const predict = (weight: number): number => {
    const reps = x.predict(buildLiveAdaptationFeatures({...x.context, proposedWeightKg: weight}));
    if (!Number.isFinite(reps) || reps < 0 || reps > 50) throw new Error('Invalid model prediction');
    return reps;
  };
  const base: DecisionInput = {
    predictedReps: 0, previousReps: x.context.previousSetReps, currentWeightKg: current,
    targetMin: x.targetMin, targetMax: x.targetMax, firstWorkingSetReps: x.context.firstWorkingSetReps,
    firstWorkingSetWeightKg: x.context.firstWorkingSetWeightKg, previousSetWeightKg: x.context.previousSetWeightKg,
    workingSetsBefore: x.context.workingSetsBefore, previousSetRpe: x.context.previousSetRpe,
    severePain: x.severePain, dizziness: x.dizziness, consecutiveVeryLowSets: x.consecutiveVeryLowSets ?? x.context.consecutiveVeryLowSets,
  };
  validateInput(base);
  const stop = stopReason(base);
  if (stop) return {action:'stop', suggestedWeightKg:current, predictedReps:0, predictionAvailable:false, reason:stop};
  // A load actually used in the preceding set is available even if a gym's
  // generic rack has not been configured to include it (e.g. 16 kg dumbbells).
  // Other off-grid proposals are still rejected; increases/decreases continue
  // to use only configured, selectable loads.
  if (current <= 0 || (!isGymLoad(x.loadSpec, current) && Math.abs(current - x.context.previousSetWeightKg) > 1e-6))
    throw new Error('Next planned load is unavailable');
  const p = predict(current);
  base.predictedReps = p;
  if (p > x.targetMax + 1 && supportsIncrease(base)) {
    const upper = nextLoadAbove(x.loadSpec, current);
    if (upper !== null && upper <= current * 1.05 + 1e-6) {
      const heavierPrediction = predict(upper);
      if (heavierPrediction >= x.targetMin && heavierPrediction <= p)
        return {action:'increase', suggestedWeightKg:upper, predictedReps:heavierPrediction, reason:'above_range'};
    }
  }
  if (p < x.targetMin) {
    let lower = nextLoadBelow(x.loadSpec, current);
    let best: {weight:number; reps:number} | null = null;
    // Search a bounded neighborhood; require predicted improvement even if no load recovers the target.
    for (let i = 0; i < 3 && lower !== null && lower > 0; i++) {
      if (i > 0 && lower < current * 0.8) break;
      const reps = predict(lower);
      if (reps > p && (best === null || reps > best.reps)) best = {weight:lower, reps};
      if (reps > p && reps >= x.targetMin) { best = {weight:lower, reps}; break; }
      lower = nextLoadBelow(x.loadSpec, lower);
    }
    if (best) return {action:'decrease', suggestedWeightKg:best.weight, predictedReps:best.reps, reason:'below_range'};
    return {action:'maintain', suggestedWeightKg:current, predictedReps:p, reason:'no_lighter_load'};
  }
  return {action:'maintain', suggestedWeightKg:current, predictedReps:p, reason:p > x.targetMax ? 'no_suitable_increase' : 'within_range'};
}
