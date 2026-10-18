import { describe, expect, it } from "vitest";
import { plateLine } from "../src/logic/plateText";
import type { GymLoadSpec } from "@gain/engine";

const t = (key: "plates.each" | "plates.nearest" | "plates.bar", p: Record<string, string | number> = {}) =>
  (key === "plates.bar" ? "Bar only" : key === "plates.each" ? `Each side: ${p.plates}` : `Nearest: ${p.load}. Each side: ${p.plates}`);

describe("plateLine", () => {
  const bar: GymLoadSpec = { equipment: "barbell", increment: 2.5, min: 20, plates: [1.25, 2.5, 5, 10, 15, 20] };
  it("80 kg is 20 + 10 each side", () => {
    expect(plateLine(bar, 80, "kg", "en", t)?.text.replace(/[\u2066-\u2069]/g, "").replace(/\u00a0/g, " ")).toBe("Each side: 20 kg + 10 kg");
    expect(plateLine(bar, 80, "kg", "en", t)?.calc.exact).toBe(true);
  });
  it("says nearest when the gym cannot make the exact load", () => {
    const limited: GymLoadSpec = { equipment: "barbell", increment: 2.5, min: 20, plates: [10, 5] };
    const line = plateLine(limited, 77, "kg", "en", t);
    expect(line?.calc.exact).toBe(false);
    expect(line?.text.startsWith("Nearest:")).toBe(true);
  });
  it("skips non-barbell equipment", () => {
    expect(plateLine({ equipment: "dumbbell", loads: [10, 20] }, 20, "kg", "en", t)).toBeNull();
  });
});
