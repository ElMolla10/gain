import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GymLoadSpec } from "@gain/engine";
import { describe, expect, it } from "vitest";
import { mergeExerciseUnits, shownExerciseIdsKey, unitIdsToRead } from "../src/logic/exerciseUnits";
import { stepLoadOnGrid } from "../src/logic/stepLoad";
import { stepLoadKg } from "../src/logic/units";

const grid: GymLoadSpec = { equipment: "barbell", increment: 2.5, min: 20 };
const stack: GymLoadSpec = { equipment: "machine", loads: [10, 15, 22.5, 30] };

describe("per-exercise unit for exercises added or swapped mid-workout (batch item 24a)", () => {
  it("the key covers slots and swapped-in exercises, sorted, and only changes when the set does", () => {
    const slots = [{ exerciseId: "b" }, { exerciseId: "a" }];
    expect(shownExerciseIdsKey(slots, {})).toBe("a|b");
    expect(shownExerciseIdsKey(slots, { b: { replacedBy: "c" } })).toBe("a|b|c");
    expect(shownExerciseIdsKey([...slots].reverse(), { a: { replacedBy: null } })).toBe("a|b");
  });

  it("only unknown ids are read", () => {
    expect(unitIdsToRead("a|b|c", new Set(["a", "b"]))).toEqual(["c"]);
    expect(unitIdsToRead("", new Set())).toEqual([]);
  });

  it("a choice made in this workout wins over the saved one", () => {
    expect(mergeExerciseUnits({ a: "kg" }, { a: "lb", c: "lb" })).toEqual({ a: "kg", c: "lb" });
  });

  it("the hook re-reads on the id key and session, not once per open", () => {
    const src = readFileSync(join(__dirname, "../src/hooks/useWorkoutSession.ts"), "utf8");
    expect(src).toContain("}, [openSessionId, shownIdsKey, repos]);");
    expect(src).toContain("setExerciseUnits((prev) => mergeExerciseUnits(prev, saved));");
  });
});

describe("± load steps stay on the exercise's available loads (batch item 24b)", () => {
  it("100 kg +5 lb on a 2.5 kg grid goes to 102.5 kg (next grid load up), not 102.29", () => {
    expect(stepLoadKg(100, 5, "lb")).toBeCloseTo(102.29, 1);
    expect(stepLoadOnGrid(100, 5, "lb", grid)).toBe(102.5);
    expect(stepLoadOnGrid(100, -5, "lb", grid)).toBe(97.5);
  });

  it("kg steps already on the grid are unchanged", () => {
    expect(stepLoadOnGrid(100, 2.5, "kg", grid)).toBe(100 + 2.5);
    expect(stepLoadOnGrid(100, -2.5, "kg", grid)).toBe(97.5);
  });

  it("a list snaps in the step's direction and always moves; at the top it stays", () => {
    expect(stepLoadOnGrid(15, 2.5, "kg", stack)).toBe(22.5);
    expect(stepLoadOnGrid(22.5, -2.5, "kg", stack)).toBe(15);
    expect(stepLoadOnGrid(15, 5, "lb", stack)).toBe(22.5);
    expect(stepLoadOnGrid(30, 2.5, "kg", stack)).toBe(30);
    expect(stepLoadOnGrid(10, -2.5, "kg", stack)).toBe(0);
  });

  it("without a spec the plain step is kept", () => {
    expect(stepLoadOnGrid(100, 5, "lb", null)).toBe(stepLoadKg(100, 5, "lb"));
  });

  it("the set row uses it with the section's spec", () => {
    expect(readFileSync(join(__dirname, "../src/components/WorkoutSetRow.tsx"), "utf8")).toContain("stepLoadOnGrid(row.load ?? row.ghostLoad ?? 0, delta, unit, loadSpec)");
    expect(readFileSync(join(__dirname, "../src/components/WorkoutExerciseSection.tsx"), "utf8")).toContain("loadSpec={spec}");
  });
});
