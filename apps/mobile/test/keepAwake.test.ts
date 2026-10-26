import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ar, en } from "../src/i18n/strings";
import { KEEP_AWAKE_KEY, keepAwakeSetting, shouldKeepAwake } from "../src/logic/keepAwake";

const src = (f: string) => readFileSync(join(__dirname, "../src", f), "utf8");

describe("keep the screen awake during a workout (batch item 28)", () => {
  it("only when the setting is on, the logger is focused and a session is open", () => {
    for (const setting of [true, false]) for (const focused of [true, false]) for (const sessionOpen of [true, false])
      expect(shouldKeepAwake({ setting, focused, sessionOpen })).toBe(setting && focused && sessionOpen);
  });

  it("unset counts as on; '0' is off", () => {
    expect(KEEP_AWAKE_KEY).toBe("workout_keep_awake");
    expect(keepAwakeSetting(null)).toBe(true);
    expect(keepAwakeSetting(undefined)).toBe(true);
    expect(keepAwakeSetting("1")).toBe(true);
    expect(keepAwakeSetting("0")).toBe(false);
    expect(shouldKeepAwake({ setting: null, focused: true, sessionOpen: true })).toBe(true);
    expect(shouldKeepAwake({ setting: "0", focused: true, sessionOpen: true })).toBe(false);
  });

  it("uses expo-keep-awake with its own tag, releases on blur/unmount, after finish and after discard", () => {
    const k = src("keepAwake.ts");
    expect(k).toContain('from "expo-keep-awake"');
    expect(k).toContain("deactivateKeepAwake(KEEP_AWAKE_TAG)");
    expect(k).toContain('diagnostics.record("warn", "keep awake", e)');
    const screen = src("screens/WorkoutScreen.tsx");
    expect(screen).toContain("useIsFocused()");
    expect(screen).toContain("return () => setKeepAwake(false);");
    const hook = src("hooks/useWorkoutSession.ts");
    expect(hook.match(/setKeepAwake\(false\)/g)?.length).toBe(2);
    expect(JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8")).dependencies["expo-keep-awake"]).toBe("~57.0.2");
  });

  it("Settings switch and strings in EN and AR", () => {
    expect(src("screens/SettingsScreen.tsx")).toContain('label={t("workout.keepAwake")}');
    expect(en["workout.keepAwake"]).toBe("Keep screen on during workouts");
    expect(ar["workout.keepAwake"]).toBe("خلي الشاشة شغالة أثناء التمرين");
    expect(en["workout.keepAwake.note"]).toContain("won't lock");
    expect(ar["workout.keepAwake.note"]).toContain("مش هيقفل");
  });
});
