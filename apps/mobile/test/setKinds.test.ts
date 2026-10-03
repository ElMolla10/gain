import { describe, expect, it } from "vitest";
import { editRow, initialRows, isDropRow, kindOf, kindPatch, mergeRows, rowLabels, type SavedSet } from "../src/logic/workoutRows";
import { liveSummary, workingIndexes } from "../src/logic/liveSummary";
import { freshDb } from "./helpers";

let n = 0;
const key = () => `k${++n}`;

describe("set types in the row list (normal / warm-up / drop / failure)", () => {
  it("kindPatch sets exactly one kind, keeps unrelated tags, and a warm-up never carries drop/failure", () => {
    expect(kindPatch("drop")).toEqual({ warmup: false, tags: ["drop"] });
    expect(kindPatch("failure", ["drop"])).toEqual({ warmup: false, tags: ["failure"] });
    expect(kindPatch("warmup", ["failure", "x"])).toEqual({ warmup: true, tags: ["x"] });
    expect(kindPatch("normal", ["drop", "x"])).toEqual({ warmup: false, tags: ["x"] });
    for (const k of ["normal", "warmup", "drop", "failure"] as const) expect(kindOf(kindPatch(k))).toBe(k);
  });
  it("labels: W and D are not numbered, F is a working set that keeps its number slot", () => {
    let rows = initialRows([], 5, { load: 60, reps: 8 }, key);
    const k = rows.map((r) => r.key);
    rows = editRow(rows, k[0]!, kindPatch("warmup"));
    rows = editRow(rows, k[2]!, kindPatch("failure"));
    rows = editRow(rows, k[3]!, kindPatch("drop"));
    expect(rowLabels(rows)).toEqual(["W", "1", "F", "D", "3"]);
    // PREVIOUS lines up with working sets only: no warm-up, no drop set
    expect(workingIndexes(rows)).toEqual([null, 0, 1, null, 2]);
    expect(isDropRow(rows[3]!)).toBe(true);
  });
  it("a saved drop set comes back from the database as a drop row", () => {
    const saved: SavedSet[] = [{ id: "a", load: 60, reps: 8, rir: null, warmup: false }, { id: "b", load: 45, reps: 10, rir: null, warmup: false, tags: ["drop"] }];
    const rows = mergeRows([], saved);
    expect(rowLabels(rows)).toEqual(["1", "D"]);
  });
  it("volume and sets still count drop and failure sets (real work), never warm-ups", () => {
    const s = liveSummary([{ load: 60, reps: 8, warmup: false }, { load: 40, reps: 10, warmup: false }, { load: 20, reps: 10, warmup: true }], null, 0);
    expect(s).toMatchObject({ sets: 2, volumeKg: 880 });
  });
});

describe("set types in the database", () => {
  async function open() {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    const gymId = (await ctx.repos.getActiveGymId())!;
    const gym = await ctx.repos.loadGymFingerprint(gymId);
    const next = (await ctx.repos.getNextDay())!;
    const bench = (await ctx.repos.listDayExercises(next.day.id))[0]!;
    const dctx = { gym, equipment: bench.equipment, setup: bench.setup };
    const finishOne = async (sets: [number, number, string[]?][]) => {
      const { id } = await ctx.workout.startOrResumeSession(next.day.id, gymId);
      for (const [load, reps, tags] of sets) await ctx.workout.logSet({ sessionId: id, exerciseId: bench.exerciseId, load, reps, tags }, dctx);
      ctx.deps.tick(1000);
      await ctx.workout.finishSession(id);
      ctx.deps.tick(3 * 86_400_000);
      return id;
    };
    return { ...ctx, gymId, gym, next, bench, dctx, finishOne };
  }

  it("tags are saved with the set and read back", async () => {
    const { workout, next, gymId, bench, dctx } = await open();
    const { id } = await workout.startOrResumeSession(next.day.id, gymId);
    await workout.logSet({ sessionId: id, exerciseId: bench.exerciseId, load: 60, reps: 8, tags: ["failure"] }, dctx);
    await workout.logSet({ sessionId: id, exerciseId: bench.exerciseId, load: 40, reps: 12, tags: ["drop"] }, dctx);
    expect((await workout.listSessionSets(id)).map((s) => s.tags)).toEqual([["failure"], ["drop"]]);
  });

  it("a drop set that is much lighter than the line is NOT flagged as an outlier (warm-ups and drops are lighter on purpose)", async () => {
    const { workout, next, gymId, bench, dctx, finishOne } = await open();
    await finishOne([[60, 8], [60, 8], [60, 8]]);
    await finishOne([[60, 8], [60, 8], [60, 8]]);
    await finishOne([[60, 8], [60, 8], [60, 8]]);
    const { id } = await workout.startOrResumeSession(next.day.id, gymId);
    const normal = await workout.logSet({ sessionId: id, exerciseId: bench.exerciseId, load: 20, reps: 8 }, dctx);
    const drop = await workout.logSet({ sessionId: id, exerciseId: bench.exerciseId, load: 20, reps: 8, tags: ["drop"] }, dctx);
    expect(normal.outlier?.verdict).toBe("unconfirmed"); // the same numbers as a normal working set are flagged
    expect(drop.outlier).toBeNull();
    expect((await workout.listSessionSets(id)).find((s) => s.id === drop.id)!.outlierStatus).toBe("none");
  });

  it("changing the type of a logged set (updateLiveSet) saves the tags; a drop set is never compared with the line", async () => {
    const { workout, next, gymId, bench, dctx, finishOne } = await open();
    await finishOne([[60, 8], [60, 8], [60, 8]]);
    await finishOne([[60, 8], [60, 8], [60, 8]]);
    const { id } = await workout.startOrResumeSession(next.day.id, gymId);
    const a = await workout.logSet({ sessionId: id, exerciseId: bench.exerciseId, load: 60, reps: 8 }, dctx);
    await workout.updateLiveSet(a.id, { load: 40, reps: 10, rir: null, warmup: false, tags: ["drop"] }, dctx);
    const row = (await workout.listSessionSets(id))[0]!;
    expect(row).toMatchObject({ load: 40, reps: 10, tags: ["drop"], outlierStatus: "none", warmup: false });
    await workout.updateLiveSet(a.id, { load: 60, reps: 8, rir: null, warmup: false, tags: [] }, dctx);
    expect((await workout.listSessionSets(id))[0]!.tags).toEqual([]);
  });

  it("drop sets never drive the next target and are not in PREVIOUS; failure sets still count as working sets", async () => {
    const { workout, finishOne, bench, gym } = await open();
    const spec = { exerciseId: bench.exerciseId, equipment: bench.equipment, setup: bench.setup, repMin: bench.repMin, repMax: bench.repMax, isGoalLift: bench.isGoalLift, trackEffort: false, sets: bench.sets };
    await finishOne([[60, 8], [60, 8, ["failure"]], [30, 15, ["drop"]]]);
    const { line, lineId } = await workout.liveProposal(spec, gym);
    const last = await workout.lastPerformance(line, lineId);
    expect(last!.sets.map((s) => s.load)).toEqual([60, 60]); // the drop set is not a "previous" working set
    const { proposal } = await workout.liveProposal(spec, gym);
    expect(proposal.load === null || proposal.load >= 60).toBe(true); // a 30 kg drop set did not pull the anchor down
  });
});
