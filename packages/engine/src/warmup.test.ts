import { describe, expect, it } from "vitest";
import { generateWarmups } from "./warmup";
import { isGymLoad } from "./loads";
import type { GymLoadSpec } from "./types";
import { DB_RACK } from "./testkit";

const bar: GymLoadSpec = { equipment: "barbell", increment: 2.5, min: 20 };
const db: GymLoadSpec = { equipment: "dumbbell", loads: DB_RACK };
const cable: GymLoadSpec = { equipment: "cable", increment: 5 };

describe("generateWarmups", () => {
  it("barbell 100: empty bar, then 50 / 70 / 85", () => {
    const p = generateWarmups(100, bar);
    expect(p.sets.map((s) => s.load)).toEqual([20, 50, 70, 85]);
    expect(p.sets.map((s) => s.reps)).toEqual([10, 8, 5, 3]);
    expect(p.skipped).toBeNull();
  });
  it("every warm-up is flagged warmup and exists in the gym", () => {
    const p = generateWarmups(97.5, bar);
    for (const s of p.sets) {
      expect(s.warmup).toBe(true);
      expect(isGymLoad(bar, s.load)).toBe(true);
    }
  });
  it("loads strictly increase and stay below the working load", () => {
    for (const w of [30, 42.5, 60, 100, 142.5]) {
      const loads = generateWarmups(w, bar).sets.map((s) => s.load);
      for (let i = 0; i < loads.length; i++) {
        expect(loads[i]!).toBeLessThan(w);
        if (i > 0) expect(loads[i]!).toBeGreaterThan(loads[i - 1]!);
      }
    }
  });
  it("dumbbells use pairs on the rack (never 21 or 25.5)", () => {
    const p = generateWarmups(30, db);
    expect(p.sets.map((s) => s.load)).toEqual([15, 20, 25]);
  });
  it("cable stack jumps of 5", () => {
    expect(generateWarmups(60, cable).sets.map((s) => s.load)).toEqual([30, 40, 50]);
  });
  it("a light working weight near the bar gets no duplicates and nothing below the bar", () => {
    const loads = generateWarmups(30, bar).sets.map((s) => s.load);
    expect(loads.every((l) => l >= 20)).toBe(true);
    expect(new Set(loads).size).toBe(loads.length);
  });
  it("the empty bar alone is not warmed up", () => {
    const p = generateWarmups(20, bar);
    expect(p.sets).toEqual([]);
    expect(p.skipped).toBe("working_load_too_light");
  });
  it("assisted lines get no warm-ups", () => {
    expect(generateWarmups(30, { equipment: "assisted", increment: 5, min: 0 }, { setup: "assisted" })).toEqual({
      sets: [],
      skipped: "assisted_line",
    });
  });
  it("no gym loads or a zero working load gives an explicit reason", () => {
    expect(generateWarmups(50, null).skipped).toBe("no_gym_loads");
    expect(generateWarmups(0, bar).skipped).toBe("working_load_too_light");
  });
  it("bodyweight with added load warms up from the added load, zero allowed", () => {
    const plate: GymLoadSpec = { equipment: "plate", increment: 2.5 };
    const p = generateWarmups(20, plate, { setup: "bodyweight_plus_added" });
    expect(p.sets.length).toBeGreaterThan(0);
    for (const s of p.sets) expect(s.load).toBeLessThan(20);
  });
  it("maxSets trims the list", () => {
    expect(generateWarmups(100, bar, { maxSets: 2 }).sets).toHaveLength(2);
  });
});
