import { describe, expect, it } from "vitest";
import { CATALOG } from "../src/db/libraryDraft";
import { facetCounts, filterTemplates, groupByDays, matchesFilter, NO_FILTER, venuesOf } from "../src/logic/templateFilter";
import { instantiateTemplate, TEMPLATES, templatesForDays } from "../src/logic/templates";
import { validateDraft } from "../src/logic/programmeDraft";
import { rebuildShortWeek } from "../src/logic/shortWeek";
import { freshDb } from "./helpers";

/** v0.19.0: the 4-day "Push / Pull / Legs / Upper" programme Mohamed asked for (no equivalent existed in the 47). */
const T = () => TEMPLATES.find((t) => t.id === "ppl_upper_4")!;
const catalog = new Map(CATALOG.map((c) => [c.key, c]));
const lib = new Map(CATALOG.map((c) => [c.key, { exerciseId: `id-${c.key}`, equipment: c.equipment }]));

describe("template ppl_upper_4: Push / Pull / Legs / Upper", () => {
  it("exists once, with the asked-for English name, a draft Arabic name, and the asked-for days in order", () => {
    expect(TEMPLATES.filter((t) => t.id === "ppl_upper_4")).toHaveLength(1);
    expect(T().en).toBe("Push / Pull / Legs / Upper");
    expect(T().ar).toMatch(/[\u0600-\u06FF]/);
    expect(T().arDraft).toBe(true);
    expect(T().reviewed).toBe(false);
    expect(T().days).toBe(4);
    expect(T().schedule.map((d) => d.en)).toEqual(["Push", "Pull", "Legs", "Upper"]);
    expect(T().schedule.every((d) => /[\u0600-\u06FF]/.test(d.ar))).toBe(true);
  });
  it("did not duplicate anything: no other 4-day template has this day order or name, and the product still has no second Push/Pull/Legs/Upper", () => {
    const order = (t: { schedule: { en: string }[] }) => t.schedule.map((d) => d.en).join("|");
    expect(TEMPLATES.filter((t) => order(t) === "Push|Pull|Legs|Upper").map((t) => t.id)).toEqual(["ppl_upper_4"]);
    expect(TEMPLATES.filter((t) => t.en.toLowerCase().includes("push") && t.en.toLowerCase().includes("upper")).map((t) => t.id).sort()).toEqual(
      ["db_ul_ppl_5", "ppl_upper_4", "ul_ppl_5"].filter((id) => TEMPLATES.some((t) => t.id === id)).sort(),
    );
  });
  it("uses valid library exercises, gym equipment, hypertrophy goal, no repeats inside a day, none timed", () => {
    expect(T().gear).toBe("gym");
    expect(T().goal).toBe("hypertrophy");
    for (const d of T().schedule) {
      expect(new Set(d.exercises.map((e) => e.key)).size).toBe(d.exercises.length);
      for (const e of d.exercises) expect(catalog.has(e.key), e.key).toBe(true);
    }
    expect(T().schedule.flatMap((d) => d.exercises).some((e) => catalog.get(e.key)!.gear === "bodyweight" && /plank|hang|carry/.test(e.key))).toBe(false);
  });
  it("weekly exposure sanity: each session 5 to 26 sets, chest/back/shoulders trained twice (Upper repeats them), legs once, pulling >= half of pushing", () => {
    const sets = T().schedule.map((d) => d.exercises.reduce((n, e) => n + e.sets, 0));
    expect(sets).toEqual([15, 17, 18, 20]);
    const trained = (mus: string[]) => T().schedule.filter((d) => d.exercises.some((e) => mus.includes(catalog.get(e.key)!.muscle))).length;
    expect(trained(["chest"])).toBe(2);
    expect(trained(["lats", "upper_back"])).toBe(2);
    expect(trained(["front_delts", "side_delts", "rear_delts"])).toBeGreaterThanOrEqual(2);
    expect(trained(["quads"])).toBe(1);
    const by = (mus: string[]) => T().schedule.flatMap((d) => d.exercises).filter((e) => mus.includes(catalog.get(e.key)!.muscle)).reduce((n, e) => n + e.sets, 0);
    expect(by(["lats", "upper_back", "rear_delts", "biceps"])).toBeGreaterThanOrEqual(0.5 * by(["chest", "front_delts", "side_delts", "triceps"]));
  });
  it("appears under the 4 days/week and Gym filters (not Home), and in first-run setup for 4 days", () => {
    const f4 = filterTemplates(TEMPLATES, { ...NO_FILTER, days: 4 });
    expect(f4.map((t) => t.id)).toContain("ppl_upper_4");
    expect(filterTemplates(TEMPLATES, { ...NO_FILTER, venue: "gym" }).map((t) => t.id)).toContain("ppl_upper_4");
    expect(filterTemplates(TEMPLATES, { ...NO_FILTER, venue: "home" }).map((t) => t.id)).not.toContain("ppl_upper_4");
    expect(filterTemplates(TEMPLATES, { ...NO_FILTER, days: 4, venue: "gym", goal: "hypertrophy", level: "intermediate", gear: "gym" }).map((t) => t.id)).toContain("ppl_upper_4");
    expect(matchesFilter(T(), { ...NO_FILTER, days: 4, venue: "gym" })).toBe(true);
    expect(venuesOf(T())).toEqual(["gym"]);
    expect(groupByDays(f4).find((g) => g.days === 4)!.templates.map((t) => t.id)).toContain("ppl_upper_4");
    expect(templatesForDays(4).map((o) => o.template.id)).toContain("ppl_upper_4");
    expect(templatesForDays(5).some((o) => o.template.id === "ppl_upper_4")).toBe(false);
    expect(facetCounts(TEMPLATES, NO_FILTER, "days", [4] as const).get(4)).toBe(TEMPLATES.filter((t) => t.days === 4).length);
  });
  it("instantiates (English and Arabic) into a valid 4-day draft with nothing dropped", () => {
    for (const lang of ["en", "ar"] as const) {
      const { draft, dropped } = instantiateTemplate(T(), { byKey: lib }, { lang, goalLiftKey: "bench_press", ceilingFor: () => 10 });
      expect(dropped).toEqual([]);
      expect(validateDraft(draft)).toEqual([]);
      expect(draft.days).toHaveLength(4);
      expect(draft.name).toBe(lang === "en" ? "Push / Pull / Legs / Upper" : T().ar);
    }
    expect(instantiateTemplate(T(), { byKey: lib }, { lang: "en", ceilingFor: () => 10 }).draft.days.map((d) => d.name)).toEqual(["Push", "Pull", "Legs", "Upper"]);
  });
  it("short-week rebuild works for 1 to 4 days and 3 time budgets, keeps the goal lift and stays valid", () => {
    const pattern = new Map(CATALOG.map((c) => [`id-${c.key}`, c.pattern]));
    for (const goalKey of ["bench_press", "back_squat", "lat_pulldown"]) {
      const base = instantiateTemplate(T(), { byKey: lib }, { lang: "en", goalLiftKey: goalKey, ceilingFor: () => 10 }).draft;
      for (let days = 1; days <= 4; days++) {
        for (const minutes of [null, 45, 30]) {
          const r = rebuildShortWeek(base, { days, minutes, patternOf: (id) => pattern.get(id) });
          if (typeof r === "string") throw new Error(`${goalKey} ${days} ${minutes}: ${r}`);
          expect(r.draft.days).toHaveLength(days);
          expect(validateDraft(r.draft)).toEqual([]);
          expect(r.draft.days.some((d) => d.exercises.some((e) => e.exerciseId === `id-${goalKey}`)), `${goalKey} ${days} ${minutes}`).toBe(true);
        }
      }
    }
  });
  it("program switcher: it is created as a new active program, the previous one keeps its history, and switching back and forth works", async () => {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    await ctx.repos.topUpLibrary();
    const exercises = await ctx.programmes.listExercises();
    const byKey = new Map(exercises.filter((e) => e.seedKey).map((e) => [e.seedKey!, { exerciseId: e.id, equipment: e.equipment }]));
    const original = (await ctx.programmes.getActive())!;
    const { draft } = instantiateTemplate(T(), { byKey }, { lang: "en", ceilingFor: () => 10 });
    const made = await ctx.programmes.createProgramme(draft, { activate: true });
    const active = (await ctx.programmes.getActive())!;
    expect(active.programmeId).toBe(made.programmeId);
    expect((await ctx.programmes.loadDraft(active.versionId)).days.map((d) => d.name)).toEqual(["Push", "Pull", "Legs", "Upper"]);
    expect((await ctx.programmes.listProgrammes()).map((p) => p.programmeId)).toContain(original.programmeId);
    await ctx.programmes.setActiveProgramme(original.programmeId);
    expect((await ctx.programmes.getActive())!.programmeId).toBe(original.programmeId);
    await ctx.programmes.setActiveProgramme(made.programmeId);
    expect((await ctx.programmes.getActive())!.programmeId).toBe(made.programmeId);
    expect(await ctx.repos.getNextDay()).toBeTruthy();
  });
});
