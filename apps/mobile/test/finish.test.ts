import { describe, expect, it } from "vitest";
import { isRememberedKind } from "../src/db/finishRepo";
import { freshDb } from "./helpers";

async function setup() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const gymId = (await ctx.repos.getActiveGymId())!;
  const gym = await ctx.repos.loadGymFingerprint(gymId);

  /** Train whatever day is next: log the given sets for the first exercise of the day (or listed ones), finish, write the next targets. */
  const trainNext = async (plan?: (names: string[]) => Record<string, [number, number][]>) => {
    const next = (await ctx.repos.getNextDay())!;
    const exs = await ctx.repos.listDayExercises(next.day.id);
    const { id } = await ctx.workout.startOrResumeSession(next.day.id, gymId);
    const sets = plan ? plan(exs.map((e) => e.nameEn)) : { [exs[0]!.nameEn]: [[50, 10]] as [number, number][] };
    for (const [name, list] of Object.entries(sets)) {
      const ex = exs.find((e) => e.nameEn === name)!;
      for (const [load, reps] of list) await ctx.workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load, reps }, { gym, equipment: ex.equipment, setup: ex.setup });
    }
    ctx.deps.tick(1000);
    await ctx.workout.finishSession(id);
    const written = await ctx.finish.writeNextSessionTargets(id);
    ctx.deps.tick(86_400_000);
    return { sessionId: id, dayName: next.day.name, written };
  };
  const BENCH = "Barbell Bench Press";
  const benchPlan = (reps: number) => (names: string[]) => ({ [names[0]!]: [[60, reps], [60, reps], [60, reps]] as [number, number][] });
  /** One full 4-day rotation; bench is trained on Upper A. Returns Upper A's bench target for the NEXT rotation. */
  const rotate = async (benchReps: number) => {
    let last: Awaited<ReturnType<typeof trainNext>> | null = null;
    for (let d = 0; d < 4; d++) last = await trainNext(d === 0 ? benchPlan(benchReps) : undefined);
    const targets = await ctx.finish.getTargets(last!.written!.sessionId);
    return { targets, bench: targets.find((t) => t.nameEn === BENCH)!, plannedSessionId: last!.written!.sessionId };
  };
  return { ...ctx, gymId, gym, trainNext, rotate, benchPlan, BENCH };
}

