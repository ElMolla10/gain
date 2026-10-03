import { describe, expect, it } from "vitest";
import { freshDb } from "./helpers";

async function setup() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const gymId = (await ctx.repos.getActiveGymId())!;
  const gym = await ctx.repos.loadGymFingerprint(gymId);
  const next = (await ctx.repos.getNextDay())!;
  const exercises = await ctx.repos.listDayExercises(next.day.id);
  const bench = exercises[0]!; // Barbell Bench Press, barbell, 6-10, goal lift
  const dctx = { gym, equipment: bench.equipment, setup: bench.setup };
  const spec = { exerciseId: bench.exerciseId, equipment: bench.equipment, setup: bench.setup, repMin: bench.repMin, repMax: bench.repMax, isGoalLift: bench.isGoalLift, trackEffort: false, sets: bench.sets };
  /** Log a whole finished session of bench sets and advance the clock by a few days. */
  const finished = async (sets: [number, number][]) => {
    const { id } = await ctx.workout.startOrResumeSession(next.day.id, gymId);
    for (const [load, reps] of sets) await ctx.workout.logSet({ sessionId: id, exerciseId: bench.exerciseId, load, reps }, dctx);
    ctx.deps.tick(1000);
    await ctx.workout.finishSession(id);
    ctx.deps.tick(3 * 86_400_000);
    return id;
  };
  return { ...ctx, gymId, gym, next, bench, dctx, spec, finished };
}

describe("sessions: no duplicates on re-open", () => {
  it("creates an in-progress session, then resumes the same one", async () => {
    const { workout, next, gymId, db } = await setup();
    const a = await workout.startOrResumeSession(next.day.id, gymId);
    const b = await workout.startOrResumeSession(next.day.id, gymId);
    expect(a.resumed).toBe(false);
    expect(b).toEqual({ id: a.id, resumed: true });
    expect((await db.all("SELECT id FROM session")).length).toBe(1);
    expect((await workout.getSession(a.id))!.status).toBe("in_progress");
  });
  it("many parallel opens still make one session", async () => {
    const { workout, next, gymId, db } = await setup();
    const rs = await Promise.allSettled([1, 2, 3].map(() => workout.startOrResumeSession(next.day.id, gymId)));
    expect(rs.some((r) => r.status === "fulfilled")).toBe(true);
    expect((await db.all("SELECT id FROM session")).length).toBe(1);
  });
  it("a planned session is started, not duplicated", async () => {
    const { workout, next, gymId, db } = await setup();
    await db.run(
      "INSERT INTO session (id, programme_version_id, programme_day_id, gym_id, status, created_at, updated_at) VALUES ('p1', ?, ?, ?, 'planned', 1, 1)",
      [next.versionId, next.day.id, gymId],
    );
    const r = await workout.startOrResumeSession(next.day.id, gymId);
    expect(r).toEqual({ id: "p1", resumed: true });
    expect((await workout.getSession("p1"))!.status).toBe("in_progress");
    expect((await workout.getSession("p1"))!.started_at).not.toBeNull();
  });
  it("after finishing, the next open of the same day is a new session", async () => {
    const { workout, next, gymId, finished } = await setup();
    const first = await finished([[60, 8]]);
    const again = await workout.startOrResumeSession(next.day.id, gymId);
    expect(again.id).not.toBe(first);
    expect(again.resumed).toBe(false);
  });
  it("an unknown day is an error", async () => {
    const { workout, gymId } = await setup();
    await expect(workout.startOrResumeSession("nope", gymId)).rejects.toThrow();
  });
});

