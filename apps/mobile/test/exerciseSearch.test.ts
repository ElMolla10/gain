import { beforeAll, describe, expect, it } from "vitest";
import { ALL_LIBRARY, CATALOG } from "../src/db/libraryDraft";
import { GEARS, MUSCLE_GROUPS } from "../src/db/library";
import type { LibraryExercise } from "../src/db/programmeRepo";
import { buildSearchIndex, metaOf, PICKER_PAGE, searchExercises, type SearchRow } from "../src/logic/exerciseSearch";
import { en, ar } from "../src/i18n/strings";

const asRows = (): LibraryExercise[] =>
  ALL_LIBRARY.map((e, i) => ({ id: `id${i}`, seedKey: e.key, nameEn: e.en, nameAr: e.ar, aliasesAr: e.aliasesAr, pattern: e.pattern, equipment: e.equipment, setup: e.setup, isCustom: false })).sort((a, b) => a.nameEn.localeCompare(b.nameEn));

let rows: LibraryExercise[];
let index: SearchRow[];
beforeAll(() => {
  rows = asRows();
  index = buildSearchIndex(rows);
});
const names = (r: LibraryExercise[]) => r.map((x) => x.nameEn);

describe("picker search over 600+ exercises", () => {
  it("finds by English name, any word order, case and punctuation insensitive", () => {
    expect(names(searchExercises(index, { query: "bench press barbell" }))).toContain("Barbell Bench Press");
    expect(names(searchExercises(index, { query: "BARBELL bench" }))).toContain("Barbell Bench Press");
    expect(names(searchExercises(index, { query: "pull up" }))).toEqual(expect.arrayContaining(["Pull Up (Assisted)", "Pull-Up (bodyweight + added)"]));
    expect(names(searchExercises(index, { query: "lat pulldown cable" }))).toContain("Wide Grip Lat Pulldown (Cable)");
  });

  it("finds by Arabic name and alias, with ة/ه and hamza forms unified", () => {
    const find = (q: string) => names(searchExercises(index, { query: q }));
    expect(find("عقله")).toContain("Pull-Up (bodyweight + added)");
    expect(find("ادكتور")).toContain("Hip Adductor (Machine)");
    expect(find("إدكتور")).toContain("Hip Adductor (Machine)");
    expect(find("لاترال")).toEqual(expect.arrayContaining(["Lateral Raise (Machine)", "Dumbbell Lateral Raise"]));
    expect(find("سوينج")).toContain("Kettlebell Swing");
    expect(find("زززززز")).toEqual([]);
  });

  it("names that start with the query come first", () => {
    const r = names(searchExercises(index, { query: "squat" }));
    expect(r[0]!.toLowerCase().startsWith("squat")).toBe(true);
    const firstNonStart = r.findIndex((n) => !n.toLowerCase().startsWith("squat"));
    expect(r.slice(firstNonStart).some((n) => n.toLowerCase().startsWith("squat"))).toBe(false);
  });

  it("filters by muscle group and by gear, alone and together with a query", () => {
    for (const g of MUSCLE_GROUPS) expect(searchExercises(index, { query: "", group: g }).length, g).toBeGreaterThanOrEqual(8);
    for (const g of GEARS) expect(searchExercises(index, { query: "", gear: g }).length, g).toBeGreaterThanOrEqual(5);
    const chestCable = searchExercises(index, { query: "", group: "chest", gear: "cable" });
    expect(chestCable.length).toBeGreaterThan(3);
    for (const e of chestCable) expect(CATALOG.find((c) => c.key === e.seedKey)!.gear).toBe("cable");
    expect(names(searchExercises(index, { query: "curl", group: "biceps", gear: "ez_bar" }))).toContain("EZ Bar Biceps Curl");
    expect(searchExercises(index, { query: "squat", group: "chest" })).toEqual([]);
    expect(names(searchExercises(index, { query: "smith", gear: "smith" })).every((n) => /smith/i.test(n))).toBe(true);
  });

  it("leaves out exercises already in the day", () => {
    const first = searchExercises(index, { query: "bench press" })[0]!;
    expect(searchExercises(index, { query: "bench press", exclude: [first.id] }).map((e) => e.id)).not.toContain(first.id);
  });

  it("an empty query lists everything; more than one page needs Show more", () => {
    const all = searchExercises(index, { query: "" });
    expect(all.length).toBe(rows.length);
    expect(all.length).toBeGreaterThan(PICKER_PAGE);
  });

  it("the lifter's own exercises are filtered by their pattern and equipment, not by a guess", () => {
    const mine: LibraryExercise = { id: "m", seedKey: null, nameEn: "My cable thing", nameAr: "حاجتي", aliasesAr: [], pattern: "elbow_extension", equipment: "cable", setup: "free", isCustom: true };
    expect(metaOf(mine)).toEqual({ group: "triceps", gear: "cable", muscle: null });
    const ix = buildSearchIndex([...rows, mine]);
    expect(searchExercises(ix, { query: "my cable", group: "triceps", gear: "cable" })).toEqual([mine]);
    const other: LibraryExercise = { ...mine, id: "o", pattern: "other", equipment: "plate" };
    expect(metaOf(other)).toEqual({ group: null, gear: "bodyweight", muscle: null });
  });

  it("is fast: building the index and 200 searches take well under a second in Node", () => {
    const t0 = performance.now();
    const ix = buildSearchIndex(rows);
    for (let i = 0; i < 200; i++) searchExercises(ix, { query: ["bench", "عقلة", "db curl", "x", "lat raise"][i % 5]!, group: i % 2 ? "chest" : null });
    expect(performance.now() - t0).toBeLessThan(1000);
  });

  it("picker labels exist in English and Arabic for every group and gear", () => {
    for (const g of MUSCLE_GROUPS) {
      expect(en[`group.${g}` as keyof typeof en], g).toBeTruthy();
      expect(ar[`group.${g}` as keyof typeof ar], g).toMatch(/[\u0600-\u06FF]/);
    }
    for (const g of GEARS) {
      expect(en[`gear.${g}` as keyof typeof en], g).toBeTruthy();
      expect(ar[`gear.${g}` as keyof typeof ar], g).toMatch(/[\u0600-\u06FF]/);
    }
  });
});
