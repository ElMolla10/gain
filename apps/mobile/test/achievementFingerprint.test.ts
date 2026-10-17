import { describe, expect, it } from "vitest";
import { createAchievementRepo } from "../src/db/achievementRepo";
import type { Db } from "../src/db/driver";
import { createRepos } from "../src/db/repos";
import { freshDb } from "./helpers";

const DAY = 86_400_000;

/** Counts statements and transactions on a Db. */
function counted(db: Db) {
  let n = 0;
  let tx = 0;
  const wrap = <A extends unknown[], R>(f: (...a: A) => R) => (...a: A): R => (n++, f(...a));
  const out: Db = { exec: wrap(db.exec), run: wrap(db.run), all: wrap(db.all) as Db["all"], get: wrap(db.get) as Db["get"], transaction: ((f: () => Promise<unknown>) => (tx++, db.transaction(f))) as Db["transaction"] };
  return { db: out, reset: () => { n = 0; tx = 0; }, count: () => n, tx: () => tx };
}

async function setup() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const gymId = (await ctx.repos.getActiveGymId())!;
  const gym = await ctx.repos.loadGymFingerprint(gymId);
  const day = (await ctx.repos.getNextDay())!.day;
  const ex = (await ctx.repos.listDayExercises(day.id))[0]!;
  const setIds: string[] = [];
  for (let s = 0; s < 2; s++) {
    const { id } = await ctx.workout.startOrResumeSession(day.id, gymId);
    for (let i = 0; i < 3; i++) setIds.push((await ctx.workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load: 60, reps: 8 }, { gym, equipment: ex.equipment, setup: ex.setup })).id);
    ctx.deps.tick();
    await ctx.workout.finishSession(id);
    ctx.deps.tick(DAY);
  }
  const c = counted(ctx.db);
  const achievements = createAchievementRepo(c.db, ctx.deps, createRepos(c.db, ctx.deps));
  await achievements.ensureBackfill();
  /** Did the next launch-path call run the full sync (a transaction)? */
  const ran = async () => { c.reset(); await achievements.ensureBackfill(); return c.tx() > 0; };
  return { ...ctx, ex, setIds, c, achievements, ran };
}

describe("launch skips achievement re-evaluation when nothing changed (iOS audit 6)", () => {
  it("a second ensureBackfill uses a handful of statements and no transaction", async () => {
    const t = await setup();
    t.c.reset();
    const r = await t.achievements.ensureBackfill();
    expect(r).toEqual({ inserted: 0, reanchored: 0, revoked: 0 });
    expect(t.c.tx()).toBe(0);
    expect(t.c.count()).toBeLessThanOrEqual(8);
  });
  it("a history correction, a deleted set, a new pin, the week start and the rule version each force a re-run", async () => {
    const t = await setup();
    expect(await t.ran()).toBe(false);
    await t.history.updateSet(t.setIds[0]!, { load: 62.5, reps: 8, rir: null });
    expect(await t.ran()).toBe(true);
    expect(await t.ran()).toBe(false);
    await t.history.removeSet(t.setIds[1]!);
    expect(await t.ran()).toBe(true);
    await t.achievements.setPin({ exerciseId: t.ex.exerciseId, equipment: t.ex.equipment, setup: t.ex.setup, gymId: null, load: 100, reps: 5 } as never);
    expect(await t.ran()).toBe(true);
    await t.repos.setSetting("week_starts_on", "6");
    expect(await t.ran()).toBe(true);
    expect(await t.ran()).toBe(false);
    // An app update with new rules: the stored print carries the old version.
    const stored = JSON.parse((await t.repos.getSetting("achv_fingerprint"))!) as unknown[];
    stored[0] = -1;
    await t.repos.setSetting("achv_fingerprint", JSON.stringify(stored));
    expect(await t.ran()).toBe(true);
  });
});
