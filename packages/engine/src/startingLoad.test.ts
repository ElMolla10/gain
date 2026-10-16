import { describe, expect, it } from "vitest";
import { estimateStartingLoad } from "./startingLoad";

const bar = { equipment: "barbell" as const, increment: 2.5, min: 20 };
const db = { equipment: "dumbbell" as const, loads: [2.5, 4, 5, 6, 7.5, 8, 10, 12.5] };

describe("estimateStartingLoad", () => {
  it("uses the empty bar for a barbell compound with no bodyweight", () => {
    const e = estimateStartingLoad({ pattern: "horizontal_push", equipment: "barbell", setup: "free", spec: bar });
    expect(e).toEqual({ load: 20, estimated: true });
  });
  it("stays at or below a quarter of bodyweight for a barbell compound, snapped down", () => {
    const e = estimateStartingLoad({ pattern: "squat", equipment: "barbell", setup: "free", bodyweightKg: 80, spec: bar });
    expect(e?.estimated).toBe(true);
    expect(e!.load).toBeLessThanOrEqual(20);
    expect(e!.load).toBeGreaterThanOrEqual(20);
  });
  it("picks a lighter dumbbell for isolation than for a compound", () => {
    const curl = estimateStartingLoad({ pattern: "elbow_flexion", equipment: "dumbbell", setup: "free", spec: db });
    const press = estimateStartingLoad({ pattern: "horizontal_push", equipment: "dumbbell", setup: "free", spec: db });
    expect(curl?.estimated).toBe(true);
    expect(press?.estimated).toBe(true);
    expect(curl!.load).toBeLessThan(press!.load);
  });
  it("bodyweight and assisted lines start at 0", () => {
    expect(estimateStartingLoad({ pattern: "vertical_pull", equipment: "plate", setup: "bodyweight_plus_added" })).toEqual({ load: 0, estimated: true });
    expect(estimateStartingLoad({ pattern: "vertical_pull", equipment: "assisted", setup: "assisted" })).toEqual({ load: 0, estimated: true });
  });
  it("never invents a gym plate that is not on the rack", () => {
    const e = estimateStartingLoad({
      pattern: "elbow_flexion",
      equipment: "dumbbell",
      setup: "free",
      bodyweightKg: 90,
      spec: db,
    });
    expect(db.loads).toContain(e!.load);
  });
});
