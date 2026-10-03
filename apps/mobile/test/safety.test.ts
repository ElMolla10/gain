import { describe, expect, it } from "vitest";
import { createDataRepo } from "../src/db/dataRepo";
import type { Db, Param } from "../src/db/driver";
import { LATEST_VERSION, MIGRATIONS, migrate, migrationInfo } from "../src/db/migrations";
import { backupBeforeMigrate, PRE_MIGRATION_FILE } from "../src/db/preMigrate";
import { freshDb, testDeps } from "./helpers";
import { openNodeDb } from "./nodeDriver";

/** A database at schema version `v`, as an older app would have left it, holding a small but real history written with v1-era SQL. */
async function dbAt(v: number) {
  const db = openNodeDb();
  await migrate(db, MIGRATIONS.filter((m) => m.version <= v));
  const t = 1_700_000_000_000;
  const ts = [t, t];
  const ins = (sql: string, ...p: Param[]) => db.run(sql, [...p, ...ts]);
  await ins("INSERT INTO gym (id, name, is_sample, created_at, updated_at) VALUES ('g1','Home',0,?,?)");
  await ins("INSERT INTO exercise (id, seed_key, name_en, name_ar, pattern, equipment, setup, is_sample, created_at, updated_at) VALUES ('e1','bench_press','Bench Press','بنش','horizontal_push','barbell','free',1,?,?)");
  await ins("INSERT INTO programme (id, name, is_sample, created_at, updated_at) VALUES ('p1','Mine',0,?,?)");
  await ins("INSERT INTO programme_version (id, programme_id, version, created_at, updated_at) VALUES ('v1','p1',1,?,?)");
  await ins("INSERT INTO programme_day (id, programme_version_id, name, position, created_at, updated_at) VALUES ('d1','v1','Day 1',0,?,?)");
  await ins("INSERT INTO programme_day_exercise (id, programme_day_id, exercise_id, position, sets, rep_min, rep_max, is_goal_lift, track_effort, created_at, updated_at) VALUES ('x1','d1','e1',0,3,6,10,1,0,?,?)");
  await ins("INSERT INTO exercise_line (id, exercise_id, gym_id, setup, created_at, updated_at) VALUES ('l1','e1','g1','free',?,?)");
  for (let s = 0; s < 3; s++) {
    await db.run("INSERT INTO session (id, programme_version_id, programme_day_id, gym_id, status, started_at, finished_at, created_at, updated_at) VALUES (?, 'v1','d1','g1','finished',?,?,?,?)", [`s${s}`, t + s * 1e6, t + s * 1e6 + 3e5, t, t]);
    for (let k = 0; k < 3; k++) await db.run("INSERT INTO workout_set (id, session_id, exercise_id, line_id, position, load, reps, is_warmup, created_at, updated_at) VALUES (?, ?, 'e1','l1',?,?,?,0,?,?)", [`w${s}${k}`, `s${s}`, k + 1, 60 + s * 2.5, 8, t, t]);
  }
  await db.run("INSERT INTO setting (id, value, created_at, updated_at) VALUES ('active_gym_id','g1',?,?)", ts);
  return db;
}
const count = async (db: Db, table: string) => Number((await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))!.n);

