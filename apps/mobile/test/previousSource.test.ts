import { describe, expect, it } from "vitest";
import { freshDb } from "./helpers";

describe("Previous display history", () => {
  it("selects trusted exercise history across days or on the same routine day", async () => {
    const c = await freshDb();
    await c.repos.seedIfNeeded();
    const gymId = (await c.repos.getActiveGymId())!;
    const gym = await c.repos.loadGymFingerprint(gymId);
    const day = (await c.repos.getNextDay())!.day;
    const ex = (await c.repos.listDayExercises(day.id))[0]!;
    const otherDay = (await c.db.get<{ id: string }>("SELECT id FROM programme_day WHERE id != ? AND deleted_at IS NULL LIMIT 1", [day.id]))!.id;
    const train = async (dayId: string, load: number, reps: number) => {
      const { id } = await c.workout.startOrResumeSession(dayId, gymId);
      const set = await c.workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load, reps }, { gym, equipment: ex.equipment, setup: ex.setup });
      c.deps.tick();
      await c.workout.finishSession(id);
      c.deps.tick();
      return set.id;
    };
    await train(day.id, 60, 8);
    await train(otherDay, 62.5, 7);
    const untrusted = await train(day.id, 200, 8);
    await c.db.run("UPDATE workout_set SET outlier_status = 'unconfirmed' WHERE id = ?", [untrusted]);
    const previous = await c.workout.previousPerformances(ex.exerciseId, day.id);
    expect(previous.any?.sets.map(s => [s.load, s.reps])).toEqual([[62.5, 7]]);
    expect(previous.routine?.sets.map(s => [s.load, s.reps])).toEqual([[60, 8]]);
    expect((await c.workout.previousPerformances("missing", day.id))).toEqual({ any: null, routine: null });
    await c.repos.setSetting("previous_source", "routine");
    expect(await c.repos.getSetting("previous_source")).toBe("routine");
  });
});
