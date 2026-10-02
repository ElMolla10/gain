import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_LIBRARY, DRAFT_LIBRARY } from "../src/db/libraryDraft";
import { matchesExercise } from "../src/i18n/format";
import { PATTERNS } from "../src/logic/exposure";
import { reviewSheetMarkdown } from "../src/logic/reviewSheet";
import { freshDb } from "./helpers";

const AR = /[\u0600-\u06FF]/;

describe("exercise library growth (Step 8, DRAFT)", () => {
  it("every entry is well formed and unique", () => {
    const keys = new Set<string>();
    const names = new Set<string>();
    for (const e of ALL_LIBRARY) {
      expect(keys.has(e.key), `duplicate key ${e.key}`).toBe(false);
      keys.add(e.key);
      const name = `${e.en.toLowerCase()}|${e.equipment}|${e.setup}`;
      expect(names.has(name), `duplicate movement ${e.en}`).toBe(false);
      names.add(name);
      expect(AR.test(e.ar), `${e.key} Arabic name`).toBe(true);
      expect(e.aliasesAr.length).toBeGreaterThan(0);
      for (const a of e.aliasesAr) expect(AR.test(a), `${e.key} alias ${a}`).toBe(true);
      expect((PATTERNS as readonly string[]).includes(e.pattern), `${e.key} pattern ${e.pattern}`).toBe(true);
      // assisted gear is assisted, and bodyweight lifts carry added load: the engine's setups line up with equipment
      if (e.setup === "assisted") expect(e.equipment).toBe("assisted");
      if (e.setup === "bodyweight_plus_added") expect(e.equipment).toBe("plate");
    }
    expect(DRAFT_LIBRARY.length).toBeGreaterThanOrEqual(30);
  });

  it("Arabic search finds the right lift (draft terms; the reviewers' own 20 terms are still to come)", () => {
    const find = (q: string) => ALL_LIBRARY.filter((e) => matchesExercise(q, { nameEn: e.en, nameAr: e.ar, aliasesAr: e.aliasesAr })).map((e) => e.key);
    expect(find("عقلة")).toContain("pullup");
    expect(find("عقله")).toContain("pullup"); // ة and ه are the same when typing
    expect(find("هيب ثراست")).toEqual(["hip_thrust"]);
    expect(find("لانجز")).toContain("db_lunge");
    expect(find("بلغاري")).toEqual(["bulgarian_split_squat"]);
    expect(find("سمانة")).toEqual(expect.arrayContaining(["calf_raise", "standing_calf_raise"]));
    expect(find("ديدلفت")).toEqual(expect.arrayContaining(["deadlift", "romanian_deadlift", "db_rdl"]));
    expect(find("بك ديك")).toEqual(expect.arrayContaining(["pec_deck", "reverse_pec_deck"]));
    expect(find("deadlift")).toEqual(expect.arrayContaining(["deadlift", "romanian_deadlift"]));
  });

  it("the review sheet file matches the library (regenerate with: npm run review-sheet -w apps/mobile)", () => {
    const file = readFileSync(join(__dirname, "../../../docs/ARABIC-REVIEW-SHEET.md"), "utf8");
    expect(file).toBe(reviewSheetMarkdown(ALL_LIBRARY));
    expect(file).toMatch(/nothing on this sheet has been reviewed/);
  });

  it("topUpLibrary adds the missing draft rows once, as non-sample rows, and never touches the lifter's rows", async () => {
    const c = await freshDb();
    await c.repos.seedIfNeeded();
    const before = await c.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM exercise");
    const r1 = await c.repos.topUpLibrary();
    expect(r1.added).toBe(DRAFT_LIBRARY.length);
    const r2 = await c.repos.topUpLibrary();
    expect(r2.added).toBe(0);
    const after = await c.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM exercise");
    expect(after!.n).toBe(before!.n + DRAFT_LIBRARY.length);
    const sample = await c.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM exercise WHERE seed_key = 'deadlift' AND is_sample = 0");
    expect(sample!.n).toBe(1);
  });

  it("a deleted or renamed library exercise is not brought back or overwritten by a later top-up", async () => {
    const c = await freshDb();
    await c.repos.seedIfNeeded();
    await c.repos.topUpLibrary();
    await c.db.run("UPDATE exercise SET deleted_at = 1 WHERE seed_key = 'hip_thrust'");
    await c.db.run("UPDATE exercise SET name_ar = 'اسمي' WHERE seed_key = 'deadlift'");
    await c.db.run("DELETE FROM setting WHERE id = 'library_version'"); // as if a newer library version arrived
    const r = await c.repos.topUpLibrary();
    expect(r.added).toBe(0);
    expect((await c.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM exercise WHERE seed_key = 'hip_thrust' AND deleted_at IS NULL"))!.n).toBe(0);
    expect((await c.db.get<{ name_ar: string }>("SELECT name_ar FROM exercise WHERE seed_key = 'deadlift'"))!.name_ar).toBe("اسمي");
  });

  it("the picker list now carries the library, and a custom exercise with the same movement is not duplicated", async () => {
    const c = await freshDb();
    await c.repos.seedIfNeeded();
    await c.repos.topUpLibrary();
    const list = await c.programmes.listExercises();
    expect(list.length).toBe(ALL_LIBRARY.length);
    const id = await c.programmes.createExercise({ nameEn: "Conventional Deadlift", equipment: "barbell", setup: "free", pattern: "hinge" });
    expect(list.find((e) => e.nameEn === "Conventional Deadlift")!.id).toBe(id);
  });
});
