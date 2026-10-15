import { describe, expect, it, vi } from 'vitest';
import { recommendLiveSet, decideNextSet } from './liveAdaptationDecision';
import type { SetContext } from './liveAdaptationFeatures';
const context: SetContext = { previousSetWeightKg: 80, proposedWeightKg: 80, previousSetReps: 8, firstWorkingSetReps: 8, priorWorkingVolume: 640, workingSetsBefore: 1, loadConvention: 'total_barbell_load', setIndex: 2, workoutSetsBefore: 1, targetReps: 8, priorWorkingReps: 8, priorWorkoutsOnEquipment: 0 };
const input = { context, targetMin: 6, targetMax: 10, loadSpec: { equipment: 'barbell' as const, increment: 2.5, min: 20, max: 200 }, predict: () => 8 };
describe('equipment-aware live recommendation', () => {
 it('maintains a selectable load within range', () => expect(recommendLiveSet(input)).toMatchObject({action:'maintain', suggestedWeightKg:80, predictedReps:8}));
 it('evaluates the increased load and reports its prediction', () => expect(recommendLiveSet({...input, context: {...context, previousSetReps:12, firstWorkingSetReps:12}, predict: f => Number(f.relative_load_change) > 0 ? 9 : 13})).toMatchObject({action:'increase',suggestedWeightKg:82.5,predictedReps:9}));
 it('does not increase if the heavier candidate falls below target', () => expect(recommendLiveSet({...input,context:{...context,previousSetReps:12,firstWorkingSetReps:12},predict:f=>Number(f.relative_load_change)>0?4:13}).action).toBe('maintain'));
 it('does not increase excessively on a coarse dumbbell rack', () => expect(recommendLiveSet({...input,loadSpec:{equipment:'dumbbell',loads:[20,25,30]},context:{...context,previousSetWeightKg:25,proposedWeightKg:25},predict:()=>14}).action).toBe('maintain'));
 it('decreases to the nearest suitable available rung', () => expect(recommendLiveSet({...input,predict:f=>Number(f.relative_load_change)<0?7:4})).toMatchObject({action:'decrease',suggestedWeightKg:77.5,predictedReps:7}));
 it('uses a real lower rack load rather than a 5% placeholder', () => expect(recommendLiveSet({...input,loadSpec:{equipment:'machine',loads:[60,70,80]},predict:f=>Number(f.relative_load_change)<0?8:4})).toMatchObject({action:'decrease',suggestedWeightKg:70}));
 it('keeps plan when no lighter load exists', () => expect(recommendLiveSet({...input,loadSpec:{equipment:'barbell',loads:[80,90]},predict:()=>4})).toMatchObject({action:'maintain',reason:'no_lighter_load'}));
 it('does not stop merely for a low prediction', () => expect(recommendLiveSet({...input,predict:()=>1}).action).toBe('maintain'));
 it('keeps plan when every lighter candidate predicts worse performance', () => expect(recommendLiveSet({...input,predict:f=>Number(f.relative_load_change)<0?3:4})).toMatchObject({action:'maintain',suggestedWeightKg:80,reason:'no_lighter_load'}));
 it('selects the best improving lighter candidate if none recovers the range', () => expect(recommendLiveSet({...input,predict:f=>Number(f.relative_load_change)<-0.04?5:Number(f.relative_load_change)<0?3:4})).toMatchObject({action:'decrease',suggestedWeightKg:75,predictedReps:5}));
 it('stops after unusually severe observed deterioration', () => expect(recommendLiveSet({...input,context:{...context,previousSetReps:2,firstWorkingSetReps:10,workingSetsBefore:3},predict:()=>1})).toMatchObject({action:'stop',reason:'performance_stop'}));
 it('does not stop a legitimate low-rep target', () => expect(recommendLiveSet({...input,targetMin:1,targetMax:3,context:{...context,previousSetReps:2,workingSetsBefore:3},predict:()=>2}).action).toBe('maintain'));
 it('only responds to explicitly reported symptoms', () => expect(recommendLiveSet({...input,dizziness:true})).toMatchObject({action:'stop',reason:'reported_symptoms'}));
 it('uses a manually chosen load even if the rack does not list it', () => {
   expect(recommendLiveSet({...input,context:{...context,proposedWeightKg:81}}))
     .toMatchObject({action:'maintain',suggestedWeightKg:81});
 });
 it('recommends the saved weight when no rack is configured', () => {
   const logged = {...context,previousSetWeightKg:16,proposedWeightKg:16,firstWorkingSetWeightKg:16,previousSetReps:7,firstWorkingSetReps:7};
   expect(recommendLiveSet({...input,context:logged,loadSpec:null,predict:()=>7}))
     .toMatchObject({action:'maintain',suggestedWeightKg:16});
   expect(recommendLiveSet({...input,context:{...logged,proposedWeightKg:18},loadSpec:null,predict:()=>7}))
     .toMatchObject({action:'maintain',suggestedWeightKg:18});
 });
 it('uses a logged 16 kg dumbbell even when the generic rack omits it', () => {
   const logged = {...context,previousSetWeightKg:16,proposedWeightKg:16,firstWorkingSetWeightKg:16,previousSetReps:7,firstWorkingSetReps:7};
   expect(recommendLiveSet({...input,context:logged,loadSpec:{equipment:'dumbbell',loads:[12.5,15,17.5,20]},predict:()=>7}))
     .toMatchObject({action:'maintain',suggestedWeightKg:16});
 });
 it('propagates inference failures for the logger fallback', () => expect(()=>recommendLiveSet({...input,predict:()=>{throw Error('offline model failed');}})).toThrow('offline model failed'));
 it('rejects nonfinite model predictions', () => expect(()=>recommendLiveSet({...input,predict:()=>NaN})).toThrow());
 it('uses the next planned load rather than the logged load', () => expect(recommendLiveSet({...input,context:{...context,proposedWeightKg:75}}).suggestedWeightKg).toBe(75));
 it('handles min and max equipment boundaries', () => expect(recommendLiveSet({...input,loadSpec:{equipment:'barbell',loads:[80]},predict:()=>15}).action).toBe('maintain'));
});
describe('decision policy without candidate inference',()=>{
 it('never fabricates a lower load',()=>expect(decideNextSet({predictedReps:4,previousReps:8,targetMin:6,targetMax:10,currentWeightKg:80})).toMatchObject({action:'maintain',suggestedWeightKg:80}));
});

