import { describe, expect, it, vi } from "vitest";
import { HistoryInvalid } from "../src/db/historyRepo";
import { freshDb } from "./helpers";

const DAY = 86_400_000;

async function setup() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const gymId = (await ctx.repos.getActiveGymId())!;
  const gym = await ctx.repos.loadGymFingerprint(gymId);
  /** Train the next program day; `plan` maps exercise name to [load, reps, warmup?] sets. */
  const train = async (plan: Record<string, [number, number, boolean?][]>) => {
    // The day that holds the first exercise of the plan (bench is on Upper A only).
    const wanted = Object.keys(plan)[0]!;
    const days = await ctx.db.all<{ id: string; name: string }>("SELECT d.id, d.name FROM programme_day d JOIN programme_version v ON v.id = d.programme_version_id ORDER BY v.version DESC, d.position");
    let next: { day: { id: string; name: string } } | null = null;
    let exs: Awaited<ReturnType<typeof ctx.repos.listDayExercises>> = [];
    for (const d of days) {
      const list = await ctx.repos.listDayExercises(d.id);
      if (list.some((e) => e.nameEn === wanted)) {
        next = { day: d };
        exs = list;
        break;
      }
    }
    const { id } = await ctx.workout.startOrResumeSession(next!.day.id, gymId);
    const ids: string[] = [];
    for (const [name, list] of Object.entries(plan)) {
      const ex = exs.find((e) => e.nameEn === name)!;
      for (const [load, reps, warmup] of list) {
        const r = await ctx.workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load, reps, warmup }, { gym, equipment: ex.equipment, setup: ex.setup });
        ids.push(r.id);
      }
    }
    ctx.deps.tick(1000);
    await ctx.workout.finishSession(id);
    await ctx.finish.writeNextSessionTargets(id);
    ctx.deps.tick(DAY);
    return { sessionId: id, setIds: ids, dayName: next!.day.name };
  };
  return { ...ctx, gymId, gym, train };
}
const BENCH = "Barbell Bench Press";

describe("history: sessions", () => {
  it("lists finished sessions newest first with counts, and nothing for planned or open ones", async () => {
    const { history, train, repos, workout, gymId } = await setup();
    expect(await history.listSessions()).toEqual([]);
    await train({ [BENCH]: [[40, 10, true], [60, 8], [60, 8]] });
    const second = await train({ [BENCH]: [[62.5, 6]] });
    const open = (await repos.getNextDay())!;
    await workout.startOrResumeSession(open.day.id, gymId); // in progress (or planned): not history
    const list = await history.listSessions();
    expect(list.map((s) => s.id)[0]).toBe(second.sessionId);
    expect(list).toHaveLength(2);
    expect(list[1]).toMatchObject({ exercises: 1, workingSets: 2, imported: false });
    expect(await history.countSessions()).toBe(2);
    expect(await history.listSessions(1, 1)).toHaveLength(1);
  });
  it("detail shows every set including warm-ups, per exercise", async () => {
    const { history, train } = await setup();
    const s = await train({ [BENCH]: [[40, 10, true], [60, 8]] });
    const d = (await history.getSession(s.sessionId))!;
    expect(d.exercises).toHaveLength(1);
    expect(d.exercises[0]!.sets.map((x) => [x.load, x.reps, x.warmup])).toEqual([[40, 10, true], [60, 8, false]]);
    expect(await history.getSession("nope")).toBeNull();
  });
});

