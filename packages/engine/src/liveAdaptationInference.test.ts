import {describe,it,expect} from 'vitest';
import {predictDelta,predictNextReps,type XGBoostJSON,type ModelSchema} from './liveAdaptationInference';
const model:XGBoostJSON={learner:{learner_model_param:{base_score:'[0.5]'},gradient_booster:{model:{iteration_indptr:[0,1],trees:[{left_children:[1,-1,-1],right_children:[2,-1,-1],split_indices:[0,0,0],split_conditions:[1.5,-1,2],default_left:[1,0,0],split_type:[0,0,0]}]}}}};
const schema:ModelSchema={features:['previous_reps'],category_mappings:{load_convention:{}},prediction_min_reps:0,prediction_max_reps:50};
describe('XGBoost JSON inference',()=>{
 it('traverses less-than and greater-than branches',()=>{
  expect(predictDelta(model,schema,{previous_reps:1})).toBe(-0.5);
  expect(predictDelta(model,schema,{previous_reps:2})).toBe(2.5);
 });
 it('uses default missing-value direction',()=>expect(predictDelta(model,schema,{})).toBe(-0.5));
 it('adds delta and clips reps',()=>expect(predictNextReps(model,schema,{previous_reps:2})).toBe(4.5));
 it('rejects missing previous reps',()=>expect(()=>predictNextReps(model,schema,{})).toThrow());
});
