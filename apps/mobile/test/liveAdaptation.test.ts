import { describe, expect, it } from "vitest";
import { applyLiveLoad, liveContext, livePerformanceKey, localPrediction, reportedSymptomDecision, tryLiveRecommendation, nextAdaptiveRow, suggestedNextLoad } from "../src/logic/liveAdaptation";
import { initialRows, editRow, markSaved } from "../src/logic/workoutRows";
import type { SetRow } from "../src/db/workoutRepo";
const saved = (extra: Partial<SetRow> = {}): SetRow => ({ id:"s1", sessionId:"session", exerciseId:"bench", lineId:"line", position:1, load:60, reps:10, durationS:null, distanceM:null, rir:2, warmup:false, tags:[], outlierStatus:"none", createdAt:100, ...extra });
const rows = () => initialRows([],3,{load:60,reps:8}, (()=>{let n=0;return()=>`draft${++n}`;})());
const context = (extra: Partial<Parameters<typeof liveContext>[0]> = {}) => liveContext({ exerciseId:"bench", measure:"reps", setup:"free", equipment:"barbell", sets:[saved()], rows:rows(), targetReps:8,...extra });
describe("live logger adapter", () => {
  it("recommends a load after the first saved set even without a next-set target", () => {
    const unprefilled = initialRows([], 3, { load: null, reps: null }, (() => { let n = 0; return () => `blank${++n}`; })());
    const exerciseRows = markSaved(editRow(unprefilled, "blank1", { load: 24, reps: 10 }), "blank1");
    const result = context({ rows: exerciseRows, sets: [saved({ id: "blank1", load: 24, reps: 10 })], equipment: "dumbbell" });
    expect(result).not.toBeNull();
    expect(result!.previousSetWeightKg).toBe(24);
    expect(result!.proposedWeightKg).toBe(24);
    const decision = tryLiveRecommendation(result!, 8, 10, { equipment: "dumbbell", loads: [22, 24, 26] }, () => 9);
    expect(decision).not.toBeNull();
    expect(Number.isFinite(decision!.suggestedWeightKg)).toBe(true);
    expect(exerciseRows[1]!.load).toBeNull();
    expect(exerciseRows[1]!.ghostLoad).toBeNull();

    const manuallyChanged = editRow(exerciseRows, "blank2", { load: 26 });
    expect(context({ rows: manuallyChanged, sets: [saved({ id: "blank1", load: 24, reps: 10 })], equipment: "dumbbell" })!.proposedWeightKg).toBe(26);
  });
  it("excludes known unsupported exercises from the workout-wide fatigue counter", () => {
    const result = context({ sets: [saved(), saved({ id: "assisted", exerciseId: "assisted-pullup" })], supportedExerciseIds: ["bench"] })!;
    expect(result.workoutSetsBefore).toBe(1);
  });
  it("only successful persisted confirmed sets supply context, including on resume", () => {
    expect(context({sets:[]})).toBeNull();
    expect(context({sets:[saved({outlierStatus:"unconfirmed"})]})).toBeNull();
    expect(context({sets:[saved({outlierStatus:"rejected"})]})).toBeNull();
    const result = context({sets:[saved({outlierStatus:"confirmed"}),saved({id:"s2",reps:7,position:2}),saved({id:"other",exerciseId:"row",reps:20})]})!;
    expect(result.previousSetReps).toBe(7);
    expect(result.firstWorkingSetReps).toBe(10);
    expect(result.priorWorkingVolume).toBe(1020);
    expect(result.workingSetsBefore).toBe(2);
    expect(result.setIndex).toBe(3);
    expect(result.previousSetRpe).toBeNull();
    expect(result.restSeconds).toBeNull();
    expect(result.priorWorkoutsOnEquipment).toBeNull();
  });
  it("excludes unsupported setups, quantities and special sets", () => {
    for (const measure of ["time","distance"] as const) expect(context({measure})).toBeNull();
    for (const setup of ["assisted","bodyweight_plus_added"] as const) expect(context({setup})).toBeNull();
    for (const tags of [["drop"],["failure"]]) expect(context({sets:[saved({tags})]})).toBeNull();
    expect(context({equipment:"assisted"})).toBeNull();
    expect(context({equipment:"plate"})!.loadConvention).toBe("unknown");
  });
  it("invalidates edits and unlogs instead of retaining a stale recommendation", () => {
    const draft=markSaved(rows(),"draft1");
    expect(context({rows:editRow(draft,"draft1",{reps:7})})).toBeNull();
    const before=livePerformanceKey([saved()],"bench");
    expect(livePerformanceKey([saved({reps:7})],"bench")).not.toBe(before);
    expect(livePerformanceKey([],"bench")).not.toBe(before);
    expect(livePerformanceKey([saved({outlierStatus:"unconfirmed"})],"bench")).not.toBe(before);
  });
  it("applies only the next unsaved normal row and preserves manual load and every other row", () => {
    const original=rows();
    const changed=applyLiveLoad(original,"draft1",57.5);
    expect(changed[0]!.ghostLoad).toBe(57.5);
    expect(changed[1]).toBe(original[1]);
    expect(applyLiveLoad(original,"draft2",57.5)).toBe(original);
    const manual=editRow(original,"draft1",{load:65});
    expect(applyLiveLoad(manual,"draft1",57.5)).toBe(manual);
    const warm=editRow(original,"draft1",{warmup:true});
    expect(nextAdaptiveRow(warm)).toBeUndefined();
    expect(applyLiveLoad(warm,"draft1",57.5)).toBe(warm);
  });
  it("evaluates the real bundled offline model with missing optional inputs", () => {
    const features = { previous_reps:10, relative_load_change:0, load_convention:2, first_working_set_reps:10, working_sets_before:1, set_index:2, target_reps:8 };
    const prediction = localPrediction(features);
    expect(Number.isFinite(prediction)).toBe(true);
    expect(localPrediction(features)).toBe(prediction);
  });
});

