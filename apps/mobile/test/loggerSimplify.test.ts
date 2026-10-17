import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ar, en } from "../src/i18n/strings";

const src = (f: string) => readFileSync(join(__dirname, "..", "src", f), "utf8");

describe("simplified logger (presentation wiring)", () => {
  it("has a visible pause / resume workout control wired to the existing duration pause", () => {
    const screen = src("screens/WorkoutScreen.tsx");
    expect(screen).toContain('t("workout.resume") : t("workout.pause")');
    expect(screen).toMatch(/QuietAction[^\n]*workout\.pause[^\n]*onPress=\{\(\) => void toggleDurationPause\(\)\}/);
    // The rest dock keeps its own start/stop, independent of the workout pause.
    expect(screen).toContain("startTimer(tm, Date.now())");
  });
  it("the rest preference can also be switched in Settings", () => {
    expect(src("screens/SettingsScreen.tsx")).toContain('save("auto", on ? "1" : "0"');
  });
  it("new strings exist in English and Arabic", () => {
    for (const k of ["workout.loads", "workout.nextSetDetails", "workout.pause", "workout.resume", "rest.auto"] as const) {
      expect(en[k]).toBeTruthy();
      expect(ar[k]).toBeTruthy();
      expect(ar[k]).not.toBe(en[k]);
    }
  });
});
