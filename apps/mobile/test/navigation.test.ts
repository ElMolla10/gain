import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { darkPalette, lightPalette, logDarkPalette, logLightPalette, navColors } from "../src/palettes";
import { ar, en } from "../src/i18n/strings";

const app = readFileSync(join(__dirname, "..", "App.tsx"), "utf8");

describe("P09 navigation", () => {
  it("every tab declares an explicit icon (no default/broken glyph)", () => {
    const tabs = app.match(/<Tab\.Screen [^\n]*/g) ?? [];
    expect(tabs.length).toBe(4);
    for (const t of tabs) expect(t).toMatch(/tabBarIcon: icon\("(today|plan|progress|trophy)"\)/);
  });
  it("the Program tab is labelled Plan in English and has a short Arabic draft label", () => {
    expect(en["tab.programme"]).toBe("Plan");
    expect(ar["tab.programme"].length).toBeLessThanOrEqual(8);
    expect(ar["tab.programme"]).not.toBe(en["tab.programme"]);
  });
  it("navigation and the workout logger share the one primary accent", () => {
    expect(navColors(lightPalette).primary).toBe(lightPalette.accent);
    expect(navColors(darkPalette).primary).toBe(darkPalette.accent);
    expect(logLightPalette.fill).toBe(lightPalette.fill);
    expect(logDarkPalette.fill).toBe(darkPalette.fill);
    expect(logLightPalette.accent).toBe(lightPalette.accent);
    expect(logDarkPalette.accent).toBe(darkPalette.accent);
  });
  it("Achievements is the 4th tab and Settings is a stack screen", () => {
    expect(app).toContain('<Tab.Screen name="Achievements"');
    expect(app).toContain('<Stack.Screen name="Settings"');
  });
  it("the navigation container receives the palette theme, not the stock blue one", () => {
    expect(app).toContain("theme={navTheme}");
    expect(app).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});

describe("Plan tab secondary views", () => {
  it("exposure and versions are their own screens, not part of the Plan tab", () => {
    const plan = readFileSync(join(__dirname, "..", "src", "screens", "ProgrammeScreen.tsx"), "utf8");
    expect(app).toContain('name="ProgrammeExposure"');
    expect(app).toContain('name="ProgrammeVersions"');
    expect(plan).not.toContain("ExposureView");
    expect(plan).toContain('navigate("ProgrammeExposure")');
  });
});

describe("Finish recap cannot be swiped away (iOS audit 12)", () => {
  it("the Finish screen hides the back button and disables the iOS swipe-back gesture", () => {
    const line = app.match(/<Stack\.Screen name="Finish"[^\n]*/)?.[0] ?? "";
    expect(line).toMatch(/headerBackVisible: false/);
    expect(line).toMatch(/gestureEnabled: false/);
  });
});