describe("live adaptation with persisted sessions", () => {
  it("waits for SQLite save success, resumes, invalidates updates and handles confirmations", async () => {
    const { freshDb } = await import("./helpers");
    const { vi } = await import("vitest");
    const { db, repos, workout } = await freshDb();
    await repos.seedIfNeeded();
    const gymId = (await repos.getActiveGymId())!;
    const gym = await repos.loadGymFingerprint(gymId);
    const day = (await repos.getNextDay())!;
    const bench = (await repos.listDayExercises(day.day.id))[0]!;
    const { id } = await workout.startOrResumeSession(day.day.id,gymId);
    const dctx = { gym, equipment:bench.equipment, setup:bench.setup };
    const read = async () => context({exerciseId:bench.exerciseId, sets:await workout.listSessionSets(id)});
    expect(await read()).toBeNull();
    const run = vi.spyOn(db,"run");
    run.mockRejectedValueOnce(new Error("disk full"));
    await expect(workout.logSet({id:"confirmed",sessionId:id,exerciseId:bench.exerciseId,load:60,reps:10},dctx)).rejects.toThrow("disk full");
    run.mockRestore();
    expect(await read()).toBeNull();
    await workout.logSet({id:"confirmed",sessionId:id,exerciseId:bench.exerciseId,load:60,reps:10},dctx);
    expect((await read())!.previousSetReps).toBe(10);
    expect(await workout.startOrResumeSession(day.day.id,gymId)).toEqual({id,resumed:true});
    expect((await read())!.workingSetsBefore).toBe(1);
    await workout.updateLiveSet("confirmed",{load:60,reps:7,rir:null,warmup:false,tags:[]},dctx);
    expect((await read())!.previousSetReps).toBe(7);
    await workout.setOutlierStatus("confirmed","unconfirmed");
    expect(await read()).toBeNull();
    await workout.setOutlierStatus("confirmed","confirmed");
    expect((await read())!.previousSetReps).toBe(7);
    await workout.deleteSet("confirmed");
    expect(await read()).toBeNull();
  });
  it("does not use an older normal set after an unsupported or unconfirmed latest set", () => {
    for (const tail of [{outlierStatus:"unconfirmed" as const},{tags:["drop"]},{tags:["failure"]},{warmup:true}]) {
      expect(context({sets:[saved(),saved({id:"latest",...tail})]})).toBeNull();
    }
  });
  it("uses trusted prior exercise-line performance and leaves equipment counts unknown", () => {
    const result=context({last:{performedAt:"2026-01-01T00:00:00Z", sets:[{load:20,reps:15,warmup:true},{load:55,reps:12,outlierStatus:"confirmed"}]}})!;
    expect(result.previousWorkoutFirstWeightKg).toBe(55);
    expect(result.previousWorkoutFirstReps).toBe(12);
    expect(result.daysSincePreviousWorkout).toBeNull();
    expect(result.priorWorkoutsOnEquipment).toBeNull();
  });
});

