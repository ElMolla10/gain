/** Offline numerical XGBoost evaluator. Validated model/schema objects are immutable. */
export type FeatureValue = number | null | undefined;
export type FeatureMap = Record<string, FeatureValue>;
export interface Tree {
  left_children:number[]; right_children:number[]; split_indices:number[];
  split_conditions:number[]; default_left:number[]; split_type:number[];
}
export interface XGBoostJSON {
  version?:number[];
  learner: {
    feature_names?:string[];
    objective?:{name:string};
    learner_model_param:{base_score:string;num_feature?:string;num_target?:string;num_class?:string};
    gradient_booster:{name?:string;model:{trees:Tree[];iteration_indptr:number[];tree_info?:number[]}};
  };
}
export interface ModelSchema {
  features:string[]; category_mappings:{load_convention:Record<string,number>};
  prediction_min_reps:number; prediction_max_reps:number; model_version?:string;
}
const validated = new WeakMap<XGBoostJSON, WeakMap<ModelSchema,number>>();

/** Validate once on first use, without retaining unreferenced models. */
export function validateModel(model:XGBoostJSON,schema:ModelSchema):void {
  baseScore(model,schema);
}
function baseScore(model:XGBoostJSON,schema:ModelSchema):number {
  const cached=validated.get(model)?.get(schema);
  if(cached!==undefined) return cached;
  const fail=(reason:string):never=>{throw new Error(`Invalid XGBoost model: ${reason}`);};
  const version=model.version;
  if(!Array.isArray(version)||version.length!==3||version.some(v=>!Number.isInteger(v)||v<0)||version[0]!<1||version[0]!>3) fail('unsupported version');
  if(schema.model_version!==undefined&&!/^2\./.test(schema.model_version)) fail('unsupported schema model version');
  const learner=model.learner;
  if(learner?.objective?.name!=='reg:squarederror') fail('unsupported objective');
  if(learner.gradient_booster?.name!=='gbtree') fail('unsupported booster');
  const param=learner.learner_model_param;
  if(Number(param.num_target??1)!==1||Number(param.num_class??0)!==0) fail('only single-output regression is supported');
  if(!Array.isArray(schema.features)||schema.features.length===0||new Set(schema.features).size!==schema.features.length) fail('invalid schema features');
  if(Number(param.num_feature)!==schema.features.length||!Array.isArray(learner.feature_names)||learner.feature_names.length!==schema.features.length||learner.feature_names.some((v,i)=>v!==schema.features[i])) fail('feature order mismatch');
  if(!Number.isFinite(schema.prediction_min_reps)||!Number.isFinite(schema.prediction_max_reps)||schema.prediction_min_reps>schema.prediction_max_reps) fail('invalid prediction bounds');
  let parsed:unknown;
  try {parsed=JSON.parse(param.base_score);} catch {fail('invalid base score');}
  const score=Array.isArray(parsed)&&parsed.length===1?parsed[0]:parsed;
  if(typeof score!=='number'||!Number.isFinite(score)||!Number.isFinite(Math.fround(score))) fail('invalid base score');
  const booster=learner.gradient_booster.model;
  if(!Array.isArray(booster.trees)||booster.trees.length===0) fail('missing trees');
  if(!Array.isArray(booster.iteration_indptr)||booster.iteration_indptr.length<2||booster.iteration_indptr[0]!==0||booster.iteration_indptr.at(-1)!==booster.trees.length||booster.iteration_indptr.some((v,i,a)=>!Number.isInteger(v)||v<0||(i>0&&v<a[i-1]!))) fail('invalid tree iteration boundaries');
  if(booster.tree_info&&(booster.tree_info.length!==booster.trees.length||booster.tree_info.some(v=>v!==0))) fail('unsupported tree output group');
  for(const tree of booster.trees) {
    const arrays=[tree.left_children,tree.right_children,tree.split_indices,tree.split_conditions,tree.default_left,tree.split_type];
    const count=tree.left_children?.length;
    if(!count||arrays.some(a=>!Array.isArray(a)||a.length!==count)) fail('inconsistent tree arrays');
    for(let node=0;node<count;node++) {
      if(tree.split_type[node]!==0) fail('categorical splits are unsupported');
      if(!Number.isFinite(tree.split_conditions[node]!)||!Number.isFinite(Math.fround(tree.split_conditions[node]!))) fail('non-finite tree value');
      if(tree.default_left[node]!==0&&tree.default_left[node]!==1) fail('invalid tree missing direction');
      const left=tree.left_children[node]!,right=tree.right_children[node]!;
      if(left===-1&&right===-1) continue;
      if(!Number.isInteger(left)||!Number.isInteger(right)||left<0||right<0||left>=count||right>=count) fail('invalid tree child');
      const feature=tree.split_indices[node]!;
      if(!Number.isInteger(feature)||feature<0||feature>=schema.features.length) fail('invalid split feature');
    }
    // Every node must belong to a rooted tree; detects cycles and multiple parents.
    const seen=new Set<number>(),stack=[0];
    while(stack.length) {
      const node=stack.pop()!;
      if(seen.has(node)) fail('cyclic or shared tree node');
      seen.add(node);
      if(tree.left_children[node]! !== -1) stack.push(tree.left_children[node]!,tree.right_children[node]!);
    }
    if(seen.size!==count) fail('unreachable tree nodes');
  }
  let schemas=validated.get(model);
  if(!schemas) {schemas=new WeakMap();validated.set(model,schemas);}
  const initial=Math.fround(score as number);
  schemas.set(schema,initial);
  return initial;
}
export function predictDelta(model:XGBoostJSON,schema:ModelSchema,features:FeatureMap):number {
  let prediction=baseScore(model,schema);
  const values=schema.features.map(key=>{
    const value=features[key];
    return typeof value==='number'&&Number.isFinite(value)&&Number.isFinite(Math.fround(value))?Math.fround(value):NaN;
  });
  for(const tree of model.learner.gradient_booster.model.trees) {
    let node=0,steps=0;
    while(tree.left_children[node]! !== -1) {
      if(++steps>tree.left_children.length||node<0||node>=tree.left_children.length) throw new Error('Invalid tree traversal');
      const value=values[tree.split_indices[node]!]!;
      node=Number.isNaN(value)
        ?(tree.default_left[node]?tree.left_children[node]!:tree.right_children[node]!)
        :(value<Math.fround(tree.split_conditions[node]!)?tree.left_children[node]!:tree.right_children[node]!);
    }
    if(!Number.isFinite(tree.split_conditions[node]!)) throw new Error('Invalid tree leaf');
    prediction=Math.fround(prediction+Math.fround(tree.split_conditions[node]!));
  }
  if(!Number.isFinite(prediction)) throw new Error('Non-finite XGBoost prediction');
  return prediction;
}
export function predictNextReps(model:XGBoostJSON,schema:ModelSchema,features:FeatureMap):number {
  const prev=features.previous_reps;
  if(typeof prev!=='number'||!Number.isFinite(prev)||prev<0) throw new Error('Valid previous reps required');
  return Math.max(schema.prediction_min_reps,Math.min(schema.prediction_max_reps,prev+predictDelta(model,schema,features)));
}