describe("history: correcting a set", () => {
  it("edits load/reps/rir and confirms a waiting outlier; the trend follows", async () => {
    const { history, train } = await setup();
    await train({ [BENCH]: [[60, 8]] });
    await train({ [BENCH]: [[60, 8]] });
    const typo = await train({ [BENCH]: [[600, 8]] }); // extra zero: flagged unconfirmed
    const d = (await history.getSession(typo.sessionId))!;
    const set = d.exercises[0]!.sets[0]!;
    expect(set.outlierStatus).toBe("unconfirmed");
    await history.updateSet(set.id, { load: 60, reps: 8, rir: 2 });
    const after = (await history.getSession(typo.sessionId))!.exercises[0]!.sets[0]!;
    expect(after).toMatchObject({ load: 60, reps: 8, rir: 2, outlierStatus: "confirmed" });
  });
  it("rejects impossible values and unknown or planned-session sets", async () => {
    const { history, train } = await setup();
    const s = await train({ [BENCH]: [[60, 8]] });
    const id = s.setIds[0]!;
    await expect(history.updateSet(id, { load: 60, reps: 0, rir: null })).rejects.toMatchObject({ code: "reps" });
    await expect(history.updateSet(id, { load: 60, reps: 8.5, rir: null })).rejects.toBeInstanceOf(HistoryInvalid);
    await expect(history.updateSet(id, { load: -1, reps: 8, rir: null })).rejects.toMatchObject({ code: "load" });
    await expect(history.updateSet(id, { load: 60, reps: 8, rir: 11 })).rejects.toMatchObject({ code: "rir" });
    await expect(history.updateSet("nope", { load: 60, reps: 8, rir: null })).rejects.toMatchObject({ code: "missing" });
    await expect(history.removeSet("nope")).rejects.toMatchObject({ code: "missing" });
  });
  it("deleting a set removes it from the session and from the trend (soft delete)", async () => {
    const { history, train, finish, db } = await setup();
    await train({ [BENCH]: [[60, 10], [60, 10]] });
    const s2 = await train({ [BENCH]: [[62.5, 10]] });
    const lift = (await history.listLifts()).find((l) => l.nameEn === BENCH)!;
    expect((await history.getLiftTrend(lift.lineId))!.trend.points.map((p) => p.load)).toEqual([60, 62.5]);
    await history.removeSet(s2.setIds[0]!);
    expect(await history.getSession(s2.sessionId)).toBeNull(); // the session is now empty, so it is no longer a workout in History
    const t = (await history.getLiftTrend(lift.lineId))!.trend;
    expect(t.points.map((p) => p.load)).toEqual([60]);
    const row = await db.get<{ deleted_at: number | null }>("SELECT deleted_at FROM workout_set WHERE id = ?", [s2.setIds[0]!]);
    expect(row!.deleted_at).not.toBeNull(); // soft delete
    void finish;
  });
});

describe("history: lifts and trend", () => {
  it("one entry per exercise + gym + setup; trend uses the top working set; warm-ups never count", async () => {
    const { history, train, deps } = await setup();
    await train({ [BENCH]: [[40, 10, true], [60, 8], [65, 5]] });
    deps.tick(6 * DAY);
    await train({ [BENCH]: [[100, 3, true], [65, 6]] });
    deps.tick(7 * DAY);
    await train({ [BENCH]: [[67.5, 5]] });
    const lifts = await history.listLifts();
    const bench = lifts.find((l) => l.nameEn === BENCH)!;
    expect(bench).toMatchObject({ sessions: 3, setup: "free", hasImported: false });
    const { trend } = (await history.getLiftTrend(bench.lineId))!;
    expect(trend.points.map((p) => [p.load, p.reps])).toEqual([[65, 5], [65, 6], [67.5, 5]]);
    expect(trend.best).toMatchObject({ load: 67.5 });
    expect(await history.getLiftTrend("nope")).toBeNull();
  });
  it("a lift with 25 sessions is computed fast (Node, SQLite in memory: not a phone number)", async () => {
    const { history, train, deps } = await setup();
    for (let i = 0; i < 25; i++) {
      await train({ [BENCH]: [[60 + (i % 5), 8], [60, 8]] });
      deps.tick(2 * DAY);
    }
    const lift = (await history.listLifts()).find((l) => l.nameEn === BENCH)!;
    const t0 = performance.now();
    const r = (await history.getLiftTrend(lift.lineId))!;
    const ms = performance.now() - t0;
    expect(r.trend.points).toHaveLength(25);
    expect(ms).toBeLessThan(1000);
  });
  it("imported sessions are labelled, in the session list and as chart points", async () => {
    const { history, imports, db, workout } = await setup();
    // Plant an imported-style session directly: the import path itself is covered in import.test.ts.
    void imports;
    const dayId = (await db.get<{ id: string }>("SELECT id FROM programme_day LIMIT 1"))!.id;
    const gymId = (await db.get<{ id: string }>("SELECT id FROM gym LIMIT 1"))!.id;
    const versionId = (await db.get<{ id: string }>("SELECT programme_version_id AS id FROM programme_day WHERE id = ?", [dayId]))!.id;
    const exId = (await db.get<{ id: string }>("SELECT id FROM exercise WHERE name_en = ?", [BENCH]))!.id;
    const lineId = await workout.ensureLine(exId, gymId, "free");
    for (const [i, load] of [60, 62.5, 65].entries()) {
      const sid = `s${i}`;
      const at = Date.UTC(2026, 0, 1 + i * 10);
      await db.run("INSERT INTO session (id, programme_version_id, programme_day_id, gym_id, status, started_at, finished_at, import_key, created_at, updated_at) VALUES (?, ?, ?, ?, 'finished', ?, ?, ?, 1, 1)", [sid, versionId, dayId, gymId, at, at, `k${i}`]);
      await db.run("INSERT INTO workout_set (id, session_id, exercise_id, line_id, position, load, reps, is_warmup, tags_json, outlier_status, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, 5, 0, '[]', 'none', 1, 1)", [`w${i}`, sid, exId, lineId, load]);
    }
    expect((await history.listSessions()).every((s) => s.imported)).toBe(true);
    const r = (await history.getLiftTrend(lineId))!;
    expect(r.lift.hasImported).toBe(true);
    expect(r.trend.points.every((p) => p.imported)).toBe(true);
    expect(r.trend.direction).toBe("better");
  });
});

