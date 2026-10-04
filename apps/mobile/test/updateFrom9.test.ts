import { describe, expect, it } from "vitest";
import { LATEST_VERSION, MIGRATIONS, migrate } from "../src/db/migrations";
import { copyAtVersion, dumpAll, populatedWithRealHistory } from "./realData";

// The phone that updates from v0.20.0 (schema 9) straight to v0.21.0 (schema 11) runs migrations 10 and 11 in ONE migrate() call.
// The per-migration tests (topSets.test.ts, exerciseLoads.test.ts) each start one version below; this one is the real update path.
describe("update over install: schema 9 -> 11 in one run, real data (Mohamed's 70-workout Hevy export + own sessions)", () => {
  it("runs 10 and 11 together, keeps every row, adds top_sets and load_spec_json as NULL, and a second run changes nothing", async () => {
    const cur = await populatedWithRealHistory();
    expect(LATEST_VERSION).toBe(11);
    const before = await dumpAll(cur.db);
    expect((before.workout_set ?? []).length).toBeGreaterThan(1000);
    const old = await copyAtVersion(cur.db, 9);
    expect((await old.get<{ user_version: number }>("PRAGMA user_version"))!.user_version).toBe(9);
    const pde0 = (await old.all<{ name: string }>("PRAGMA table_info(programme_day_exercise)")).map((c) => c.name);
    const ex0 = (await old.all<{ name: string }>("PRAGMA table_info(exercise)")).map((c) => c.name);
    expect(pde0).not.toContain("top_sets");
    expect(ex0).not.toContain("load_spec_json");

    expect(await migrate(old, MIGRATIONS)).toEqual({ from: 9, to: 11 });
    expect((await old.get<{ user_version: number }>("PRAGMA user_version"))!.user_version).toBe(11);
    expect((await old.all<{ name: string }>("PRAGMA table_info(programme_day_exercise)")).map((c) => c.name)).toContain("top_sets");
    expect((await old.all<{ name: string }>("PRAGMA table_info(exercise)")).map((c) => c.name)).toContain("load_spec_json");

    const after = await dumpAll(old);
    expect(after).toEqual(before); // row for row identical, new columns NULL on both sides
    for (const r of after.programme_day_exercise as { top_sets: number | null }[]) expect(r.top_sets).toBeNull();
    for (const r of after.exercise as { load_spec_json: string | null }[]) expect(r.load_spec_json).toBeNull();

    expect(await migrate(old, MIGRATIONS)).toEqual({ from: 11, to: 11 });
    expect(await dumpAll(old)).toEqual(before);
  });
});