describe("logging sets (offline, saved locally)", () => {
  it("stores load, reps, effort and the warm-up flag, with ids and timestamps", async () => {
    const { workout, next, gymId, bench, dctx, db } = await setup();
    const { id: sid } = await workout.startOrResumeSession(next.day.id, gymId);
    const w = await workout.logSet({ sessionId: sid, exerciseId: bench.exerciseId, load: 40, reps: 8, warmup: true }, dctx);
    const r = await workout.logSet({ sessionId: sid, exerciseId: bench.exerciseId, load: 60, reps: 8, rir: 2 }, dctx);
    const rows = await workout.listSessionSets(sid, bench.exerciseId);
    expect(rows.map((x) => [x.position, x.load, x.reps, x.rir, x.warmup])).toEqual([
      [1, 40, 8, null, true],
      [2, 60, 8, 2, false],
    ]);
    expect(w.id).toMatch(/^[0-9a-f-]{36}$/);
    const raw = await db.get<{ updated_at: number; deleted_at: number | null }>("SELECT updated_at, deleted_at FROM workout_set WHERE id = ?", [r.id]);
    expect(raw!.updated_at).toBeGreaterThan(0);
    expect(raw!.deleted_at).toBeNull();
  });
  it("a double tap with the same draft id saves once", async () => {
    const { workout, next, gymId, bench, dctx } = await setup();
    const { id: sid } = await workout.startOrResumeSession(next.day.id, gymId);
    const input = { id: "draft-1", sessionId: sid, exerciseId: bench.exerciseId, load: 60, reps: 8 };
    const a = await workout.logSet(input, dctx);
    const b = await workout.logSet(input, dctx);
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(await workout.listSessionSets(sid)).toHaveLength(1);
  });
  it("rejects impossible sets and sets on a finished session", async () => {
    const { workout, next, gymId, bench, dctx } = await setup();
    const { id: sid } = await workout.startOrResumeSession(next.day.id, gymId);
    await expect(workout.logSet({ sessionId: sid, exerciseId: bench.exerciseId, load: 60, reps: 0 }, dctx)).rejects.toThrow(/Invalid/);
    await expect(workout.logSet({ sessionId: sid, exerciseId: bench.exerciseId, load: -1, reps: 5 }, dctx)).rejects.toThrow(/Invalid/);
    await workout.finishSession(sid);
    await expect(workout.logSet({ sessionId: sid, exerciseId: bench.exerciseId, load: 60, reps: 5 }, dctx)).rejects.toThrow(/not in progress/);
  });
  it("undo is a soft delete: the row stays, the list hides it", async () => {
    const { workout, next, gymId, bench, dctx, db } = await setup();
    const { id: sid } = await workout.startOrResumeSession(next.day.id, gymId);
    const r = await workout.logSet({ sessionId: sid, exerciseId: bench.exerciseId, load: 60, reps: 8 }, dctx);
    await workout.deleteSet(r.id);
    expect(await workout.listSessionSets(sid)).toHaveLength(0);
    expect((await db.all("SELECT id FROM workout_set")).length).toBe(1);
  });
  it("sets stay saved when the workout is re-opened", async () => {
    const { workout, next, gymId, bench, dctx } = await setup();
    const { id: sid } = await workout.startOrResumeSession(next.day.id, gymId);
    await workout.logSet({ sessionId: sid, exerciseId: bench.exerciseId, load: 60, reps: 8 }, dctx);
    const again = await workout.startOrResumeSession(next.day.id, gymId);
    expect(again.id).toBe(sid);
    expect(await workout.listSessionSets(again.id)).toHaveLength(1);
  });
});

