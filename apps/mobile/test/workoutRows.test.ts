import { describe, expect, it } from "vitest";
import { acceptGhost, addRow, editRow, effectiveOf, initialRows, markSaved, mergeRows, removeRow, rowCanLog, rowLabels, rowReady, unloggedFilled, unlogRow, type SavedSet } from "../src/logic/workoutRows";
import { freshDb } from "./helpers";

let n = 0;
const key = () => `k${++n}`;
const target = { load: 60, reps: 8 };
const s = (id: string, load: number, reps: number, warmup = false): SavedSet => ({ id, load, reps, rir: null, warmup });

describe("workout rows (single list)", () => {
  it("shows the program's sets as rows with today's target as GHOST text (boxes empty), nothing invented without one", () => {
    const rows = initialRows([], 3, target, key);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.load === null && r.reps === null && r.ghostLoad === 60 && r.ghostReps === 8 && !r.saved)).toBe(true);
    expect(rows.every((r) => rowCanLog(r))).toBe(true); // one tap on the checkmark accepts the target
    const none = initialRows([], 2, { load: null, reps: null }, key);
    expect(none.every((r) => r.load === null && r.reps === null && !rowCanLog(r))).toBe(true);
  });
  it("ghost values only become the row's values when it is ticked; typed values win; one typed box keeps the other ghost", () => {
    const rows = initialRows([], 1, target, key);
    const k = rows[0]!.key;
    expect(effectiveOf(rows[0]!)).toEqual({ load: 60, reps: 8 });
    const typed = editRow(rows, k, { load: 65 });
    expect(effectiveOf(typed[0]!)).toEqual({ load: 65, reps: 8 });
    expect(rowReady(rows[0]!)).toBe(false);
    expect(acceptGhost(typed, k)[0]).toMatchObject({ load: 65, reps: 8 });
    expect(editRow(typed, k, { load: null })[0]).toMatchObject({ load: null }); // clearing a box falls back to the ghost
    expect(effectiveOf(editRow(typed, k, { load: null })[0]!).load).toBe(60);
  });
  it("un-ticking a logged row gives it a new id (the old set id is deleted) and keeps its numbers as ghost", () => {
    const rows = initialRows([s("a", 62.5, 6)], 1, target, key);
    const back = unlogRow(rows, "a", "new1");
    expect(back[0]).toMatchObject({ key: "new1", saved: false, dirty: false, load: 62.5, reps: 6, ghostLoad: 62.5, ghostReps: 6 });
    expect(rowCanLog(back[0]!)).toBe(true);
  });
  it("logged sets come first; only the missing working sets are padded; warm-ups do not count", () => {
    const rows = initialRows([s("a", 40, 10, true), s("b", 60, 8)], 3, target, key);
    expect(rows.map((r) => [r.saved, r.warmup])).toEqual([[true, true], [true, false], [false, false], [false, false]]);
    expect(rowLabels(rows)).toEqual(["W", "1", "2", "3"]);
    expect(initialRows([s("a", 60, 8), s("b", 60, 8), s("c", 60, 8), s("d", 60, 7)], 3, target, key)).toHaveLength(4); // more than planned stays
  });
  it("add set copies the last working row; remove drops just that row", () => {
    const rows = initialRows([s("a", 62.5, 6)], 1, target, key);
    const more = addRow(rows, target, key);
    expect(more).toHaveLength(2);
    expect(more[1]).toMatchObject({ load: null, reps: null, ghostLoad: 62.5, ghostReps: 6, saved: false });
    expect(addRow([], target, key)[0]).toMatchObject({ ghostLoad: 60, ghostReps: 8 });
    // the ghost follows an unlogged row too (typed 70 on the last row -> next ghost is 70)
    const typed = editRow(more, more[1]!.key, { load: 70 });
    expect(addRow(typed, target, key)[2]).toMatchObject({ ghostLoad: 70, ghostReps: 6 });
    expect(removeRow(more, more[1]!.key).map((r) => r.key)).toEqual(["a"]);
  });
  it("typing over a logged row makes it dirty until it is saved again", () => {
    let rows = initialRows([s("a", 60, 8)], 1, target, key);
    rows = editRow(rows, "a", { load: 62.5 });
    expect(rows[0]).toMatchObject({ load: 62.5, saved: true, dirty: true });
    expect(markSaved(rows, "a")[0]).toMatchObject({ saved: true, dirty: false });
    const fresh = initialRows([], 1, target, key);
    expect(editRow(fresh, fresh[0]!.key, { reps: 9 })[0]!.dirty).toBe(false);
  });
  it("a reload keeps unlogged rows and typed-over edits, and takes the database's order for logged sets", () => {
    let rows = initialRows([s("a", 60, 8)], 3, target, key);
    rows = editRow(rows, "a", { reps: 9 });
    const merged = mergeRows(rows, [s("a", 60, 8), s("b", 60, 8, true)]);
    expect(merged.map((r) => r.key).slice(0, 2)).toEqual(["a", "b"]);
    expect(merged[0]).toMatchObject({ reps: 9, dirty: true });
    expect(merged.filter((r) => !r.saved)).toHaveLength(2);
  });
  it("counts filled rows that finishing would leave out", () => {
    const rows = initialRows([s("a", 60, 8)], 3, target, key);
    expect(unloggedFilled(rows)).toBe(0); // untouched ghost rows are not "filled in"
    const typed = editRow(rows, rows[1]!.key, { load: 60, reps: 8 });
    expect(unloggedFilled(typed)).toBe(1);
    expect(unloggedFilled(editRow(rows, rows[2]!.key, { load: 55 }))).toBe(1); // reps come from the ghost
    expect(unloggedFilled(initialRows([], 2, { load: null, reps: null }, key))).toBe(0);
  });
});

