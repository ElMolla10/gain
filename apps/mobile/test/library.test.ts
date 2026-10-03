import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyLift, classifyTitle, matchLibrary, nameKey, parseImport, type LibraryEntry } from "@gain/engine";
import { ALL_LIBRARY, CATALOG, CATALOG_BY_KEY, DRAFT_LIBRARY, LIBRARY_VERSION } from "../src/db/libraryDraft";
import { ENGINE_EQUIPMENT, GEARS, GROUP_OF_MUSCLE, MUSCLES, MUSCLE_GROUPS } from "../src/db/library";
import { ceilingForName } from "../src/logic/ceilings";
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
    expect(DRAFT_LIBRARY.length).toBeGreaterThanOrEqual(450);
    expect(ALL_LIBRARY.length).toBeGreaterThanOrEqual(500);
  });

  it("Arabic search finds the right lift (draft terms; the reviewers' own 20 terms are still to come)", () => {
    const find = (q: string) => ALL_LIBRARY.filter((e) => matchesExercise(q, { nameEn: e.en, nameAr: e.ar, aliasesAr: e.aliasesAr })).map((e) => e.key);
    expect(find("عقلة")).toContain("pullup");
    expect(find("عقله")).toContain("pullup"); // ة and ه are the same when typing
    expect(find("هيب ثراست")).toEqual(expect.arrayContaining(["hip_thrust", "hip_thrust_smith_machine"]));
    expect(find("لانجز")).toContain("db_lunge");
    expect(find("بلغاري")).toEqual(expect.arrayContaining(["bulgarian_split_squat", "bulgarian_split_squat_barbell"]));
    expect(find("سمانة")).toEqual(expect.arrayContaining(["calf_raise", "standing_calf_raise"]));
    expect(find("ديدلفت")).toEqual(expect.arrayContaining(["deadlift", "romanian_deadlift", "db_rdl"]));
    expect(find("بك ديك")).toEqual(expect.arrayContaining(["pec_deck", "reverse_pec_deck"]));
    expect(find("deadlift")).toEqual(expect.arrayContaining(["deadlift", "romanian_deadlift"]));
    // v0.12.0 terms
    expect(find("ادكتور")).toContain("hip_adductor_machine");
    expect(find("شراج")).toEqual(expect.arrayContaining(["db_shrug", "shrug_barbell"]));
    expect(find("كيتل بيل")).toContain("kettlebell_swing");
  });

  it("the review sheet file matches the library (regenerate with: npm run review-sheet -w apps/mobile)", () => {
    const file = readFileSync(join(__dirname, "../../../docs/ARABIC-REVIEW-SHEET.md"), "utf8");
    expect(file).toBe(reviewSheetMarkdown(ALL_LIBRARY));
    expect(file).toMatch(/no sign-off is recorded on this sheet/);
    expect(file).toMatch(/must still sign off before any "draft" label is removed/);
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
    expect(list.length).toBeGreaterThanOrEqual(500);
    const id = await c.programmes.createExercise({ nameEn: "Conventional Deadlift", equipment: "barbell", setup: "free", pattern: "hinge" });
    expect(list.find((e) => e.nameEn === "Conventional Deadlift")!.id).toBe(id);
  });
});

const fixture = (name: string) => readFileSync(join(__dirname, "../../../fixtures", name), "utf8");

