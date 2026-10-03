import { describe, expect, it } from "vitest";
import { CATALOG, ALL_LIBRARY } from "../src/db/libraryDraft";
import { TIMED_LIBRARY } from "../src/db/library/measures";
import { GROUP_OF_MUSCLE, type Gear, type Muscle } from "../src/db/library/types";
import { computeExposure } from "../src/logic/exposure";
import { MAX_SETS, validateDraft } from "../src/logic/programmeDraft";
import {
  facetCounts, filterTemplates, gearFits, groupByDays, usableAtHome, venuesOf, matchesFilter, NO_FILTER, daysAvailable,
} from "../src/logic/templateFilter";
import { instantiateTemplate, TEMPLATES, templatesForDays, TEMPLATE_GEARS, TEMPLATE_GOALS, TEMPLATE_LEVELS, type Template } from "../src/logic/templates";
import { freshDb } from "./helpers";

const catalog = new Map(CATALOG.map((c) => [c.key, c]));
const AR = /[\u0600-\u06FF]/;
const fingerprint = (t: Template) => JSON.stringify(t.schedule.map((d) => d.exercises.map((e) => [e.key, e.sets, e.repMin, e.ceiling ?? null])));
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

describe("template catalogue: identity and library references", () => {
  it("the library really has 607 exercises (the templates are built from it)", () => {
    expect(ALL_LIBRARY.length).toBe(607);
    expect(CATALOG.length).toBe(607);
  });
  it("ids, English names and Arabic names are unique", () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    expect(new Set(TEMPLATES.map((t) => norm(t.en))).size).toBe(TEMPLATES.length);
    expect(new Set(TEMPLATES.map((t) => norm(t.ar))).size).toBe(TEMPLATES.length);
  });
  it("no two templates are the same programme (identical days, exercises, sets and reps)", () => {
    const seen = new Map<string, string>();
    for (const t of TEMPLATES) {
      const fp = fingerprint(t);
      expect(seen.get(fp), `${t.id} duplicates ${seen.get(fp)}`).toBeUndefined();
      seen.set(fp, t.id);
    }
  });
  it("every exercise key is a library seed_key; none repeats inside a day; none is timed (templates use rep ranges)", () => {
    for (const t of TEMPLATES) {
      expect(t.schedule.length, t.id).toBeGreaterThanOrEqual(1);
      for (const d of t.schedule) {
        expect(d.exercises.length, `${t.id}/${d.en}`).toBeGreaterThan(0);
        const keys = d.exercises.map((e) => e.key);
        expect(new Set(keys).size, `${t.id}/${d.en} repeats an exercise`).toBe(keys.length);
        for (const e of d.exercises) {
          expect(catalog.has(e.key), `${t.id}: unknown library id ${e.key}`).toBe(true);
          expect(TIMED_LIBRARY[e.key], `${t.id}: ${e.key} is timed`).toBeUndefined();
        }
      }
    }
  });
  it("rep and set numbers are valid; a template ceiling is never below the bottom of its range", () => {
    for (const t of TEMPLATES) {
      for (const d of t.schedule) {
        for (const e of d.exercises) {
          expect(Number.isInteger(e.sets) && e.sets >= 1 && e.sets <= MAX_SETS, `${t.id}/${e.key} sets`).toBe(true);
          expect(Number.isInteger(e.repMin) && e.repMin >= 1 && e.repMin <= 20, `${t.id}/${e.key} repMin`).toBe(true);
          if (e.ceiling !== undefined) {
            expect(Number.isInteger(e.ceiling) && e.ceiling >= e.repMin && e.ceiling <= 30, `${t.id}/${e.key} ceiling`).toBe(true);
          }
        }
      }
    }
  });
  it("day names are English and Arabic (Arabic is a draft and flagged so); nothing claims trainer review", () => {
    for (const t of TEMPLATES) {
      expect(t.arDraft, t.id).toBe(true);
      expect(t.reviewed, t.id).toBe(false);
      expect(t.ar, t.id).toMatch(AR);
      expect(t.en, t.id).not.toMatch(AR);
      for (const d of t.schedule) {
        expect(d.ar, `${t.id}/${d.en}`).toMatch(AR);
        expect(d.en, `${t.id}/${d.ar}`).not.toMatch(AR);
      }
      expect(new Set(t.schedule.map((d) => d.en)).size, `${t.id} day names`).toBe(t.schedule.length);
    }
  });
  it("tags are from the known sets; days are 2..6 and the rotation never has more days than the week", () => {
    for (const t of TEMPLATES) {
      expect(TEMPLATE_LEVELS, t.id).toContain(t.level);
      expect(TEMPLATE_GEARS, t.id).toContain(t.gear);
      expect(TEMPLATE_GOALS, t.id).toContain(t.goal);
      expect(t.days, t.id).toBeGreaterThanOrEqual(2);
      expect(t.days, t.id).toBeLessThanOrEqual(6);
      expect(t.schedule.length, t.id).toBeLessThanOrEqual(t.days);
      expect(t.schedule.length, t.id).toBeGreaterThanOrEqual(2);
    }
  });
  it("the gear tag is true: dumbbell programmes use dumbbells, kettlebells and bodyweight only; bodyweight programmes use bodyweight only", () => {
    const okDumbbell: Gear[] = ["dumbbell", "kettlebell", "bodyweight"];
    const okBand: Gear[] = ["band", "bodyweight"];
    for (const t of TEMPLATES) {
      const gears = t.schedule.flatMap((d) => d.exercises.map((e) => catalog.get(e.key)!.gear));
      if (t.gear === "dumbbell") for (const g of gears) expect(okDumbbell, `${t.id}`).toContain(g);
      if (t.gear === "band") {
        for (const g of gears) expect(okBand, `${t.id}`).toContain(g);
        expect(gears.some((g) => g === "band"), `${t.id} is tagged band but uses no band`).toBe(true);
      }
      if (t.gear === "bodyweight") for (const g of gears) expect(g, `${t.id}`).toBe("bodyweight");
      if (t.gear === "gym") expect(gears.some((g) => !okDumbbell.includes(g) && !okBand.includes(g)), `${t.id} is tagged gym but needs no gym gear`).toBe(true);
    }
  });
});

