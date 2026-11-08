import { describe, expect, it } from "vitest";
import { CATALOG, CATALOG_BY_KEY } from "../src/db/libraryDraft";
import { generateProgramme, weeklySetsByGroup, type GenerateInput } from "../src/logic/programGenerator";
import { DAYS_OPTIONS } from "../src/logic/onboarding";
import { GYM_EQUIPMENT } from "../src/logic/gymInput";
import { estimateSessionMinutes } from "../src/logic/templates";
import { validateDraft } from "../src/logic/programmeDraft";
import { freshDb } from "./helpers";

const byKey = new Map(CATALOG.map(c => [c.key, { exerciseId: c.key, equipment: c.equipment }]));
const input = (over: Partial<GenerateInput> = {}): GenerateInput => ({ goal: "hypertrophy", experience: "intermediate", daysPerWeek: 3, sessionMinutes: 75, equipment: [...GYM_EQUIPMENT], priorities: {}, avoid: [], lang: "en", skipLegs: true, ...over });
const make = (over: Partial<GenerateInput> = {}, keys = byKey) => generateProgramme(input(over), { byKey: keys }, () => 10);
const signature = (day: NonNullable<ReturnType<typeof make>>["draft"]["days"][number]) => day.exercises.map(e => e.exerciseId).sort().join("|");
const lowerMuscles = new Set(["quads", "hamstrings", "glutes", "calves", "adductors", "abductors", "hip_flexors", "lower_back", "full_body"]);
const lowerPatterns = new Set(["hinge", "squat", "knee_extension", "knee_flexion", "calf"]);

