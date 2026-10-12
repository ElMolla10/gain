// Run: node --expose-gc --import tsx scripts/benchmark-live-adaptation.mjs
// Host measurements only; measure release Hermes builds separately before rollout.
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {predictDelta,predictNextReps,validateModel} from '../packages/engine/src/liveAdaptationInference.ts';
const asset=name=>new URL(`../packages/engine/assets/live-adaptation-v2/${name}`,import.meta.url);
const load=name=>JSON.parse(readFileSync(asset(name),'utf8'));
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*p)];
const summary=values=>({median_ms:percentile(values,.5),p95_ms:percentile(values,.95),max_ms:Math.max(...values)});
global.gc?.();
const memoryBefore=process.memoryUsage();
const start=performance.now();
const model=load('model.json'),schema=load('schema.json'),references=load('reference-predictions.json');
const loadMs=performance.now()-start;
const validationStart=performance.now();
validateModel(model,schema);
const validationMs=performance.now()-validationStart;
global.gc?.();
const memoryLoaded=process.memoryUsage();
const parity=references.map((row,index)=>{
 const delta=predictDelta(model,schema,row.features),reps=predictNextReps(model,schema,row.features);
 return {index,delta,expected_delta:row.predicted_delta,delta_error:Math.abs(delta-row.predicted_delta),reps_error:Math.abs(reps-row.predicted_reps),display_matches:Math.round(reps)===row.display_reps};
});
if(parity.length!==10||parity.some(row=>row.delta_error>1e-6||row.reps_error>1e-6||!row.display_matches)) throw new Error('Real-model reference parity failed');
const coldLoad=[],coldValidation=[];
for(let i=0;i<10;i++) {
 const t=performance.now(),m=load('model.json');coldLoad.push(performance.now()-t);
 const v=performance.now();validateModel(m,schema);coldValidation.push(performance.now()-v);
}
for(let i=0;i<2000;i++) predictDelta(model,schema,references[i%10].features);
const inference=[],cachedValidation=[];
for(let i=0;i<10000;i++) {
 const t=performance.now();predictDelta(model,schema,references[i%10].features);inference.push(performance.now()-t);
 const c=performance.now();validateModel(model,schema);cachedValidation.push(performance.now()-c);
}
global.gc?.();
const after=process.memoryUsage();
console.log(JSON.stringify({runtime:process.version,platform:process.platform,arch:process.arch,model_bytes:readFileSync(asset('model.json')).length,trees:model.learner.gradient_booster.model.trees.length,load_ms:loadMs,validation_ms:validationMs,cold_load:summary(coldLoad),cold_validation:summary(coldValidation),cached_validation:summary(cachedValidation),inference:summary(inference),memory:{gc_available:typeof global.gc==='function',model_retained_heap_bytes:memoryLoaded.heapUsed-memoryBefore.heapUsed,rss_delta_bytes:memoryLoaded.rss-memoryBefore.rss,after_benchmark_heap_bytes:after.heapUsed},parity},null,2));
