import { describe, expect, it } from "vitest";
import { SAMPLE_PROGRAMME } from "../src/db/seedData";
import { freshDb } from "./helpers";

async function setup() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const gymId = (await ctx.repos.getActiveGymId())!;
  const gym = await ctx.repos.loadGymFingerprint(gymId);
  const all = async () => {
    const v = (await ctx.repos.getLatestProgrammeVersion())!;
    const days = await ctx.repos.listDays(v.versionId);
    const out = [];
    for (const d of days) for (const e of await ctx.repos.listDayExercises(d.id)) out.push({ day: d.name, ...e });
    return out;
  };
  /** Train `days` program days (a full rotation by default; 3 days ends with Lower B written); `plan` maps an exercise name to [load, reps] x3 on the day it appears. Other days log a filler set. */
  const rotation = async (plan: Record<string, [number, number]>, days = 4) => {
    let lastWritten: string | null = null;
    for (let d = 0; d < days; d++) {
      const next = (await ctx.repos.getNextDay())!;
      const exs = await ctx.repos.listDayExercises(next.day.id);
      const { id } = await ctx.workout.startOrResumeSession(next.day.id, gymId);
      const mine = exs.filter((e) => plan[e.nameEn]);
      for (const e of mine.length ? mine : [exs[0]!]) {
        const [load, reps] = plan[e.nameEn] ?? [50, 10];
        for (let i = 0; i < 3; i++) await ctx.workout.logSet({ sessionId: id, exerciseId: e.exerciseId, load, reps }, { gym, equipment: e.equipment, setup: e.setup });
      }
      ctx.deps.tick(1000);
      await ctx.workout.finishSession(id);
      lastWritten = (await ctx.finish.writeNextSessionTargets(id))!.sessionId;
      ctx.deps.tick(86_400_000);
    }
    return ctx.finish.getTargets(lastWritten!);
  };
  return { ...ctx, gymId, gym, all, rotation };
}

describe("rep ceilings in the seeded program", () => {
  it("upper body 10, legs 12, lateral raises 15 for every seeded lift", async () => {
    const { all } = await setup();
    const rows = await all();
    expect(rows.length).toBeGreaterThan(15);
    for (const r of rows) {
      const legs = /Squat|Leg |Deadlift|Calf/.test(r.nameEn);
      const lateral = /Lateral Raise/.test(r.nameEn);
      expect(r.repCeiling, `${r.day}: ${r.nameEn}`).toBe(lateral ? 15 : legs ? 12 : 10);
      expect(r.repMax).toBe(r.repCeiling);
      expect(r.repMin).toBeLessThan(r.repCeiling);
      expect(r.repCeilingIsCustom).toBe(false);
    }
  });
  it("the seed program's own ranges end at the same ceilings (what the Today screen shows)", async () => {
    const { db } = await setup();
    const rows = await db.all<{ rep_max: number; name_en: string }>(
      "SELECT pde.rep_max, e.name_en FROM programme_day_exercise pde JOIN exercise e ON e.id = pde.exercise_id",
    );
    expect(rows.length).toBe(SAMPLE_PROGRAMME.days.flatMap((d) => d.exercises).length);
    for (const r of rows) expect([10, 12, 15]).toContain(r.rep_max);
  });
  it("a stale stored range (old 8-12 on an upper lift) does not hold the load: the ceiling wins", async () => {
    const { db, all } = await setup();
    await db.run("UPDATE programme_day_exercise SET rep_min = 8, rep_max = 12 WHERE exercise_id IN (SELECT id FROM exercise WHERE name_en = 'Barbell Bench Press')");
    const bench = (await all()).find((r) => r.nameEn === "Barbell Bench Press")!;
    expect(bench.repMax).toBe(10);
  });
});