describe("template catalogue: weekly muscle exposure sanity", () => {
  type Row = { sets: number; sessions: number };
  /** Hard sets per week by the primary muscle of each exercise (catalogue), like the app: each exercise counts once. */
  function weekly(t: Template): Map<string, Row> {
    const scale = t.days / t.schedule.length;
    const m = new Map<string, Row>();
    for (const d of t.schedule) {
      const seen = new Set<string>();
      for (const e of d.exercises) {
        const mu = catalog.get(e.key)!.muscle as Muscle;
        const r = m.get(mu) ?? { sets: 0, sessions: 0 };
        r.sets += e.sets * scale;
        if (!seen.has(mu)) r.sessions += scale;
        seen.add(mu);
        m.set(mu, r);
      }
    }
    return m;
  }
  const sum = (m: Map<string, Row>, mus: Muscle[]) => mus.reduce((n, k) => n + (m.get(k)?.sets ?? 0), 0);
  /** Sessions a week that train any of these muscles (a day counts once even if two of the muscles are in it). */
  const sessionsOf = (t: Template, mus: Muscle[]) => (t.days / t.schedule.length) * t.schedule.filter((d) => d.exercises.some((e) => mus.includes(catalog.get(e.key)!.muscle as Muscle))).length;
  const MAJOR: Record<string, Muscle[]> = {
    chest: ["chest"],
    back: ["lats", "upper_back"],
    shoulders: ["front_delts", "side_delts", "rear_delts"],
    quads: ["quads"],
    posterior: ["hamstrings", "glutes", "lower_back"],
  };
  const FOCUSED = new Set(["glutes", "arms_shoulders"]);
  const LOW_POSTERIOR_OK = new Set(["sl_5x5_3", "ss_3"]);

  it("a session is 5 to 26 sets (about 15 to 78 minutes at the app's 3 minutes per set) and at most 9 exercises", () => {
    for (const t of TEMPLATES) {
      for (const d of t.schedule) {
        const sets = d.exercises.reduce((n, e) => n + e.sets, 0);
        expect(sets, `${t.id}/${d.en}`).toBeGreaterThanOrEqual(5);
        expect(sets, `${t.id}/${d.en}`).toBeLessThanOrEqual(26);
        expect(d.exercises.length, `${t.id}/${d.en}`).toBeLessThanOrEqual(9);
      }
    }
  });
  it("no muscle gets more than 30 hard sets a week", () => {
    for (const t of TEMPLATES) for (const [mu, r] of weekly(t)) expect(r.sets, `${t.id} ${mu}`).toBeLessThanOrEqual(30);
  });
  it("general, strength, hypertrophy and bulking templates train chest, back, shoulders, quads and the back of the legs every week (at least 3 sets each)", () => {
    for (const t of TEMPLATES.filter((x) => !FOCUSED.has(x.goal) && x.gear !== "bodyweight")) {
      const w = weekly(t);
      for (const [name, mus] of Object.entries(MAJOR)) {
        // One heavy deadlift set (3x5 novice shapes) loads the whole back of the body but counts as 1 hamstring set in this arithmetic.
        if (name === "posterior" && LOW_POSTERIOR_OK.has(t.id)) continue;
        expect(sum(w, mus), `${t.id} ${name} sets`).toBeGreaterThanOrEqual(3);
        expect(sessionsOf(t, mus), `${t.id} ${name} sessions`).toBeGreaterThanOrEqual(1);
      }
    }
  });
  it("bodyweight templates still train every major area (at least 3 sets)", () => {
    for (const t of TEMPLATES.filter((x) => x.gear === "bodyweight")) {
      const w = weekly(t);
      for (const [name, mus] of Object.entries(MAJOR)) expect(sum(w, mus), `${t.id} ${name}`).toBeGreaterThanOrEqual(3);
    }
  });
  it("pulling is not neglected: back + rear delts + biceps >= 50% of chest + front/side delts + triceps (non-focused templates)", () => {
    for (const t of TEMPLATES.filter((x) => !FOCUSED.has(x.goal))) {
      const w = weekly(t);
      const pull = sum(w, ["lats", "upper_back", "rear_delts", "biceps"]);
      const push = sum(w, ["chest", "front_delts", "side_delts", "triceps"]);
      expect(pull, `${t.id}: pull ${pull} vs push ${push}`).toBeGreaterThanOrEqual(0.5 * push);
    }
  });
  it("every template with 3+ days a week trains each major area at least twice a week, except body-part splits (bro / Arnold-type), which are tagged by name", () => {
    const SINGLE_FREQ = new Set(["mix_4", "bro_5", "arnold_3", "ppl_3", "ppl_5", "phat_5", "arms_shoulders_4"]);
    for (const t of TEMPLATES.filter((x) => x.days >= 3 && !SINGLE_FREQ.has(x.id) && !FOCUSED.has(x.goal))) {
      const w = weekly(t);
      for (const [name, mus] of Object.entries(MAJOR)) {
        if (name === "posterior" || name === "shoulders") continue;
        expect(sessionsOf(t, mus), `${t.id} ${name} frequency`).toBeGreaterThanOrEqual(1.5);
      }
    }
  });
  it("focus templates deliver their focus: glutes >= 10 sets a week; arms/shoulders >= 12 arm sets and >= 8 delt sets", () => {
    for (const t of TEMPLATES.filter((x) => x.goal === "glutes")) expect(sum(weekly(t), ["glutes"]), t.id).toBeGreaterThanOrEqual(10);
    for (const t of TEMPLATES.filter((x) => x.goal === "arms_shoulders")) {
      const w = weekly(t);
      expect(sum(w, ["biceps", "triceps"]), t.id).toBeGreaterThanOrEqual(12);
      expect(sum(w, ["front_delts", "side_delts", "rear_delts"]), t.id).toBeGreaterThanOrEqual(8);
    }
  });
  it("strength templates use low-rep targets (bottom of range <= 6) on their main lifts, with a matching low ceiling", () => {
    for (const t of TEMPLATES.filter((x) => x.goal === "strength")) {
      const mains = t.schedule.flatMap((d) => d.exercises.filter((e) => e.mainLift));
      expect(mains.length, t.id).toBeGreaterThan(0);
      for (const e of mains) expect(e.repMin, `${t.id}/${e.key}`).toBeLessThanOrEqual(6);
    }
  });
  it("the app's own exposure (movement patterns) agrees: no group over 30 sets a week for the real library rows", () => {
    for (const t of TEMPLATES) {
      const lib = new Map(CATALOG.map((c) => [c.key, { exerciseId: `id-${c.key}`, equipment: c.equipment }]));
      const patterns = new Map(CATALOG.map((c) => [`id-${c.key}`, c.pattern]));
      const { draft } = instantiateTemplate(t, { byKey: lib }, { lang: "en", ceilingFor: () => 10 });
      for (const r of computeExposure(draft, (id) => patterns.get(id), t.days)) expect(r.setsPerWeek ?? 0, `${t.id} ${r.group}`).toBeLessThanOrEqual(30);
    }
  });
  it("group mapping covers every muscle used by the templates", () => {
    for (const t of TEMPLATES) for (const d of t.schedule) for (const e of d.exercises) expect(GROUP_OF_MUSCLE[catalog.get(e.key)!.muscle as Muscle]).toBeTruthy();
  });
});

