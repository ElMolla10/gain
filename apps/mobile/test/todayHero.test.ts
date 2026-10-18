import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculatePlates, type GymLoadSpec } from "@gain/engine";
import { describe, expect, it } from "vitest";
import { defaultGymLoads } from "../src/logic/defaultGym";
import { plateDelta } from "../src/logic/plateDelta";
import { pinIndex, todayHero, type HeroExercise, type TodayHero } from "../src/logic/todayHero";
import { startDay } from "../src/logic/dayChoice";

const gym = (unit: "kg" | "lb" = "kg", extra: GymLoadSpec[] = []) => ({ gymId: "g", loads: [...defaultGymLoads(unit).filter((s) => !extra.some((e) => e.equipment === s.equipment)), ...extra] });
const ex = (over: Partial<HeroExercise> = {}): HeroExercise => ({ exerciseId: "bench", nameEn: "Barbell Bench Press", nameAr: "بنش برس", equipment: "barbell", setup: "free", measure: "reps", pattern: "horizontal_push", loadSpec: null, isGoalLift: true, ...over });
const tg = (load: number | null, reps = 6) => ({ exerciseId: "bench", load, reps, measure: "reps" as const });
const hero = (load: number | null, over: Partial<HeroExercise> = {}, g = gym(), more: { normalLoad?: number; position?: number } = {}) => todayHero({ target: tg(load), exercise: ex(over), gym: g, ...more });
const as = <K extends Exclude<TodayHero, { kind: "firstRun" }>["kind"]>(h: TodayHero | null, kind: K) => {
  if (!h || h.kind !== kind) throw new Error(`expected ${kind}, got ${h?.kind}`);
  return h as Extract<TodayHero, { kind: K }>;
};

describe("todayHero: barbell through barbellPlates", () => {
  it("102.5 → [25,15,1.25] exact; 187.5 worst case; 20 = empty bar; 15 → number only", () => {
    const b = as(hero(102.5), "barbell");
    expect(b.calc.perSide).toEqual([25, 15, 1.25]);
    expect(b.calc.exact).toBe(true);
    expect(as(hero(187.5), "barbell").calc.perSide).toEqual([25, 25, 25, 5, 2.5, 1.25]);
    expect(as(hero(20), "barbell").calc.perSide).toEqual([]);
    expect(as(hero(15), "noGym").reason).toBe("not_loadable");
  });
  it("a gym without change plates at 102.5 → the nearest load (100), exact false", () => {
    const b = as(hero(102.5, {}, gym("kg", [{ equipment: "barbell", increment: 2.5, min: 20, max: 200, plates: [5, 10, 15, 20, 25] }])), "barbell");
    expect(b.calc.load).toBe(100);
    expect(b.calc.exact).toBe(false);
  });
  it("lb: a 225 lb target on the standard lb rack → two 45 lb plates per side", () => {
    const b = as(hero(225 * 0.45359237, {}, gym("lb")), "barbell");
    expect(b.calc.perSide.map((kg) => Math.round(kg / 0.45359237))).toEqual([45, 45]);
  });
  it("warm-ups 102.5 → 20, 50, 72.5, 87.5 with their plates; isolation late in the day → skipped hint", () => {
    const b = as(hero(102.5), "barbell");
    expect(b.warmups.map((w) => w.load)).toEqual([20, 50, 72.5, 87.5]);
    expect(b.warmups.map((w) => w.perSide)).toEqual([[], [15], [25, 1.25], [25, 5, 2.5, 1.25]]);
    expect(b.skippedHint).toBe(false);
    expect(as(hero(30, { pattern: "elbow_flexion" }, gym(), { position: 3 }), "barbell").skippedHint).toBe(true);
  });
  it("lighter week: 90 with ghost plates of the normal 102.5", () => {
    const b = as(hero(90, {}, gym(), { normalLoad: 102.5 }), "barbell");
    expect(b.calc.perSide).toEqual([25, 10]);
    expect(b.ghost).toEqual([25, 15, 1.25]);
    expect(b.normalLoad).toBe(102.5);
    expect(as(hero(90), "barbell").ghost).toBeNull();
  });
});

