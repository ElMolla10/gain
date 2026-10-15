import { describe, expect, it } from "vitest";
import { freshDb } from "./helpers";

async function setup() {
  const ctx = await freshDb(); await ctx.repos.seedIfNeeded();
  const gymId = (await ctx.repos.getActiveGymId())!;
  const gym = await ctx.repos.loadGymFingerprint(gymId);
  const day = (await ctx.repos.getNextDay())!.day;
  const ex = (await ctx.repos.listDayExercises(day.id))[0]!;
  const train = async (options: { warmup?: boolean; tags?: string[]; load?: number; reps?: number } = {}) => {
    const { id } = await ctx.workout.startOrResumeSession(day.id, gymId);
    const set = await ctx.workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load: options.load ?? 60, reps: options.reps ?? 8, warmup: options.warmup, tags: options.tags }, { gym, equipment: ex.equipment, setup: ex.setup });
    ctx.deps.tick(); await ctx.workout.finishSession(id); ctx.deps.tick();
    return { sessionId: id, setId: set.id };
  };
  return { ...ctx, train };
}

describe("personal progress from saved history", () => {
  it("counts one day for split workouts and follows saved goal settings", async () => {
    const c = await setup();
    await c.repos.setSetting("days_per_week", "3");
    await c.train(); await c.train();
    expect(await c.history.getPersonalProgress()).toMatchObject({ activeDays: 1, done: 1, goal: 3, totalSessions: 2 });
  });
  it("does not reward warmups, drop sets, pending outliers or deleted workouts", async () => {
    const c = await setup();
    await c.train({ warmup: true }); await c.train({ tags: ["drop"] });
    const valid = await c.train();
    expect((await c.history.getPersonalProgress()).activeDays).toBe(1);
    await c.history.deleteWorkout(valid.sessionId);
    expect((await c.history.getPersonalProgress()).activeDays).toBe(0);
    const pending = await c.train();
    await c.db.run("UPDATE workout_set SET outlier_status = 'unconfirmed' WHERE id = ?", [pending.setId]);
    expect((await c.history.getPersonalProgress()).activeDays).toBe(0);
    await c.history.updateSet(pending.setId, { load: 60, reps: 8, rir: null });
    expect((await c.history.getPersonalProgress()).activeDays).toBe(1);
    await c.history.removeSet(pending.setId);
    expect((await c.history.getPersonalProgress()).activeDays).toBe(0);
  });
  it("uses the active short week's goal, then restores the normal goal", async () => {
    const c = await setup();
    await c.repos.setSetting("days_per_week", "4");
    await c.shortWeek.apply(2, null, c.deps.now(), -new Date(c.deps.now()).getTimezoneOffset() * 60_000);
    expect((await c.history.getPersonalProgress()).goal).toBe(2);
    c.deps.tick(8 * 86_400_000);
    expect((await c.history.getPersonalProgress()).goal).toBe(4);
  });
  it("recalculates before-and-after results after history corrections", async () => {
    const c = await setup();
    const first = await c.train({ reps: 5 }); const second = await c.train({ reps: 6 });
    expect((await c.finish.summarizeSession(second.sessionId)).exercises[0]).toMatchObject({ previousAtLoad: 5, records: ["reps_at_load"] });
    await c.history.updateSet(first.setId, { load: 60, reps: 7, rir: null });
    expect((await c.finish.summarizeSession(second.sessionId)).exercises[0]).toMatchObject({ previousAtLoad: 7, records: [] });
  });
});
