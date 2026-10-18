import { barbellPlates, type GymLoadSpec } from "@gain/engine";
import { describe, expect, it } from "vitest";
import { NBSP, translate } from "../src/i18n/format";
import type { StringKey } from "../src/i18n/strings";
import { changeText, loadChange, plateMoves } from "../src/logic/loadChange";

const bar: GymLoadSpec = { equipment: "barbell", min: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] };
const noSmall: GymLoadSpec = { equipment: "barbell", min: 20, plates: [25, 20, 15, 10, 5, 2.5] };
const ctx = (lang: "en" | "ar") => ({ lang, unit: "kg" as const, t: (k: StringKey, p?: Record<string, string | number>) => translate(lang, k, p) });
const plain = (s: string | null) => (s ?? "").replace(/[\u2066-\u2069]/g, "").replace(/\u00a0/g, " ");
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("loadChange: fewest moves on a 20 kg bar", () => {
  it.each([
    [70, 80, "add", [5], []],
    [140, 120, "strip", [], [10]],
    [100, 110, "add", [5], []],
    [100, 120, "add", [10], []],
    [50, 57.5, "add", [2.5, 1.25], []],
    [100, 70, "strip", [], [15]],
  ] as const)("%s → %s", (from, to, kind, add, strip) => {
    const c = loadChange(bar, from, to, "barbell");
    expect(c.kind).toBe(kind);
    expect(c.add).toEqual(add);
    expect(c.strip).toEqual(strip);
  });
  it("100 → 120 reads '+10 each side' (not a swap)", () => {
    expect(plain(changeText(loadChange(bar, 100, 120, "barbell"), ctx("en")))).toBe("+10 each side");
  });
  it("down to the empty bar, same load, nearest", () => {
    expect(loadChange(bar, 40, 20, "barbell").kind).toBe("bar");
    expect(loadChange(bar, 57.5, 57.5, "barbell").kind).toBe("same");
    const n = loadChange(noSmall, 100, 102.5, "barbell");
    expect(n.kind).toBe("nearest");
    expect(n.to).toBe(100);
  });
  it("a swap when neither adding nor stripping works", () => {
    const c = loadChange(bar, 60, 70, "barbell"); // [20] → [25]: one swap beats strip + add of two
    expect(c.kind === "swap" || c.kind === "add").toBe(true);
    expect(sum([...barbellPlates(bar, 60)!.perSide.filter((p) => !c.strip.includes(p)), ...c.add])).toBeCloseTo(25);
  });
  it("property: strip then add always lands on the target load", () => {
    const loads: number[] = [];
    for (let x = 20; x <= 200; x += 2.5) loads.push(x);
    for (const from of loads) for (const to of loads) {
      const a = barbellPlates(bar, from)!.perSide;
      const b = barbellPlates(bar, to)!;
      const m = plateMoves(a, b.perSide, [25, 20, 15, 10, 5, 2.5, 1.25]);
      // strip is an outer run of a or the canonical tail; either way the per-side total matches.
      expect(sum(a) - sum(m.strip) + sum(m.add)).toBeCloseTo(sum(b.perSide), 6);
      const left = [...a];
      for (const s of m.strip) {
        const i = left.indexOf(s);
        expect(i).toBeGreaterThanOrEqual(0);
        left.splice(i, 1);
      }
    }
  });
});

describe("loadChange: other equipment and copy", () => {
  it("dumbbell, cable stack, assisted", () => {
    const db: GymLoadSpec = { equipment: "dumbbell", loads: [26, 28, 30, 32] };
    expect(plain(changeText(loadChange(db, 28, 30, "dumbbell"), ctx("en")))).toBe("Grab the 30s");
    const cable: GymLoadSpec = { equipment: "cable", min: 5, increment: 5, max: 100 };
    expect(plain(changeText(loadChange(cable, 45, 40, "cable"), ctx("en")))).toBe("Pin to 40 kg");
    const ar = changeText(loadChange(null, 25, 20, "assisted", "assisted"), ctx("ar"))!;
    expect(ar).toContain("←");
    expect(ar).toContain("كجم");
    expect(plain(changeText(loadChange(null, 25, 20, "assisted", "assisted"), ctx("en")))).toBe("Assistance 25 → 20 kg (less is stronger)");
  });
  it("stack with unknown positions says 'on the stack'", () => {
    const loose: GymLoadSpec = { equipment: "machine", loads: [12, 19, 33] };
    expect(plain(changeText(loadChange(loose, 12, 25, "machine"), ctx("en")))).toBe("25 kg on the stack");
  });
  it("horn: the total is halved per horn", () => {
    const plate: GymLoadSpec = { equipment: "plate", plates: [25, 20, 10, 5] };
    const c = loadChange(plate, 80, 100, "plate");
    expect(c.kind).toBe("horn");
    expect(c.add).toEqual([10]);
    expect(plain(changeText(c, ctx("en")))).toBe("+10 on each horn");
  });
  it("suffixes and Arabic", () => {
    expect(plain(changeText(loadChange(bar, 70, 80, "barbell"), ctx("en"), "work"))).toBe("+5 each side: work sets");
    expect(plain(changeText(loadChange(bar, 70, 80, "barbell"), ctx("ar"), "backoff"))).toBe("حمّل 5 في كل ناحية: مجموعات أخف");
    expect(plain(changeText(loadChange(bar, 140, 120, "barbell"), ctx("ar")))).toBe("شيل الـ10");
  });
  it("bidi: Arabic says كجم never kg, numbers isolated, NBSP before the unit", () => {
    const outs = [
      changeText(loadChange({ equipment: "cable", min: 5, increment: 5, max: 100 }, 45, 40, "cable"), ctx("ar"))!,
      changeText(loadChange(noSmall, 100, 102.5, "barbell"), ctx("ar"))!,
      changeText(loadChange(null, 25, 20, "assisted", "assisted"), ctx("ar"))!,
    ];
    for (const s of outs) {
      expect(s).toContain("كجم");
      expect(s).not.toMatch(/kg/);
      expect(s).toMatch(/\u2066[\d.]+\u2069/);
      expect(s).toContain(`${NBSP}كجم`);
    }
  });
  it("nothing to say for the same load or no spec", () => {
    expect(changeText(loadChange(bar, 80, 80, "barbell"), ctx("en"))).toBeNull();
    expect(changeText(loadChange(null, 80, 90, "barbell"), ctx("en"))).toBeNull();
  });
});
