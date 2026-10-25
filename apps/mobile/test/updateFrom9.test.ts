import { describe, expect, it } from "vitest";
import { LATEST_VERSION, MIGRATIONS, migrate } from "../src/db/migrations";
import { copyAtVersion, dumpAll, populatedWithRealHistory } from "./realData";

// The phone that updates from v0.20.0 (schema 9) straight to latest runs migrations 10+ in ONE migrate() call.
// The per-migration tests (topSets.test.ts, exerciseLoads.test.ts) each start one version below; this one is the real update path.
describe("update over install: schema 9 -> latest in one run, real data (Mohamed's 70-workout Hevy export + own sessions)", () => {
  it("runs the pending migrations together, keeps every row, adds top_sets and load_spec_json as NULL, and a second run changes nothing", async () => {
    const cur = await populatedWithRealHistory();
    expect(LATEST_VERSION).toBe(19);
    const before = await dumpAll(cur.db);
    expect((before.workout_set ?? []).length).toBeGreaterThan(1000);
    const old = await copyAtVersion(cur.db, 9);
    expect((await old.get<{ user_version: number }>("PRAGMA user_version"))!.user_version).toBe(9);
    const pde0 = (await old.all<{ name: string }>("PRAGMA table_info(programme_day_exercise)")).map((c) => c.name);
    const ex0 = (await old.all<{ name: string }>("PRAGMA table_info(exercise)")).map((c) => c.name);
    expect(pde0).not.toContain("top_sets");
    expect(ex0).not.toContain("load_spec_json");

    expect(await migrate(old, MIGRATIONS)).toEqual({ from: 9, to: LATEST_VERSION });
    expect((await old.get<{ user_version: number }>("PRAGMA user_version"))!.user_version).toBe(LATEST_VERSION);
    expect((await old.all<{ name: string }>("PRAGMA table_info(programme_day_exercise)")).map((c) => c.name)).toContain("top_sets");
    expect((await old.all<{ name: string }>("PRAGMA table_info(exercise)")).map((c) => c.name)).toContain("load_spec_json");
    expect((await old.all<{ name: string }>("PRAGMA table_info(session)")).map((c) => c.name)).toContain("paused_ms");
    expect((await old.all<{ name: string }>("PRAGMA table_info(session)")).map((c) => c.name)).toContain("local_calendar_date");
    expect((await old.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('user_achievements','achievement_audit_log','user_quest','lift_pin')")).map((r) => r.name).sort()).toEqual(["achievement_audit_log", "lift_pin", "user_achievements", "user_quest"]);
    expect((await old.all<{ name: string }>("PRAGMA table_info(exercise_line)")).map((c) => c.name)).toContain("load_spec_json");
    expect((await old.all<{ name: string }>("PRAGMA table_info(session)")).map((c) => c.name)).toContain("readiness");
    expect((await old.all<{ name: string }>("PRAGMA table_info(session)")).map((c) => c.name)).toContain("feel");
    expect((await old.all<{ name: string }>("PRAGMA table_info(lift_pin)")).map((c) => c.name)).toEqual(expect.arrayContaining(["weeks", "started_week"]));
    expect((await old.all<{ name: string }>("PRAGMA table_info(weekly_review)")).map((c) => c.name)).toEqual(expect.arrayContaining(["original_version_id", "applied_version_id", "ends_at", "ended_at", "ended_how"]));

    const after = await dumpAll(old);
    // Achievements are derived after import on latest; schema 9 had no such tables, so a v9 copy + migrate starts them empty.
    const durable = (d: Record<string, unknown[]>) => {
      const { user_achievements: _a, achievement_audit_log: _b, ...rest } = d;
      return rest;
    };
    expect(durable(after)).toEqual(durable(before)); // row for row identical, new columns NULL (or 0) on both sides
    for (const r of after.programme_day_exercise as { top_sets: number | null }[]) expect(r.top_sets).toBeNull();
    for (const r of after.exercise as { load_spec_json: string | null }[]) expect(r.load_spec_json).toBeNull();
    for (const r of after.session as { paused_ms: number; paused_at: number | null; readiness: string | null }[]) {
      expect(r.paused_ms).toBe(0);
      expect(r.paused_at).toBeNull();
      expect(r.readiness).toBeNull();
    }
    expect(after.user_achievements).toEqual([]);
    expect(after.achievement_audit_log).toEqual([]);
    expect(after.user_quest).toEqual([]);
    expect(after.lift_pin).toEqual([]);
    for (const r of after.exercise_line as { load_spec_json: string | null }[]) expect(r.load_spec_json).toBeNull();

    expect(await migrate(old, MIGRATIONS)).toEqual({ from: LATEST_VERSION, to: LATEST_VERSION });
    expect(durable(await dumpAll(old))).toEqual(durable(before));
  });
});
