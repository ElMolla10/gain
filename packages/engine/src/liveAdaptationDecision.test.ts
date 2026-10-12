import { describe, expect, it } from 'vitest';
import { recommendLiveSet, decideNextSet } from './liveAdaptationDecision';
import type { SetContext } from './liveAdaptationFeatures';
const context: SetContext = { previousSetWeightKg: 80, proposedWeightKg: 80, previousSetReps: 8, firstWorkingSetReps: 8, priorWorkingVolume: 640, workingSetsBefore: 1, loadConvention: 'total_barbell_load', setIndex: 2, workoutSetsBefore: 1, targetReps: 8, priorWorkingReps: 8, priorWorkoutsOnEquipment: 0 };
const input = { context, targetMin: 6, targetMax: 10, loadSpec: { equipment: 'barbell' as const, increment: 2.5, min: 20, max: 200 }, predict: () => 8 };
describe('equipment-aware live recommendation', () => {
 it('maintains a selectable load within range', () => expect(recommendLiveSet(input)).toMatchObject({action:'maintain', suggestedWeightKg:80, predictedReps:8}));
 it('evaluates the increased load and reports its prediction', () => expect(recommendLiveSet({...input, predict: f => Number(f.relative_load_change) > 0 ? 9 : 13})).toMatchObject({action:'increase',suggestedWeightKg:82.5,predictedReps:9}));
 it('does not increase if the heavier candidate falls below target', () => expect(recommendLiveSet({...input,predict:f=>Number(f.relative_load_change)>0?4:13}).action).toBe('maintain'));
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
 it('refuses off-grid planned loads', () => expect(()=>recommendLiveSet({...input,context:{...context,proposedWeightKg:81}})).toThrow());
 it('propagates inference failures for the logger fallback', () => expect(()=>recommendLiveSet({...input,predict:()=>{throw Error('offline model failed');}})).toThrow('offline model failed'));
 it('rejects nonfinite model predictions', () => expect(()=>recommendLiveSet({...input,predict:()=>NaN})).toThrow());
 it('uses the next planned load rather than the logged load', () => expect(recommendLiveSet({...input,context:{...context,proposedWeightKg:75}}).suggestedWeightKg).toBe(75));
 it('handles min and max equipment boundaries', () => expect(recommendLiveSet({...input,loadSpec:{equipment:'barbell',loads:[80]},predict:()=>15}).action).toBe('maintain'));
});
describe('decision policy without candidate inference',()=>{
 it('never fabricates a lower load',()=>expect(decideNextSet({predictedReps:4,previousReps:8,targetMin:6,targetMax:10,currentWeightKg:80})).toMatchObject({action:'maintain',suggestedWeightKg:80}));
});
