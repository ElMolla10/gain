import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DbNewerError, LATEST_VERSION, MIGRATIONS, migrate } from "../src/db/migrations";
import { splitSql } from "../src/db/schemaHeal";
import { backupBeforeMigrate } from "../src/db/preMigrate";
import type { Db } from "../src/db/driver";
import { createRepos } from "../src/db/repos";
import { createWorkoutRepo } from "../src/db/workoutRepo";
import { createFinishRepo } from "../src/db/finishRepo";
import { createGymRepo } from "../src/db/gymRepo";
import { createProgrammeRepo } from "../src/db/programmeRepo";
import { createOnboardingRepo } from "../src/db/onboardingRepo";
import { createAchievementRepo } from "../src/db/achievementRepo";
import { createDataRepo } from "../src/db/dataRepo";
import { bootFailure } from "../src/logic/bootFailure";
import { copyAtVersion, dumpAll, populatedWithRealHistory } from "./realData";
import { openNodeDb } from "./nodeDriver";
import { testDeps } from "./helpers";

// Oct 18 2026: Mohamed's iPhone showed "Could not open your data". The phone's database had been updated to schema 18 by a main build;
// Xcode then built branch fix/ios-offline-install (schema 11), whose migrate() refuses a newer database. These tests open real data from
// every earlier state with CURRENT main and run the same boot steps as App.tsx, so a future update can never strand the lifter's data.

const deps = () => testDeps(1_800_000_000_000);
const cols = async (db: Db, t: string) => (await db.all<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name);
const durable = (d: Record<string, unknown[]>) => {
  const { user_achievements: _a, achievement_audit_log: _b, setting: _c, exercise: _d, ...rest } = d;
  return rest;
};

/** The boot sequence from App.tsx up to the first screen: safety copy, migrate, seed, library top-up, onboarding, achievements, settings. */
async function boot(db: Db) {
  const d = deps();
  const files = new Map<string, string>();
  const safety = await backupBeforeMigrate(db, d, (n, t) => void files.set(n, t), (n) => files.get(n)!);
  expect(safety.blocked ?? false).toBe(false);
  const m = await migrate(db);
  const repos = createRepos(db, d);
  await repos.seedIfNeeded();
  await repos.topUpLibrary();
  const workout = createWorkoutRepo(db, d);
  const finish = createFinishRepo(db, d, repos, workout);
  const gyms = createGymRepo(db, d, repos, finish);
  const programmes = createProgrammeRepo(db, d, repos, finish);
  const onboarding = createOnboardingRepo(db, d, repos, gyms, programmes);
  await onboarding.markExistingInstall();
  await createAchievementRepo(db, d, repos).ensureBackfill();
  await repos.getLanguage();
  await repos.getUnits();
  await onboarding.getState();
  await workout.getOpenSession();
  await createDataRepo(db, d).exportJson();
  return { m, safety };
}

/** The branch's exact schema (dumped from a database its own code created) filled with the same real rows. */
async function branchDb(src: Db) {
  const db = openNodeDb();
  await db.exec(readFileSync(join(__dirname, "../../../fixtures/db/schema-fix-ios-offline-install-v11.sql"), "utf8"));
  await db.exec("PRAGMA foreign_keys = OFF");
  for (const { name: t } of await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")) {
    const c = await cols(db, t);
    for (const r of await src.all<Record<string, string | number | null>>(`SELECT ${c.join(", ")} FROM ${t}`)) await db.run(`INSERT INTO ${t} (${c.join(", ")}) VALUES (${c.map(() => "?").join(", ")})`, c.map((k) => r[k]!));
  }
  await db.exec("PRAGMA foreign_keys = ON");
  return db;
}