describe("v0.12.0 library: ids, classification, coverage", () => {
  it("library version bumped so existing installs top up once", () => {
    expect(LIBRARY_VERSION).toBe(2);
  });

  it("ids are unique, lower-case slugs, and no two rows are the same Hevy name", () => {
    const keys = ALL_LIBRARY.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k, k).toMatch(/^[a-z0-9]+(_[a-z0-9]+)*$/);
    const names = ALL_LIBRARY.map((e) => e.en.toLowerCase().replace(/\s+/g, " "));
    expect(new Set(names).size).toBe(names.length);
    expect(CATALOG.length).toBe(ALL_LIBRARY.length);
  });

  it("no new row repeats a movement the app already shipped under another name (same words, same bracket, same equipment)", () => {
    const sig = (e: (typeof CATALOG)[number]) => `${nameKey(classifyTitle(e.en).base)}|${(classifyTitle(e.en).suffix ?? e.gear).toLowerCase()}|${e.equipment}|${e.setup}`;
    const seen = new Map<string, string>();
    for (const e of CATALOG) {
      const s = sig(e);
      const other = seen.get(s);
      expect(other, `${e.en} repeats ${other}`).toBeUndefined();
      seen.set(s, e.key);
    }
  });

  it("every row has a muscle, gear and ceiling class that agree with the engine", () => {
    for (const e of CATALOG) {
      expect((MUSCLES as readonly string[]).includes(e.muscle), `${e.key} muscle`).toBe(true);
      expect((GEARS as readonly string[]).includes(e.gear), `${e.key} gear`).toBe(true);
      expect(GROUP_OF_MUSCLE[e.muscle], e.key).toBeTruthy();
      expect(ENGINE_EQUIPMENT[e.gear], `${e.key} engine equipment`).toBe(e.equipment);
      if (e.gear === "assisted") expect(e.setup).toBe("assisted");
      if (e.gear === "bodyweight" || e.gear === "suspension") expect(e.setup).toBe("bodyweight_plus_added");
      if (e.setup === "free") expect(["bodyweight", "suspension", "assisted"]).not.toContain(e.gear);
      expect(e.draftAr, e.key).toBe(true);
      // the stored classification is what the engine's name classifier says (that is what the app really uses at run time)
      const c = classifyLift(e.en);
      expect(c.lateralRaise ? "lateral_raise" : c.bodyRegion, `${e.en} ceiling class`).toBe(e.ceilingClass);
    }
  });

  it("rep ceilings: 10 upper body, 12 legs, 15 for every lateral raise variant", () => {
    const ceilings = { upper: 10, lower: 12, lateral_raise: 15 };
    let lateral = 0;
    for (const e of CATALOG) {
      const want = e.ceilingClass === "lateral_raise" ? 15 : e.ceilingClass === "lower" ? 12 : 10;
      expect(ceilingForName(e.en, ceilings), e.en).toBe(want);
      if (/\b(lateral|side) raises?\b/i.test(e.en) && !/reverse|rear|bent/i.test(e.en)) {
        lateral++;
        expect(want, e.en).toBe(15);
      }
    }
    expect(lateral).toBeGreaterThanOrEqual(10);
  });

  it("covers every muscle group, every gear and the three setups", () => {
    const perGroup = new Map<string, number>();
    const perGear = new Map<string, number>();
    for (const e of CATALOG) {
      perGroup.set(GROUP_OF_MUSCLE[e.muscle], (perGroup.get(GROUP_OF_MUSCLE[e.muscle]) ?? 0) + 1);
      perGear.set(e.gear, (perGear.get(e.gear) ?? 0) + 1);
    }
    for (const g of MUSCLE_GROUPS) expect(perGroup.get(g) ?? 0, `group ${g}`).toBeGreaterThanOrEqual(8);
    for (const g of GEARS) expect(perGear.get(g) ?? 0, `gear ${g}`).toBeGreaterThanOrEqual(5);
    for (const m of MUSCLES) expect(CATALOG.some((e) => e.muscle === m), `muscle ${m}`).toBe(true);
    for (const setup of ["free", "assisted", "bodyweight_plus_added"]) expect(CATALOG.some((e) => e.setup === setup), setup).toBe(true);
    expect(CATALOG.filter((e) => e.ceilingClass === "lower").length).toBeGreaterThanOrEqual(120);
  });

  it("every Arabic name and alias is Arabic text and every Arabic string is a draft (no Latin-only names)", () => {
    for (const e of CATALOG) {
      expect(AR.test(e.ar), e.key).toBe(true);
      expect(e.aliasesAr.length).toBeGreaterThan(0);
      for (const a of e.aliasesAr) expect(AR.test(a), `${e.key}: ${a}`).toBe(true);
    }
  });
});

