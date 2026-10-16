import { describe, expect, it } from "vitest";
import { CATALOG } from "../src/db/libraryDraft";
import { generateProgramme, matchesAvoid, pickGeneratorTemplate, weeklySetsByGroup, type GenerateInput } from "../src/logic/programGenerator";
import { estimateSessionMinutes } from "../src/logic/templates";
import { validateDraft } from "../src/logic/programmeDraft";
import { GYM_EQUIPMENT } from "../src/logic/gymInput";
import { freshDb } from "./helpers";

const byKey = new Map(CATALOG.map((c) => [c.key, { exerciseId: `id-${c.key}`, equipment: c.equipment }]));
const idToKey = new Map([...byKey.entries()].map(([k, v]) => [v.exerciseId, k]));
const names = (draft: { days: { exercises: { exerciseId: string }[] }[] }) =>
  draft.days.flatMap((d) => d.exercises.map((e) => idToKey.get(e.exerciseId) ?? e.exerciseId));

const base = (over: Partial<GenerateInput> = {}): GenerateInput => ({
  goal: "hypertrophy",
  experience: "intermediate",
  daysPerWeek: 4,
  sessionMinutes: 75,
  equipment: [...GYM_EQUIPMENT],
  priorities: { biceps: "priority", forearms: "priority" },
  avoid: ["RDLs", "hip thrusts"],
  lang: "en",
  ...over,
});

describe("pickGeneratorTemplate", () => {
  it("picks the 4-day Push / Pull / Legs / Upper template for a 4-day hypertrophy gym request", () => {
    expect(pickGeneratorTemplate(base())?.id).toBe("ppl_upper_4");
    expect(pickGeneratorTemplate(base())?.days).toBe(4);
  });
  it("respects days per week", () => {
    expect(pickGeneratorTemplate(base({ daysPerWeek: 3 }))?.days).toBe(3);
    expect(pickGeneratorTemplate(base({ daysPerWeek: 5 }))?.days).toBe(5);
  });
});

describe("matchesAvoid", () => {
  it("matches RDLs and hip thrusts by name and key", () => {
    expect(matchesAvoid({ key: "romanian_deadlift", nameEn: "Romanian Deadlift" }, ["rdl"])).toBe(true);
    expect(matchesAvoid({ key: "db_rdl", nameEn: "Dumbbell Romanian Deadlift" }, ["rdl"])).toBe(true);
    expect(matchesAvoid({ key: "hip_thrust", nameEn: "Barbell Hip Thrust" }, ["hip thrust"])).toBe(true);
    expect(matchesAvoid({ key: "back_squat", nameEn: "Back Squat" }, ["rdl", "hip thrust"])).toBe(false);
  });
});

describe("generateProgramme", () => {
  it("builds an editable 4-day PPL + Upper program, drops RDLs and hip thrusts, stays under 75 minutes, and boosts biceps and forearms", () => {
    const none = generateProgramme(base({ priorities: {}, avoid: [] }), { byKey }, () => 10);
    const got = generateProgramme(base(), { byKey }, () => 10);
    expect(got).toBeTruthy();
    expect(got!.template.id).toBe("ppl_upper_4");
    expect(got!.draft.days).toHaveLength(4);
    expect(got!.draft.days.map((d) => d.name)).toEqual(["Push", "Pull", "Legs", "Upper"]);
    expect(validateDraft(got!.draft)).toEqual([]);
    const keys = names(got!.draft);
    expect(keys.some((k) => /rdl|romanian/i.test(k))).toBe(false);
    expect(keys.some((k) => /hip_thrust/i.test(k))).toBe(false);
    expect(got!.dropped.some((d) => d.reason === "avoid")).toBe(true);
    for (const day of got!.draft.days) {
      expect(estimateSessionMinutes(day.exercises.reduce((n, e) => n + e.sets, 0))).toBeLessThanOrEqual(75);
    }
    const withP = weeklySetsByGroup(got!.draft, idToKey);
    const without = weeklySetsByGroup(none!.draft, idToKey);
    expect(withP.get("biceps") ?? 0).toBeGreaterThan(without.get("biceps") ?? 0);
    expect(withP.get("forearms") ?? 0).toBeGreaterThan(without.get("forearms") ?? 0);
  });
  it("reduced muscles get fewer weekly sets than normal", () => {
    const normal = generateProgramme(base({ priorities: {}, avoid: [] }), { byKey }, () => 10)!;
    const cut = generateProgramme(base({ priorities: { hamstrings: "reduced" }, avoid: [] }), { byKey }, () => 10)!;
    expect(weeklySetsByGroup(cut.draft, idToKey).get("hamstrings") ?? 0).toBeLessThan(weeklySetsByGroup(normal.draft, idToKey).get("hamstrings") ?? 0);
  });
});

describe("generated program does not overwrite", () => {
  it("createProgramme({ activate: false }) leaves the current program in place", async () => {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    await ctx.repos.topUpLibrary();
    const seed = await ctx.programmes.seedKeyMap();
    const first = generateProgramme(base({ priorities: {}, avoid: [] }), { byKey: seed }, () => 10);
    expect(first).toBeTruthy();
    const made = await ctx.programmes.createProgramme(first!.draft, { activate: true });
    const second = generateProgramme(base(), { byKey: seed }, () => 10)!;
    await ctx.programmes.createProgramme(second.draft, { activate: false });
    const active = await ctx.programmes.getActive();
    expect(active?.programmeId).toBe(made.programmeId);
    expect((await ctx.programmes.listProgrammes()).length).toBeGreaterThanOrEqual(2);
  });
});
