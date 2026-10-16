import { describe, expect, it } from "vitest";
import { barbellPlates, calculatePlates, derivePlates, platesOf } from "./plates";
import type { GymLoadSpec } from "./types";

const kgGym: GymLoadSpec = { equipment: "barbell", increment: 2.5, min: 20, max: 200 };
const plates = [1.25, 2.5, 5, 10, 15, 20];

describe("derivePlates", () => {
  it("2.5 kg jumps give 1.25 through 25", () => {
    expect(derivePlates(2.5)).toEqual([1.25, 2.5, 5, 10, 15, 20, 25]);
  });
  it("5 lb jumps give the usual lb plates in kg", () => {
    expect(derivePlates(5 * 0.45359237)).toEqual([1.13, 2.27, 4.54, 11.34, 15.88, 20.41]);
  });
});

describe("calculatePlates", () => {
  it("80 kg on a 20 kg bar is 20 + 10 each side", () => {
    const r = calculatePlates(80, 20, plates);
    expect(r).toEqual({ bar: 20, target: 80, load: 80, exact: true, perSide: [20, 10] });
  });
  it("empty bar is no plates", () => {
    expect(calculatePlates(20, 20, plates)?.perSide).toEqual([]);
    expect(calculatePlates(20, 20, plates)?.exact).toBe(true);
  });
  it("refuses a target below the bar", () => {
    expect(calculatePlates(15, 20, plates)).toBeNull();
  });
  it("uses only listed denominations (never invents a 25)", () => {
    const r = calculatePlates(90, 20, plates);
    expect(r?.exact).toBe(true);
    expect(r?.load).toBe(90);
    expect(r?.perSide.reduce((s, p) => s + p, 0)).toBe(35);
    expect(r?.perSide.includes(25)).toBe(false);
  });
  it("picks the nearest load when the exact target cannot be made, and says so", () => {
    const r = calculatePlates(77, 20, [10, 5]);
    // side 28.5; 10+10+5 = 25 → 70, or 30 → 80. 80 is 3 away, 70 is 7 away.
    expect(r?.exact).toBe(false);
    expect(r?.load).toBe(80);
    expect(r?.perSide.reduce((s, p) => s + p, 0)).toBe(30);
  });
  it("bar only when no plates are listed", () => {
    const r = calculatePlates(80, 20, []);
    expect(r).toEqual({ bar: 20, target: 80, load: 20, exact: false, perSide: [] });
  });
  it("ties on nearest go to the lighter (safer) load", () => {
    const r = calculatePlates(70, 20, [20]);
    // side 25; 20 → 60 (10 light) or 20+20 → 80 (10 heavy). Same error: pick lighter.
    expect(r?.load).toBe(60);
    expect(r?.exact).toBe(false);
  });
});

describe("barbellPlates / platesOf", () => {
  it("uses the spec's own plates when set, else derives from increment", () => {
    expect(platesOf(kgGym)).toEqual(derivePlates(2.5));
    expect(platesOf({ ...kgGym, plates: [10, 20] })).toEqual([10, 20]);
  });
  it("80 kg on the default kg gym (including 25s) is still exact", () => {
    const r = barbellPlates(kgGym, 80);
    expect(r?.exact).toBe(true);
    expect(r?.load).toBe(80);
    expect(r?.perSide.reduce((s, p) => s + p, 0)).toBe(30);
  });
});
