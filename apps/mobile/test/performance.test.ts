import { describe, expect, it } from "vitest";
import type { Db } from "../src/db/driver";
import { instantiateTemplate, TEMPLATES } from "../src/logic/templates";
import { freshDb } from "./helpers";

/**
 * Step 15 performance guard. These run on NODE, not on a phone, so the ceilings are not phone timings: they exist to catch an accidental
 * N+1 query or a quadratic loop (a screen that issues one query per set, or re-reads the whole history per row) long before it reaches a
 * mid-range phone. Real phone thresholds are written down in docs/PERFORMANCE.md as PROPOSED and are still to be agreed and measured.
 */
const DAY = 86_400_000;
const START = Date.UTC(2024, 9, 1, 17);

/** Wraps a Db to count statements. */
function counted(db: Db) {
  let n = 0;
  const wrap = <A extends unknown[], R>(f: (...a: A) => R) => (...a: A): R => (n++, f(...a));
  const out: Db = { exec: wrap(db.exec), run: wrap(db.run), all: wrap(db.all) as Db["all"], get: wrap(db.get) as Db["get"], transaction: db.transaction };
  return { db: out, reset: () => (n = 0), count: () => n };
}

/** A lifter with `weeks` weeks of 4 sessions a week on a 4-day template, written with plain SQL for speed. */
async function lifter(weeks: number) {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const lib = await ctx.programmes.listExercises();
  const byKey = new Map(lib.filter((e) => e.seedKey).map((e) => [e.seedKey!, { exerciseId: e.id, equipment: e.equipment }]));
  const draft = instantiateTemplate(TEMPLATES.find((t) => t.id === "upper_lower_4")!, { byKey }, { lang: "en", goalLiftKey: "bench_press", ceilingFor: () => 10 }).draft;
  await ctx.programmes.createProgramme(draft);
  const gymId = (await ctx.repos.getActiveGymId())!;
  const v = (await ctx.programmes.getActive())!;
  const days = await ctx.repos.listDays(v.versionId);
  const { db } = ctx;
  let sets = 0;
  let sessions = 0;
  await db.transaction(async () => {
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < days.length; d++) {
        const day = days[d]!;
        const at = START + (w * 7 + d * 2) * DAY;
        const sid = `s-${w}-${d}`;
        await db.run("INSERT INTO session (id, programme_version_id, programme_day_id, gym_id, status, started_at, finished_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'finished', ?, ?, ?, ?)", [sid, v.versionId, day.id, gymId, at, at + 3_600_000, at, at]);
        sessions++;
        for (const ex of await ctx.repos.listDayExercises(day.id)) {
          const line = await ctx.workout.ensureLine(ex.exerciseId, gymId, ex.setup);
          for (let k = 0; k < ex.sets + 1; k++) {
            const warm = k === 0 ? 1 : 0;
            await db.run("INSERT INTO workout_set (id, session_id, exercise_id, line_id, position, load, reps, is_warmup, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [`${sid}-${ex.exerciseId}-${k}`, sid, ex.exerciseId, line, k + 1, 40 + w * 0.25 + (warm ? -15 : 0), warm ? 5 : 8 + (k % 3), warm, at + k, at + k]);
            sets++;
          }
        }
      }
    }
  });
  return { ...ctx, gymId, sessions, sets, days, version: v };
}

async function time<T>(f: () => Promise<T>): Promise<{ ms: number; out: T }> {
  const t0 = performance.now();
  const out = await f();
  return { ms: performance.now() - t0, out };
}

