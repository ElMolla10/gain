import { describe, expect, it } from "vitest";
import { LATEST_VERSION, MIGRATIONS, migrate } from "../src/db/migrations";
import { SAMPLE_EXERCISES, SAMPLE_PROGRAMME } from "../src/db/seedData";
import { freshDb } from "./helpers";
import { openNodeDb } from "./nodeDriver";

const TABLES = [
  "setting", "gym", "gym_load", "exercise", "exercise_line", "programme", "programme_version", "programme_day",
  "programme_day_exercise", "session", "workout_set", "goal", "bodyweight_entry", "target", "decision_log", "rejection_memory",
  "import_batch", "import_mapping",
];

describe("migrations", () => {
  it("creates every table, each with id, updated_at and deleted_at", async () => {
    const { db } = await freshDb();
    for (const t of TABLES) {
      const cols = (await db.all<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name);
      expect(cols, t).toEqual(expect.arrayContaining(["id", "updated_at", "deleted_at"]));
    }
  });
  it("is idempotent and tracks the version", async () => {
    const db = openNodeDb();
    expect(await migrate(db)).toEqual({ from: 0, to: LATEST_VERSION });
    expect(await migrate(db)).toEqual({ from: LATEST_VERSION, to: LATEST_VERSION });
    expect(MIGRATIONS.map((m) => m.version)).toEqual([...MIGRATIONS.keys()].map((i) => i + 1));
  });
  it("refuses a database newer than the app", async () => {
    const db = openNodeDb();
    await db.exec(`PRAGMA user_version = ${LATEST_VERSION + 1}`);
    await expect(migrate(db)).rejects.toThrow(/newer/);
  });
  it("rolls a failed transaction back", async () => {
    const { db } = await freshDb();
    await expect(
      db.transaction(async () => {
        await db.run("INSERT INTO setting (id, value, created_at, updated_at) VALUES ('a','1',1,1)");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await db.get("SELECT * FROM setting WHERE id='a'")).toBeNull();
  });
});

describe("constraints", () => {
  it("rejects an unknown equipment type and a gym_load with neither loads nor increment", async () => {
    const { db, deps } = await freshDb();
    await db.run("INSERT INTO gym (id,name,created_at,updated_at) VALUES ('g','g',1,1)");
    await expect(
      db.run("INSERT INTO gym_load (id,gym_id,equipment,increment,created_at,updated_at) VALUES ('x','g','spaceship',5,1,1)"),
    ).rejects.toThrow();
    await expect(
      db.run("INSERT INTO gym_load (id,gym_id,equipment,created_at,updated_at) VALUES ('y','g','dumbbell',1,1)"),
    ).rejects.toThrow();
    void deps;
  });
  it("one load spec per equipment per gym (soft-deleted ones do not count)", async () => {
    const { db } = await freshDb();
    await db.run("INSERT INTO gym (id,name,created_at,updated_at) VALUES ('g','g',1,1)");
    const ins = (id: string) =>
      db.run("INSERT INTO gym_load (id,gym_id,equipment,increment,created_at,updated_at) VALUES (?,'g','cable',5,1,1)", [id]);
    await ins("a");
    await expect(ins("b")).rejects.toThrow();
    await db.run("UPDATE gym_load SET deleted_at = 2 WHERE id='a'");
    await ins("c");
  });
  it("target and set enums are enforced", async () => {
    const { db } = await freshDb();
    await expect(
      db.run("INSERT INTO target (id,session_id,exercise_id,line_id,currency,rule_version,status,reason_key,confidence,created_at,updated_at) VALUES ('t','s','e','l','reps','rule-v0.1','maybe','k','low',1,1)"),
    ).rejects.toThrow();
  });
});

describe("seed (sample data)", () => {
  it("seeds a labelled sample gym, ~20 exercises with Arabic names/aliases, and a sample programme", async () => {
    const { db, repos } = await freshDb();
    expect(await repos.seedIfNeeded()).toEqual({ seeded: true });
    const gym = await db.get<{ name: string; is_sample: number }>("SELECT name, is_sample FROM gym");
    expect(gym?.is_sample).toBe(1);
    expect(gym?.name).toMatch(/sample/i);
    const ex = await db.all<{ name_ar: string; aliases_ar_json: string; is_sample: number }>("SELECT name_ar, aliases_ar_json, is_sample FROM exercise");
    expect(ex.length).toBeGreaterThanOrEqual(20);
    for (const e of ex) {
      expect(e.is_sample).toBe(1);
      expect(e.name_ar).toMatch(/[\u0600-\u06FF]/);
      expect((JSON.parse(e.aliases_ar_json) as string[]).length).toBeGreaterThan(0);
    }
    const prog = await db.get<{ name: string; is_sample: number }>("SELECT name, is_sample FROM programme");
    expect(prog?.name).toMatch(/sample/);
    expect((await db.all("SELECT id FROM programme_day")).length).toBe(SAMPLE_PROGRAMME.days.length);
  });
  it("creates one line per exercise at the sample gym, matching its setup", async () => {
    const { db, repos } = await freshDb();
    await repos.seedIfNeeded();
    const lines = await db.all<{ setup: string; seed_key: string }>(
      "SELECT l.setup AS setup, e.seed_key AS seed_key FROM exercise_line l JOIN exercise e ON e.id = l.exercise_id",
    );
    expect(lines).toHaveLength(SAMPLE_EXERCISES.length);
    expect(lines.find((l) => l.seed_key === "assisted_pullup")?.setup).toBe("assisted");
  });
  it("is idempotent: re-opening never duplicates anything", async () => {
    const { db, repos } = await freshDb();
    await repos.seedIfNeeded();
    expect(await repos.seedIfNeeded()).toEqual({ seeded: false });
    expect((await db.all("SELECT id FROM gym")).length).toBe(1);
    expect((await db.all("SELECT id FROM exercise")).length).toBe(SAMPLE_EXERCISES.length);
  });
  it("every id is a client-generated UUID and every row has timestamps", async () => {
    const { db, repos } = await freshDb();
    await repos.seedIfNeeded();
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    for (const t of ["gym", "gym_load", "exercise", "exercise_line", "programme", "programme_version", "programme_day", "programme_day_exercise"]) {
      const rows = await db.all<{ id: string; updated_at: number; deleted_at: number | null }>(`SELECT id, updated_at, deleted_at FROM ${t}`);
      expect(rows.length, t).toBeGreaterThan(0);
      for (const r of rows) {
        expect(r.id).toMatch(re);
        expect(r.updated_at).toBeGreaterThan(0);
        expect(r.deleted_at).toBeNull();
      }
    }
  });
  it("the stored gym fingerprint round-trips into engine loads", async () => {
    const { repos } = await freshDb();
    await repos.seedIfNeeded();
    const gymId = (await repos.getActiveGymId())!;
    const fp = await repos.loadGymFingerprint(gymId);
    expect(fp.gymId).toBe(gymId);
    expect(fp.loads.find((l) => l.equipment === "dumbbell")?.loads).toContain(22.5);
    expect(fp.loads.find((l) => l.equipment === "barbell")).toMatchObject({ increment: 2.5, min: 20 });
    expect(fp.loads).toHaveLength(6);
  });
});

describe("settings and Today", () => {
  it("English is the default language; Arabic persists", async () => {
    const { repos, deps } = await freshDb();
    expect(await repos.getLanguage()).toBe("en");
    await repos.setSetting("language", "ar");
    deps.tick();
    expect(await repos.getLanguage()).toBe("ar");
    await repos.setSetting("language", "en");
    expect(await repos.getLanguage()).toBe("en");
  });
  it("rtl override defaults to auto and ignores junk", async () => {
    const { repos } = await freshDb();
    expect(await repos.getRtlOverride()).toBe("auto");
    await repos.setSetting("rtl_override", "on");
    expect(await repos.getRtlOverride()).toBe("on");
    await repos.setSetting("rtl_override", "banana");
    expect(await repos.getRtlOverride()).toBe("auto");
  });
  it("setSetting updates updated_at and keeps one row", async () => {
    const { repos, db, deps } = await freshDb();
    await repos.setSetting("language", "ar");
    const t1 = (await db.get<{ updated_at: number }>("SELECT updated_at FROM setting WHERE id='language'"))!.updated_at;
    deps.tick(5000);
    await repos.setSetting("language", "en");
    const rows = await db.all<{ updated_at: number }>("SELECT updated_at FROM setting WHERE id='language'");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.updated_at).toBe(t1 + 5000);
  });
  it("Today has nothing before seeding", async () => {
    const { repos } = await freshDb();
    expect(await repos.getNextDay()).toBeNull();
  });
  it("Today starts at the first day and advances only after a FINISHED session", async () => {
    const { repos, db } = await freshDb();
    await repos.seedIfNeeded();
    const first = (await repos.getNextDay())!;
    expect(first.day.name).toBe("Upper A");
    expect(first.dayCount).toBe(4);
    const gymId = (await repos.getActiveGymId())!;
    const addSession = (status: string, finishedAt: number | null) =>
      db.run(
        `INSERT INTO session (id, programme_version_id, programme_day_id, gym_id, status, finished_at, created_at, updated_at)
         VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, 1, 1)`,
        [first.versionId, first.day.id, gymId, status, finishedAt],
      );
    await addSession("skipped", null);
    expect((await repos.getNextDay())!.day.name).toBe("Upper A"); // a missed workout is not a completed workout
    await addSession("finished", 10);
    expect((await repos.getNextDay())!.day.name).toBe("Lower A");
  });
  it("lists day exercises with Arabic names, aliases, rep ranges and the goal lift flag", async () => {
    const { repos } = await freshDb();
    await repos.seedIfNeeded();
    const next = (await repos.getNextDay())!;
    const ex = await repos.listDayExercises(next.day.id);
    expect(ex.length).toBe(6);
    expect(ex[0]).toMatchObject({ nameEn: "Barbell Bench Press", repMin: 6, repMax: 10, isGoalLift: true, setup: "free" });
    expect(ex[0]!.nameAr).toMatch(/[\u0600-\u06FF]/);
    expect(ex[0]!.aliasesAr.length).toBeGreaterThan(0);
  });
  it("the schema allows only one open session per programme day (no duplicate sessions)", async () => {
    const { repos, db } = await freshDb();
    await repos.seedIfNeeded();
    const next = (await repos.getNextDay())!;
    const gymId = (await repos.getActiveGymId())!;
    const ins = (id: string, status: string) =>
      db.run(
        "INSERT INTO session (id, programme_version_id, programme_day_id, gym_id, status, created_at, updated_at) VALUES (?,?,?,?,?,1,1)",
        [id, next.versionId, next.day.id, gymId, status],
      );
    await ins("s1", "in_progress");
    await expect(ins("s2", "planned")).rejects.toThrow();
    await db.run("UPDATE session SET status='finished' WHERE id='s1'");
    await ins("s3", "planned");
  });
});