describe("current main opens real data from every earlier state without losing a row", () => {
  it("branch fix/ios-offline-install (schema 11, its own DDL): updates to latest and keeps every workout", async () => {
    const cur = await populatedWithRealHistory();
    const before = await dumpAll(cur.db);
    const db = await branchDb(cur.db);
    expect((await db.get<{ user_version: number }>("PRAGMA user_version"))!.user_version).toBe(11);
    const { m, safety } = await boot(db);
    expect(safety.backedUp).toBe(true);
    expect(m).toEqual({ from: 11, to: LATEST_VERSION });
    const after = await dumpAll(db);
    for (const t of ["session", "workout_set", "session_exercise", "programme", "programme_day_exercise", "gym", "import_batch"]) expect((after[t] ?? []).length, t).toBe((before[t] ?? []).length);
    expect((after.workout_set ?? []).length).toBeGreaterThan(1000);
  });

  for (let v = 1; v < LATEST_VERSION; v++) {
    it(`an earlier main build (schema ${v}) updates to latest through the boot steps`, async () => {
      const cur = await populatedWithRealHistory();
      const db = await copyAtVersion(cur.db, v);
      const { m } = await boot(db);
      expect(m.to).toBe(LATEST_VERSION);
      expect(m.repaired).toBeUndefined();
      expect((await dumpAll(db)).workout_set!.length).toBe((await dumpAll(cur.db)).workout_set!.length);
    });
  }

  it("current schema: opens with no writes beyond the usual, and nothing to repair", async () => {
    const cur = await populatedWithRealHistory();
    const before = durable(await dumpAll(cur.db));
    expect(await migrate(cur.db)).toEqual({ from: LATEST_VERSION, to: LATEST_VERSION });
    expect(durable(await dumpAll(cur.db))).toEqual(before);
  });

  it("a migration already partly applied (column from v18 exists at v17) still updates instead of failing on 'duplicate column'", async () => {
    const cur = await populatedWithRealHistory();
    const db = await copyAtVersion(cur.db, 17);
    await db.exec("ALTER TABLE weekly_review ADD COLUMN ends_at INTEGER; CREATE TABLE IF NOT EXISTS user_quest_shadow (id TEXT)");
    await expect(migrate(db)).resolves.toEqual({ from: 17, to: LATEST_VERSION });
    expect(await cols(db, "weekly_review")).toEqual(expect.arrayContaining(["original_version_id", "applied_version_id", "ends_at", "ended_at", "ended_how"]));
  });

  it("a version-number collision (user_version says 18 but the v16-v18 structure is missing) is repaired on open, rows kept", async () => {
    const cur = await populatedWithRealHistory();
    const db = await copyAtVersion(cur.db, 15);
    const sets = (await dumpAll(db)).workout_set!.length;
    await db.exec(`PRAGMA user_version = ${LATEST_VERSION}`);
    const { m } = await boot(db);
    expect(m.repaired).toEqual(expect.arrayContaining(["v16 user_quest", "v16 lift_pin", "v16 exercise_line.load_spec_json", "v17 session.readiness", "v17 lift_pin.weeks", "v18 weekly_review.ends_at"]));
    expect(await cols(db, "lift_pin")).toEqual(expect.arrayContaining(["weeks", "started_week"]));
    expect((await dumpAll(db)).workout_set!.length).toBe(sets);
    expect((await migrate(db)).repaired).toBeUndefined(); // second open: nothing left to repair
  });

  it("a missing achievements table at the current version is recreated (backfill then works)", async () => {
    const cur = await populatedWithRealHistory();
    await cur.db.exec("DROP TABLE user_achievements; DROP TABLE achievement_audit_log");
    const { m } = await boot(cur.db);
    expect(m.repaired).toEqual(expect.arrayContaining(["v15 user_achievements", "v15 achievement_audit_log"]));
  });

  it("a database written by a NEWER app is refused untouched with a typed error the boot screen explains", async () => {
    const cur = await populatedWithRealHistory();
    await cur.db.exec(`PRAGMA user_version = ${LATEST_VERSION + 3}`);
    const before = await dumpAll(cur.db);
    const err = await migrate(cur.db).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DbNewerError);
    expect((err as DbNewerError).code).toBe("db_newer");
    expect(await dumpAll(cur.db)).toEqual(before);
    const f = bootFailure("migrate", err);
    expect(f.kind).toBe("db_newer");
    expect(f.details).toContain(`v${LATEST_VERSION + 3}`);
  });

  it("this is exactly what the branch build did to the iPhone: schema-11 code refuses a schema-18 database", async () => {
    const cur = await populatedWithRealHistory();
    const old = MIGRATIONS.filter((m) => m.version <= 11);
    await expect(migrate(cur.db, old)).rejects.toThrow(`Database is newer (v${LATEST_VERSION}) than this app (v11)`);
  });
});

describe("splitSql", () => {
  it("keeps trigger bodies whole (CASE .. END inside) and drops comments", () => {
    const parts = splitSql(`-- a; b\nCREATE TABLE t (a TEXT DEFAULT ';'); /* x; */\nCREATE TRIGGER g AFTER INSERT ON t BEGIN\n UPDATE t SET a = CASE WHEN 1 THEN 'x' ELSE 'y' END;\n UPDATE t SET a = 'z';\nEND;\nALTER TABLE t ADD COLUMN b INTEGER;`);
    expect(parts).toHaveLength(3);
    expect(parts[1]).toMatch(/^CREATE TRIGGER g[\s\S]*END;$/);
  });
  it("every shipped migration splits into statements that rebuild the same schema", async () => {
    const a = openNodeDb();
    for (const m of MIGRATIONS) for (const s of splitSql(m.sql)) await a.exec(s);
    const b = openNodeDb();
    for (const m of MIGRATIONS) await b.exec(m.sql);
    const shape = async (db: Db) => (await db.all<{ type: string; name: string }>("SELECT type, name FROM sqlite_master ORDER BY name")).map((r) => `${r.type}:${r.name}`);
    expect(await shape(a)).toEqual(await shape(b));
  });
});

describe("boot error screen", () => {
  const src = readFileSync(join(__dirname, "../src/components/BootScreens.tsx"), "utf8");
  it("has a bilingual 'saved by a newer GAIN' message and a selectable, copyable Details box", () => {
    expect(src).toContain("This data was saved by a newer GAIN");
    expect(src).toContain("نسخة أحدث من GAIN");
    expect(src).toMatch(/<Text selectable testID="boot-error-details"/);
    expect(src).toContain("Copy details · انسخ التفاصيل");
  });
  it("details name the stage, the error and the schema numbers", () => {
    const f = bootFailure("migrate", Object.assign(new Error("near \"x\": syntax error"), { code: "ERR_INTERNAL_SQLITE_ERROR" }), { appSchema: 18, platform: "ios 26.0" });
    expect(f.kind).toBe("failed");
    expect(f.details).toContain("stage: migrate");
    expect(f.details).toContain("[ERR_INTERNAL_SQLITE_ERROR]");
    expect(f.details).toContain("app schema: v18");
  });
});
