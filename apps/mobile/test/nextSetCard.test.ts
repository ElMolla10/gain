import { describe, expect, it } from "vitest";
import type { Decision } from "@gain/engine";
import { nextSetState } from "../src/logic/nextSetCard";

const d = (extra: Partial<Decision>): Decision => ({
  action: "maintain",
  suggestedWeightKg: 80,
  suggestedReps: 8,
  predictedReps: 8,
  reason: "within_range",
  ...extra,
});

describe("next-set card states", () => {
  it("increase / hold / decrease / no-heavier / starting / stop", () => {
    expect(nextSetState({ decision: d({ action: "increase", reason: "above_range", suggestedWeightKg: 82.5 }) })).toBe("increase");
    expect(nextSetState({ decision: d({ action: "maintain", reason: "within_range" }) })).toBe("hold");
    expect(nextSetState({ decision: d({ action: "decrease", reason: "below_range", suggestedWeightKg: 77.5 }) })).toBe("decrease");
    expect(nextSetState({ decision: d({ action: "maintain", reason: "no_suitable_increase" }) })).toBe("no_heavier");
    expect(nextSetState({
      decision: d({ action: "maintain", reason: "no_suitable_increase" }),
      spec: { equipment: "dumbbell", loads: [14, 16] },
    })).toBe("no_heavier");
    expect(nextSetState({ decision: d({}), starting: true })).toBe("starting");
    expect(nextSetState({ decision: d({ action: "stop", reason: "performance_stop" }) })).toBe("stop");
  });
  it("a within-range hold at the top of the rack stays Hold", () => {
    expect(nextSetState({
      decision: d({ action: "maintain", reason: "within_range", suggestedWeightKg: 16, predictedReps: 8 }),
      spec: { equipment: "dumbbell", loads: [14, 16] },
    })).toBe("hold");
  });
});
