/** Offline XGBoost v2 numerical-tree evaluator. Model must be bundled locally. */
export type FeatureValue = number | null | undefined;
export type FeatureMap = Record<string, FeatureValue>;
export interface Tree { left_children:number[]; right_children:number[]; split_indices:number[]; split_conditions:number[]; default_left:number[]; split_type:number[] }
export interface XGBoostJSON { learner: { learner_model_param: { base_score:string }; gradient_booster:{ model:{ trees:Tree[]; iteration_indptr:number[] } } } }
export interface ModelSchema { features:string[]; category_mappings:{load_convention:Record<string,number>}; prediction_min_reps:number; prediction_max_reps:number }
export function predictDelta(model:XGBoostJSON, schema:ModelSchema, features:FeatureMap):number {
  const raw = JSON.parse(model.learner.learner_model_param.base_score) as number[];
  let prediction = raw[0];
  const values = schema.features.map(k => {
    const v = features[k]; return typeof v === 'number' && Number.isFinite(v) ? Math.fround(v) : NaN;
  });
  for (const tree of model.learner.gradient_booster.model.trees) {
    let node = 0;
    while (tree.left_children[node] !== -1) {
      const index = tree.split_indices[node];
      const value = values[index];
      if (tree.split_type[node] !== 0) throw new Error('Categorical split requires separate implementation');
      node = Number.isNaN(value)
        ? (tree.default_left[node] ? tree.left_children[node] : tree.right_children[node])
        : (value < Math.fround(tree.split_conditions[node]) ? tree.left_children[node] : tree.right_children[node]);
    }
    prediction += tree.split_conditions[node];
  }
  return prediction;
}
export function predictNextReps(model:XGBoostJSON,schema:ModelSchema,features:FeatureMap):number {
  const prev=features.previous_reps;
  if(typeof prev!=='number'||!Number.isFinite(prev)||prev<0) throw new Error('Valid previous reps required');
  return Math.max(schema.prediction_min_reps,Math.min(schema.prediction_max_reps,prev+predictDelta(model,schema,features)));
}