describe("history: deleting a whole finished workout", () => {
  it("tombstones the workout and its sets, updates history/trends, and blocks stale edits", async () => {
    const { train, history, finish, workout, db, repos, gymId } = await setup();
    const first = await train({ [BENCH]: [[60, 10]] });
    const second = await train({ [BENCH]: [[40, 12, true], [65, 7], [65, 6]] });
    const line = (await history.listLifts()).find((lift) => lift.nameEn === BENCH)!;
    expect((await history.getLiftTrend(line.lineId))!.trend.points.map((p) => p.load)).toEqual([60, 65]);
    expect((await finish.summarizeSession(second.sessionId)).totals.records).toBe(1);
    expect(await history.countSessions()).toBe(2);

    // A finished session can retain notes/rest choices. These are tombstoned too.
    const day = (await repos.getNextDay())!;
    void day;
    await workout.patchExerciseState(second.sessionId, (await history.getSession(second.sessionId))!.exercises[0]!.exerciseId, { note: "test workout" });
    await history.deleteWorkout(second.sessionId);

    expect(await history.countSessions()).toBe(1);
    expect((await history.listSessions()).map((x) => x.id)).toEqual([first.sessionId]);
    expect(await history.getSession(second.sessionId)).toBeNull();
    expect((await history.getLiftTrend(line.lineId))!.trend.points.map((p) => p.load)).toEqual([60]);
    expect((await finish.summarizeSession(first.sessionId)).totals.records).toBe(0);

    const tombstone = await db.get<{ deleted_at: number | null }>("SELECT deleted_at FROM session WHERE id = ?", [second.sessionId]);
    expect(tombstone?.deleted_at).not.toBeNull();
    const sets = await db.all<{ deleted_at: number | null }>("SELECT deleted_at FROM workout_set WHERE session_id = ?", [second.sessionId]);
    expect(sets).toHaveLength(3);
    expect(sets.every((s) => s.deleted_at !== null)).toBe(true);
    const notes = await db.all<{ deleted_at: number | null }>("SELECT deleted_at FROM session_exercise WHERE session_id = ?", [second.sessionId]);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((x) => x.deleted_at !== null)).toBe(true);
    await expect(history.updateSet(second.setIds[1]!, { load: 65, reps: 8, rir: null })).rejects.toMatchObject({ code: "missing" });
    await expect(history.removeSet(second.setIds[1]!)).rejects.toMatchObject({ code: "missing" });
    await expect(history.deleteWorkout(second.sessionId)).rejects.toMatchObject({ code: "missing" });
    const future = await finish.previewDayLoads((await repos.getNextDay())!.day.id, gymId);
    expect(future.length).toBeGreaterThan(0);
  });

  it("refuses to delete open or unknown sessions without changing them", async () => {
    const { history, workout, repos, gymId, db } = await setup();
    const next = (await repos.getNextDay())!;
    const active = await workout.startOrResumeSession(next.day.id, gymId);
    await expect(history.deleteWorkout(active.id)).rejects.toMatchObject({ code: "missing" });
    await expect(history.deleteWorkout("missing")).rejects.toMatchObject({ code: "missing" });
    const row = await db.get<{ status: string; deleted_at: number | null }>("SELECT status, deleted_at FROM session WHERE id = ?", [active.id]);
    expect(row).toMatchObject({ status: "in_progress", deleted_at: null });
  });

  it("rolls back every tombstone if any write fails halfway through deletion", async () => {
    const { history, train, db } = await setup();
    const s = await train({ [BENCH]: [[60, 10], [60, 9]] });
    const realRun = db.run.bind(db);
    const spy = vi.spyOn(db, "run");
    let writes = 0;
    spy.mockImplementation(async (...args) => {
      writes++;
      if (writes === 4) throw new Error("simulated disk failure");
      return realRun(...args);
    });
    try {
      await expect(history.deleteWorkout(s.sessionId)).rejects.toThrow("simulated disk failure");
    } finally {
      spy.mockRestore();
    }
    expect(await history.getSession(s.sessionId)).not.toBeNull();
    expect(await history.countSessions()).toBe(1);
    expect((await db.all<{ deleted_at: number | null }>("SELECT deleted_at FROM workout_set WHERE session_id = ?", [s.sessionId])).every((x) => x.deleted_at === null)).toBe(true);
    expect((await db.get<{ deleted_at: number | null }>("SELECT deleted_at FROM session WHERE id = ?", [s.sessionId]))?.deleted_at).toBeNull();
  });
});
