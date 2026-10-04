import { describe, expect, it } from "vitest";
import { DEFAULT_REP_CEILINGS } from "@gain/engine";
import { ceilingForName } from "../src/logic/ceilings";
import { effectiveRange, rangeText } from "../src/logic/repRange";
import { describeDecision, type DecisionPayload } from "../src/logic/why";
import { ar, en } from "../src/i18n/strings";
import { freshDb } from "./helpers";

const T = (k: string, p: Record<string, string | number>) => en[k as keyof typeof en].replace(/\{(\w+)\}/g, (_, n) => String(p[n]));

describe("P05 the effective rep range is explicit", () => {
  it("a program range above the default ceiling is overridden, and the text says so", () => {
    const r = effectiveRange({ programmeMin: 8, programmeMax: 12, ceiling: ceilingForName("Barbell Bench Press", DEFAULT_REP_CEILINGS), source: "default" });
    expect(r).toMatchObject({ min: 8, max: 10, overridesProgramme: true });
    const text = rangeText(r, T);
    expect(text).toContain("Reps: 8-10");
    expect(text).toContain("Your program says 8-12");
    expect(text).toContain("default rep ceiling");
  });
  it("a per-lift ceiling is named as the lift's own", () => {
    const text = rangeText(effectiveRange({ programmeMin: 6, programmeMax: 10, ceiling: 8, source: "lift" }), T);
    expect(text).toContain("this lift's own rep ceiling is 8");
  });
  it("no extra sentence when the program and the ceiling agree", () => {
    const r = effectiveRange({ programmeMin: 8, programmeMax: 10, ceiling: 10, source: "default" });
    expect(r.overridesProgramme).toBe(false);
    expect(rangeText(r, T)).toBe("Reps: 8-10. Load goes up when every set reaches 10.");
  });
  it("a ceiling below the program's bottom pulls the bottom down with it", () => {
    expect(effectiveRange({ programmeMin: 12, programmeMax: 15, ceiling: 10, source: "default" })).toMatchObject({ min: 10, max: 10 });
  });
  it("strings are in both languages with the same placeholders", () => {
    for (const k of ["range.line", "range.override.lift", "range.override.default", "range.why", "range.src.lift", "range.src.default"] as const) {
      expect(ar[k]).toMatch(/[\u0600-\u06FF]/);
      expect((en[k].match(/\{\w+\}/g) ?? []).sort()).toEqual((ar[k].match(/\{\w+\}/g) ?? []).sort());
    }
  });
});

describe("P05 stored decisions and the Why screen", () => {
  it("the decision log stores the program's own range next to the one used, and Why shows both", async () => {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    const gymId = (await ctx.repos.getActiveGymId())!;
    const day = (await ctx.repos.getNextDay())!.day;
    const planned = await ctx.finish.planDay(day.id, gymId);
    const targets = await ctx.finish.getTargets(planned!.sessionId);
    expect(targets.length).toBeGreaterThan(0);
    const d = await ctx.finish.getDecision(targets[0]!.id);
    expect(d).not.toBeNull();
    const i = d!.payload.inputs;
    expect(i.programmeRepRange).toBeDefined();
    expect(i.programmeRepRange!.min).toBeGreaterThanOrEqual(1);
    // Force a difference and render
    const payload: DecisionPayload = { ...d!.payload, inputs: { ...i, programmeRepRange: { min: 8, max: 12 }, repRange: { min: 8, max: 10 }, policy: { ...i.policy, ceilingSource: "default", repCeiling: 10 } } };
    const sections = describeDecision(payload, { ruleVersion: d!.ruleVersion, path: d!.path }, (k, p) => (en[k as keyof typeof en] ?? k).replace(/\{(\w+)\}/g, (_, n) => String(p?.[n] ?? "")), "en");
    const rule = sections.find((s) => s.title === en["why.rule"])!;
    expect(rule.lines.join("\n")).toContain("Program range 8-12; rep ceiling in force 10 (app-wide default for this kind of lift).");
    // and nothing extra when they agree
    const same: DecisionPayload = { ...payload, inputs: { ...payload.inputs, programmeRepRange: { min: 8, max: 10 } } };
    const s2 = describeDecision(same, { ruleVersion: "x", path: "rule" }, (k, p) => (en[k as keyof typeof en] ?? k).replace(/\{(\w+)\}/g, (_, n) => String(p?.[n] ?? "")), "en");
    expect(s2.find((s) => s.title === en["why.rule"])!.lines.join("\n")).not.toContain("Program range");
  });
});
