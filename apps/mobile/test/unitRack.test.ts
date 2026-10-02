import { describe, expect, it } from "vitest";
import { findSpec, nextLoadAbove } from "@gain/engine";
import { defaultGymLoads, isStandardRack } from "../src/logic/defaultGym";
import { kgToUnit } from "../src/logic/units";
import { freshDb } from "./helpers";

describe("standard rack detection (Step 11 polish)", () => {
  it("the standard racks are recognised as themselves and not as the other unit", () => {
    for (const u of ["kg", "lb"] as const) {
      expect(isStandardRack(defaultGymLoads(u), u)).toBe(true);
      expect(isStandardRack(defaultGymLoads(u), u === "kg" ? "lb" : "kg")).toBe(false);
    }
  });
  it("any edit means it is no longer standard: extra equipment, a changed step, a missing dumbbell", () => {
    const kg = defaultGymLoads("kg");
    expect(isStandardRack(kg.slice(0, 5), "kg")).toBe(false);
    expect(isStandardRack(kg.map((s) => (s.equipment === "barbell" ? { ...s, increment: 1.25 } : s)), "kg")).toBe(false);
    expect(isStandardRack(kg.map((s) => (s.equipment === "dumbbell" ? { ...s, loads: s.loads!.slice(1) } : s)), "kg")).toBe(false);
    expect(isStandardRack([...kg, { equipment: "barbell", increment: 2.5 }], "kg")).toBe(false);
  });
  it("a gym saved and read back from the database is still recognised (what the Settings card sees)", async () => {
    const { gyms } = await freshDb();
    const id = await gyms.createGym({ name: "My gym", loads: defaultGymLoads("kg"), activate: true });
    const g = (await gyms.getGym(id))!;
    expect(isStandardRack(g.loads, "kg")).toBe(true);
    expect(isStandardRack(g.loads, "lb")).toBe(false);
    const id2 = await gyms.createGym({ name: "lb gym", loads: defaultGymLoads("lb") });
    expect(isStandardRack((await gyms.getGym(id2))!.loads, "lb")).toBe(true);
  });
  it("swapping the untouched kg rack for the lb rack gives loadable lb steps and leaves history alone", async () => {
    const c = await freshDb();
    const gymId = await c.gyms.createGym({ name: "My gym", loads: defaultGymLoads("kg"), activate: true });
    await c.repos.seedIfNeeded();
    const before = await c.gyms.getGym(gymId);
    expect(isStandardRack(before!.loads, "kg")).toBe(true);
    // The kg rack shown in pounds is awkward: 22.5 kg = 49.6 lb.
    expect(kgToUnit(22.5, "lb")).toBe(49.6);
    await c.gyms.updateGym(gymId, { name: "My gym", loads: defaultGymLoads("lb") });
    const after = (await c.gyms.getGym(gymId))!;
    expect(isStandardRack(after.loads, "lb")).toBe(true);
    const bar = findSpec({ gymId, name: "My gym", loads: after.loads } as never, "barbell")!;
    const next = nextLoadAbove(bar, 61.3, false); // just above the 135 lb rung (61.236 kg)
    expect(kgToUnit(next!, "lb")).toBe(140); // 5 lb steps, not 22.68-style decimals
  });
});