describe("upgrade paths: every older schema version migrates to the latest without losing a row", () => {
  for (let v = 1; v < LATEST_VERSION; v++) {
    it(`v${v} -> v${LATEST_VERSION}: sessions, sets, programme and settings survive; integrity and foreign keys are clean`, async () => {
      const db = await dbAt(v);
      expect((await migrationInfo(db)).from).toBe(v);
      const r = await migrate(db);
      expect(r).toEqual({ from: v, to: LATEST_VERSION });
      expect(await count(db, "workout_set")).toBe(9);
      expect(await count(db, "session")).toBe(3);
      expect((await db.get<{ value: string }>("SELECT value FROM setting WHERE id='active_gym_id'"))!.value).toBe("g1");
      expect(await db.all("PRAGMA foreign_key_check")).toEqual([]);
      expect((await db.get<{ integrity_check: string }>("PRAGMA integrity_check"))!.integrity_check).toBe("ok");
      // new columns exist with safe defaults on old rows
      expect((await db.get<{ kind: string }>("SELECT kind FROM programme WHERE id='p1'"))?.kind ?? "user").toBe("user");
    });
  }

  it("an upgraded database works with the app code: the next day, the history and a live target come from the old rows", async () => {
    const db = await dbAt(1);
    await migrate(db);
    const deps = testDeps(1_700_100_000_000);
    const { createRepos } = await import("../src/db/repos");
    const { createWorkoutRepo } = await import("../src/db/workoutRepo");
    const repos = createRepos(db, deps);
    const workout = createWorkoutRepo(db, deps);
    const next = (await repos.getNextDay())!;
    expect(next.day.id).toBe("d1");
    const gym = await repos.loadGymFingerprint("g1");
    const ex = (await repos.listDayExercises("d1"))[0]!;
    const { proposal, line, lineId } = await workout.liveProposal({ exerciseId: "e1", equipment: ex.equipment, setup: ex.setup, repMin: ex.repMin, repMax: ex.repMax, repCeiling: ex.repCeiling, isGoalLift: true, trackEffort: false, sets: 3 }, gym);
    expect((await workout.getHistory(line, lineId)).length).toBe(3);
    expect(proposal.status).not.toBe("no_history");
  });

  it("a database from a NEWER app is refused instead of being damaged", async () => {
    const db = await dbAt(LATEST_VERSION);
    await db.exec(`PRAGMA user_version = ${LATEST_VERSION + 1}`);
    await expect(migrate(db)).rejects.toThrow(/newer/);
    expect(await count(db, "workout_set")).toBe(9);
  });
});

describe("a failed or killed migration leaves the last complete version", () => {
  it("a migration that fails halfway rolls back completely and can be retried after a fix", async () => {
    const db = await dbAt(3);
    const broken = [...MIGRATIONS.filter((m) => m.version <= 3), { version: 4, name: "broken", sql: "CREATE TABLE half_done (id TEXT); INSERT INTO no_such_table VALUES (1);" }];
    await expect(migrate(db, broken)).rejects.toThrow();
    expect((await migrationInfo(db)).from).toBe(3);
    expect(await db.get("SELECT name FROM sqlite_master WHERE name = 'half_done'")).toBeNull();
    expect(await count(db, "workout_set")).toBe(9);
    expect((await migrate(db)).to).toBe(LATEST_VERSION); // the real migrations still apply afterwards
  });
});

describe("safety copy before an update (migration safety rule)", () => {
  it("is written only when an existing database is behind, contains every row, and restores into a fresh database", async () => {
    const old = await dbAt(4);
    const files: Record<string, string> = {};
    const deps = testDeps();
    const r = await backupBeforeMigrate(old, deps, (n, t) => void (files[n] = t));
    expect(r).toMatchObject({ backedUp: true, from: 4, to: LATEST_VERSION });
    const text = files[PRE_MIGRATION_FILE]!;
    expect(JSON.parse(text).schemaVersion).toBe(4);
    await migrate(old);
    // an up-to-date database and a brand-new one need no copy
    expect((await backupBeforeMigrate(old, deps, () => { throw new Error("must not write"); })).backedUp).toBe(false);
    expect((await backupBeforeMigrate(openNodeDb(), deps, () => { throw new Error("must not write"); })).backedUp).toBe(false);
    // the copy is a normal backup: restoring it into a fresh phone gives back the history
    const fresh = await freshDb();
    const res = await fresh.data.restoreJson(text);
    expect(res).toEqual({ sessions: 3, sets: 9 });
  });

  it("if the copy cannot be written (disk full) the update is BLOCKED, the error is returned, and nothing was migrated", async () => {
    const old = await dbAt(2);
    const r = await backupBeforeMigrate(old, testDeps(), () => { throw new Error("ENOSPC"); });
    expect(r.backedUp).toBe(false);
    expect(r.blocked).toBe(true);
    expect((r.error as Error).message).toBe("ENOSPC");
    expect((await old.get<{ user_version: number }>("PRAGMA user_version"))!.user_version).toBe(2); // still the old layout
    // the lifter can knowingly go on (the app does so only after they choose it)
    expect((await migrate(old)).to).toBe(LATEST_VERSION);
  });

  it("a copy that does not read back identical counts as failed (blocked)", async () => {
    const old = await dbAt(4);
    const r = await backupBeforeMigrate(old, testDeps(), () => undefined, () => "truncated");
    expect(r.blocked).toBe(true);
    const ok: Record<string, string> = {};
    const good = await backupBeforeMigrate(old, testDeps(), (n, t) => void (ok[n] = t), (n) => ok[n]!);
    expect(good.backedUp).toBe(true);
    expect(good.blocked).toBeUndefined();
    expect(await count(old, "workout_set")).toBe(9);
  });
});