describe("v0.12.0 library: imports resolve to library rows", () => {
  const lib: LibraryEntry[] = ALL_LIBRARY.map((e) => ({ id: e.key, nameEn: e.en, equipment: e.equipment, setup: e.setup }));

  it("every exercise title in fixtures/hevy-export.csv matches exactly one library row", () => {
    const parse = parseImport(fixture("hevy-export.csv"));
    const titles = [...new Set(parse.workouts.flatMap((w) => w.exercises.map((x) => x.title)))];
    expect(titles.length).toBeGreaterThanOrEqual(50);
    const missing = titles.filter((t) => matchLibrary(t, lib) === null);
    expect(missing).toEqual([]);
  });

  it("the other fixtures (Hevy and Strong synthetic) resolve too", () => {
    for (const f of ["hevy-synthetic.csv", "strong-synthetic.csv"]) {
      const parse = parseImport(fixture(f));
      const titles = [...new Set(parse.workouts.flatMap((w) => w.exercises.map((x) => x.title)))];
      expect(titles.filter((t) => matchLibrary(t, lib) === null), f).toEqual([]);
    }
  });

  it("every library row finds itself by its own name, so no Hevy-style name is ambiguous", () => {
    for (const e of ALL_LIBRARY) expect(matchLibrary(e.en, lib)?.id, e.en).toBe(e.key);
  });

  it("a Hevy export imports against the topped-up library with no new exercises created", async () => {
    const c = await freshDb();
    await c.repos.seedIfNeeded();
    await c.repos.topUpLibrary();
    const parse = parseImport(fixture("hevy-export.csv"));
    const prev = await c.imports.preview(parse);
    const fresh = prev.titles.filter((t) => t.suggestion.kind === "new").map((t) => t.title);
    expect(fresh).toEqual([]);
    expect(prev.titles.every((t) => t.suggestion.kind === "library")).toBe(true);
  });

  it("common Hevy and Strong names for movements beyond the fixtures also resolve", () => {
    const ok = [
      "Squat (Barbell)", "Deadlift (Barbell)", "Overhead Press (Barbell)", "Incline Bench Press (Barbell)", "Bent Over Row (Barbell)", "Hip Thrust (Barbell)",
      "Romanian Deadlift (Barbell)", "Lying Leg Curl (Machine)", "Lat Pulldown (Cable)", "Pull Up", "Chin Up", "Triceps Dip", "Plank", "Crunch", "Kettlebell Swing",
      "Hammer Curl (Dumbbell)", "Lunge (Dumbbell)", "Standing Calf Raise (Machine)", "Shrug (Dumbbell)", "Face Pull (Cable)",
    ];
    for (const t of ok) expect(matchLibrary(t, lib), t).not.toBeNull();
  });
});

describe("v0.12.0 library: top-up never touches the lifter's rows", () => {
  it("a v1 install gets only the missing rows; a lifter's custom, renamed or deleted rows with the same key stay as they were", async () => {
    const c = await freshDb();
    await c.repos.seedIfNeeded();
    await c.repos.topUpLibrary();
    // pretend this phone is on library v1 with a lifter's edits
    await c.db.run("DELETE FROM exercise WHERE seed_key = 'squat_barbell' OR seed_key = 'plank' OR seed_key = 'kettlebell_swing'");
    await c.db.run("INSERT INTO exercise (id, seed_key, name_en, name_ar, aliases_ar_json, pattern, equipment, setup, is_sample, created_at, updated_at) VALUES ('mine', 'plank', 'My plank', 'بلانكي', '[]', 'other', 'plate', 'bodyweight_plus_added', 0, 1, 1)");
    await c.db.run("UPDATE exercise SET deleted_at = 5 WHERE seed_key = 'plank'");
    await c.db.run("UPDATE exercise SET name_ar = 'اسمي', name_en = 'My bench' WHERE seed_key = 'bench_press_smith_machine'");
    const customId = await c.programmes.createExercise({ nameEn: "Bench Press (Smith Machine) mine", equipment: "machine", setup: "free", pattern: "horizontal_push" });
    await c.db.run("DELETE FROM setting WHERE id = 'library_version'");
    const r = await c.repos.topUpLibrary();
    expect(r.added).toBe(2); // squat_barbell and kettlebell_swing only
    expect((await c.db.get<{ name_en: string }>("SELECT name_en FROM exercise WHERE id = 'mine'"))!.name_en).toBe("My plank");
    expect((await c.db.get<{ deleted_at: number | null }>("SELECT deleted_at FROM exercise WHERE id = 'mine'"))!.deleted_at).toBe(5);
    expect((await c.db.get<{ name_en: string; name_ar: string }>("SELECT name_en, name_ar FROM exercise WHERE seed_key = 'bench_press_smith_machine'"))).toEqual({ name_en: "My bench", name_ar: "اسمي" });
    expect((await c.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM exercise WHERE id = ?", [customId]))!.n).toBe(1);
  });

  it("a library row is never marked as the lifter's sample data, and the top-up is quick", async () => {
    const c = await freshDb();
    await c.repos.seedIfNeeded();
    const t0 = Date.now();
    const r = await c.repos.topUpLibrary();
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(r.added).toBe(DRAFT_LIBRARY.length);
    expect((await c.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM exercise WHERE is_sample = 0 AND seed_key IS NOT NULL"))!.n).toBe(DRAFT_LIBRARY.length);
  });
});
