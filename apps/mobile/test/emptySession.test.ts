import { describe, expect, it } from "vitest";
import { finishChoice } from "../src/logic/finishChoice";
import { freshDb } from "./helpers";

async function setup() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const gymId = (await ctx.repos.getActiveGymId())!;
  const gym = await ctx.repos.loadGymFingerprint(gymId);
  const day = (await ctx.repos.getNextDay())!.day;
  const exs = await ctx.repos.listDayExercises(day.id);
  const log = (sessionId: string, load = 60, reps = 8) => ctx.workout.logSet({ sessionId, exerciseId: exs[0]!.exerciseId, load, reps }, { gym, equipment: exs[0]!.equipment, setup: exs[0]!.setup });
  return { ...ctx, gymId, day, exs, log };
}

describe("P11 empty completed workouts", () => {
  it("finishChoice: zero logged sets makes 'discard empty workout' the primary action", () => {
    expect(finishChoice(0, 0)).toBe("discard-empty");
    expect(finishChoice(0, 3)).toBe("discard-empty");
    expect(finishChoice(4, 2)).toBe("confirm-unlogged");
    expect(finishChoice(4, 0)).toBe("finish");
  });

  it("discarding removes the empty session and lets Today plan the day again", async () => {
    const { workout, gymId, day, db } = await setup();
    const { id } = await workout.startOrResumeSession(day.id, gymId);
    expect(await workout.discardEmptySession(id)).toBe(true);
    expect(await workout.getSession(id)).toBeFalsy();
    expect(await workout.getOpenSession()).toBeNull();
    const row = await db.get<{ deleted_at: number | null }>("SELECT deleted_at FROM session WHERE id = ?", [id]);
    expect(row!.deleted_at).not.toBeNull(); // tombstone, so sync can carry it
    const again = await workout.startOrResumeSession(day.id, gymId);
    expect(again.id).not.toBe(id);
    expect(again.resumed).toBe(false);
  });

  it("a session with a logged set can never be discarded", async () => {
    const { workout, gymId, day, log } = await setup();
    const { id } = await workout.startOrResumeSession(day.id, gymId);
    await log(id);
    expect(await workout.discardEmptySession(id)).toBe(false);
    expect((await workout.getSession(id))!.status).toBe("in_progress");
    expect(await workout.discardEmptySession("no-such-session")).toBe(false);
  });

  it("an empty session that was finished anyway is excluded from History, counts and the rotation", async () => {
    const { workout, history, data, repos, gymId, day, log } = await setup();
    // one real workout
    const real = await workout.startOrResumeSession(day.id, gymId);
    await log(real.id);
    await workout.finishSession(real.id);
    expect(await history.countSessions()).toBe(1);
    const nextAfterReal = (await repos.getNextDay())!.day.id;
    // one empty workout, finished anyway
    const empty = await workout.startOrResumeSession(nextAfterReal, gymId);
    await workout.finishSession(empty.id);
    expect((await workout.getSession(empty.id))!.status).toBe("finished");
    expect(await history.countSessions()).toBe(1);
    expect((await history.listSessions()).map((s) => s.id)).toEqual([real.id]);
    expect(await history.getSession(empty.id)).toBeNull();
    expect((await data.counts()).sessions).toBe(1);
    expect((await repos.getNextDay())!.day.id).toBe(nextAfterReal); // the empty one did not advance the rotation
  });

  it("weekly counts ignore empty finished sessions", async () => {
    const { workout, weekly, gymId, day, log, deps } = await setup();
    const empty = await workout.startOrResumeSession(day.id, gymId);
    await workout.finishSession(empty.id);
    const nextWeek = deps.now() + 7 * 86_400_000;
    expect((await weekly.buildInput(nextWeek, 0)).sessionsDone).toBe(0);
    const real = await workout.startOrResumeSession(day.id, gymId);
    await log(real.id);
    await workout.finishSession(real.id);
    expect((await weekly.buildInput(nextWeek, 0)).sessionsDone).toBe(1);
  });
});
