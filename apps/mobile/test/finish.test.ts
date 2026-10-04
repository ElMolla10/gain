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
      expect(t.ruleVersion).toBe("rule-v0.4");
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
  it("targets come back in program order", async () => {
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
    expect(d!.ruleVersion).toBe("rule-v0.4");
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
    await expect(finish.editTargetLoad(bench.id, 61, gym, "barbell", "free")).rejects.toThrow(/not one of the standard steps/);
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

describe("rejection memory surfaces (Step 5)", () => {
  /** Three rotations at 10 reps so bench proposes a load jump on the fourth. */
  async function toJump() {
    const c = await setup();
    await c.rotate(9);
    await c.rotate(10);
    const r = await c.rotate(10);
    return { ...c, r };
  }

  it("rejecting says how many times and when the jump stops; non-jumps return null", async () => {
    const c = await toJump();
    expect(c.r.bench.currency).toBe("load");
    const o1 = await c.finish.rejectTarget(c.r.bench.id);
    expect(o1).toEqual({ jumpKind: "load:harder:2.5", count: 1, max: 3, blocked: false });
    const again = await c.finish.rejectTarget(c.r.bench.id); // same target twice does not count twice
    expect(again!.count).toBe(1);
    const r2 = await c.rotate(10);
    expect((await c.finish.rejectTarget(r2.bench.id))!.count).toBe(2);
    const r3 = await c.rotate(10);
    expect(await c.finish.rejectTarget(r3.bench.id)).toMatchObject({ count: 3, blocked: true });
    const other = await c.finish.getTargets(r3.plannedSessionId);
    const noJump = other.find((t) => t.jumpKind === null || !isRememberedKind(t.jumpKind));
    if (noJump && noJump.currency !== "none") expect(await c.finish.rejectTarget(noJump.id)).toBeNull();
  });

  it("the list shows exercise, gym, jump, count, and blocked state; empty when nothing was declined", async () => {
    const c = await toJump();
    expect(await c.rejections.list()).toEqual([]);
    await c.finish.rejectTarget(c.r.bench.id);
    const [a] = await c.rejections.list();
    expect(a).toMatchObject({ nameEn: "Barbell Bench Press", jumpKind: "load:harder:2.5", count: 1, blocked: false });
    expect(a!.gymName).toBeTruthy();
    expect(a!.nameAr).toMatch(/[\u0600-\u06FF]/);
  });

  it("after 3 rejections the jump is stopped, and 'bring it back' lets the engine propose it again", async () => {
    const c = await toJump();
    await c.finish.rejectTarget(c.r.bench.id);
    await c.finish.rejectTarget((await c.rotate(10)).bench.id);
    await c.finish.rejectTarget((await c.rotate(10)).bench.id);
    const [stopped] = await c.rejections.list();
    expect(stopped).toMatchObject({ count: 3, blocked: true });
    const blocked = await c.rotate(10);
    expect(blocked.bench.currency).not.toBe("load");

    await c.rejections.bringBack(stopped!.id);
    expect(await c.rejections.list()).toEqual([]);
    const back = await c.rotate(10);
    expect(back.bench.currency).toBe("load");
    expect(back.bench.load).toBe(62.5);
  });

  it("undo puts the record back as it was, unless the jump was declined again meanwhile", async () => {
    const c = await toJump();
    await c.finish.rejectTarget(c.r.bench.id);
    const [it1] = await c.rejections.list();
    await c.rejections.bringBack(it1!.id);
    expect(await c.rejections.undoBringBack(it1!.id)).toBe(true);
    expect((await c.rejections.list())[0]).toMatchObject({ id: it1!.id, count: 1 });
    expect(await c.rejections.undoBringBack(it1!.id)).toBe(false); // already live
    expect(await c.rejections.undoBringBack("nope")).toBe(false);

    await c.rejections.bringBack(it1!.id);
    const r2 = await c.rotate(10);
    await c.finish.rejectTarget(r2.bench.id); // declined again: a new record with count 1
    expect(await c.rejections.undoBringBack(it1!.id)).toBe(false);
    expect((await c.rejections.list()).map((x) => x.count)).toEqual([1]);
  });

  it("accepting a previously declined jump also clears it from the list", async () => {
    const c = await toJump();
    await c.finish.rejectTarget(c.r.bench.id);
    await c.finish.acceptTarget(c.r.bench.id);
    expect(await c.rejections.list()).toEqual([]);
  });

  it("blocked records sort first", async () => {
    const c = await toJump();
    await c.finish.rejectTarget(c.r.bench.id);
    await c.finish.rejectTarget((await c.rotate(10)).bench.id);
    await c.finish.rejectTarget((await c.rotate(10)).bench.id);
    const l = await c.rejections.list();
    expect(l[0]!.blocked).toBe(true);
  });
});

describe("an unconfirmed outlier never moves the next target (Step 5)", () => {
  const rotateWith = async (typo: boolean) => {
    const c = await setup();
    await c.rotate(9);
    await c.rotate(10);
    // Third rotation: bench 3x10 at 60, plus (maybe) a typo set of 100 reps.
    let last: Awaited<ReturnType<typeof c.trainNext>> | null = null;
    for (let d = 0; d < 4; d++) {
      last = await c.trainNext(
        d === 0 ? (n) => ({ [n[0]!]: [[60, 10], [60, 10], [60, 10], ...(typo ? ([[60, 100]] as [number, number][]) : [])] }) : undefined,
      );
    }
    const targets = await c.finish.getTargets(last!.written!.sessionId);
    const bench = targets.find((t) => t.nameEn === c.BENCH)!;
    const typoSets = await c.db.all<{ outlier_status: string }>("SELECT outlier_status FROM workout_set WHERE reps = 100");
    return { bench, typoSets };
  };

  it("100 reps typed instead of 10 is stored as unconfirmed and the next bench target equals the no-typo run", async () => {
    const clean = await rotateWith(false);
    const typo = await rotateWith(true);
    expect(typo.typoSets).toEqual([{ outlier_status: "unconfirmed" }]);
    expect(typo.bench).toMatchObject({ load: clean.bench.load, reps: clean.bench.reps, currency: clean.bench.currency, jumpKind: clean.bench.jumpKind });
  });
});

describe("P04 swapping a big jump for a smaller step", () => {
  it("editTargetLoad can set the reps with the load (repeat + one more rep)", async () => {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    const gymId = (await ctx.repos.getActiveGymId())!;
    const gym = await ctx.repos.loadGymFingerprint(gymId);
    const day = (await ctx.repos.getNextDay())!.day;
    const ex = (await ctx.repos.listDayExercises(day.id))[0]!;
    const planned = await ctx.finish.planDay(day.id, gymId);
    const targets = await ctx.finish.getTargets(planned!.sessionId);
    const tg = targets.find((x) => x.exerciseId === ex.exerciseId)!;
    const load = tg.load ?? 20;
    await ctx.finish.editTargetLoad(tg.id, load, gym, ex.equipment, ex.setup, 9);
    const after = (await ctx.finish.getTarget(tg.id))!;
    expect(after.status).toBe("edited");
    expect(after.reps).toBe(9);
    await expect(ctx.finish.editTargetLoad(tg.id, load, gym, ex.equipment, ex.setup, 0)).rejects.toThrow();
  });
});