describe("ceilings are editable", () => {
  it("per lift, and clearing returns to the default", async () => {
    const { repos, all } = await setup();
    const bench = (await all()).find((r) => r.nameEn === "Barbell Bench Press")!;
    await repos.setLiftRepCeiling(bench.id, 8);
    let b = (await all()).find((r) => r.nameEn === "Barbell Bench Press")!;
    expect(b).toMatchObject({ repCeiling: 8, repMax: 8, repCeilingIsCustom: true });
    expect((await all()).find((r) => r.nameEn === "Incline Dumbbell Press")!.repCeiling).toBe(10); // other lifts untouched
    await repos.setLiftRepCeiling(bench.id, null);
    b = (await all()).find((r) => r.nameEn === "Barbell Bench Press")!;
    expect(b).toMatchObject({ repCeiling: 10, repCeilingIsCustom: false });
    await expect(repos.setLiftRepCeiling(bench.id, 0)).rejects.toThrow();
  });
  it("app-wide defaults per kind of lift, validated, resettable", async () => {
    const { repos, all } = await setup();
    expect(await repos.getRepCeilingDefaults()).toEqual({ upper: 10, lower: 12, lateral_raise: 15 });
    expect(await repos.setRepCeilingDefaults({ lower: 15 })).toEqual({ upper: 10, lower: 15, lateral_raise: 15 });
    expect((await all()).find((r) => r.nameEn === "Leg Press")!.repCeiling).toBe(15);
    expect((await all()).find((r) => r.nameEn === "Barbell Bench Press")!.repCeiling).toBe(10);
    await expect(repos.setRepCeilingDefaults({ upper: 0 })).rejects.toThrow();
    expect(await repos.getRepCeilingDefaults()).toMatchObject({ lower: 15 });
    expect(await repos.resetRepCeilingDefaults("lower")).toEqual({ upper: 10, lower: 12, lateral_raise: 15 });
  });
  it("a damaged setting falls back to the built-in defaults", async () => {
    const { repos } = await setup();
    await repos.setSetting("rep_ceilings", "{not json");
    expect(await repos.getRepCeilingDefaults()).toEqual({ upper: 10, lower: 12, lateral_raise: 15 });
  });
});

describe("end to end: load goes up only at the ceiling", () => {
  it("bench: 9 reps keeps the load and asks for 10; 10 reps raises it", async () => {
    const a = await setup();
    await a.rotation({ "Barbell Bench Press": [60, 9] });
    const stay = (await a.rotation({ "Barbell Bench Press": [60, 9] })).find((t) => t.nameEn === "Barbell Bench Press")!;
    expect(stay.load).toBe(60);
    expect(stay.reps).toBe(10);
    expect(stay.currency).toBe("reps");

    const b = await setup();
    await b.rotation({ "Barbell Bench Press": [60, 9] });
    const up = (await b.rotation({ "Barbell Bench Press": [60, 10] })).find((t) => t.nameEn === "Barbell Bench Press")!;
    expect(up.currency).toBe("load");
    expect(up.load).toBeGreaterThan(60);
  });
  it("leg press: 11 reps is not the ceiling, 12 is", async () => {
    const a = await setup();
    await a.rotation({ "Leg Press": [100, 11] });
    const t11 = (await a.rotation({ "Leg Press": [100, 11] }, 3)).find((t) => t.nameEn === "Leg Press")!;
    expect(t11).toMatchObject({ load: 100, reps: 12, currency: "reps" });
    const b = await setup();
    await b.rotation({ "Leg Press": [100, 11] });
    const t12 = (await b.rotation({ "Leg Press": [100, 12] }, 3)).find((t) => t.nameEn === "Leg Press")!;
    expect(t12.currency).toBe("load");
    expect(t12.load).toBe(105);
  });
  it("lateral raise: 14 reps keeps the load and asks for 15", async () => {
    const a = await setup();
    await a.rotation({ "Dumbbell Lateral Raise": [10, 13] });
    const t = (await a.rotation({ "Dumbbell Lateral Raise": [10, 14] })).find((x) => x.nameEn === "Dumbbell Lateral Raise")!;
    expect(t).toMatchObject({ load: 10, reps: 15, currency: "reps" });
  });
});