describe("skip leg training", () => {
  it.each(DAYS_OPTIONS)("keeps %i distinct, useful upper-body days across goals and experience levels", daysPerWeek => {
    for (const goal of ["strength", "hypertrophy", "general"] as const) for (const experience of ["beginner", "intermediate"] as const) {
      const got = make({ daysPerWeek, goal, experience });
      expect(got, `${daysPerWeek}/${goal}/${experience}`).toBeTruthy();
      expect(got!.draft.days).toHaveLength(daysPerWeek);
      expect(validateDraft(got!.draft)).toEqual([]);
      expect(new Set(got!.draft.days.map(signature)).size).toBe(daysPerWeek);
      for (const day of got!.draft.days) {
        expect(day.exercises.length).toBeGreaterThanOrEqual(2);
        expect(new Set(day.exercises.map(e => e.exerciseId)).size).toBe(day.exercises.length);
        for (const ex of day.exercises) {
          const meta = CATALOG_BY_KEY.get(ex.exerciseId)!;
          expect(lowerMuscles.has(meta.muscle), meta.en).toBe(false);
          expect(lowerPatterns.has(meta.pattern), meta.en).toBe(false);
          expect(meta.ceilingClass).not.toBe("lower");
          if (goal === "strength") expect(ex.repMax).toBeLessThanOrEqual(6);
        }
      }
    }
  });
  it("uses Push / Pull / Upper for three days and bounds six-day volume", () => {
    const p3 = make()!;
    expect(p3.draft.days.map(d => d.name)).toEqual(["Push", "Pull", "Upper"]);
    const got = make({ daysPerWeek: 6 })!;
    expect(got.draft.days.reduce((n,d) => n+d.exercises.reduce((s,e)=>s+e.sets,0),0)).toBeLessThanOrEqual(36);
    expect(make({ experience: "beginner", daysPerWeek: 6 })!.draft.days.flatMap(d=>d.exercises).reduce((n,e)=>n+e.sets,0)).toBeLessThanOrEqual(24);
  });
  it.each(["dumbbell", "machine", "plate", "cable"] as const)("respects limited equipment %s at every day count", equipment => {
    for (const daysPerWeek of DAYS_OPTIONS) {
      const got = make({ daysPerWeek, equipment: [equipment], sessionMinutes: 30 });
      expect(got).toBeTruthy();
      expect(got!.draft.days).toHaveLength(daysPerWeek);
      for (const day of got!.draft.days) for (const e of day.exercises) expect([equipment]).toContain(CATALOG_BY_KEY.get(e.exerciseId)!.equipment);
    }
  });
  it.each(DAYS_OPTIONS)("honours a 30-minute cap with upper and lower priorities on %i days", daysPerWeek => {
    const got = make({ daysPerWeek, sessionMinutes: 30, priorities: { biceps: "priority", quads: "priority", hamstrings: "priority", glutes: "priority", calves: "priority" } });
    expect(got).toBeTruthy();
    for (const day of got!.draft.days) expect(estimateSessionMinutes(day.exercises.reduce((n,e)=>n+e.sets,0))).toBeLessThanOrEqual(30);
    for (const e of got!.draft.days.flatMap(d=>d.exercises)) expect(lowerMuscles.has(CATALOG_BY_KEY.get(e.exerciseId)!.muscle)).toBe(false);
  });
  it("lower priorities cannot add leg work; upper priorities retain set scaling and ordering", () => {
    const normal = make()!;
    const legs = make({ priorities: { quads: "priority", hamstrings: "priority", glutes: "priority", calves: "priority" } })!;
    expect(legs.draft).toEqual(normal.draft);
    const priority = make({ priorities: { biceps: "priority" } })!;
    const ids = new Map(CATALOG.map(c=>[c.key,c.key]));
    expect(weeklySetsByGroup(priority.draft, ids).get("biceps")).toBeGreaterThan(weeklySetsByGroup(normal.draft, ids).get("biceps") ?? 0);
    for (const day of priority.draft.days) if(day.exercises.some(e=>CATALOG_BY_KEY.get(e.exerciseId)?.muscle === "biceps")) expect(CATALOG_BY_KEY.get(day.exercises[0]!.exerciseId)?.muscle).toBe("biceps");
  });
  it("avoids exercises before selection, including replacements and priority additions", () => {
    const got = make({ daysPerWeek: 6, avoid: ["bench", "curl"], priorities: { biceps: "priority" } })!;
    expect(got).toBeTruthy();
    for (const e of got.draft.days.flatMap(d=>d.exercises)) expect(CATALOG_BY_KEY.get(e.exerciseId)!.en.toLowerCase()).not.toMatch(/bench|curl/);
  });
  it("fails atomically instead of returning partial/repeated days for impossible constraints", () => {
    expect(make({ equipment: [] })).toBeNull();
    expect(make({ sessionMinutes: 3 })).toBeNull();
    expect(make({ daysPerWeek: 7 })).toBeNull();
    const sparse = new Map([...byKey].filter(([k])=>["bench_press", "barbell_row"].includes(k)));
    expect(make({ daysPerWeek: 6 }, sparse)).toBeNull();
    expect(make({ avoid: CATALOG.map(c=>c.en) })).toBeNull();
  });
  it("is opt-in: omitted and false return the same existing whole-body result", () => {
    const { skipLegs: _, ...old } = input({ daysPerWeek: 4 });
    const a = generateProgramme(old, { byKey }, () => 10);
    expect(generateProgramme({...old, skipLegs:false}, {byKey},()=>10)).toEqual(a);
    expect(a!.draft.days.flatMap(d=>d.exercises).some(e=>lowerMuscles.has(CATALOG_BY_KEY.get(e.exerciseId)!.muscle))).toBe(true);
  });
  it.each(["en", "ar"] as const)("saves exactly the preview in %s without rewriting the existing program", async lang => {
    const ctx = await freshDb(); await ctx.repos.seedIfNeeded(); await ctx.repos.topUpLibrary();
    const previous = await ctx.programmes.getActive();
    const before = previous ? await ctx.programmes.loadDraft(previous.versionId) : null;
    const preview = generateProgramme(input({lang,daysPerWeek:6}), {byKey:await ctx.programmes.seedKeyMap()},()=>10)!;
    expect(preview).toBeTruthy();
    const made = await ctx.programmes.createProgramme(preview.draft, {activate:true});
    expect(await ctx.programmes.loadDraft(made.versionId)).toEqual(preview.draft);
    if(previous) expect(await ctx.programmes.loadDraft(previous.versionId)).toEqual(before);
  });
});