describe("todayHero: other equipment", () => {
  it("plate-loaded machine: the load is the total, half per horn (60 → [25,5])", () => {
    const h = as(hero(60, { equipment: "plate" }), "horn");
    expect(h.perSide).toEqual([25, 5]);
    expect(2 * h.perSide.reduce((a, b) => a + b, 0)).toBe(60);
  });
  it("dip belt: plates that sum to the added load (10 → [10], 12.5 → [10, 2.5])", () => {
    expect(as(hero(10, { equipment: "plate", setup: "bodyweight_plus_added" }), "belt").plates).toEqual([10]);
    expect(as(hero(12.5, { equipment: "plate", setup: "bodyweight_plus_added" }), "belt").plates).toEqual([10, 2.5]);
  });
  it("stack: pin index from the grid (cable 50 → 10); unknown grid → null; assisted keeps its own variant", () => {
    expect(as(hero(50, { equipment: "cable" }), "stack").pinIndex).toBe(10);
    expect(pinIndex({ equipment: "machine", increment: 5 }, 50)).toBeNull();
    expect(pinIndex({ equipment: "dumbbell", loads: [2, 4, 6] }, 4)).toBe(2);
    expect(hero(25, { equipment: "assisted", setup: "assisted" })?.kind).toBe("assisted");
  });
  it("dumbbell pair, timed hold, no gym, no target", () => {
    expect(hero(28, { equipment: "dumbbell" })?.kind).toBe("dumbbell");
    const hold = todayHero({ target: { exerciseId: "x", load: 20, reps: null, measure: "time", durationS: 45 }, exercise: ex({ equipment: "dumbbell", measure: "time" }), gym: gym() });
    expect(as(hold, "hold").object).toBe("dumbbell");
    expect(as(hero(100, {}, null as never), "noGym").reason).toBe("no_gym");
    expect(todayHero({ target: null, exercise: ex(), gym: gym() })).toBeNull();
    expect(todayHero({ target: null, exercise: ex(), gym: gym(), isSample: true })).toEqual({ kind: "firstRun" });
  });
  it("every plate list drawn sums to the shown load (the art never lies)", () => {
    for (const load of [20, 22.5, 60, 61.25, 102.5, 143.75, 187.5, 200]) {
      const b = hero(load);
      if (b?.kind !== "barbell") continue;
      expect(20 + 2 * b.calc.perSide.reduce((a, c) => a + c, 0)).toBeCloseTo(b.calc.load, 6);
    }
    // calculatePlates is the only source for the horn too.
    expect(calculatePlates(60, 0, [1.25, 2.5, 5, 10, 15, 20, 25])!.perSide).toEqual([25, 5]);
  });
});

describe("plateDelta", () => {
  it("multiset diff, heaviest first", () => {
    expect(plateDelta([15], [25, 1.25])).toEqual({ off: [15], on: [25, 1.25] });
    expect(plateDelta([25, 1.25], [25, 5, 2.5, 1.25])).toEqual({ off: [], on: [5, 2.5] });
    expect(plateDelta([25, 25], [25])).toEqual({ off: [25], on: [] });
    expect(plateDelta([], [])).toEqual({ off: [], on: [] });
  });
});

describe("startDay afterStart", () => {
  it("runs after navigate on a new start, never blocks it, and a failure is only recorded", async () => {
    const order: string[] = [];
    const errors: unknown[] = [];
    let release!: () => void;
    await startDay({ kind: "start", dayId: "d" }, {
      plan: async () => order.push("plan"),
      navigate: () => order.push("navigate"),
      record: (e) => errors.push(e),
      afterStart: () => { order.push("after"); return new Promise<void>((r) => (release = r)); },
    });
    expect(order).toEqual(["plan", "navigate", "after"]);
    release();
    await startDay({ kind: "start", dayId: "d" }, { plan: async () => {}, navigate: () => {}, record: (e) => errors.push(e), afterStart: async () => { throw new Error("x"); } });
    await new Promise((r) => setTimeout(r, 0));
    expect(errors).toHaveLength(1);
    const resumed: string[] = [];
    await startDay({ kind: "resume", dayId: "d", elsewhere: false }, { plan: async () => {}, navigate: () => resumed.push("nav"), record: () => {}, afterStart: async () => void resumed.push("after") });
    expect(resumed).toEqual(["nav"]);
  });
});

describe("plate math audit", () => {
  it("todayHero never divides loads itself", () => {
    const src = readFileSync(join(__dirname, "..", "src", "logic", "todayHero.ts"), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(src).not.toMatch(/load\s*\/\s*2|\/\s*2\b/);
  });
});
