import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {buildLiveAdaptationFeatures,type SetContext} from './liveAdaptationFeatures';
const context:SetContext={previousSetWeightKg:20,proposedWeightKg:22,previousSetReps:8,firstWorkingSetReps:10,priorWorkingVolume:160,workingSetsBefore:1,loadConvention:'total_barbell_load',setIndex:2,workoutSetsBefore:3,targetReps:10,priorWorkingReps:8,priorWorkoutsOnEquipment:2};
describe('live adaptation feature contract',()=>{
 it('matches bundled schema order exactly',()=>{
  const schema=JSON.parse(readFileSync(new URL('../assets/live-adaptation-v2/schema.json',import.meta.url),'utf8'));
  expect(Object.keys(buildLiveAdaptationFeatures(context))).toEqual(schema.features);
 });
 it('maps known categories and unknown category to minus one',()=>{
  expect(buildLiveAdaptationFeatures(context).load_convention).toBe(2);
  expect(buildLiveAdaptationFeatures({...context,loadConvention:'unknown'}).load_convention).toBe(-1);
 });
 it('preserves numeric missing values instead of inventing zeros',()=>{
  const f=buildLiveAdaptationFeatures({...context,priorWorkoutsOnEquipment:null});
  expect(f.prior_workouts_this_equipment).toBeNull();
  expect(f.rest_before_set_seconds).toBeUndefined();
  expect(f.previous_workout_first_reps).toBeUndefined();
  expect(f.relative_previous_workout_load).toBeNull();
 });
 it('uses null for unavailable denominator features',()=>{
  const f=buildLiveAdaptationFeatures({...context,previousSetWeightKg:0,workingSetsBefore:0});
  expect(f.relative_load_change).toBeNull();
  expect(f.volume_per_prior_set).toBeNull();
 });
});
