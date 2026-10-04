import { describe, expect, it } from "vitest";
import { proposeNext } from "./progression";
import { vetModelAdvice } from "./modelGuard";
import { specForExercise, withExerciseLoads } from "./loads";
import { ASOF, gymA, lineOf, run } from "./testkit";
import type { ExerciseSpec, GymLoadSpec } from "./types";

// Weights the lifter set for one exercise replace the gym's grid for that exercise only; nothing set = nothing changes.
const db = (over: Partial<ExerciseSpec> = {}): ExerciseSpec => ({ exerciseId: "curl", name: "Dumbbell Curl", equipment: "dumbbell", setup: "free", repRange: { min: 8, max: 12 }, ...over });
const P = (ex: ExerciseSpec, load: number, reps: number[]) => proposeNext({ exercise: ex, gym: gymA, asOf: ASOF, history: run(lineOf("curl"), load, reps) });
// this lifter's dumbbells jump 2 kg: 10, 12, 14, 16 ...
const twoKg: GymLoadSpec = { equipment: "dumbbell", loads: [10, 12, 14, 16, 18, 20] };

describe("per-exercise loadable weights", () => {
  it("nothing set: identical decision to before, and nothing about it is recorded", () => {
    const a = P(db(), 20, [12, 12]);
    const b = P(db({ loadOverride: undefined }), 20, [12, 12]);
    expect(b).toEqual(a);
    expect(a.inputs.gym.loadSource).toBeUndefined();
    expect(a.inputs.gym.loadSpec).toBeUndefined();
  });
  it("uses the exercise's own dumbbell jumps for the next load, and records the grid it used", () => {
    const base = P(db(), 20, [12, 12]);
    expect(base.load).toBeGreaterThan(20);
    const own = P(db({ loadOverride: { equipment: "dumbbell", loads: [10, 12, 14, 16, 18, 20, 21, 22] } }), 20, [12, 12]);
    expect(own.load).toBe(21);
    expect(own.inputs.gym.nextHarderLoad).toBe(21);
    expect(own.inputs.gym.loadSource).toBe("exercise");
    expect(own.inputs.gym.loadSpec?.loads).toContain(21);
  });
  it("a 2 kg grid: from 16 the next weight is 18, never 17.5 (which is only in the gym's default rack)", () => {
    const p = P(db({ loadOverride: twoKg }), 16, [12, 12]);
    expect(p.load).toBe(18);
  });
  it("a machine stack with 4.5 kg plates: the step grid is respected", () => {
    const ex: ExerciseSpec = { exerciseId: "press", name: "Chest Press (Machine)", equipment: "machine", setup: "free", repRange: { min: 8, max: 12 }, loadOverride: { equipment: "machine", increment: 4.5, min: 4.5, max: 90 } };
    const p = proposeNext({ exercise: ex, gym: gymA, asOf: ASOF, history: run(lineOf("press"), 45, [12, 12]) });
    expect(p.load).toBe(49.5);
    expect(p.inputs.gym.loadSpec).toEqual(ex.loadOverride);
  });
  it("a barbell with 1.25 kg plates (2.5 kg jumps) vs 0.5 kg micro plates (1 kg jumps)", () => {
    const mk = (inc: number): ExerciseSpec => ({ exerciseId: "bench", name: "Barbell Bench Press", equipment: "barbell", setup: "free", repRange: { min: 6, max: 8 }, loadOverride: { equipment: "barbell", increment: inc, min: 20, max: 200 } });
    const a = proposeNext({ exercise: mk(1), gym: gymA, asOf: ASOF, history: run(lineOf("bench"), 100, [8, 8]) });
    const b = proposeNext({ exercise: mk(2.5), gym: gymA, asOf: ASOF, history: run(lineOf("bench"), 100, [8, 8]) });
    expect(a.load! % 1).toBe(0);
    expect(b.load! % 2.5).toBe(0);
  });
  it("assisted: zero assistance stays a real rung with an own grid", () => {
    const ex: ExerciseSpec = { exerciseId: "pull", name: "Assisted Pull Up", equipment: "assisted", setup: "assisted", repRange: { min: 6, max: 10 }, loadOverride: { equipment: "assisted", increment: 3, min: 0, max: 45 } };
    const p = proposeNext({ exercise: ex, gym: gymA, asOf: ASOF, history: run(lineOf("pull", "assisted"), 9, [10, 10]) });
    // 9 is a rung of the 3 kg grid (it is not on the default 5 kg grid), so the anchor is kept and 0 assistance stays reachable.
    expect(p.inputs.gym.anchorLoad).toBe(9);
    expect(p.inputs.gym.anchorOnGymLoads).toBe(true);
    expect(p.inputs.gym.nextHarderLoad).toBe(6);
    expect(p.inputs.gym.nextEasierLoad).toBe(12);
    expect(p.inputs.gym.loadSource).toBe("exercise");
  });
  it("the gym's other equipment and other exercises are untouched", () => {
    const g = withExerciseLoads(gymA, "dumbbell", twoKg);
    expect(g.loads.find((l) => l.equipment === "dumbbell")).toEqual(twoKg);
    expect(g.loads.filter((l) => l.equipment !== "dumbbell")).toEqual(gymA.loads.filter((l) => l.equipment !== "dumbbell"));
    expect(withExerciseLoads(gymA, "dumbbell", null)).toBe(gymA);
    expect(specForExercise(gymA, { equipment: "dumbbell" })).toEqual(gymA.loads.find((l) => l.equipment === "dumbbell"));
    expect(specForExercise(gymA, { equipment: "dumbbell", loadOverride: twoKg })).toEqual(twoKg);
  });
  it("an exercise whose gym has no grid for its equipment can still be planned with its own weights", () => {
    const empty = { gymId: "gymA", loads: [] };
    const none = proposeNext({ exercise: db(), gym: empty, asOf: ASOF, history: run(lineOf("curl"), 20, [12, 12]) });
    expect(none.status).toBe("no_gym_loads");
    const own = proposeNext({ exercise: db({ loadOverride: twoKg }), gym: empty, asOf: ASOF, history: run(lineOf("curl"), 16, [12, 12]) });
    expect(own.status).not.toBe("no_gym_loads");
    expect(own.load).toBe(18);
  });
  it("the model guard checks advice against the exercise's own grid", () => {
    const p = P(db({ loadOverride: twoKg }), 16, [12, 12]);
    const req = { ruleProposal: { ...p, needsModel: { needed: true, reasons: ["x"] } }, inputs: p.inputs } as never;
    const bad = vetModelAdvice(req, gymA, { load: 17.5, reps: 8, rationaleKey: "x", confidence: "low" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).not.toBe("no_gym_loads");
  });
});