describe("picker: filter and grouping logic", () => {
  it("no filter shows everything; each facet narrows; facets combine", () => {
    expect(filterTemplates(TEMPLATES, NO_FILTER)).toHaveLength(TEMPLATES.length);
    const three = filterTemplates(TEMPLATES, { ...NO_FILTER, days: 3 });
    expect(three.length).toBeGreaterThan(0);
    expect(three.every((t) => t.days === 3)).toBe(true);
    const beginner3 = filterTemplates(TEMPLATES, { ...NO_FILTER, days: 3, level: "beginner" });
    expect(beginner3.every((t) => t.days === 3 && t.level === "beginner")).toBe(true);
    expect(beginner3.length).toBeLessThanOrEqual(three.length);
    const strength = filterTemplates(TEMPLATES, { ...NO_FILTER, goal: "strength" });
    expect(strength.every((t) => t.goal === "strength")).toBe(true);
  });
  it("equipment means 'what I have': a full gym sees all, dumbbells see dumbbell + bodyweight (not bands), nothing sees bodyweight only", () => {
    expect(gearFits("gym", "gym") && gearFits("dumbbell", "gym") && gearFits("bodyweight", "gym")).toBe(true);
    expect(gearFits("gym", "dumbbell")).toBe(false);
    expect(gearFits("bodyweight", "dumbbell")).toBe(true);
    expect(gearFits("dumbbell", "bodyweight")).toBe(false);
    expect(filterTemplates(TEMPLATES, { ...NO_FILTER, gear: "gym" })).toHaveLength(TEMPLATES.length);
    for (const t of filterTemplates(TEMPLATES, { ...NO_FILTER, gear: "dumbbell" })) expect(["dumbbell", "bodyweight"]).toContain(t.gear);
    for (const t of filterTemplates(TEMPLATES, { ...NO_FILTER, gear: "bodyweight" })) expect(t.gear).toBe("bodyweight");
  });
  it("Home shows only programmes needing bodyweight, dumbbells or bands; Gym shows every programme (home ones included); nothing needing a gym is under Home", () => {
    const home = filterTemplates(TEMPLATES, { ...NO_FILTER, venue: "home" });
    const gym = filterTemplates(TEMPLATES, { ...NO_FILTER, venue: "gym" });
    expect(gym).toHaveLength(TEMPLATES.length);
    for (const t of home) {
      expect(t.gear, t.id).not.toBe("gym");
      expect(gym.map((g) => g.id), t.id).toContain(t.id);
      expect(venuesOf(t)).toEqual(["home", "gym"]);
    }
    for (const t of TEMPLATES.filter((x) => x.gear === "gym")) {
      expect(home.map((h) => h.id)).not.toContain(t.id);
      expect(venuesOf(t)).toEqual(["gym"]);
      expect(usableAtHome(t)).toBe(false);
    }
    // Home is also true by exercise: every exercise of a home programme is bodyweight, dumbbell, kettlebell or band gear.
    for (const t of home) for (const d of t.schedule) for (const e of d.exercises) expect(["bodyweight", "dumbbell", "kettlebell", "band"], `${t.id}/${e.key}`).toContain(catalog.get(e.key)!.gear);
  });
  it("venue combines with days, equipment, goal and level (all AND-ed)", () => {
    const f = { ...NO_FILTER, venue: "home" as const, days: 3 };
    for (const t of filterTemplates(TEMPLATES, f)) expect(t.days === 3 && t.gear !== "gym").toBe(true);
    for (const t of filterTemplates(TEMPLATES, { ...f, gear: "dumbbell" })) expect(t.gear === "dumbbell" || t.gear === "bodyweight").toBe(true);
    // "I have a full gym" does not remove home programmes from the Home list.
    expect(filterTemplates(TEMPLATES, { ...NO_FILTER, venue: "home", gear: "gym" }).map((t) => t.id)).toEqual(filterTemplates(TEMPLATES, { ...NO_FILTER, venue: "home" }).map((t) => t.id));
    const combo = filterTemplates(TEMPLATES, { days: 4, venue: "home", gear: "dumbbell", goal: "hypertrophy", level: "intermediate" });
    for (const t of combo) expect(t).toMatchObject({ days: 4, goal: "hypertrophy", level: "intermediate" });
    const counts = facetCounts(TEMPLATES, { ...NO_FILTER, days: 6 }, "venue", ["home", "gym"] as const);
    expect(counts.get("gym")).toBe(TEMPLATES.filter((t) => t.days === 6).length);
    expect(counts.get("home")).toBe(TEMPLATES.filter((t) => t.days === 6 && t.gear !== "gym").length);
  });
  it("equipment 'what I have' for bands: bands + bodyweight, not dumbbells", () => {
    expect(gearFits("band", "band") && gearFits("bodyweight", "band")).toBe(true);
    expect(gearFits("dumbbell", "band")).toBe(false);
    expect(gearFits("band", "dumbbell")).toBe(false);
  });
  it("groups are by days per week, fewest first, and keep every template once", () => {
    const g = groupByDays(TEMPLATES);
    expect(g.map((x) => x.days)).toEqual([...g.map((x) => x.days)].sort((a, b) => a - b));
    expect(g.flatMap((x) => x.templates.map((t) => t.id)).sort()).toEqual(TEMPLATES.map((t) => t.id).sort());
    for (const x of g) expect(x.templates.every((t) => t.days === x.days)).toBe(true);
    expect(g.map((x) => x.days)).toEqual(daysAvailable(TEMPLATES));
    expect(groupByDays([])).toEqual([]);
  });
  it("facet counts apply the OTHER filters, so an option that would show nothing reads 0", () => {
    const f = { ...NO_FILTER, goal: "strength" as const };
    const counts = facetCounts(TEMPLATES, f, "days", [2, 3, 4, 5, 6]);
    for (const [d, n] of counts) expect(n).toBe(TEMPLATES.filter((t) => t.goal === "strength" && t.days === d).length);
    const g = facetCounts(TEMPLATES, { ...NO_FILTER, days: 6 }, "goal", TEMPLATE_GOALS);
    for (const [goal, n] of g) expect(n).toBe(TEMPLATES.filter((t) => t.days === 6 && t.goal === goal).length);
  });
  it("every facet option offered by the picker leads to at least one programme on its own", () => {
    for (const d of daysAvailable(TEMPLATES)) expect(filterTemplates(TEMPLATES, { ...NO_FILTER, days: d }).length, `days ${d}`).toBeGreaterThan(0);
    for (const g of new Set(TEMPLATES.map((t) => t.gear))) expect(filterTemplates(TEMPLATES, { ...NO_FILTER, gear: g }).length, g).toBeGreaterThan(0);
    for (const g of new Set(TEMPLATES.map((t) => t.goal))) expect(filterTemplates(TEMPLATES, { ...NO_FILTER, goal: g }).length, g).toBeGreaterThan(0);
    for (const l of new Set(TEMPLATES.map((t) => t.level))) expect(filterTemplates(TEMPLATES, { ...NO_FILTER, level: l }).length, l).toBeGreaterThan(0);
  });
  it("matchesFilter agrees with filterTemplates", () => {
    for (const t of TEMPLATES) expect(matchesFilter(t, { ...NO_FILTER, days: t.days, venue: "gym", goal: t.goal, level: t.level, gear: t.gear })).toBe(true);
  });
  it("the onboarding offer for N days still lists exactly the templates arranged for N days (never more days than the lifter has)", () => {
    for (const d of [2, 3, 4, 5, 6]) {
      const offers = templatesForDays(d);
      const exact = TEMPLATES.filter((t) => t.days === d);
      expect(offers.length, `days ${d}`).toBeGreaterThan(0);
      if (exact.length > 0) {
        expect(offers.map((o) => o.template.id).sort()).toEqual(exact.map((t) => t.id).sort());
        expect(offers.every((o) => o.fit === "exact")).toBe(true);
      } else {
        expect(offers.every((o) => o.fit === "fewer" && o.template.days < d)).toBe(true);
      }
    }
    expect(templatesForDays(1)).toEqual([]);
    expect(templatesForDays(7).every((o) => o.fit === "fewer" && o.template.days === 6)).toBe(true);
  });
});

