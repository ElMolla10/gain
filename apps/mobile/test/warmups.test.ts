import { describe, expect, it } from "vitest";
import { findSpec, isGymLoad } from "@gain/engine";
import { warmupOffer } from "../src/logic/warmups";
import { freshDb } from "./helpers";

async function gymSetup() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const gymId = (await ctx.repos.getActiveGymId())!;
  const gym = await ctx.repos.loadGymFingerprint(gymId);
  return { ...ctx, gymId, gym };
}
const BENCH = "Barbell Bench Press";

describe("warm-up offer", () => {
  it("100 kg target on this rack gives ascending loads that exist here, all below the target", async () => {
    const { gym } = await gymSetup();
    const spec = findSpec(gym, "barbell");
    const o = warmupOffer({ workingLoad: 100, spec, setup: "free", loggedToday: 0 });
    expect(o.kind).toBe("offer");
    if (o.kind !== "offer") return;
    expect(o.sets.length).toBeGreaterThanOrEqual(3);
    for (const s of o.sets) {
      expect(isGymLoad(spec!, s.load, false), `${s.load} kg exists`).toBe(true);
      expect(s.load).toBeLessThan(100);
      expect(s.warmup).toBe(true);
    }
    const loads = o.sets.map((s) => s.load);
    expect([...loads].sort((a, b) => a - b)).toEqual(loads);
    expect(new Set(loads).size).toBe(loads.length);
  });
  it("says why there is no offer", async () => {
    const { gym } = await gymSetup();
    const spec = findSpec(gym, "barbell");
    expect(warmupOffer({ workingLoad: null, spec, setup: "free", loggedToday: 0 })).toEqual({ kind: "none", reason: "no_target" });
    expect(warmupOffer({ workingLoad: 100, spec, setup: "free", loggedToday: 1 })).toEqual({ kind: "none", reason: "already_started" });
    expect(warmupOffer({ workingLoad: 30, spec: findSpec(gym, "assisted"), setup: "assisted", loggedToday: 0 })).toEqual({ kind: "none", reason: "assisted" });
    expect(warmupOffer({ workingLoad: 100, spec: null, setup: "free", loggedToday: 0 })).toEqual({ kind: "none", reason: "no_loads" });
    expect(warmupOffer({ workingLoad: 20, spec, setup: "free", loggedToday: 0 }).kind).toBe("none");
  });
});

describe("adding warm-ups", () => {
  async function trainWithBench(withWarmups: boolean) {
    const c = await gymSetup();
    const benchDay = async () => {
      const days = await c.db.all<{ id: string }>("SELECT d.id FROM programme_day d JOIN programme_version v ON v.id = d.programme_version_id ORDER BY v.version DESC, d.position");
      for (const d of days) {
        const exs = await c.repos.listDayExercises(d.id);
        const b = exs.find((e) => e.nameEn === BENCH);
        if (b) return { dayId: d.id, bench: b };
      }
      throw new Error("no bench day");
    };
    const { dayId, bench } = await benchDay();
    let lastSession = "";
    const out: { sessionId: string; added: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const { id } = await c.workout.startOrResumeSession(dayId, c.gymId);
      const ctx = { gym: c.gym, equipment: bench.equipment, setup: bench.setup };
      let added = 0;
      if (withWarmups) {
        const o = warmupOffer({ workingLoad: 60, spec: findSpec(c.gym, bench.equipment), setup: bench.setup, loggedToday: 0 });
        if (o.kind === "offer") added = await c.workout.addWarmups(id, bench.exerciseId, o.sets, ctx);
      }
      for (const reps of [10, 10, 10]) await c.workout.logSet({ sessionId: id, exerciseId: bench.exerciseId, load: 60, reps }, ctx);
      c.deps.tick(1000);
      await c.workout.finishSession(id);
      lastSession = id;
      out.push({ sessionId: id, added });
      c.deps.tick(86_400_000);
    }
    return { ...c, out, lastSession, bench, dayId };
  }

  it("logs the ladder as warm-ups, once: a second tap adds nothing", async () => {
    const c = await gymSetup();
    const next = (await c.repos.getNextDay())!;
    const bench = (await c.repos.listDayExercises(next.day.id))[0]!;
    const { id } = await c.workout.startOrResumeSession(next.day.id, c.gymId);
    const ctx = { gym: c.gym, equipment: bench.equipment, setup: bench.setup };
    const o = warmupOffer({ workingLoad: 100, spec: findSpec(c.gym, bench.equipment), setup: bench.setup, loggedToday: 0 });
    if (o.kind !== "offer") throw new Error("expected an offer");
    expect(await c.workout.addWarmups(id, bench.exerciseId, o.sets, ctx)).toBe(o.sets.length);
    expect(await c.workout.addWarmups(id, bench.exerciseId, o.sets, ctx)).toBe(0);
    const sets = (await c.workout.listSessionSets(id)).filter((s) => s.exerciseId === bench.exerciseId);
    expect(sets).toHaveLength(o.sets.length);
    expect(sets.every((s) => s.warmup && s.outlierStatus === "none")).toBe(true);
    expect(sets.map((s) => s.load)).toEqual(o.sets.map((s) => s.load));
    // After the ladder exists, the offer is gone.
    expect(warmupOffer({ workingLoad: 100, spec: findSpec(c.gym, bench.equipment), setup: bench.setup, loggedToday: sets.length }).kind).toBe("none");
  });

  it("warm-ups never change the next target", async () => {
    const plain = await trainWithBench(false);
    const warm = await trainWithBench(true);
    expect(warm.out.every((o) => o.added > 0)).toBe(true);
    const next = async (c: typeof plain) => {
      const spec = { exerciseId: c.bench.exerciseId, name: c.bench.nameEn, equipment: c.bench.equipment, setup: c.bench.setup, repMin: c.bench.repMin, repMax: c.bench.repMax, repCeiling: c.bench.repCeiling, isGoalLift: c.bench.isGoalLift, trackEffort: c.bench.trackEffort, sets: c.bench.sets };
      const { proposal } = await c.workout.liveProposal(spec, c.gym);
      return { load: proposal.load, reps: proposal.reps, currency: proposal.currency, jumpKind: proposal.jumpKind, confidence: proposal.confidence };
    };
    expect(await next(warm)).toEqual(await next(plain));
    // And the history tells the same story: top set and counted sets are unchanged.
    const sm = await warm.finish.summarizeSession(warm.lastSession);
    const sp = await plain.finish.summarizeSession(plain.lastSession);
    expect(sm.exercises[0]!.counted).toBe(sp.exercises[0]!.counted);
    expect(sm.exercises[0]!.top).toEqual(sp.exercises[0]!.top);
    expect(sm.totals.warmups).toBeGreaterThan(0);
    expect(sp.totals.warmups).toBe(0);
  });
});
