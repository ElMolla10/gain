import {describe,it,expect} from 'vitest';
import {buildLiveAdaptationFeatures} from './liveAdaptationFeatures';
import {decideNextSet} from './liveAdaptationDecision';
describe('live adaptation features',()=>{
 it('uses relative load and preserves missing history',()=>{
  const x=buildLiveAdaptationFeatures({previousSetWeightKg:60,proposedWeightKg:62.5,previousSetReps:8,firstWorkingSetReps:10,priorWorkingVolume:480,workingSetsBefore:1,loadConvention:'total_barbell_load',setIndex:2,workoutSetsBefore:3,targetReps:8,priorWorkingReps:8,priorWorkoutsOnEquipment:0});
  expect(x.relative_load_change).toBeCloseTo(2.5/60);
  expect(x.rep_drop_from_first).toBe(2);
  expect(x.relative_previous_workout_load).toBeNull();
  expect(x.load_convention).toBe(2);
 });
});
describe('live adaptation decision',()=>{
 const input={predictedReps:8,previousReps:9,targetMin:6,targetMax:10,currentWeightKg:60};
 it('maintains inside range',()=>expect(decideNextSet(input).action).toBe('maintain'));
 it('reduces when below target',()=>expect(decideNextSet({...input,predictedReps:4,lowerAvailableWeightKg:57.5}).action).toBe('decrease'));
 it('increases only with available next weight',()=>expect(decideNextSet({...input,previousReps:12,predictedReps:13,nextAvailableWeightKg:62.5}).action).toBe('increase'));
 it('stops on pain',()=>expect(decideNextSet({...input,severePain:true}).action).toBe('stop'));
});