describe("inline suggested load for each AI action", () => {
  it("displays the maintained weight as a valid suggestion", () => {
    const maintain = { action: "maintain" as const, suggestedWeightKg: 24, predictedReps: 9, reason: "within_range" as const };
    expect(suggestedNextLoad(maintain, true)).toBe(24);
    expect(suggestedNextLoad({ ...maintain, action: "increase", suggestedWeightKg: 26 }, true)).toBe(26);
    expect(suggestedNextLoad({ ...maintain, action: "decrease", suggestedWeightKg: 22 }, true)).toBe(22);
    expect(suggestedNextLoad({ ...maintain, action: "stop" }, true)).toBeNull();
    expect(suggestedNextLoad(maintain, false)).toBeNull();
    expect(suggestedNextLoad(undefined, true)).toBeNull();
  });
});

describe("live card presentation and fallback", () => {
  it("overrides only explicitly reported symptoms without invoking or altering normal predictions", () => {
    for (const action of ["increase","maintain","decrease","stop"] as const) {
      const normal = { action, suggestedWeightKg:60, predictedReps:8, reason:"within_range" as const };
      expect(reportedSymptomDecision(normal)).toBe(normal);
      for (const symptom of ["severe_pain","dizziness"] as const) {
        const stop=reportedSymptomDecision(normal,symptom);
        expect(stop).toEqual({...normal,action:"stop",reason:"reported_symptoms"});
        expect(normal.action).toBe(action);
      }
    }
  });
  it("applies kilograms internally while displaying a suggestion in pounds", async () => {
    const { weightText } = await import("../src/logic/units");
    const original=rows();
    const applied=applyLiveLoad(original,"draft1",57.5);
    expect(applied[0]!.ghostLoad).toBe(57.5);
    expect(weightText(applied[0]!.ghostLoad!,"lb")).toBe("126.8");
    expect(original[0]!.ghostLoad).toBe(60);
  });
  it("real inference failure leaves the deterministic row plan and running rest timer intact", async () => {
    const { newTimer, startTimer, remainingMs } = await import("../src/logic/restTimer");
    const plan=rows();
    const timer=startTimer(newTimer(90),1000);
    let reported: unknown;
    const decision=tryLiveRecommendation(context({rows:plan})!,6,10,{equipment:"barbell",loads:[55,57.5,60,62.5]},features=>localPrediction({...features,previous_reps:NaN}),error=>{reported=error;});
    expect(decision).toBeNull();
    expect(reported).toBeInstanceOf(Error);
    expect(plan[0]!.ghostLoad).toBe(60);
    expect(plan.every(r=>!r.saved)).toBe(true);
    expect(remainingMs(timer,2000)).toBe(89000);
  });
});
