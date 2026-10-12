import { describe,it,expect } from 'vitest';
import { readFileSync,existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname,join } from 'node:path';
import { predictDelta,predictNextReps,type XGBoostJSON,type ModelSchema } from './liveAdaptationInference';
const assets=join(dirname(fileURLToPath(import.meta.url)),'../assets/live-adaptation-v2');
const available=['model.json','schema.json','reference-predictions.json'].every(x=>existsSync(join(assets,x)));
const load=(name:string)=>JSON.parse(readFileSync(join(assets,name),'utf8'));
describe.skipIf(!available)('trained v2 parity',()=>{
 it('matches all ten Kaggle references',()=>{
  const model=load('model.json') as XGBoostJSON;
  const schema=load('schema.json') as ModelSchema;
  const references=load('reference-predictions.json') as Array<{features:Record<string,number|null>;predicted_delta:number;predicted_reps:number;display_reps:number}>;
  expect(references).toHaveLength(10);
  for(const row of references) {
   expect(predictDelta(model,schema,row.features)).toBeCloseTo(row.predicted_delta,4);
   const predicted=predictNextReps(model,schema,row.features);
   expect(predicted).toBeCloseTo(row.predicted_reps,4);
   expect(Math.round(predicted)).toBe(row.display_reps);
  }
 });
});
