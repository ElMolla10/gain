import { describe, expect, it } from "vitest";
import type { GymLoadSpec, ReasonText } from "@gain/engine";
import { renderReason } from "@gain/engine";
import { formatLoad, LRI, PDI } from "../src/i18n/format";
import { stepLoad } from "../src/logic/draft";
import { heaviestLoad } from "../src/logic/importFlow";
import { editedKg, kgToUnit, localizeReason, parseUnit, unitLabel, unitToKg, unitToKgKnown, weightText } from "../src/logic/units";
import { freshDb } from "./helpers";

const clean = (x: string) => x.replace(/[\u2066-\u2069]/g, "");

describe("kg <-> lb conversion layer", () => {
  it("kg is the default and junk falls back to kg", () => {
    expect(parseUnit(null)).toBe("kg");
    expect(parseUnit("stone")).toBe("kg");
    expect(parseUnit("lb")).toBe("lb");
  });
  it("kilograms show as they are (3 decimals at most, no float noise)", () => {
    expect(kgToUnit(62.5, "kg")).toBe(62.5);
    expect(kgToUnit(0.1 + 0.2, "kg")).toBe(0.3);
    expect(weightText(1.25, "kg")).toBe("1.25");
  });
  it("pounds are rounded to 0.1 lb", () => {
    expect(kgToUnit(20, "lb")).toBe(44.1);
    expect(kgToUnit(62.5, "lb")).toBe(137.8);
    expect(kgToUnit(0, "lb")).toBe(0);
  });
  it("a 45 lb bar and 5 lb steps are exact in lb after the kg round trip", () => {
    const bar = unitToKg(45, "lb");
    expect(bar).toBe(20.412);
    expect(kgToUnit(bar, "lb")).toBe(45);
    for (let k = 0; k <= 100; k++) expect(kgToUnit(bar + k * unitToKg(5, "lb"), "lb")).toBe(45 + 5 * k);
  });
  it("a typed lb value that is just the display of a stored kg value maps back to that exact kg", () => {
    expect(unitToKgKnown(44.1, "lb", [20, 2.5])).toBe(20);
    expect(unitToKgKnown(44.1, "lb", [])).toBe(unitToKg(44.1, "lb"));
    expect(unitToKgKnown(44.1, "kg", [20])).toBe(44.1);
  });
  it("labels: English and a draft Arabic", () => {
    expect(unitLabel("kg", "en")).toBe("kg");
    expect(unitLabel("lb", "en")).toBe("lb");
    expect(unitLabel("kg", "ar")).toBe("كجم");
    expect(unitLabel("lb", "ar")).toBe("باوند");
  });
  it("formatLoad defaults to kg and isolates the number for RTL", () => {
    expect(formatLoad(32.5, "en")).toBe(`${LRI}32.5${PDI} kg`);
    expect(clean(formatLoad(20, "en", "lb"))).toBe("44.1 lb");
    expect(clean(formatLoad(20, "ar", "lb"))).toBe("44.1 باوند");
  });
});

describe("logger steps on loads that exist, in either unit", () => {
  const lbBar: GymLoadSpec = { equipment: "barbell", increment: unitToKg(5, "lb"), min: unitToKg(45, "lb"), max: unitToKg(600, "lb") };
  it("a 5 lb barbell steps 45 -> 50 -> 55 lb and back", () => {
    let load = unitToKg(45, "lb");
    const seen: number[] = [];
    for (let i = 0; i < 3; i++) {
      load = stepLoad(lbBar, load, 1, "free", "lb").load;
      seen.push(kgToUnit(load, "lb"));
    }
    expect(seen).toEqual([50, 55, 60]);
    expect(kgToUnit(stepLoad(lbBar, load, -1).load, "lb")).toBe(55);
  });
  it("a kg gym viewed in lb still steps on its real kg loads", () => {
    const kgBar: GymLoadSpec = { equipment: "barbell", increment: 2.5, min: 20, max: 200 };
    const up = stepLoad(kgBar, 20, 1, "free", "lb").load;
    expect(up).toBe(22.5);
    expect(kgToUnit(up, "lb")).toBe(49.6);
  });
  it("with no gym loads the fallback is 2.5 kg, or 5 lb in lb mode", () => {
    expect(stepLoad(null, 20, 1, "free", "kg")).toEqual({ load: 22.5, exact: false });
    const r = stepLoad(null, unitToKg(100, "lb"), 1, "free", "lb");
    expect(kgToUnit(r.load, "lb")).toBe(105);
    expect(r.exact).toBe(false);
    expect(stepLoad(null, 1, -1, "free", "lb").load).toBe(0);
  });
});

describe("engine reasons are shown in the lifter's unit", () => {
  const reason: ReasonText = { key: "load_up", params: { load: 62.5, unit: "kg", equipment: "barbell", reps: 6, lastReps: 10, prevLoad: 60, lo: 6, hi: 10 } };
  it("kg: unchanged apart from the label", () => {
    expect(renderReason(localizeReason(reason, "kg", "en"), "en")).toBe("Go up to 62.5 kg for 6. You hit 10 at 60 kg.");
  });
  it("lb: weights converted, reps untouched", () => {
    expect(renderReason(localizeReason(reason, "lb", "en"), "en")).toBe("Go up to 137.8 lb for 6. You hit 10 at 132.3 lb.");
    expect(renderReason(localizeReason(reason, "lb", "ar"), "ar")).toContain("137.8 باوند");
  });
  it("does not mutate the stored reason", () => {
    localizeReason(reason, "lb", "en");
    expect(reason.params.load).toBe(62.5);
  });
});

describe("setting", () => {
  it("units default to kg and persist", async () => {
    const { repos } = await freshDb();
    expect(await repos.getUnits()).toBe("kg");
    await repos.setUnits("lb");
    expect(await repos.getUnits()).toBe("lb");
    await repos.setUnits("kg");
    expect(await repos.getUnits()).toBe("kg");
  });
});

describe("import display", () => {
  it("heaviest set of a converted file", () => {
    const parse = { source: "hevy", unit: "kg", rowCount: 2, warnings: [], workouts: [{ exercises: [{ sets: [{ load: 61.23 }, { load: 100 }] }, { sets: [{ load: 20 }] }] }] } as never;
    expect(heaviestLoad(parse)).toBe(100);
    expect(heaviestLoad(null)).toBeNull();
    expect(heaviestLoad({ workouts: [] } as never)).toBeNull();
  });
});

describe("history edit keeps an unchanged load (Step 6)", () => {
  it("60 kg shown in lb and saved untouched stays exactly 60 kg; a real change converts", () => {
    const shown = kgToUnit(60, "lb");
    expect(unitToKg(shown, "lb")).not.toBe(60); // the plain round trip drifts by grams
    expect(editedKg(shown, 60, "lb")).toBe(60);
    expect(editedKg(135, 60, "lb")).toBe(unitToKg(135, "lb"));
    expect(editedKg(62.5, 60, "kg")).toBe(62.5);
    expect(editedKg(60, 60, "kg")).toBe(60);
  });
});