// Both public decision paths must apply the same observed-performance vetoes.
describe('observed performance before increasing load', () => {
 const base = { predictedReps: 15, previousReps: 12, targetMin: 6, targetMax: 10, currentWeightKg: 80, nextAvailableWeightKg: 82.5, firstWorkingSetReps: 12 };
 it.each([
   { name:'missing RPE at the top of range', previousReps:10, firstWorkingSetReps:10 },
   { name:'missing RPE below range', previousReps:4, firstWorkingSetReps:4 },
   { name:'missing RPE with only one extra rep', previousReps:11, firstWorkingSetReps:11 },
   { name:'observed rep decline despite a high forecast', previousReps:12, firstWorkingSetReps:14 },
   { name:'reported near failure', previousSetRpe:9 },
   { name:'reported failure', previousSetRpe:10 },
   { name:'nonfinite effort', previousSetRpe:NaN },
   { name:'invalid effort', previousSetRpe:-1 },
   { name:'low effort but underperformed reps', previousReps:8, firstWorkingSetReps:8, previousSetRpe:7 },
 ])('holds after $name', patch => {
   const decision = { ...base, ...patch };
   expect(decideNextSet(decision)).toMatchObject({action:'maintain',reason:'no_suitable_increase'});
   const result = recommendLiveSet({...input, context:{...context,previousSetReps:decision.previousReps,firstWorkingSetReps:decision.firstWorkingSetReps,previousSetRpe:decision.previousSetRpe},predict:()=>15});
   expect(result).toMatchObject({action:'maintain',suggestedWeightKg:80});
 });
 it.each([null, undefined])('still permits supported increases with unknown RPE (%s)', previousSetRpe => {
   expect(decideNextSet({...base,previousSetRpe}).action).toBe('increase');
   expect(recommendLiveSet({...input,context:{...context,previousSetReps:12,firstWorkingSetReps:12,previousSetRpe},predict:f=>Number(f.relative_load_change)>0?10:15})).toMatchObject({action:'increase',suggestedWeightKg:82.5});
 });
 it('allows reported low effort at the top of range', () => {
   expect(decideNextSet({...base,previousReps:10,firstWorkingSetReps:10,previousSetRpe:8}).action).toBe('increase');
 });
 it('keeps symptom stops above increase eligibility', () => {
   expect(decideNextSet({...base,severePain:true}).action).toBe('stop');
   expect(decideNextSet({...base,dizziness:true}).action).toBe('stop');
 });
});

describe('observed fatigue before model inference', () => {
 it.each(['optimistic','failed'] as const)('a comparable collapse stops with an %s model without asking it', mode => {
   const predict = vi.fn(() => { if (mode === 'failed') throw Error('model unavailable'); return 15; });
   const result = recommendLiveSet({...input,context:{...context,previousSetReps:2,firstWorkingSetReps:10,firstWorkingSetWeightKg:80,previousSetWeightKg:80,workingSetsBefore:3},predict});
   expect(result).toMatchObject({action:'stop',reason:'performance_stop',predictionAvailable:false});
   expect(predict).not.toHaveBeenCalled();
 });
 it('does not call a heavier deliberate set an observed fatigue collapse', () => {
   expect(recommendLiveSet({...input,context:{...context,previousSetReps:2,firstWorkingSetReps:10,firstWorkingSetWeightKg:60,previousSetWeightKg:80,workingSetsBefore:3},predict:()=>8}).action).toBe('maintain');
 });
 it('respects low-rep programming and explicit symptom stops with an unavailable model', () => {
   const predict = vi.fn(() => 2);
   expect(recommendLiveSet({...input,targetMin:1,targetMax:3,context:{...context,previousSetReps:2,firstWorkingSetReps:10,firstWorkingSetWeightKg:80,workingSetsBefore:3},predict}).action).not.toBe('stop');
   predict.mockImplementation(() => {throw Error('offline');});
   expect(recommendLiveSet({...input,dizziness:true,predict})).toMatchObject({action:'stop',reason:'reported_symptoms',predictionAvailable:false});
 });
});
