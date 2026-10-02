import { describe, expect, it } from "vitest";
import { effectiveLoad, epley, lineKey, median, sameLine, sortNewestFirst, splitComparable } from "./line";
import { lineOf, session, sets } from "./testkit";

describe("lines", () => {
  it("the same exercise at two gyms is two lines", () => {
    expect(sameLine(lineOf("bench"), lineOf("bench", "free", "home"))).toBe(false);
  });
  it("free, assisted and bodyweight setups never share a line", () => {
    const keys = new Set(
      (["free", "assisted", "bodyweight_plus_added"] as const).map((s) => lineKey(lineOf("pullup", s))),
    );
    expect(keys.size).toBe(3);
  });
  it("splitComparable separates other gyms and setups", () => {
    const line = lineOf("pullup", "assisted");
    const h = [
      session(line, "2026-09-01", sets(30, 8)),
      session(lineOf("pullup", "free"), "2026-09-02", sets(0, 8)),
      session(lineOf("pullup", "assisted", "home"), "2026-09-03", sets(30, 8)),
    ];
    const r = splitComparable(line, h);
    expect(r.comparable).toHaveLength(1);
    expect(r.incomparable).toHaveLength(2);
  });
  it("sortNewestFirst puts unparseable dates last and does not mutate", () => {
    const a = [{ performedAt: "garbage" }, { performedAt: "2026-01-01" }, { performedAt: "2026-02-01" }];
    const s = sortNewestFirst(a);
    expect(s.map((x) => x.performedAt)).toEqual(["2026-02-01", "2026-01-01", "garbage"]);
    expect(a[0]!.performedAt).toBe("garbage");
  });
  it("effectiveLoad needs a bodyweight for non-free setups and never guesses", () => {
    expect(effectiveLoad("free", 50)).toBe(50);
    expect(effectiveLoad("bodyweight_plus_added", 10)).toBeNull();
    expect(effectiveLoad("bodyweight_plus_added", 10, 80)).toBe(90);
    expect(effectiveLoad("assisted", 30, 80)).toBe(50);
    expect(effectiveLoad("assisted", 30, 0)).toBeNull();
  });
  it("epley and median", () => {
    expect(epley(100, 1)).toBe(100);
    expect(epley(100, 3)).toBeCloseTo(110);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});