describe("the next session is written at the door", () => {
  it("finishing writes the next day's targets at once, each with a reason and rule version", async () => {
    const { trainNext, finish, db } = await setup();
    const r = await trainNext(); // Upper A -> next is Lower A
    expect(r.written).toMatchObject({ dayName: "Lower A", created: 5 });
    const targets = await finish.getTargets(r.written!.sessionId);
    expect(targets).toHaveLength(5);
    for (const t of targets) {
      expect(t.ruleVersion).toBe("rule-v0.2");
      expect(t.path).toBe("rule");
      expect(t.status).toBe("proposed");
      expect(t.reason.key).toBeTruthy();
    }
    const s = await db.get<{ status: string }>("SELECT status FROM session WHERE id = ?", [r.written!.sessionId]);
    expect(s!.status).toBe("planned");
  });
  it("no history means no number: the target says so instead of inventing one", async () => {
    const { trainNext, finish } = await setup();
    const r = await trainNext();
    const t = (await finish.getTargets(r.written!.sessionId))[0]!;
    expect(t.currency).toBe("none");
    expect(t.load).toBeNull();
    expect(t.reason.key).toBe("no_history");
    expect(t.effectiveLoad).toBeNull();
  });
  it("targets come back in programme order", async () => {
    const { trainNext, finish, repos } = await setup();
    const r = await trainNext();
    const next = (await repos.getNextDay())!;
    const order = (await repos.listDayExercises(next.day.id)).map((e) => e.nameEn);
    expect((await finish.getTargets(r.written!.sessionId)).map((t) => t.nameEn)).toEqual(order);
  });
  it("writes a decision log row with the inputs for every target", async () => {
    const { rotate, finish } = await setup();
    const { bench } = await rotate(8);
    const d = await finish.getDecision(bench.id);
    expect(d!.ruleVersion).toBe("rule-v0.2");
    expect(d!.path).toBe("rule");
    expect(d!.payload.inputs.lineKey).toContain("|free");
    expect(d!.payload.inputs.sessions[0]).toMatchObject({ topLoad: 60, repsAtTop: 8 });
    expect(d!.payload.inputs.gym.anchorLoad).toBe(60);
    expect(d!.payload.proposal.reason.key).toBe(bench.reason.key);
    expect(await finish.getDecision("missing")).toBeNull();
  });
  it("is idempotent: writing again changes nothing and never duplicates", async () => {
    const { trainNext, finish, db } = await setup();
    const r = await trainNext();
    const again = await finish.writeNextSessionTargets(r.sessionId);
    expect(again!.created).toBe(0);
    expect((await db.all("SELECT id FROM target")).length).toBe(5);
    expect((await db.all("SELECT id FROM decision_log")).length).toBe(5);
    expect((await db.all("SELECT id FROM session WHERE status = 'planned'")).length).toBe(1);
  });
  it("starting the planned session resumes it (no duplicate) and its targets stay attached", async () => {
    const { trainNext, workout, finish, repos, gymId } = await setup();
    const r = await trainNext();
    const next = (await repos.getNextDay())!;
    const s = await workout.startOrResumeSession(next.day.id, gymId);
    expect(s).toEqual({ id: r.written!.sessionId, resumed: true });
    expect(await finish.getTargets(s.id)).toHaveLength(5);
  });
  it("does not rewrite a day that is already in progress", async () => {
    const { trainNext, workout, finish, repos, gymId } = await setup();
    const r = await trainNext();
    const next = (await repos.getNextDay())!;
    await workout.startOrResumeSession(next.day.id, gymId);
    expect(await finish.writeNextSessionTargets(r.sessionId)).toBeNull();
  });
  it("after three bench sessions the target is the next real barbell load, with the reason sentence inputs", async () => {
    const { rotate } = await setup();
    await rotate(9);
    await rotate(10);
    const { bench } = await rotate(10);
    expect(bench).toMatchObject({ load: 62.5, reps: 6, currency: "load", jumpKind: "load:harder:2.5", confidence: "high" });
    expect(bench.reason.key).toBe("load_up");
    expect(bench.reason.params).toMatchObject({ load: 62.5, prevLoad: 60 });
  });
  it("after one bench session the target is low confidence and a smaller step (repeat)", async () => {
    const { rotate } = await setup();
    const { bench } = await rotate(8);
    expect(bench).toMatchObject({ load: 60, reps: 8, confidence: "low", jumpKind: "repeat" });
  });
});