describe("two years of history (Step 15)", () => {
  it("the main reads stay fast and use a fixed number of statements however long the history is", async () => {
    const small = await lifter(8);
    const big = await lifter(104);
    expect(big.sessions).toBe(416);
    expect(big.sets).toBeGreaterThan(8000);

    const measure = async (ctx: typeof big) => {
      const c = counted(ctx.db);
      const { createHistoryRepo } = await import("../src/db/historyRepo");
      const { createRepos } = await import("../src/db/repos");
      const { createWorkoutRepo } = await import("../src/db/workoutRepo");
      const { createFinishRepo } = await import("../src/db/finishRepo");
      const repos = createRepos(c.db, ctx.deps);
      const workout = createWorkoutRepo(c.db, ctx.deps);
      const finish = createFinishRepo(c.db, ctx.deps, repos, workout);
      const history = createHistoryRepo(c.db, ctx.deps, repos, finish);
      const res: Record<string, { ms: number; stmts: number }> = {};
      const run = async (name: string, f: () => Promise<unknown>) => {
        c.reset();
        const r = await time(f);
        res[name] = { ms: r.ms, stmts: c.count() };
      };
      await run("sessionList", () => history.listSessions(30, 0));
      await run("liftList", () => history.listLifts());
      const lifts = await history.listLifts();
      await run("liftTrend", () => history.getLiftTrend(lifts[0]!.lineId));
      const first = (await history.listSessions(1, 0))[0]!;
      await run("sessionDetail", () => history.getSession(first.id));
      const next = (await repos.getNextDay())!;
      const gym = await repos.loadGymFingerprint(ctx.gymId);
      const ex = (await repos.listDayExercises(next.day.id))[0]!;
      await run("liveTarget", () => workout.liveProposal({ exerciseId: ex.exerciseId, equipment: ex.equipment, setup: ex.setup, repMin: ex.repMin, repMax: ex.repMax, repCeiling: ex.repCeiling, isGoalLift: ex.isGoalLift, trackEffort: false, sets: ex.sets }, gym));
      await run("todayNextDay", () => repos.getNextDay());
      await run("planNextSession", () => finish.planNextSession(ctx.gymId));
      return res;
    };

    const a = await measure(small);
    const b = await measure(big);
    if (process.env.PERF_REPORT) console.log(JSON.stringify({ weeks8: a, weeks104: b, sets: big.sets }, (k, v) => (typeof v === "number" ? Math.round(v * 10) / 10 : v)));
    for (const [name, r] of Object.entries(b)) {
      // 1. no screen read is slow on 2 years of history, even on Node (generous: a phone is slower; see docs/PERFORMANCE.md)
      expect(r.ms, `${name}: ${r.ms.toFixed(0)} ms`).toBeLessThan(1500);
      // 2. statements per read do not grow with the history (no N+1 per set or per session)
      expect(r.stmts, `${name}: ${r.stmts} statements vs ${a[name]!.stmts} on 8 weeks`).toBeLessThanOrEqual(a[name]!.stmts + 2);
    }
  }, 60_000);

  it("export of two years of data (JSON and CSV) completes and has every set", async () => {
    const x = await lifter(104);
    const j = await time(() => x.data.exportJson());
    const csv = await time(() => x.data.exportCsv());
    expect(j.ms).toBeLessThan(5000);
    expect(csv.ms).toBeLessThan(5000);
    expect(csv.out.trim().split("\n").length - 1).toBe(x.sets);
    expect((JSON.parse(j.out) as { tables: Record<string, unknown[]> }).tables.workout_set).toHaveLength(x.sets);
  }, 60_000);

  it("restoring a two-year backup into an empty phone returns every session and set", async () => {
    const x = await lifter(104);
    const text = await x.data.exportJson();
    const fresh = await freshDb();
    const r = await time(() => fresh.data.restoreJson(text));
    expect(r.out).toEqual({ sessions: x.sessions, sets: x.sets });
    expect(r.ms).toBeLessThan(10_000);
  }, 60_000);
});

describe("many gyms", () => {
  it("40 gyms: the active gym's rack, planning and lines are unaffected", async () => {
    const x = await lifter(4);
    const before = await x.repos.loadGymFingerprint(x.gymId);
    for (let i = 0; i < 40; i++) await x.gyms.copyGym(x.gymId, `Gym ${i}`);
    const n = Number((await x.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM gym WHERE deleted_at IS NULL"))!.n);
    const after = await x.repos.loadGymFingerprint(x.gymId);
    expect(after).toEqual(before);
    const t = await time(() => x.finish.planNextSession(x.gymId));
    expect(t.ms).toBeLessThan(1500);
    expect(n).toBe(41);
  });
});

describe("storage full while logging", () => {
  it("a failed write throws, leaves no half set, and the same row can be ticked again once there is space", async () => {
    const x = await lifter(2);
    const gym = await x.repos.loadGymFingerprint(x.gymId);
    const next = (await x.repos.getNextDay())!;
    const ex = (await x.repos.listDayExercises(next.day.id))[0]!;
    const { id } = await x.workout.startOrResumeSession(next.day.id, x.gymId);
    let full = true;
    const flaky: Db = { ...x.db, run: async (sql, p) => { if (full && /INSERT INTO workout_set/.test(sql)) throw new Error("SQLITE_FULL: database or disk is full"); return x.db.run(sql, p); } };
    const { createWorkoutRepo } = await import("../src/db/workoutRepo");
    const w = createWorkoutRepo(flaky, x.deps);
    const dctx = { gym, equipment: ex.equipment, setup: ex.setup };
    await expect(w.logSet({ id: "row-1", sessionId: id, exerciseId: ex.exerciseId, load: 60, reps: 8 }, dctx)).rejects.toThrow(/full/);
    expect(await x.workout.listSessionSets(id)).toHaveLength(0);
    full = false;
    expect((await w.logSet({ id: "row-1", sessionId: id, exerciseId: ex.exerciseId, load: 60, reps: 8 }, dctx)).created).toBe(true);
    expect(await x.workout.listSessionSets(id)).toHaveLength(1);
  });
});