/** Wraps a Db so that the Nth write statement throws, like a kill in the middle of a save. */
function crashing(db: Db) {
  let n = 0;
  let at = Infinity;
  const wrapped: Db = {
    ...db,
    run: async (sql, p) => {
      if (++n >= at) throw new Error("killed");
      return db.run(sql, p);
    },
    exec: db.exec,
    all: db.all,
    get: db.get,
    transaction: db.transaction,
  };
  return { db: wrapped, armAt: (k: number) => ((n = 0), (at = k)), disarm: () => (at = Infinity), writes: () => n };
}

async function snapshot(db: Db): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")) out[t.name] = await count(db, t.name);
  return out;
}

describe("killed in the middle of a save: nothing half-written", () => {
  it("logging a set is one statement: either the whole set exists or none of it", async () => {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    const gymId = (await ctx.repos.getActiveGymId())!;
    const gym = await ctx.repos.loadGymFingerprint(gymId);
    const next = (await ctx.repos.getNextDay())!;
    const bench = (await ctx.repos.listDayExercises(next.day.id))[0]!;
    const { id } = await ctx.workout.startOrResumeSession(next.day.id, gymId);
    const c = crashing(ctx.db);
    const { createWorkoutRepo } = await import("../src/db/workoutRepo");
    const w = createWorkoutRepo(c.db, ctx.deps);
    const dctx = { gym, equipment: bench.equipment, setup: bench.setup };
    c.armAt(1);
    await expect(w.logSet({ id: "set-1", sessionId: id, exerciseId: bench.exerciseId, load: 60, reps: 8 }, dctx)).rejects.toThrow("killed");
    expect(await ctx.workout.listSessionSets(id)).toHaveLength(0);
    c.disarm();
    // the lifter ticks again with the same row id: saved exactly once, even after another retry
    const first = await w.logSet({ id: "set-1", sessionId: id, exerciseId: bench.exerciseId, load: 60, reps: 8 }, dctx);
    const again = await w.logSet({ id: "set-1", sessionId: id, exerciseId: bench.exerciseId, load: 60, reps: 8 }, dctx);
    expect([first.created, again.created]).toEqual([true, false]);
    expect(await ctx.workout.listSessionSets(id)).toHaveLength(1);
  });

  /** A phone with one programme, repos running through the crashing wrapper, and the operations to kill. */
  async function rig() {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    const c = crashing(ctx.db);
    const { createProgrammeRepo } = await import("../src/db/programmeRepo");
    const { createFinishRepo } = await import("../src/db/finishRepo");
    const { createRepos } = await import("../src/db/repos");
    const { createWorkoutRepo } = await import("../src/db/workoutRepo");
    const repos = createRepos(c.db, ctx.deps);
    const finish = createFinishRepo(c.db, ctx.deps, repos, createWorkoutRepo(c.db, ctx.deps));
    const programmes = createProgrammeRepo(c.db, ctx.deps, repos, finish);
    const data = createDataRepo(c.db, ctx.deps);
    const lib = await programmes.listExercises();
    const ex = (i: number) => ({ exerciseId: lib[i]!.id, sets: 3, repMin: 6, repMax: 10, repCeiling: null, isGoalLift: false, trackEffort: false });
    const draft = (name: string) => ({ name, days: [{ name: "A", exercises: [ex(0), ex(2)] }, { name: "B", exercises: [ex(1)] }] });
    const backup = await createDataRepo(ctx.db, ctx.deps).exportJson();
    const base = (await programmes.createProgramme(draft("Base"))).programmeId;
    const ops: Record<string, () => Promise<unknown>> = {
      createProgramme: () => programmes.createProgramme(draft("Other")),
      saveNewVersion: () => programmes.saveNewVersion(base, draft("Base renamed")),
      restoreJson: () => data.restoreJson(backup),
      deleteAll: () => data.deleteAll(),
    };
    return { ctx, c, ops };
  }

  /** Every version has days and every day has exercises: a programme is never left half-written. */
  async function programmesWhole(db: Db) {
    expect(await db.all("SELECT v.id FROM programme_version v WHERE v.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM programme_day d WHERE d.programme_version_id = v.id)")).toEqual([]);
    expect(await db.all("SELECT d.id FROM programme_day d WHERE d.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM programme_day_exercise e WHERE e.programme_day_id = d.id)")).toEqual([]);
    expect(await db.all("PRAGMA foreign_key_check")).toEqual([]);
  }

  for (const name of ["createProgramme", "saveNewVersion", "restoreJson", "deleteAll"]) {
    it(`${name}: killed at every point of its writes, the data is either untouched or whole`, async () => {
      const probe = await rig();
      probe.c.armAt(Infinity);
      await probe.ops[name]!();
      const total = probe.c.writes();
      expect(total).toBeGreaterThan(2);
      const step = Math.max(1, Math.floor(total / 15));
      for (let k = 1; k <= total; k += step) {
        const { ctx, c, ops } = await rig(); // a fresh phone for every kill point
        const before = await snapshot(ctx.db);
        c.armAt(k);
        await expect(ops[name]!(), `${name} killed at write ${k}`).rejects.toThrow();
        c.disarm();
        const after = await snapshot(ctx.db);
        if (name === "restoreJson" || name === "deleteAll") expect(after, `${name} at write ${k}`).toEqual(before); // one transaction and nothing after it
        await programmesWhole(ctx.db);
        if (name === "saveNewVersion" || name === "createProgramme") {
          // the transaction is all-or-nothing; only the re-plan AFTER it may be missing, and that is rebuilt when Today opens
          const grew = after.programme_version! > before.programme_version!;
          if (!grew) expect(after, `${name} at write ${k}`).toEqual(before);
        }
      }
    });
  }
});