describe("accept, edit, reject", () => {
  const upToJump = async () => {
    const c = await setup();
    await c.rotate(9);
    await c.rotate(10);
    const r = await c.rotate(10);
    return { ...c, bench: r.bench, plannedSessionId: r.plannedSessionId };
  };
  it("accept stores the status and the effective load", async () => {
    const { finish, bench } = await upToJump();
    await finish.acceptTarget(bench.id);
    const t = (await finish.getTarget(bench.id))!;
    expect(t.status).toBe("accepted");
    expect(t.effectiveLoad).toBe(62.5);
  });
  it("edit stores the new load (a real load only) and keeps the original proposal", async () => {
    const { finish, bench, gym } = await upToJump();
    await finish.editTargetLoad(bench.id, 60, gym, "barbell", "free");
    const t = (await finish.getTarget(bench.id))!;
    expect(t).toMatchObject({ status: "edited", editedLoad: 60, effectiveLoad: 60, load: 62.5 });
    await expect(finish.editTargetLoad(bench.id, 61, gym, "barbell", "free")).rejects.toThrow(/does not exist/);
    expect((await finish.getTarget(bench.id))!.editedLoad).toBe(60);
  });
  it("editing never touches rejection memory", async () => {
    const { finish, bench, gym, db } = await upToJump();
    await finish.editTargetLoad(bench.id, 60, gym, "barbell", "free");
    expect((await db.all("SELECT id FROM rejection_memory")).length).toBe(0);
  });
  it("reject stores the status, no effective load, and remembers the jump kind once", async () => {
    const { finish, bench, db } = await upToJump();
    await finish.rejectTarget(bench.id);
    await finish.rejectTarget(bench.id); // pressing twice does not count twice
    const t = (await finish.getTarget(bench.id))!;
    expect(t).toMatchObject({ status: "rejected", effectiveLoad: null });
    const rows = await db.all<{ jump_kind: string; count: number }>("SELECT jump_kind, count FROM rejection_memory WHERE deleted_at IS NULL");
    expect(rows).toEqual([{ jump_kind: "load:harder:2.5", count: 1 }]);
  });
  it("accepting after rejecting clears the memory for that jump", async () => {
    const { finish, bench, db } = await upToJump();
    await finish.rejectTarget(bench.id);
    await finish.acceptTarget(bench.id);
    expect((await db.all("SELECT id FROM rejection_memory WHERE deleted_at IS NULL")).length).toBe(0);
  });
  it("only jumps are remembered, not 'one more rep' or 'repeat'", async () => {
    const { rotate, finish, db } = await setup();
    const { bench } = await rotate(8); // low confidence repeat
    await finish.rejectTarget(bench.id);
    expect((await db.all("SELECT id FROM rejection_memory")).length).toBe(0);
    expect(isRememberedKind("load:harder:2.5")).toBe(true);
    expect(isRememberedKind("effort:rir2")).toBe(true);
    expect(isRememberedKind("quality:pause")).toBe(true);
    expect(isRememberedKind("reps")).toBe(false);
    expect(isRememberedKind("repeat")).toBe(false);
    expect(isRememberedKind(null)).toBe(false);
  });
  it("nothing proposed means nothing to accept", async () => {
    const { trainNext, finish } = await setup();
    const r = await trainNext();
    const t = (await finish.getTargets(r.written!.sessionId))[0]!;
    await expect(finish.acceptTarget(t.id)).rejects.toThrow(/nothing to accept/);
  });
  it("three rejections of the same jump stop it: the next target spends another currency", async () => {
    const { rotate, finish, benchPlan, trainNext, BENCH } = await setup();
    await rotate(9);
    await rotate(10);
    let r = await rotate(10);
    expect(r.bench.currency).toBe("load");
    await finish.rejectTarget(r.bench.id); // 1
    r = await rotate(10);
    expect(r.bench.currency).toBe("load");
    await finish.rejectTarget(r.bench.id); // 2
    r = await rotate(10);
    expect(r.bench.currency).toBe("load");
    await finish.rejectTarget(r.bench.id); // 3
    r = await rotate(10);
    expect(r.bench.currency).not.toBe("load");
    expect(r.bench.load).toBe(60);
    const d = await finish.getDecision(r.bench.id);
    expect(d!.payload.inputs.rejections).toEqual([{ jumpKind: "load:harder:2.5", count: 3, blocked: true }]);
    void benchPlan; void trainNext; void BENCH;
  });
});

describe("what counted and records", () => {
  it("first time on a line: counts the working sets, claims no record", async () => {
    const { trainNext, finish } = await setup();
    const r = await trainNext((n) => ({ [n[0]!]: [[60, 8], [60, 8]] }));
    const s = await finish.summarizeSession(r.sessionId);
    expect(s.exercises[0]).toMatchObject({ counted: 2, firstTime: true, records: [], top: { load: 60, reps: 8 } });
    expect(s.totals).toMatchObject({ counted: 2, records: 0, exercises: 1 });
  });
  it("a heavier load than ever before is a load record", async () => {
    const { rotate, trainNext, finish, benchPlan } = await setup();
    await rotate(8);
    const r = await trainNext((n) => ({ [n[0]!]: [[62.5, 6], [62.5, 6]] }));
    void benchPlan;
    const s = await finish.summarizeSession(r.sessionId);
    expect(s.exercises[0]!.records).toEqual(["load"]);
  });
  it("warm-ups and unconfirmed sets are reported but not counted", async () => {
    const { trainNext, finish, workout, repos, gym, gymId } = await setup();
    const next = (await repos.getNextDay())!;
    const ex = (await repos.listDayExercises(next.day.id))[0]!;
    const { id } = await workout.startOrResumeSession(next.day.id, gymId);
    const c = { gym, equipment: ex.equipment, setup: ex.setup };
    await workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load: 30, reps: 10, warmup: true }, c);
    await workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load: 60, reps: 8 }, c);
    await workout.finishSession(id);
    void trainNext;
    const s = await finish.summarizeSession(id);
    expect(s.exercises[0]).toMatchObject({ counted: 1, warmups: 1, unconfirmed: 0 });
  });
});