describe("outlier check while logging", () => {
  it("a set far from the line is stored unconfirmed; warm-ups are never checked", async () => {
    const { workout, next, gymId, bench, dctx, finished } = await setup();
    await finished([[60, 8], [60, 8], [60, 8]]);
    const { id: sid } = await workout.startOrResumeSession(next.day.id, gymId);
    const w = await workout.logSet({ sessionId: sid, exerciseId: bench.exerciseId, load: 20, reps: 10, warmup: true }, dctx);
    expect(w.outlier).toBeNull();
    const bad = await workout.logSet({ sessionId: sid, exerciseId: bench.exerciseId, load: 120, reps: 8 }, dctx);
    expect(bad.outlier?.verdict).toBe("unconfirmed");
    const rows = await workout.listSessionSets(sid);
    expect(rows.find((r) => r.id === bad.id)!.outlierStatus).toBe("unconfirmed");
    expect(rows.find((r) => r.id === w.id)!.outlierStatus).toBe("none");
  });
  it("a normal set is fine; no history means it cannot judge and says none", async () => {
    const { workout, next, gymId, bench, dctx } = await setup();
    const { id: sid } = await workout.startOrResumeSession(next.day.id, gymId);
    const r = await workout.logSet({ sessionId: sid, exerciseId: bench.exerciseId, load: 60, reps: 8 }, dctx);
    expect(r.outlier?.verdict).toBe("insufficient_history");
    expect((await workout.listSessionSets(sid))[0]!.outlierStatus).toBe("none");
  });
  it("confirm keeps the set; 'not right' removes it from every list", async () => {
    const { workout, next, gymId, bench, dctx, finished } = await setup();
    await finished([[60, 8], [60, 8], [60, 8]]);
    const { id: sid } = await workout.startOrResumeSession(next.day.id, gymId);
    const a = await workout.logSet({ sessionId: sid, exerciseId: bench.exerciseId, load: 120, reps: 8 }, dctx);
    const b = await workout.logSet({ sessionId: sid, exerciseId: bench.exerciseId, load: 3, reps: 8 }, dctx);
    await workout.setOutlierStatus(a.id, "confirmed");
    await workout.setOutlierStatus(b.id, "rejected");
    const rows = await workout.listSessionSets(sid);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: a.id, outlierStatus: "confirmed" });
  });
});

describe("history, last performance and the live target", () => {
  it("no history: nothing is proposed and it says so", async () => {
    const { workout, spec, gym } = await setup();
    const { proposal } = await workout.liveProposal(spec, gym);
    expect(proposal.status).toBe("no_history");
    expect(proposal.load).toBeNull();
  });
  it("history only counts finished sessions, oldest first, and last performance drops warm-ups", async () => {
    const { workout, next, gymId, bench, dctx, finished, gym, spec } = await setup();
    await finished([[40, 8], [60, 8]]);
    const second = await workout.startOrResumeSession(next.day.id, gymId);
    await workout.logSet({ sessionId: second.id, exerciseId: bench.exerciseId, load: 100, reps: 5 }, dctx);
    const { lineId, line } = await workout.liveProposal(spec, gym);
    const h = await workout.getHistory(line, lineId);
    expect(h).toHaveLength(1); // the open session is not history yet
    const last = await workout.lastPerformance(line, lineId);
    expect(last!.sets.map((s) => s.load)).toEqual([40, 60]);
  });
  it("three finished sessions give a high-confidence target from real loads", async () => {
    const { finished, workout, spec, gym } = await setup();
    await finished([[60, 9], [60, 9], [60, 9]]);
    await finished([[60, 10], [60, 10], [60, 10]]);
    await finished([[60, 10], [60, 10], [60, 10]]);
    const { proposal } = await workout.liveProposal(spec, gym);
    expect(proposal.confidence).toBe("high");
    expect(proposal.currency).toBe("load");
    expect(proposal.load).toBe(62.5); // a barbell step that exists in this gym
    expect(proposal.reps).toBe(6);
  });
  it("an unconfirmed outlier in a finished session does not move the target", async () => {
    const { finished, workout, spec, gym, next, gymId, bench, dctx } = await setup();
    await finished([[60, 8], [60, 8], [60, 8]]);
    await finished([[60, 9], [60, 9], [60, 9]]);
    const { id } = await workout.startOrResumeSession(next.day.id, gymId);
    for (let i = 0; i < 3; i++) await workout.logSet({ sessionId: id, exerciseId: bench.exerciseId, load: 120, reps: 10 }, dctx);
    await workout.finishSession(id);
    const { proposal } = await workout.liveProposal(spec, gym);
    expect(proposal.load).toBe(60);
    expect(proposal.warnings).toContain("pending_outlier");
  });
  it("another gym's sets are a different line and are not used", async () => {
    const { workout, next, db, bench, gym, spec, repos } = await setup();
    await db.run("INSERT INTO gym (id,name,created_at,updated_at) VALUES ('home','Home',1,1)");
    const { id } = await workout.startOrResumeSession(next.day.id, "home");
    for (let i = 0; i < 3; i++) await workout.logSet({ sessionId: id, exerciseId: bench.exerciseId, load: 80, reps: 8 }, { gym, equipment: bench.equipment, setup: bench.setup });
    await workout.finishSession(id);
    expect(await repos.getActiveGymId()).not.toBe("home");
    const { proposal } = await workout.liveProposal(spec, gym);
    expect(proposal.status).toBe("no_history");
  });
  it("stored rejection memory stops a declined jump", async () => {
    const { finished, workout, spec, gym, db } = await setup();
    await finished([[60, 10], [60, 10], [60, 10]]);
    await finished([[60, 10], [60, 10], [60, 10]]);
    await finished([[60, 10], [60, 10], [60, 10]]);
    const { lineId } = await workout.liveProposal(spec, gym);
    await db.run(
      "INSERT INTO rejection_memory (id, line_id, jump_kind, count, last_rejected_at, created_at, updated_at) VALUES ('r1', ?, 'load:harder:2.5', 3, 1, 1, 1)",
      [lineId],
    );
    const { proposal } = await workout.liveProposal(spec, gym);
    expect(proposal.currency).not.toBe("load");
    expect(proposal.load).toBe(60);
  });
  it("a first use of a line creates it once", async () => {
    const { workout, bench, gymId, db } = await setup();
    const a = await workout.ensureLine(bench.exerciseId, gymId, "free");
    const b = await workout.ensureLine(bench.exerciseId, gymId, "free");
    expect(a).toBe(b);
    const n = await db.get<{ c: number }>("SELECT COUNT(*) AS c FROM exercise_line WHERE exercise_id = ? AND gym_id = ?", [bench.exerciseId, gymId]);
    expect(n!.c).toBe(1);
  });
});

