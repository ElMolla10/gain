import {describe,it,expect} from 'vitest';
import {predictDelta,predictNextReps,validateModel,type ModelSchema} from './liveAdaptationInference';
const fixture=()=>({version:[3,4,1],learner:{feature_names:['previous_reps'],objective:{name:'reg:squarederror'},learner_model_param:{base_score:'[0.5]',num_feature:'1',num_target:'1',num_class:'0'},gradient_booster:{name:'gbtree',model:{iteration_indptr:[0,1],tree_info:[0],trees:[{left_children:[1,-1,-1],right_children:[2,-1,-1],split_indices:[0,0,0],split_conditions:[1.5,-1,2],default_left:[1,0,0],split_type:[0,0,0]}]}}}});
const schema:ModelSchema={features:['previous_reps'],category_mappings:{load_convention:{}},prediction_min_reps:0,prediction_max_reps:50};
describe('XGBoost JSON inference',()=>{
 it('traverses strict less-than, equality and greater-than branches',()=>{
  expect(predictDelta(fixture(),schema,{previous_reps:1})).toBe(-0.5);
  expect(predictDelta(fixture(),schema,{previous_reps:1.5})).toBe(2.5);
 });
 it.each([undefined,null,NaN,Infinity,-Infinity])('uses default missing-value direction for %s',value=>expect(predictDelta(fixture(),schema,{previous_reps:value})).toBe(-0.5));
 it('supports scalar base scores from earlier XGBoost models',()=>{
  const m=fixture(); m.version=[2,1,0]; m.learner.learner_model_param.base_score='0.5';
  expect(predictDelta(m,schema,{previous_reps:2})).toBe(2.5);
 });
 it('rounds traversal inputs and accumulation to float32',()=>{
  const m=fixture(); m.learner.learner_model_param.base_score='[16777216]';
  m.learner.gradient_booster.model.trees[0]!.split_conditions=[1.5,1,1];
  expect(predictDelta(m,schema,{previous_reps:1.49999999})).toBe(16777216);
 });
 it('adds delta and clips reps',()=>{
  expect(predictNextReps(fixture(),schema,{previous_reps:2})).toBe(4.5);
  expect(predictNextReps(fixture(),schema,{previous_reps:50})).toBe(50);
 });
 it('uses the right missing branch when default-left is false',()=>{
  const m=fixture(); m.learner.gradient_booster.model.trees[0]!.default_left[0]=0;
  expect(predictDelta(m,schema,{})).toBe(2.5);
 });
 it('rounds feature values before threshold comparisons',()=>{
  expect(predictDelta(fixture(),schema,{previous_reps:1.49999999})).toBe(2.5);
 });
 it('validates and caches a model for repeated predictions',()=>{
  const m=fixture(); validateModel(m,schema);
  expect(predictDelta(m,schema,{previous_reps:2})).toBe(2.5);
  expect(predictDelta(m,schema,{previous_reps:1})).toBe(-0.5);
 });
 it('rejects multi-target models',()=>{
  const m=fixture(); m.learner.learner_model_param.num_target='2';
  expect(()=>predictDelta(m,schema,{})).toThrow(/single-output/);
 });
 it('rejects unsupported booster kinds',()=>{
  const m=fixture(); m.learner.gradient_booster.name='dart';
  expect(()=>predictDelta(m,schema,{})).toThrow(/booster/);
 });
 it('rejects unsupported schema model versions',()=>{
  expect(()=>predictDelta(fixture(),{...schema,model_version:'1.0.0'},{})).toThrow(/version/);
 });
 it('rejects inconsistent leaf pointers',()=>{
  const m=fixture(); m.learner.gradient_booster.model.trees[0]!.right_children[1]=2;
  expect(()=>predictDelta(m,schema,{})).toThrow(/tree/);
 });
 it('rejects missing previous reps',()=>expect(()=>predictNextReps(fixture(),schema,{})).toThrow());
 it.each(['binary:logistic','reg:logistic'])('rejects unsupported objective %s',objective=>{
  const m=fixture(); m.learner.objective.name=objective;
  expect(()=>predictDelta(m,schema,{})).toThrow(/objective/i);
 });
 it('rejects unsupported model versions',()=>{
  const m=fixture(); m.version=[4,0,0];
  expect(()=>predictDelta(m,schema,{})).toThrow(/version/i);
 });
 it.each(['[0.5,1]','null','"bad"','1e999'])('rejects invalid base score %s',base=>{
  const m=fixture(); m.learner.learner_model_param.base_score=base;
  expect(()=>predictDelta(m,schema,{})).toThrow(/base score/i);
 });
 it('rejects schema feature order mismatch',()=>{
  expect(()=>predictDelta(fixture(),{...schema,features:['other']},{})).toThrow(/feature/i);
 });
 it('rejects categorical splits, including unreachable nodes',()=>{
  const m=fixture(); m.learner.gradient_booster.model.trees[0]!.split_type[2]=1;
  expect(()=>predictDelta(m,schema,{})).toThrow(/categorical/i);
 });
 it('rejects cyclic trees without hanging',()=>{
  const m=fixture(); m.learner.gradient_booster.model.trees[0]!.left_children[0]=0;
  expect(()=>predictDelta(m,schema,{})).toThrow(/tree/i);
 });
 it('rejects out-of-range child pointers',()=>{
  const m=fixture(); m.learner.gradient_booster.model.trees[0]!.left_children[0]=20;
  expect(()=>predictDelta(m,schema,{})).toThrow(/tree/i);
 });
 it('rejects inconsistent tree arrays',()=>{
  const m=fixture(); m.learner.gradient_booster.model.trees[0]!.right_children.pop();
  expect(()=>predictDelta(m,schema,{})).toThrow(/tree/i);
 });
 it('rejects invalid split feature indices',()=>{
  const m=fixture(); m.learner.gradient_booster.model.trees[0]!.split_indices[0]=10;
  expect(()=>predictDelta(m,schema,{})).toThrow(/feature/i);
 });
 it('rejects non-finite leaf values',()=>{
  const m=fixture(); m.learner.gradient_booster.model.trees[0]!.split_conditions[1]=NaN;
  expect(()=>predictDelta(m,schema,{})).toThrow(/tree/i);
 });
});
