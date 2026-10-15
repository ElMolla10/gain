import type { FeatureMap } from './liveAdaptationInference';
/** Only call after a confirmed working set; all fields must be known before the next set. */
export interface SetContext {
  previousSetWeightKg:number; proposedWeightKg:number; previousSetReps:number;
  /** Policy-only observation; not a trained model feature. */
  firstWorkingSetWeightKg?:number;
  consecutiveVeryLowSets?:number;
  firstWorkingSetReps:number; previousWorkoutFirstWeightKg?:number|null;
  priorWorkingVolume:number; workingSetsBefore:number;
  loadConvention:'displayed_machine_load'|'per_dumbbell'|'total_barbell_load'|'unknown';
  setIndex:number; workoutSetsBefore:number; restSeconds?:number|null;
  targetReps:number; plannedRir?:number|null; sleepHours?:number|null;
  readiness?:number|null; previousSetRpe?:number|null;
  priorWorkingReps:number; priorWorkoutsOnEquipment:number|null;
  previousWorkoutFirstReps?:number|null; daysSincePreviousWorkout?:number|null;
}
export const LOAD_CONVENTION_CODES:Record<SetContext['loadConvention'],number>={
  displayed_machine_load:0,per_dumbbell:1,total_barbell_load:2,unknown:-1
};
export function buildLiveAdaptationFeatures(c:SetContext):FeatureMap {
  if(!Number.isFinite(c.previousSetReps)||c.previousSetReps<0||!Number.isFinite(c.proposedWeightKg)||c.proposedWeightKg<0) throw new Error('Invalid set context');
  const relative=(a:number,b:number)=>b>0?a/b:null;
  return {
    relative_load_change:c.previousSetWeightKg>0?(c.proposedWeightKg-c.previousSetWeightKg)/c.previousSetWeightKg:null,
    previous_reps:c.previousSetReps,
    rep_drop_from_first:c.firstWorkingSetReps-c.previousSetReps,
    relative_previous_workout_load:c.previousWorkoutFirstWeightKg?relative(c.proposedWeightKg,c.previousWorkoutFirstWeightKg):null,
    volume_per_prior_set:c.workingSetsBefore>0?c.priorWorkingVolume/c.workingSetsBefore:null,
    load_convention:LOAD_CONVENTION_CODES[c.loadConvention]??-1,
    set_index:c.setIndex,
    working_sets_before:c.workingSetsBefore,
    workout_sets_before:c.workoutSetsBefore,
    rest_before_set_seconds:c.restSeconds,
    target_reps:c.targetReps,
    planned_rir:c.plannedRir,
    sleep_hours:c.sleepHours,
    readiness_self_report:c.readiness,
    previous_set_rpe:c.previousSetRpe,
    first_working_set_reps:c.firstWorkingSetReps,
    prior_working_reps_this_exercise:c.priorWorkingReps,
    prior_workouts_this_equipment:c.priorWorkoutsOnEquipment,
    previous_workout_first_reps:c.previousWorkoutFirstReps,
    days_since_previous_workout_this_equipment:c.daysSincePreviousWorkout
  };
}