describe("per-workout exercise changes (remove / replace / note / rest timer)", () => {
  async function open() {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    const gymId = (await ctx.repos.getActiveGymId())!;
    const gym = await ctx.repos.loadGymFingerprint(gymId);
    const next = (await ctx.repos.getNextDay())!;
    const exs = await ctx.repos.listDayExercises(next.day.id);
    const { id } = await ctx.workout.startOrResumeSession(next.day.id, gymId);
    return { ...ctx, id, exs, gym, dctx: { gym, equipment: exs[0]!.equipment, setup: exs[0]!.setup } };
  }
  it("starts empty and upserts one row per slot", async () => {
    const { workout, id, exs } = await open();
    expect(await workout.listExerciseState(id)).toEqual([]);
    const slot = exs[0]!.exerciseId;
    await workout.patchExerciseState(id, slot, { note: "belt on" });
    await workout.patchExerciseState(id, slot, { restOff: true });
    expect(await workout.listExerciseState(id)).toEqual([{ slot, removed: false, replacedBy: null, note: "belt on", restOff: true, added: false, position: null, superset: null }]);
  });
  it("removing an exercise deletes its logged sets and restoring brings the slot back", async () => {
    const { workout, id, exs, dctx } = await open();
    const slot = exs[0]!.exerciseId;
    await workout.logSet({ sessionId: id, exerciseId: slot, load: 60, reps: 8 }, dctx);
    await workout.removeExercise(id, slot, slot);
    expect(await workout.listSessionSets(id)).toHaveLength(0);
    expect((await workout.listExerciseState(id))[0]).toMatchObject({ slot, removed: true });
    await workout.patchExerciseState(id, slot, { removed: false });
    expect((await workout.listExerciseState(id))[0]!.removed).toBe(false);
  });
  it("replacing is refused once sets are logged, allowed before, and never touches the programme", async () => {
    const { workout, repos, id, exs, dctx } = await open();
    const slot = exs[0]!.exerciseId;
    const other = exs[1]!.exerciseId;
    await workout.replaceExercise(id, slot, slot, other);
    expect((await workout.listExerciseState(id))[0]).toMatchObject({ slot, replacedBy: other });
    await workout.logSet({ sessionId: id, exerciseId: other, load: 40, reps: 10 }, dctx);
    await expect(workout.replaceExercise(id, slot, other, slot)).rejects.toThrow();
    expect((await repos.listDayExercises((await repos.getNextDay())!.day.id))[0]!.exerciseId).toBe(slot);
  });
});
