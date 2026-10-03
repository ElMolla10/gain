import { parseImport } from "@gain/engine";
import { describe, expect, it } from "vitest";
import { CATALOG } from "../src/db/libraryDraft";
import { EQUIVALENT_KEYS, equivalentsOf, preferUsedTwin } from "../src/db/library/equivalents";
import { addExercise, newExercise } from "../src/logic/programmeDraft";
import { freshDb } from "./helpers";

const csv = (title: string, day: string) =>
  `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"\n` +
  [0, 1, 2].map((i) => `"Pull","${day}, 3:15 PM","${day}, 4:32 PM","","${title}",,"",${i},"normal",100,5,,,`).join("\n") +
  "\n";

describe("library twins (same movement under two seed keys)", () => {
  it("every key exists, groups are disjoint, and the twins agree on gear and muscle", () => {
    const byKey = new Map(CATALOG.map((e) => [e.key, e]));
    const seen = new Set<string>();
    for (const g of EQUIVALENT_KEYS) {
      expect(g.length).toBeGreaterThanOrEqual(2);
      expect(new Set(g).size).toBe(g.length);
      for (const k of g) {
        expect(byKey.has(k), `${k} exists`).toBe(true);
        expect(seen.has(k), `${k} in two groups`).toBe(false);
        seen.add(k);
      }
      const first = byKey.get(g[0]!)!;
      for (const k of g) {
        expect(byKey.get(k)!.gear, k).toBe(first.gear);
        expect(byKey.get(k)!.muscle, k).toBe(first.muscle);
        expect(byKey.get(k)!.setup, k).toBe(first.setup);
      }
    }
  });
  it("equivalentsOf never returns the key itself and is symmetric", () => {
    for (const g of EQUIVALENT_KEYS) for (const k of g) {
      expect(equivalentsOf(k)).not.toContain(k);
      for (const o of equivalentsOf(k)) expect(equivalentsOf(o)).toContain(k);
    }
    expect(equivalentsOf("squat_nonexistent")).toEqual([]);
    expect(equivalentsOf(null)).toEqual([]);
  });
  it("preferUsedTwin keeps the match unless it is unused and a twin has use", () => {
    expect(preferUsedTwin("deadlift_barbell", new Map())).toBe("deadlift_barbell");
    expect(preferUsedTwin("deadlift_barbell", new Map([["deadlift", 4]]))).toBe("deadlift");
    expect(preferUsedTwin("deadlift_barbell", new Map([["deadlift", 4], ["deadlift_barbell", 1]]))).toBe("deadlift_barbell");
    expect(preferUsedTwin("squat_unknown", new Map([["x", 1]]))).toBe("squat_unknown");
  });
  async function setup() {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    await ctx.repos.topUpLibrary();
    const id = async (k: string) => (await ctx.db.get<{ id: string }>("SELECT id FROM exercise WHERE seed_key = ? AND deleted_at IS NULL", [k]))!.id;
    return { ...ctx, id };
  }
  it("an import title for one name lands on the twin the lifter already uses, and changes no row", async () => {
    const s = await setup();
    const legacy = await s.id("deadlift");
    const hevyStyle = await s.id("deadlift_barbell");
    // the lifter's programme plans the older "Conventional Deadlift" row
    const active = (await s.programmes.getActive())!;
    const draft = await s.programmes.loadDraft(active.versionId);
    await s.programmes.saveNewVersion(active.programmeId, addExercise(draft, 0, newExercise(legacy, { sets: 3, repMin: 3, repMax: 6 })));
    const before = await s.db.all("SELECT id, seed_key, name_en, updated_at, deleted_at FROM exercise ORDER BY id");
    const p0 = await s.imports.preview(parseImport(csv("Deadlift (Barbell)", "Sep 29, 2026")));
    const t0 = p0.titles.find((t) => t.title === "Deadlift (Barbell)")!;
    // the sample programme already plans the older Conventional Deadlift, so that one is in use and the other is not
    const used = await s.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM programme_day_exercise WHERE exercise_id = ? AND deleted_at IS NULL", [legacy]);
    expect(used!.n).toBeGreaterThan(0);
    expect((await s.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM programme_day_exercise WHERE exercise_id = ? AND deleted_at IS NULL", [hevyStyle]))!.n).toBe(0);
    expect(t0.suggestion).toMatchObject({ kind: "library", exerciseId: legacy });
    expect(await s.db.all("SELECT id, seed_key, name_en, updated_at, deleted_at FROM exercise ORDER BY id")).toEqual(before);
  });
  it("with no use on either row the exact name match is kept; with use only on the Hevy-style row it stays there", async () => {
    const s = await setup();
    const hevyStyle = await s.id("deadlift_barbell");
    await s.db.run("UPDATE programme_day_exercise SET deleted_at = 1 WHERE exercise_id IN (SELECT id FROM exercise WHERE seed_key IN ('deadlift','deadlift_barbell'))");
    const p = await s.imports.preview(parseImport(csv("Deadlift (Barbell)", "Sep 29, 2026")));
    expect(p.titles.find((t) => t.title === "Deadlift (Barbell)")!.suggestion).toMatchObject({ kind: "library", exerciseId: hevyStyle });
    const p2 = await s.imports.preview(parseImport(csv("Conventional Deadlift", "Sep 29, 2026")));
    expect(p2.titles.find((t) => t.title === "Conventional Deadlift")!.suggestion).toMatchObject({ kind: "library", exerciseId: await s.id("deadlift") });
  });
  it("a title with no twin is unaffected", async () => {
    const s = await setup();
    const p = await s.imports.preview(parseImport(csv("Bench Press (Barbell)", "Sep 29, 2026")));
    expect(p.titles[0]!.suggestion.kind).toBe("library");
  });
});
