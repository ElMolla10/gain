import { describe, expect, it } from "vitest";
import { openWorkoutContext } from "../src/logic/openWorkout";
import { attachLoads } from "../src/db/exerciseGrid";
import { freshDb } from "./helpers";
async function setup() {
  const ctx = await freshDb(); await ctx.repos.seedIfNeeded();
  const gymA = (await ctx.repos.getActiveGymId())!;
  const day = (await ctx.repos.getNextDay())!.day.id;
  const opened = await ctx.workout.startOrResumeSession(day, gymA);
  const gymB = await ctx.gyms.copyGym(gymA, "Second gym", true);
  await ctx.gyms.updateGym(gymA, { name: "Original gym", loads: [{ equipment: "barbell", increment: 2.5, min: 20, max: 200 }] });
  await ctx.gyms.updateGym(gymB, { name: "Second gym", loads: [{ equipment: "barbell", increment: 10, min: 20, max: 200 }] });
  return { ...ctx, gymA, gymB, day, sessionId: opened.id };
}
describe("workout gym context on resume", () => {
  it("uses the original gym for loads, save context and stored line after active gym changes", async () => {
    const c = await setup();
    const opened = (await openWorkoutContext(c.day, c))!;
    expect(opened).toMatchObject({ id: c.sessionId, resumed: true, gym: { gymId: c.gymA } });
    expect(opened.gym.loads[0]?.increment).toBe(2.5);
    const slots = await attachLoads(c.db, opened.gym, await c.repos.listDayExercises(c.day));
    const ex = slots.find(ex => ex.equipment === "barbell")!;
    expect(ex).toBeTruthy();
    const logged = await c.workout.logSet({ id: "resume-set", sessionId: opened.id, exerciseId: ex.exerciseId, load: 62.5, reps: 8 }, { gym: opened.gym, equipment: ex.equipment, setup: ex.setup });
    const saved = (await c.workout.listSessionSets(opened.id)).find(s => s.id === logged.id)!;
    const line = await c.db.get<{ gym_id: string }>("SELECT gym_id FROM exercise_line WHERE id = ?", [saved.lineId]);
    expect(line?.gym_id).toBe(opened.gym.gymId);
    expect((await c.workout.getSession(opened.id))?.gym_id).toBe(c.gymA);
    expect(await c.repos.getActiveGymId()).toBe(c.gymB);
  });
  it("resumes with the original gym when no active gym is selected", async () => {
    const c = await setup(); await c.repos.setSetting("active_gym_id", "");
    expect(await openWorkoutContext(c.day, c)).toMatchObject({ id: c.sessionId, gym: { gymId: c.gymA } });
  });
  it("fails rather than switching to active gym when the original gym is deleted", async () => {
    const c = await setup(); await c.db.run("UPDATE gym SET deleted_at = 1 WHERE id = ?", [c.gymA]);
    await expect(openWorkoutContext(c.day, c)).rejects.toThrow("Workout gym is unavailable");
    expect((await c.workout.getSession(c.sessionId))?.gym_id).toBe(c.gymA);
  });
  it("uses the active gym for a genuinely new session, and asks for a gym when none is selected", async () => {
    const c = await setup(); await c.workout.discardEmptySession(c.sessionId);
    expect(await openWorkoutContext(c.day, c)).toMatchObject({ resumed: false, gym: { gymId: c.gymB } });
    const current = (await c.workout.getOpenSession())!; await c.workout.discardEmptySession(current.id);
    await c.repos.setSetting("active_gym_id", "");
    expect(await openWorkoutContext(c.day, c)).toBeNull();
  });
});