describe("every template works with the real library, the programme repo, the switcher, rule-v0.3 and the short-week rebuild", () => {
  async function ctxWithLibrary() {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    await ctx.repos.topUpLibrary();
    const lib = await ctx.programmes.listExercises();
    const byKey = new Map(lib.filter((e) => e.seedKey).map((e) => [e.seedKey!, { exerciseId: e.id, equipment: e.equipment }]));
    expect(byKey.size).toBeGreaterThanOrEqual(607);
    return { ...ctx, lib, byKey };
  }
  it("instantiates into a valid draft with every exercise present and the lifter's equipment honoured", async () => {
    const { byKey } = await ctxWithLibrary();
    for (const t of TEMPLATES) {
      const r = instantiateTemplate(t, { byKey }, { lang: "en", ceilingFor: () => 10 });
      expect(r.dropped, t.id).toEqual([]);
      expect(validateDraft(r.draft), t.id).toEqual([]);
      expect(r.draft.days.length, t.id).toBe(t.schedule.length);
      expect(r.draft.days.flatMap((d) => d.exercises).length, `${t.id}: an exercise was silently left out`).toBe(t.schedule.flatMap((d) => d.exercises).length);
      const ar = instantiateTemplate(t, { byKey }, { lang: "ar", ceilingFor: () => 10 });
      expect(ar.draft.name, t.id).toMatch(AR);
    }
  });
  it("a template ceiling is stored as the lift's own rep ceiling and as the top of its range; others follow the default", async () => {
    const { byKey } = await ctxWithLibrary();
    const t: Template = { id: "t", days: 3, en: "T", ar: "ت", arDraft: true, reviewed: false, level: "beginner", gear: "gym", goal: "strength", schedule: [{ en: "A", ar: "أ", exercises: [{ key: "back_squat", sets: 5, repMin: 5, mainLift: true, ceiling: 5 }, { key: "db_curl", sets: 3, repMin: 8 }] }, { en: "B", ar: "ب", exercises: [{ key: "bench_press", sets: 3, repMin: 5, ceiling: 5 }] }] };
    const d = instantiateTemplate(t, { byKey }, { lang: "en", ceilingFor: (k) => (k === "back_squat" ? 12 : 10) }).draft;
    expect(d.days[0]!.exercises[0]).toMatchObject({ repMin: 5, repMax: 5, repCeiling: 5, sets: 5 });
    expect(d.days[0]!.exercises[1]).toMatchObject({ repMin: 8, repMax: 10, repCeiling: null });
  });
  it("each template can be started as a programme, switched away from and switched back to; nothing is lost", async () => {
    const { programmes, byKey, repos } = await ctxWithLibrary();
    const original = (await programmes.getActive())!;
    const created: string[] = [];
    for (const t of TEMPLATES) {
      const { draft } = instantiateTemplate(t, { byKey }, { lang: "en", ceilingFor: () => 10 });
      const made = await programmes.createProgramme(draft, { activate: true });
      created.push(made.programmeId);
      const active = (await programmes.getActive())!;
      expect(active.programmeId, t.id).toBe(made.programmeId);
      const back = await programmes.loadDraft(active.versionId);
      expect(back.days.map((d) => d.name), t.id).toEqual(t.schedule.map((d) => d.en));
    }
    const list = await programmes.listProgrammes();
    expect(list.length).toBe(TEMPLATES.length + 1);
    for (const id of [original.programmeId, created[0]!, created[created.length - 1]!]) {
      await programmes.setActiveProgramme(id);
      expect((await programmes.getActive())!.programmeId).toBe(id);
    }
    expect(await repos.getNextDay()).toBeTruthy();
  });
  it("the short-week rebuild works on every template (1..N days, with and without a time budget) and keeps its promises", async () => {
    const { byKey, lib } = await ctxWithLibrary();
    const { rebuildShortWeek } = await import("../src/logic/shortWeek");
    const pattern = new Map(lib.map((e) => [e.id, e.pattern]));
    let combos = 0;
    for (const t of TEMPLATES) {
      const goalKey = t.schedule[0]!.exercises[0]!.key;
      const base = instantiateTemplate(t, { byKey }, { lang: "en", goalLiftKey: goalKey, ceilingFor: () => 10 }).draft;
      for (let days = 1; days <= base.days.length; days++) {
        for (const minutes of [null, 45, 30]) {
          combos++;
          const r = rebuildShortWeek(base, { days, minutes, patternOf: (id) => pattern.get(id) });
          if (typeof r === "string") throw new Error(`${t.id} ${days} ${minutes}: ${r}`);
          expect(r.draft.days.length, `${t.id} ${days} ${minutes}`).toBe(days);
          expect(validateDraft(r.draft), `${t.id} ${days} ${minutes}`).toEqual([]);
          const goalId = byKey.get(goalKey)!.exerciseId;
          expect(r.draft.days.some((d) => d.exercises.some((e) => e.exerciseId === goalId)), `${t.id} goal lift kept`).toBe(true);
        }
      }
    }
    expect(combos).toBeGreaterThan(50);
  });
  it("5x5 / 3x5 shapes: hitting 5 reps on every set raises the load next session (ceiling 5), 4 reps on one set does not", async () => {
    for (const [id, miss] of [["sl_5x5_3", false], ["sl_5x5_3", true], ["ss_3", false]] as const) {
      const ctx = await ctxWithLibrary();
      const gymId = (await ctx.repos.getActiveGymId())!;
      const gym = await ctx.repos.loadGymFingerprint(gymId);
      const t = TEMPLATES.find((x) => x.id === id)!;
      const { draft } = instantiateTemplate(t, { byKey: ctx.byKey }, { lang: "en", ceilingFor: () => 10 });
      await ctx.programmes.createProgramme(draft, { activate: true });
      let tg: Awaited<ReturnType<typeof ctx.finish.getTargets>>[number] | undefined;
      // Two sessions at the same load: with one session the engine is still "low confidence" and repeats the load.
      for (let n = 0; n < 2; n++) {
        const next = (await ctx.repos.getNextDay())!;
        const exs = await ctx.repos.listDayExercises(next.day.id);
        const squat = exs.find((e) => e.nameEn.toLowerCase().includes("squat"))!;
        expect(squat.repCeiling, id).toBe(5);
        const { id: sid } = await ctx.workout.startOrResumeSession(next.day.id, gymId);
        for (let i = 0; i < squat.sets; i++) await ctx.workout.logSet({ sessionId: sid, exerciseId: squat.exerciseId, load: 60, reps: miss && n === 1 && i === squat.sets - 1 ? 4 : 5 }, { gym, equipment: squat.equipment, setup: squat.setup });
        ctx.deps.tick(1000);
        await ctx.workout.finishSession(sid);
        const written = (await ctx.finish.writeNextSessionTargets(sid))!;
        ctx.deps.tick(86_400_000);
        tg = (await ctx.finish.getTargets(written.sessionId)).find((x) => x.exerciseId === squat.exerciseId);
      }
      if (miss) expect(tg!.load, `${id} missed`).toBe(60);
      else expect(tg!.load!, `${id} hit`).toBeGreaterThan(60);
    }
  });
  it("a full rotation of every template logs, finishes and writes next-session targets under rule-v0.3 (strength lines with a ceiling of 5 earn more weight at 5 reps)", async () => {
    const ctx = await ctxWithLibrary();
    const gymId = (await ctx.repos.getActiveGymId())!;
    const gym = await ctx.repos.loadGymFingerprint(gymId);
    let checked = 0;
    for (const t of TEMPLATES) {
      const { draft } = instantiateTemplate(t, { byKey: ctx.byKey }, { lang: "en", ceilingFor: () => 10 });
      await ctx.programmes.createProgramme(draft, { activate: true });
      for (let i = 0; i < draft.days.length; i++) {
        const next = (await ctx.repos.getNextDay())!;
        const exs = await ctx.repos.listDayExercises(next.day.id);
        const { id } = await ctx.workout.startOrResumeSession(next.day.id, gymId);
        for (const ex of exs) {
          const load = ex.setup === "assisted" ? 20 : ex.setup === "bodyweight_plus_added" ? 0 : 40;
          for (let s = 0; s < ex.sets; s++) await ctx.workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load, reps: ex.repMax }, { gym, equipment: ex.equipment, setup: ex.setup });
        }
        ctx.deps.tick(1000);
        await ctx.workout.finishSession(id);
        const written = await ctx.finish.writeNextSessionTargets(id);
        ctx.deps.tick(86_400_000);
        if (written) {
          const targets = await ctx.finish.getTargets(written.sessionId);
          expect(targets.length, `${t.id}/${next.day.name}`).toBeGreaterThan(0);
          for (const tg of targets) {
            checked++;
            expect(tg.ruleVersion, `${t.id}/${tg.nameEn}`).toBe("rule-v0.3");
            expect(tg.reason.key, `${t.id}/${tg.nameEn}`).toBeTruthy();
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(TEMPLATES.length * 4);
  }, 120_000);
});
