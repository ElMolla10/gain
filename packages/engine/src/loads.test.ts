import { describe, expect, it } from "vitest";
import {
  ceilLoad,
  floorLoad,
  InvalidGymLoadSpec,
  isGymLoad,
  listLoads,
  nextLoadAbove,
  nextLoadBelow,
  roundToGymLoad,
  validateGymLoadSpec,
} from "./loads";
import type { GymLoadSpec } from "./types";
import { DB_RACK } from "./testkit";

const db: GymLoadSpec = { equipment: "dumbbell", loads: DB_RACK };
const bar: GymLoadSpec = { equipment: "barbell", increment: 2.5, min: 20 };
const frac: GymLoadSpec = { equipment: "barbell", increment: 1.25, min: 20 };
const cable: GymLoadSpec = { equipment: "cable", increment: 5 };
const machine: GymLoadSpec = { equipment: "machine", increment: 5, min: 5, max: 100 };
const assisted: GymLoadSpec = { equipment: "assisted", increment: 5, min: 0, max: 80 };

describe("validateGymLoadSpec", () => {
  it("needs loads or an increment", () => {
    expect(() => validateGymLoadSpec({ equipment: "dumbbell" })).toThrow(InvalidGymLoadSpec);
    expect(() => validateGymLoadSpec({ equipment: "dumbbell", loads: [] })).toThrow(InvalidGymLoadSpec);
  });
  it("rejects a zero or negative increment", () => {
    expect(() => validateGymLoadSpec({ equipment: "cable", increment: 0 })).toThrow(InvalidGymLoadSpec);
    expect(() => validateGymLoadSpec({ equipment: "cable", increment: -5 })).toThrow(InvalidGymLoadSpec);
  });
  it("rejects negative or non-finite loads and max < min", () => {
    expect(() => validateGymLoadSpec({ equipment: "dumbbell", loads: [-1] })).toThrow(InvalidGymLoadSpec);
    expect(() => validateGymLoadSpec({ equipment: "dumbbell", loads: [Infinity] })).toThrow(InvalidGymLoadSpec);
    expect(() => validateGymLoadSpec({ equipment: "machine", increment: 5, min: 50, max: 10 })).toThrow(InvalidGymLoadSpec);
  });
  it("accepts a valid list and a valid grid", () => {
    expect(() => validateGymLoadSpec(db)).not.toThrow();
    expect(() => validateGymLoadSpec(bar)).not.toThrow();
  });
});

describe("roundToGymLoad: dumbbell pairs (20 then 22.5)", () => {
  it("never returns 21: 21 rounds to 20", () => expect(roundToGymLoad(db, 21).load).toBe(20));
  it("21.5 rounds to 22.5", () => expect(roundToGymLoad(db, 21.5).load).toBe(22.5));
  it("a tie goes to the lighter load", () => expect(roundToGymLoad(db, 21.25).load).toBe(20));
  it("exact loads are flagged exact", () => expect(roundToGymLoad(db, 22.5)).toEqual({ load: 22.5, exact: true }));
  it("non-exact loads are flagged not exact", () => expect(roundToGymLoad(db, 21).exact).toBe(false));
  it("mode up / down", () => {
    expect(roundToGymLoad(db, 20.1, { mode: "up" }).load).toBe(22.5);
    expect(roundToGymLoad(db, 22.4, { mode: "down" }).load).toBe(20);
  });
  it("above the heaviest dumbbell clamps to the heaviest", () => {
    expect(roundToGymLoad(db, 100).load).toBe(40);
    expect(roundToGymLoad(db, 100, { mode: "up" }).load).toBe(40);
  });
  it("below the lightest clamps to the lightest (free weights have no zero rung)", () => {
    expect(roundToGymLoad(db, 3).load).toBe(10);
  });
});

describe("roundToGymLoad: grids", () => {
  it("barbell 2.5 kg increments from a 20 kg bar", () => {
    expect(roundToGymLoad(bar, 101).load).toBe(100);
    expect(roundToGymLoad(bar, 101.3).load).toBe(102.5);
    expect(roundToGymLoad(bar, 15).load).toBe(20);
  });
  it("barbell 1.25 kg increments with fractional plates", () => {
    expect(roundToGymLoad(frac, 101).load).toBe(101.25);
    expect(roundToGymLoad(frac, 100.6).load).toBe(100);
  });
  it("cable 5 kg jumps", () => {
    expect(roundToGymLoad(cable, 32).load).toBe(30);
    expect(roundToGymLoad(cable, 33).load).toBe(35);
  });
  it("machine max caps the grid", () => {
    expect(roundToGymLoad(machine, 140).load).toBe(100);
    expect(ceilLoad(machine, 101)).toBeNull();
  });
  it("float noise does not move a load", () => {
    expect(floorLoad(bar, 22.5000000001)).toBe(22.5);
    expect(floorLoad(bar, 22.4999999999)).toBe(22.5);
  });
});

describe("next / previous load", () => {
  it("dumbbell: next after 30 is 32.5, after 20 is 22.5, after 21 is 22.5", () => {
    expect(nextLoadAbove(db, 30)).toBe(32.5);
    expect(nextLoadAbove(db, 20)).toBe(22.5);
    expect(nextLoadAbove(db, 21)).toBe(22.5);
  });
  it("dumbbell: previous", () => {
    expect(nextLoadBelow(db, 22.5)).toBe(20);
    expect(nextLoadBelow(db, 10)).toBeNull();
    expect(nextLoadAbove(db, 40)).toBeNull();
  });
  it("barbell", () => {
    expect(nextLoadAbove(bar, 100)).toBe(102.5);
    expect(nextLoadBelow(bar, 20)).toBeNull();
    expect(nextLoadBelow(bar, 22.5)).toBe(20);
  });
  it("machine top of stack", () => expect(nextLoadAbove(machine, 100)).toBeNull());
  it("zero is a rung for bodyweight lines only", () => {
    const plate: GymLoadSpec = { equipment: "plate", increment: 2.5 };
    expect(nextLoadAbove(plate, 0, true)).toBe(2.5);
    expect(floorLoad(plate, 1, true)).toBe(0);
    expect(floorLoad(plate, 1, false)).toBeNull();
    expect(nextLoadBelow(plate, 2.5, true)).toBe(0);
  });
  it("assisted: less assistance is a lower number", () => {
    expect(nextLoadBelow(assisted, 5, true)).toBe(0);
    expect(nextLoadBelow(assisted, 0, true)).toBeNull();
    expect(nextLoadAbove(assisted, 80, true)).toBeNull();
  });
});

describe("isGymLoad / listLoads", () => {
  it("isGymLoad", () => {
    expect(isGymLoad(db, 22.5)).toBe(true);
    expect(isGymLoad(db, 21)).toBe(false);
    expect(isGymLoad(bar, 102.5)).toBe(true);
    expect(isGymLoad(bar, 101)).toBe(false);
  });
  it("lists a dumbbell rack and a grid", () => {
    expect(listLoads(db)).toEqual(DB_RACK);
    expect(listLoads(bar, 30)).toEqual([20, 22.5, 25, 27.5, 30]);
    expect(listLoads(machine)).toHaveLength(20);
  });
  it("an unbounded grid cannot be listed", () => {
    expect(() => listLoads(bar)).toThrow(InvalidGymLoadSpec);
  });
});