describe("updating a set of the open workout", () => {
  async function open() {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    const gymId = (await ctx.repos.getActiveGymId())!;
    const gym = await ctx.repos.loadGymFingerprint(gymId);
    const next = (await ctx.repos.getNextDay())!;
    const bench = (await ctx.repos.listDayExercises(next.day.id))[0]!;
    const dctx = { gym, equipment: bench.equipment, setup: bench.setup };
    const { id } = await ctx.workout.startOrResumeSession(next.day.id, gymId);
    return { ...ctx, id, bench, dctx, next, gymId };
  }
  it("changes load, reps and warm-up in place and keeps one row", async () => {
    const { workout, id, bench, dctx } = await open();
    const r = await workout.logSet({ sessionId: id, exerciseId: bench.exerciseId, load: 60, reps: 8 }, dctx);
    await workout.updateLiveSet(r.id, { load: 62.5, reps: 7, rir: 2, warmup: false }, dctx);
    const sets = await workout.listSessionSets(id);
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ load: 62.5, reps: 7, rir: 2, warmup: false });
    await workout.updateLiveSet(r.id, { load: 40, reps: 10, rir: null, warmup: true }, dctx);
    expect((await workout.listSessionSets(id))[0]).toMatchObject({ warmup: true, outlierStatus: "none" });
  });
  it("re-checks a typo: 100 reps typed over a normal set is unconfirmed again", async () => {
    const { workout, id, bench, dctx, next, gymId, deps } = await open();
    // build a clean history first
    for (let i = 0; i < 3; i++) {
      const sid = i === 0 ? id : (await workout.startOrResumeSession(next.day.id, gymId)).id;
      for (let k = 0; k < 3; k++) await workout.logSet({ sessionId: sid, exerciseId: bench.exerciseId, load: 60, reps: 8 }, dctx);
      deps.tick(1000);
      await workout.finishSession(sid);
      deps.tick(86_400_000);
    }
    const { id: live } = await workout.startOrResumeSession(next.day.id, gymId);
    const r = await workout.logSet({ sessionId: live, exerciseId: bench.exerciseId, load: 60, reps: 8 }, dctx);
    expect((await workout.listSessionSets(live))[0]!.outlierStatus).toBe("none");
    const u = await workout.updateLiveSet(r.id, { load: 60, reps: 100, rir: null, warmup: false }, dctx);
    expect(u.outlier?.verdict).toBe("unconfirmed");
    expect((await workout.listSessionSets(live))[0]!.outlierStatus).toBe("unconfirmed");
  });
  it("refuses a finished workout and bad numbers", async () => {
    const { workout, id, bench, dctx } = await open();
    const r = await workout.logSet({ sessionId: id, exerciseId: bench.exerciseId, load: 60, reps: 8 }, dctx);
    await expect(workout.updateLiveSet(r.id, { load: 60, reps: 0, rir: null, warmup: false }, dctx)).rejects.toThrow();
    await workout.finishSession(id);
    await expect(workout.updateLiveSet(r.id, { load: 61, reps: 8, rir: null, warmup: false }, dctx)).rejects.toThrow();
  });
});
