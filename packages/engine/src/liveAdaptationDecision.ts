export type Action='increase'|'maintain'|'decrease'|'stop';
export interface DecisionInput { predictedReps:number; previousReps:number; targetMin:number; targetMax:number; currentWeightKg:number; nextAvailableWeightKg?:number; previousSetRpe?:number|null; severePain?:boolean; dizziness?:boolean; consecutiveVeryLowSets?:number }
export interface Decision { action:Action; suggestedWeightKg:number; reason:string; predictedReps:number }
/** Conservative product policy, not learned by the regression model. */
export function decideNextSet(x:DecisionInput):Decision {
  const {predictedReps:p,previousReps:prev,currentWeightKg:w,targetMin:min,targetMax:max}=x;
  if(![p,prev,w,min,max].every(Number.isFinite)||w<0||min<1||max<min) throw new Error('Invalid set inputs');
  if(x.severePain||x.dizziness||p<=2||(prev>=8&&p<=3)||(x.consecutiveVeryLowSets??0)>=2)
    return {action:'stop',suggestedWeightKg:w,predictedReps:p,reason:'Performance or symptoms suggest ending this exercise. If you feel pain or unwell, stop and assess before continuing.'};
  if(p<min) return {action:'decrease',suggestedWeightKg: Math.max(0,Math.round(w*0.95*2)/2),predictedReps:p,reason:`Predicted ${Math.round(p)} reps, below your ${min}–${max} target. Consider reducing the load or resting longer.`};
  if(p>max+1 && (x.previousSetRpe??0)<9 && x.nextAvailableWeightKg!==undefined && x.nextAvailableWeightKg>w)
    return {action:'increase',suggestedWeightKg:x.nextAvailableWeightKg,predictedReps:p,reason:`Predicted ${Math.round(p)} reps, above your target. A small increase may be appropriate.`};
  return {action:'maintain',suggestedWeightKg:w,predictedReps:p,reason:`Predicted ${Math.round(p)} reps. Keep the weight and reassess after the next set.`};
}