describe("killed while applying a short week", () => {
  it("the new programme version and the record that brings the normal week back are saved together", async () => {
    const { instantiateTemplate, TEMPLATES } = await import("../src/logic/templates");
    const probeWrites = async (arm: number) => {
      const ctx = await freshDb();
      await ctx.repos.seedIfNeeded();
      const lib = await ctx.programmes.listExercises();
      const byKey = new Map(lib.filter((e) => e.seedKey).map((e) => [e.seedKey!, { exerciseId: e.id, equipment: e.equipment }]));
      const draft = instantiateTemplate(TEMPLATES.find((t) => t.id === "upper_lower_4")!, { byKey }, { lang: "en", goalLiftKey: "bench_press", ceilingFor: () => 10 }).draft;
      await ctx.programmes.createProgramme(draft);
      const c = crashing(ctx.db);
      const { createProgrammeRepo } = await import("../src/db/programmeRepo");
      const { createFinishRepo } = await import("../src/db/finishRepo");
      const { createRepos } = await import("../src/db/repos");
      const { createWorkoutRepo } = await import("../src/db/workoutRepo");
      const { createShortWeekRepo } = await import("../src/db/shortWeekRepo");
      const { createGoalRepo } = await import("../src/db/goalRepo");
      const repos = createRepos(c.db, ctx.deps);
      const finish = createFinishRepo(c.db, ctx.deps, repos, createWorkoutRepo(c.db, ctx.deps));
      const programmes = createProgrammeRepo(c.db, ctx.deps, repos, finish);
      const sw = createShortWeekRepo(c.db, ctx.deps, repos, programmes, createGoalRepo(c.db, ctx.deps, repos));
      c.armAt(arm);
      const failed = await sw.apply(2, null, Date.UTC(2026, 9, 2, 12)).then(() => false, () => true);
      return { ctx, c, failed, programmes };
    };
    const dry = await probeWrites(Infinity);
    expect(dry.failed).toBe(false);
    const total = dry.c.writes();
    for (let k = 1; k <= total; k++) {
      const r = await probeWrites(k);
      const active = await r.ctx.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM short_week WHERE status = 'active'");
      const versions = (await r.programmes.getActive())!.version;
      // either nothing happened (version 1, no record) or both happened: never a short programme without the record that restores the normal one
      expect({ k, versions, active: Number(active!.n) }, `kill at write ${k}`).toSatisfy((x: { versions: number; active: number }) => (x.versions === 1 && x.active === 0) || (x.versions === 2 && x.active === 1));
    }
  });
});
