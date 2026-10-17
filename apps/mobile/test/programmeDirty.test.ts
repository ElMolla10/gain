import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ar, en } from "../src/i18n/strings";
import { isDraftDirty, newExercise, removeDay, renameDay, type ProgrammeDraft } from "../src/logic/programmeDraft";

const base: ProgrammeDraft = {
  name: "PPL",
  days: [
    { name: "Push", exercises: [newExercise("bench"), newExercise("ohp")] },
    { name: "Pull", exercises: [newExercise("row")] },
  ],
};
const screen = readFileSync(join(__dirname, "../src/screens/ProgrammeEditScreen.tsx"), "utf8");

describe("programme editor discard guard (plan 1.7)", () => {
  it("is clean when nothing changed, or before the draft loads", () => {
    expect(isDraftDirty(base, structuredClone(base))).toBe(false);
    expect(isDraftDirty(null, base)).toBe(false);
    expect(isDraftDirty(base, null)).toBe(false);
  });
  it("is dirty after a renamed day, changed sets or a removed exercise", () => {
    expect(isDraftDirty(base, renameDay(base, 0, "Chest"))).toBe(true);
    const sets = structuredClone(base);
    sets.days[0]!.exercises[0]!.sets = 4;
    expect(isDraftDirty(base, sets)).toBe(true);
    const removed = structuredClone(base);
    removed.days[0]!.exercises.pop();
    expect(isDraftDirty(base, removed)).toBe(true);
    expect(isDraftDirty(base, removeDay(base, 1))).toBe(true);
  });
  it("ignores whitespace-only name edits (same as what saving compares)", () => {
    expect(isDraftDirty(base, { ...base, name: "PPL  " })).toBe(false);
  });
  it("is clean against the new initial after a save", () => {
    const edited = renameDay(base, 0, "Chest");
    expect(isDraftDirty(edited, edited)).toBe(false);
  });
  it("the screen guards removal with usePreventRemove on the dirty flag and steps aside after save", () => {
    expect(screen).toContain("usePreventRemove(dirty,");
    expect(screen).toContain("const dirty = isDraftDirty(initial, draft)");
    expect(screen).toContain('style: "destructive", onPress: () => nav.dispatch(data.action)');
    expect(screen).toContain("if (saved.current) return nav.dispatch(data.action)");
    const save = screen.indexOf("async function save()");
    expect(screen.indexOf("saved.current = true", save)).toBeLessThan(screen.indexOf("nav.goBack()", save));
  });
  it("onboarding's editor has no guard (only ProgrammeEditScreen does)", () => {
    const onboarding = readFileSync(join(__dirname, "../src/screens/OnboardingScreen.tsx"), "utf8");
    expect(onboarding).not.toContain("usePreventRemove");
  });
  it("has the strings in English and Arabic", () => {
    for (const k of ["prog.discard.title", "prog.discard.body", "prog.discard.keep", "prog.discard.ok"] as const) {
      expect(en[k]).toBeTruthy();
      expect(ar[k]).toBeTruthy();
    }
  });
});
