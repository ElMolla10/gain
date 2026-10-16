import { describe, expect, it } from "vitest";
import { AGE_STANDARD_LOADERS } from "../src/data/synthetic-standards";
import { modeledAlternativeIndex, modeledBodyweightIndex, modeledStrengthIndex } from "../src/logic/worldStrength";
import { CATALOG } from "../src/db/libraryDraft";
import exerciseModels from "../src/data/synthetic-standards/exercises.json";

describe("synthetic comparison model", () => {
  it("has a deterministic file for every age and an entry for every shipped exercise", () => {
    expect(AGE_STANDARD_LOADERS).toHaveLength(89);
    for (let age = 12; age <= 100; age++) {
      const file = AGE_STANDARD_LOADERS[age - 12]!();
      expect(file.age).toBe(age);
      expect(file.ageClass).toBe(age <= 17 ? "youth" : "adult");
      expect(file.male).toHaveLength(exerciseModels.length);
      expect(file.female).toHaveLength(exerciseModels.length);
    }
    const keys = new Set(exerciseModels.map(model => model.key));
    for (const exercise of CATALOG) expect(keys.has(exercise.key)).toBe(true);
  });

  it("centers at the baseline and reacts modestly to bodyweight and height", () => {
    const base = modeledStrengthIndex("bench_press", 100, "male", 30, 74, 175)!;
    expect(modeledStrengthIndex("bench_press", base.baselineKg, "male", 30, 74, 175)?.score).toBe(500);
    expect(modeledStrengthIndex("bench_press", 100, "male", 30, 100, 175)!.score).toBeLessThan(base.score);
    expect(modeledStrengthIndex("bench_press", 100, "male", 30, 74, 190)!.score).toBeLessThan(base.score);
    expect(modeledStrengthIndex("bench_press", 100, "female", 30, 63, 162)!.score).toBeGreaterThan(base.score);
  });

  it("keeps the youth class separate and does not imply a loaded 1RM for a timed movement", () => {
    expect(modeledStrengthIndex("bench_press", 50, "male", 17, 65, 170)).toMatchObject({ ageClass: "youth", basis: "synthetic_estimate" });
    expect(modeledStrengthIndex("bench_press", 50, "male", 18, 65, 170)).toMatchObject({ ageClass: "adult", basis: "published_anchor" });
    expect(modeledStrengthIndex("plank", 50, "male", 30, 74, 175)).toBeNull();
    expect(modeledStrengthIndex("bench_press", 50, "male", 11, 74, 175)).toBeNull();
  });

  it("scores unweighted reps and holds using their own units", () => {
    const reps = modeledBodyweightIndex("push_up", { reps: 20, load: 0, seconds: null }, "male", 30, 74, 175)!;
    expect(reps).toMatchObject({ score: 500, metric: "reps", value: 20 });
    expect(modeledBodyweightIndex("push_up", { reps: 30, load: 0, seconds: null }, "male", 30, 74, 175)!.score).toBeGreaterThan(reps.score);
    expect(modeledBodyweightIndex("plank", { reps: 0, load: 0, seconds: 45 }, "male", 30, 74, 175)).toMatchObject({ score: 500, metric: "seconds" });
    expect(modeledBodyweightIndex("push_up", { reps: 20, load: 10, seconds: null }, "male", 30, 74, 175)).toBeNull();
  });

  it("accounts for added weight on vertical bodyweight lifts and keeps weighted performance separate", () => {
    const light = modeledBodyweightIndex("pullup", { reps: 5, load: 10, seconds: null }, "male", 30, 74, 175)!;
    const heavy = modeledBodyweightIndex("pullup", { reps: 5, load: 20, seconds: null }, "male", 30, 74, 175)!;
    expect(light.metric).toBe("weighted_bodyweight");
    expect(heavy.score).toBeGreaterThan(light.score);
    expect(modeledBodyweightIndex("pullup", { reps: 11, load: 20, seconds: null }, "male", 30, 74, 175)).toBeNull();
    expect(modeledBodyweightIndex("pullup", { reps: 8, load: 0, seconds: null }, "male", 17, 60, 170)?.ageClass).toBe("youth");
  });

  it("scores assistance in the correct direction and rejects impossible help", () => {
    const set = (load: number) => modeledAlternativeIndex("assisted_pullup", { load, reps: 8, seconds: null, distance: null }, "male", 30, 74, 175);
    expect(set(10)!.score).toBeGreaterThan(set(20)!.score);
    expect(set(74)).toBeNull();
  });

  it("requires logged load and distance for carries and load and time for weighted holds", () => {
    const carry = (load: number, distance: number | null) => modeledAlternativeIndex("farmers_walk", { load, distance, reps: 0, seconds: null }, "male", 30, 74, 175);
    expect(carry(30, 40)!.score).toBeGreaterThan(carry(30, 20)!.score);
    expect(carry(0, 40)).toBeNull();
    const hold = (load: number) => modeledAlternativeIndex("weighted_plank", { load, distance: null, reps: 0, seconds: 45 }, "male", 30, 74, 175);
    expect(hold(20)!.score).toBeGreaterThan(hold(10)!.score);
    expect(hold(0)).toBeNull();
    expect(modeledAlternativeIndex("ab_crunch_band", { load: 10, distance: null, reps: 12, seconds: null }, "male", 30, 74, 175)).toBeNull();
  });
});
