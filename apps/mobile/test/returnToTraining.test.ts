import { describe, expect, it } from "vitest";
import { RETURN_PLAN_KEY, canProgressReturn, comebackLoad, comebackPrefill, comebackSets, parseReturnPlan, returnSessionKey, returnStage } from "../src/logic/returnToTraining";
import { freshDb } from "./helpers";
import { initialRows, editRow } from "../src/logic/workoutRows";
import { applyLiveTarget } from "../src/logic/liveAdaptation";

const barbell = { equipment: "barbell" as const, loads: [20, 40, 50, 60, 70, 80] };
const dumbbell = { equipment: "dumbbell" as const, loads: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24] };

describe("optional return plan", () => {
  it("preserves the original plan, keeps one set per exercise, and progresses only on explicit eligible action", () => {
    expect([1, 2, 3, 4, 5].map(n => comebackSets(n, 1))).toEqual([1, 1, 2, 3, 3]);
    expect([1, 2, 3, 4].map(n => comebackSets(n, 2))).toEqual([1, 2, 3, 3]);
    const p = { active: true, versionId: "v", startedAt: 1_000, stage: 1 as const };
    expect(canProgressReturn(p, p.startedAt + 6 * 86_400_000, [{ feel: "smooth" }])).toBe(false);
    expect(canProgressReturn(p, p.startedAt + 7 * 86_400_000, [])).toBe(false);
    expect(canProgressReturn(p, p.startedAt + 7 * 86_400_000, [{ feel: "heavy" }])).toBe(false);
    expect(canProgressReturn(p, p.startedAt + 7 * 86_400_000, [{ feel: null }])).toBe(true);
    expect(canProgressReturn({ ...p, active: false }, p.startedAt + 8 * 86_400_000, [{ feel: "smooth" }])).toBe(false);
    expect(parseReturnPlan(JSON.stringify(p))).toEqual(p);
    expect(parseReturnPlan("{bad")).toBeNull();
    expect(returnStage("0")).toBeNull();
    expect(returnStage("2")).toBe(2);
  });

  it("rounds down to gym loads, handles assistance and bodyweight, and does not invent an unknown weight or effort", () => {
    expect(comebackLoad(80, barbell, "free", 1)).toBe(60);
    expect(comebackLoad(24, dumbbell, "free", 1)).toBe(20);
    expect(comebackLoad(24, dumbbell, "free", 2)).toBe(22);
    expect(comebackLoad(50, { equipment: "assisted", loads: [20, 40, 60, 80] }, "assisted", 1)).toBe(60);
    expect(comebackLoad(80, { equipment: "assisted", loads: [20, 40, 60, 80] }, "assisted", 1)).toBe(80);
    expect(comebackLoad(10, null, "bodyweight_plus_added", 1)).toBe(0);
    expect(comebackLoad(40, null, "free", 1)).toBeNull();
    expect(comebackLoad(40, null, "assisted", 1)).toBeNull();
    expect(comebackPrefill({ load: 80, reps: 8 }, barbell, "free", "reps", 1)).toEqual({ load: 60, reps: 8 });
    expect(comebackPrefill({ load: 80, reps: 30 }, barbell, "free", "time", 1)).toEqual({ load: 80, reps: 30 });
  });

  it("leaves saved values and typed overrides alone, and restores the original set count in normal mode", () => {
    const saved = [{ id: "saved", load: 80, reps: 8, rir: 2, warmup: false }];
    const easier = initialRows(saved, comebackSets(4, 1), { load: 60, reps: 8 }, () => "empty");
    expect(easier).toHaveLength(3);
    expect(easier[0]).toMatchObject({ load: 80, reps: 8, saved: true });
    const own = editRow(easier, "empty", { load: 70, reps: 7 });
    const suggested = applyLiveTarget(own, "empty", 60, 8);
    expect(suggested[1]).toMatchObject({ load: 70, reps: 7 });
    expect(initialRows(saved, 4, { load: 80, reps: 8 }, () => "normal")).toHaveLength(4);
  });

  it("persists a session's stage and keeps its logged sets visible without treating easier loads as normal progression", async () => {
    const c = await freshDb();
    await c.repos.seedIfNeeded();
    const next = (await c.repos.getNextDay())!;
    const gymId = (await c.repos.getActiveGymId())!;
    const gym = await c.repos.loadGymFingerprint(gymId);
    const ex = (await c.repos.listDayExercises(next.day.id))[0]!;
    const line = { exerciseId: ex.exerciseId, gymId, setup: ex.setup };
    const normal = await c.workout.startOrResumeSession(next.day.id, gymId);
    await c.workout.logSet({ sessionId: normal.id, exerciseId: ex.exerciseId, load: 80, reps: 8 }, { gym, equipment: ex.equipment, setup: ex.setup });
    await c.workout.finishSession(normal.id);
    const started = await c.workout.startOrResumeSession(next.day.id, gymId);
    await c.repos.setSetting(RETURN_PLAN_KEY, JSON.stringify({ active: true, versionId: next.versionId, stage: 1, startedAt: c.deps.now() }));
    await c.repos.setSetting(returnSessionKey(started.id), "1");
    await c.workout.setSessionReadiness(started.id, "returning");
    await c.workout.logSet({ sessionId: started.id, exerciseId: ex.exerciseId, load: 40, reps: 8 }, { gym, equipment: ex.equipment, setup: ex.setup });
    await c.workout.finishSession(started.id);
    const lineId = (await c.db.get<{ line_id: string }>("SELECT line_id FROM workout_set WHERE session_id = ?", [started.id]))!.line_id;
    expect(await c.workout.getHistory(line, lineId)).toHaveLength(2);
    expect((await c.workout.getHistory(line, lineId, true)).map(h => h.sets[0]!.load)).toEqual([80]);
    expect(await c.repos.getSetting(returnSessionKey(started.id))).toBe("1");
    expect((await c.workout.previousPerformances(ex.exerciseId, next.day.id)).any?.sets).toHaveLength(1);
    c.db.close();
  });
});
