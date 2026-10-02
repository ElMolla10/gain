import { describe, expect, it } from "vitest";
import type { TrendPoint } from "@gain/engine";
import { chartBars, directionKey, localDateText, MAX_BARS } from "../src/logic/trendChart";
import { en } from "../src/i18n/strings";

const pt = (i: number, load: number, imported = false): TrendPoint => ({ at: 1_000_000 * (i + 1), load, reps: 5, sets: 3, ...(imported ? { imported } : {}) });

describe("chart bars", () => {
  it("scales between the lowest and highest load so small gains stay visible; newest last", () => {
    const b = chartBars([pt(0, 60), pt(1, 62.5), pt(2, 65)], false);
    expect(b.map((x) => x.frac)).toEqual([0.15, 0.575, 1]);
    expect(b.map((x) => x.at)).toEqual([1_000_000, 2_000_000, 3_000_000]);
  });
  it("assisted lines: less assistance is a taller bar", () => {
    const b = chartBars([pt(0, 40), pt(1, 30), pt(2, 20)], true);
    expect(b[2]!.frac).toBe(1);
    expect(b[0]!.frac).toBe(0.15);
  });
  it("a flat history draws equal mid bars; empty draws nothing; only the last bars are shown; imported flagged", () => {
    expect(chartBars([pt(0, 60), pt(1, 60)], false).map((x) => x.frac)).toEqual([0.6, 0.6]);
    expect(chartBars([], false)).toEqual([]);
    const many = Array.from({ length: MAX_BARS + 10 }, (_, i) => pt(i, 50 + i, i === MAX_BARS + 9));
    const b = chartBars(many, false);
    expect(b).toHaveLength(MAX_BARS);
    expect(b[0]!.at).toBe(many[10]!.at);
    expect(b[b.length - 1]!.imported).toBe(true);
  });
});

describe("trend wording", () => {
  it("every direction has a string, and assisted lines get their own wording", () => {
    for (const d of ["better", "flat", "worse", "thin"] as const) {
      for (const a of [false, true]) expect(en[directionKey(d, a)]).toBeTruthy();
    }
    expect(directionKey("better", true)).toBe("trend.dir.betterAssisted");
    expect(directionKey("thin", true)).toBe("trend.dir.thin");
  });
  it("local date text is the local calendar day", () => {
    const d = new Date(2026, 8, 5, 0, 30); // local 00:30
    expect(localDateText(d.getTime())).toBe("2026-09-05");
  });
});
