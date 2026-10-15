import { describe, expect, it } from "vitest";
import type { LibraryExercise } from "../src/db/programmeRepo";
import { substitutionCandidates } from "../src/logic/substitutions";
import { replacementDisplay, replacementRange } from "../src/logic/replacement";
import { freshDb } from "./helpers";

const exercise = (id:string, patch:Partial<LibraryExercise> = {}):LibraryExercise => ({id,seedKey:null,nameEn:id,nameAr:id,aliasesAr:[],pattern:"horizontal_push",equipment:"barbell",setup:"free",measure:"reps",isCustom:true,...patch});
describe("exercise substitution candidates", () => {
  it("ranks up to three matching movements and excludes incompatible or unavailable choices", () => {
    const source = exercise("bench");
    const list = [exercise("db",{equipment:"dumbbell"}),exercise("bar"),exercise("machine",{equipment:"machine"}),exercise("wrong-motion",{pattern:"vertical_push"}),exercise("timed",{measure:"time"}),exercise("assisted",{setup:"assisted"}),exercise("present"),source];
    expect(substitutionCandidates(source,list,["barbell","dumbbell"],["present"]).map(ex=>ex.id)).toEqual(["bar","db"]);
    expect(substitutionCandidates(source,[...list,exercise("a"),exercise("b"),exercise("c")],["barbell","dumbbell"]).length).toBe(3);
    expect(substitutionCandidates(exercise("unknown",{pattern:"other"}),list,["barbell"])).toEqual([]);
  });
  it("accepts an explicit exercise grid without fabricating cross-exercise loads", () => {
    const candidate = exercise("own-machine",{equipment:"machine",loadSpec:{equipment:"machine",loads:[12,18,24]}});
    expect(substitutionCandidates(exercise("bench"),[candidate],[])).toEqual([candidate]);
    expect(candidate.loadSpec?.loads).toEqual([12,18,24]);
  });
});
describe("replacement prescriptions", () => {
  it("never interprets reps as seconds or metres, but preserves a same-measure range", () => {
    const original = {measure:"reps" as const,repMin:6,repMax:10};
    expect(replacementRange(original,"time")).toEqual({repMin:30,repMax:60});
    expect(replacementRange(original,"distance")).toEqual({repMin:20,repMax:40});
    expect(replacementRange({...original,measure:"time"},"reps")).toEqual({repMin:6,repMax:10});
    expect(replacementRange(original,"reps")).toEqual({repMin:6,repMax:10});
  });
  it("uses the replacement's pattern/grid and resets rep-only controls for timed work", async () => {
    const c = await freshDb(); await c.repos.seedIfNeeded();
    const day = (await c.repos.getNextDay())!;
    const original = (await c.repos.listDayExercises(day.day.id))[0]!;
    const source = {...original,sets:5,topSets:2,trackEffort:true,loadSpec:{equipment:"barbell" as const,loads:[60,65,70]}};
    const own = {equipment:"machine" as const,loads:[10,20,30]};
    const replacement = replacementDisplay(source,exercise("hold",{measure:"time",pattern:"core",equipment:"machine",loadSpec:own}));
    expect(replacement).toMatchObject({slot:source.exerciseId,sets:5,measure:"time",pattern:"core",repMin:30,repMax:60,topSets:null,trackEffort:false,isGoalLift:false,repCeilingIsCustom:false});
    expect(replacement.loadSpec).toBe(own);
    expect(replacementDisplay(source,exercise("db",{equipment:"dumbbell"})).loadSpec).toBeNull();
    expect(source.repMax).toBe(original.repMax);
    expect(source.loadSpec.loads).toEqual([60,65,70]);
  });
  it("permanent swaps store the new quantity range while preserving set count", async () => {
    const c = await freshDb(); await c.repos.seedIfNeeded();
    const gymId = (await c.repos.getActiveGymId())!;
    const day = (await c.repos.getNextDay())!;
    const original = (await c.repos.listDayExercises(day.day.id))[0]!;
    const hold = await c.programmes.createExercise({nameEn:"Test hold",pattern:"core",equipment:"plate",setup:"free",measure:"time"});
    await c.db.run("UPDATE programme_day_exercise SET sets = 5, top_sets = 2, track_effort = 1, rep_ceiling = 12 WHERE programme_day_id = ? AND exercise_id = ?",[day.day.id,original.exerciseId]);
    const session = await c.workout.startOrResumeSession(day.day.id,gymId);
    await c.workout.replaceExercise(session.id,original.exerciseId,original.exerciseId,hold,true);
    const changed = (await c.repos.listDayExercises(day.day.id)).find(ex=>ex.exerciseId===hold)!;
    expect(changed).toMatchObject({sets:5,measure:"time",repMin:30,repMax:60,topSets:null,trackEffort:false,isGoalLift:false,repCeilingIsCustom:false});
    const gym = await c.repos.loadGymFingerprint(gymId);
    await c.workout.logSet({sessionId:session.id,exerciseId:hold,load:0,reps:1,durationS:35},{gym,equipment:"plate",setup:"free"});
    const saved = await c.workout.listSessionSets(session.id,hold);
    expect(saved[0]).toMatchObject({durationS:35,reps:1});
  });
  it("library data carries a replacement's configured load grid", async () => {
    const c = await freshDb(); await c.repos.seedIfNeeded();
    const id = await c.programmes.createExercise({nameEn:"Custom swap",pattern:"horizontal_push",equipment:"machine",setup:"free"});
    await c.programmes.setExerciseLoads(id,{equipment:"machine",loads:[12,18,24]});
    expect((await c.programmes.listExercises()).find(ex=>ex.id===id)?.loadSpec).toMatchObject({equipment:"machine",loads:[12,18,24]});
  });
});
