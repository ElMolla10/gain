import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createWorkoutRepo } from "../src/db/workoutRepo";
import { createRepos } from "../src/db/repos";
import { migrate } from "../src/db/migrations";
import { openNodeDb } from "./nodeDriver";
import { freshDb, testDeps } from "./helpers";

async function setup() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const gymId = (await ctx.repos.getActiveGymId())!;
  const gym = await ctx.repos.loadGymFingerprint(gymId);
  const day = (await ctx.repos.getNextDay())!.day.id;
  const ex = (await ctx.repos.listDayExercises(day))[0]!;
  const { id } = await ctx.workout.startOrResumeSession(day, gymId);
  const input = { id:"retry-set",sessionId:id,exerciseId:ex.exerciseId,load:60,reps:8 };
  const dctx = { gym,equipment:ex.equipment,setup:ex.setup };
  return { ...ctx, input, dctx };
}

describe("saved workout recovery", () => {
  it("rolls back a failure after inserting the set and retries with the same id", async () => {
    const { db,workout,input,dctx } = await setup();
    const linesBefore = await db.all("SELECT id FROM exercise_line");
    const run = db.run.bind(db);
    const spy = vi.spyOn(db,"run").mockImplementation(async (sql,params) => {
      const result = await run(sql,params);
      if (sql.includes("INSERT INTO workout_set")) throw new Error("interrupted save");
      return result;
    });
    await expect(workout.logSet(input,dctx)).rejects.toThrow("interrupted save");
    spy.mockRestore();
    expect(await workout.listSessionSets(input.sessionId)).toEqual([]);
    expect(await db.all("SELECT id FROM exercise_line")).toEqual(linesBefore);
    expect(await workout.logSet(input,dctx)).toMatchObject({created:true,id:input.id});
    expect(await workout.logSet(input,dctx)).toMatchObject({created:false,id:input.id});
    expect(await workout.listSessionSets(input.sessionId)).toHaveLength(1);
  });
  it("serializes simultaneous retries and position allocation", async () => {
    const { workout,input,dctx } = await setup();
    const saved = await Promise.all([workout.logSet(input,dctx),workout.logSet(input,dctx),workout.logSet({...input,id:"second-set"},dctx)]);
    expect(saved.filter(s=>s.created)).toHaveLength(2);
    expect((await workout.listSessionSets(input.sessionId)).map(s=>s.position)).toEqual([1,2]);
  });
  it("resumes committed sets after closing and reopening a file-backed database", async () => {
    const dir = mkdtempSync(join(tmpdir(),"gain-recovery-"));
    const path = join(dir,"gain.db");
    let db = openNodeDb(path);
    try {
      await migrate(db);
      const deps = testDeps();
      const repos = createRepos(db,deps);
      await repos.seedIfNeeded();
      const gymId = (await repos.getActiveGymId())!;
      const gym = await repos.loadGymFingerprint(gymId);
      const day = (await repos.getNextDay())!.day.id;
      const ex = (await repos.listDayExercises(day))[0]!;
      const workout = createWorkoutRepo(db,deps);
      const {id} = await workout.startOrResumeSession(day,gymId);
      const input = {id:"durable-set",sessionId:id,exerciseId:ex.exerciseId,load:60,reps:8};
      const dctx = {gym,equipment:ex.equipment,setup:ex.setup};
      await workout.logSet(input,dctx);
      db.close();
      db = openNodeDb(path);
      await migrate(db);
      const resumed = createWorkoutRepo(db,deps);
      expect(await resumed.startOrResumeSession(day,gymId)).toEqual({id,resumed:true});
      expect(await resumed.listSessionSets(id)).toMatchObject([{id:"durable-set",load:60,reps:8,position:1}]);
      expect(await resumed.logSet(input,dctx)).toMatchObject({created:false});
      expect(await resumed.listSessionSets(id)).toHaveLength(1);
    } finally {
      db.close();
      rmSync(dir,{recursive:true,force:true});
    }
  });
});
