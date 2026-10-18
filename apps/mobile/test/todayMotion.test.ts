import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { isBarTap, PAGER, pagerClaims, pagerCommit, pathPlan, runUnrack, stepDay, TODAY_MOTION } from "../src/logic/todayMotion";

describe("Today motion constants (spec §5)", () => {
  it("timings", () => {
    expect(TODAY_MOTION).toMatchObject({ unrackLift: 120, unrackLiftDp: 8, pagerSettle: 120, pagerSpringBack: 180, pathOpen: 240, pathClose: 180, pathStep: 48, pathHeroScale: 1.02, crossfade: 200 });
    expect(PAGER).toMatchObject({ claimDx: 24, angle: 2, edge: 20, commitShare: 0.3, commitVelocity: 0.3 });
  });
  it("Reduce Motion picks the crossfade (no scale, no stagger)", () => {
    expect(pathPlan(true, 4)).toEqual({ kind: "crossfade", duration: 200, heroScale: 1, stepDelays: [0, 0, 0, 0] });
    expect(pathPlan(false, 3)).toEqual({ kind: "full", duration: 240, heroScale: 1.02, stepDelays: [0, 48, 96] });
  });
});

describe("day pager", () => {
  it("claims only past 24 dp, angle-locked, away from both screen edges", () => {
    expect(pagerClaims({ dx: 30, dy: 10, x0: 200, width: 400 })).toBe(true);
    expect(pagerClaims({ dx: 20, dy: 0, x0: 200, width: 400 })).toBe(false);
    expect(pagerClaims({ dx: 30, dy: 16, x0: 200, width: 400 })).toBe(false);
    expect(pagerClaims({ dx: 60, dy: 0, x0: 10, width: 400 })).toBe(false);
    expect(pagerClaims({ dx: -60, dy: 0, x0: 390, width: 400 })).toBe(false);
  });
  it("commits past 30% or 0.3 dp/ms; toward the start edge is the next day (flips in RTL)", () => {
    expect(pagerCommit({ dx: -130, vx: 0, width: 400, rtl: false })).toBe(1);
    expect(pagerCommit({ dx: 130, vx: 0, width: 400, rtl: false })).toBe(-1);
    expect(pagerCommit({ dx: 130, vx: 0, width: 400, rtl: true })).toBe(1);
    expect(pagerCommit({ dx: -40, vx: -0.5, width: 400, rtl: false })).toBe(1);
    expect(pagerCommit({ dx: -40, vx: -0.1, width: 400, rtl: false })).toBe(0);
    expect(stepDay(0, -1, 4)).toBe(0);
    expect(stepDay(3, 1, 4)).toBe(3);
    expect(stepDay(1, 1, 4)).toBe(2);
    expect(isBarTap(5, 200)).toBe(true);
    expect(isBarTap(9, 200)).toBe(false);
  });
});

describe("unrack", () => {
  it("lift first, then at 120 ms unrack() fires BEFORE navigate; navigate is never awaited on the animation", () => {
    const order: string[] = [];
    const timers: [() => void, number][] = [];
    runUnrack({ reduced: false, lift: (ms) => order.push(`lift ${ms}`), haptic: () => order.push("unrack"), navigate: () => order.push("navigate"), later: (fn, ms) => timers.push([fn, ms]) });
    expect(order).toEqual(["lift 120"]);
    expect(timers[0]![1]).toBe(120);
    timers[0]![0]();
    expect(order).toEqual(["lift 120", "unrack", "navigate"]);
  });
  it("Reduce Motion: no lift, the haptic stays, navigate at once; a failing lift still navigates", () => {
    const order: string[] = [];
    runUnrack({ reduced: true, lift: () => order.push("lift"), haptic: () => order.push("unrack"), navigate: () => order.push("navigate"), later: vi.fn() });
    expect(order).toEqual(["unrack", "navigate"]);
    const o2: string[] = [];
    runUnrack({ reduced: false, lift: () => { throw new Error("x"); }, haptic: () => o2.push("unrack"), navigate: () => o2.push("navigate"), later: vi.fn() });
    expect(o2).toEqual(["unrack", "navigate"]);
  });
});

describe("native driver, no idle loops", () => {
  it("every Animated.timing in Today uses the native driver and nothing loops", () => {
    const src = join(__dirname, "..", "src");
    const files = [join(src, "screens", "TodayScreen.tsx"), ...readdirSync(join(src, "components", "today")).map((f) => join(src, "components", "today", f))];
    for (const f of files) {
      const s = readFileSync(f, "utf8");
      for (const m of s.matchAll(/Animated\.timing\([^)]*\)/g)) expect(m[0], f).toContain("useNativeDriver: true");
      expect(s, f).not.toMatch(/Animated\.loop/);
    }
  });
});
