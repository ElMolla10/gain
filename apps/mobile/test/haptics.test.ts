import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ os: "ios", vibrate: vi.fn(), impact: vi.fn(async () => {}), selection: vi.fn(async () => {}), notification: vi.fn(async () => {}) }));
vi.mock("react-native", () => ({ Platform: { get OS() { return state.os; } }, Vibration: { vibrate: state.vibrate } }));
vi.mock("expo-haptics", () => ({ impactAsync: state.impact, selectionAsync: state.selection, notificationAsync: state.notification, ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" }, NotificationFeedbackType: { Success: "success" } }));
import { haptics } from "../src/haptics";

const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");
beforeEach(() => vi.clearAllMocks());

describe("haptics (iOS audit 7)", () => {
  it("iOS uses expo-haptics", () => {
    state.os = "ios";
    haptics.tick(); haptics.untick(); haptics.restOver(); haptics.celebrate();
    expect(state.impact).toHaveBeenCalledWith("light");
    expect(state.selection).toHaveBeenCalled();
    expect(state.notification).toHaveBeenCalledTimes(2);
    expect(state.vibrate).not.toHaveBeenCalled();
  });
  it("Android: tick/untick do nothing, rest over and celebrate keep the old vibrations", () => {
    state.os = "android";
    haptics.tick(); haptics.untick();
    expect(state.impact).not.toHaveBeenCalled();
    expect(state.selection).not.toHaveBeenCalled();
    haptics.restOver(); haptics.celebrate();
    expect(state.vibrate.mock.calls).toEqual([[400], [40]]);
  });
  it("earn moment: land is iOS Medium, legacy is iOS Heavy; Android stays silent for both", () => {
    state.os = "ios";
    haptics.land(); haptics.legacy();
    expect(state.impact.mock.calls).toEqual([["medium"], ["heavy"]]);
    state.os = "android";
    vi.clearAllMocks();
    haptics.land(); haptics.legacy();
    expect(state.impact).not.toHaveBeenCalled();
    expect(state.vibrate).not.toHaveBeenCalled();
  });
  it("a failing native module never throws", () => {
    state.os = "ios";
    state.impact.mockRejectedValueOnce(new Error("x"));
    expect(() => haptics.tick()).not.toThrow();
  });
  it("the tick and set-type buttons give haptics before the action and react when pressed; rest/hero use haptics", () => {
    const row = read("src/components/WorkoutSetRow.tsx");
    expect(row).toMatch(/haptics\.untick\(\); onUntick\(row\);/);
    expect(row).toMatch(/haptics\.tick\(\); onLog\(row\);/);
    expect(row.match(/style=\{\(\{ pressed \}\) =>/g)?.length).toBeGreaterThanOrEqual(2);
    expect(read("src/hooks/useWorkoutRest.ts")).toMatch(/if \(rest\.vibrate\) haptics\.restOver\(\);/);
    expect(read("src/components/achievements/EarnMoment.tsx")).toMatch(/haptics\.celebrate\(\);/);
  });
});
