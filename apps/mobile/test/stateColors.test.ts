import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { progressColors, switchColors } from "../src/logic/stateColors";
import { darkPalette, lightPalette } from "../src/palettes";

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

const src = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");

describe("light-mode state cues (plan 1.3)", () => {
  it("light switch: accent on-track, edge off-track, iOS background = off-track, white thumb", () => {
    for (const on of [true, false]) {
      const s = switchColors(lightPalette, true, on);
      expect(s.trackOn).toBe(lightPalette.accent);
      expect(s.trackOff).toBe(lightPalette.edge);
      expect(s.iosBackground).toBe(s.trackOff);
      expect(s.thumb.toUpperCase()).toBe("#FFFFFF");
    }
    expect(contrast(lightPalette.accent, lightPalette.card)).toBeGreaterThanOrEqual(3);
    expect(contrast(lightPalette.accent, lightPalette.bg)).toBeGreaterThanOrEqual(3);
  });
  it("dark switch keeps the lime look", () => {
    expect(switchColors(darkPalette, false, true)).toMatchObject({ trackOn: darkPalette.fill, trackOff: darkPalette.edge, thumb: darkPalette.onFill, iosBackground: darkPalette.edge });
    expect(switchColors(darkPalette, false, false).thumb).toBe(darkPalette.card);
  });
  it("onboarding progress: accent active, faded edge inactive, 6 dp in light; dark unchanged", () => {
    expect(progressColors(lightPalette, true)).toEqual({ active: lightPalette.accent, inactive: lightPalette.edge, inactiveOpacity: 0.4, height: 6 });
    expect(progressColors(darkPalette, false)).toEqual({ active: darkPalette.fill, inactive: darkPalette.border, inactiveOpacity: 1, height: 4 });
  });
  it("the active tab pill has an accent border that reads on the tab bar in both themes", () => {
    const app = src("App.tsx");
    expect(app).toContain('borderWidth: 1.5, borderColor: focused ? p.accent : "transparent"');
    for (const p of [lightPalette, darkPalette]) expect(contrast(p.accent, p.card)).toBeGreaterThanOrEqual(3);
  });
  it("the components use the helpers", () => {
    expect(src("src/components/SettingsRows.tsx")).toContain("ios_backgroundColor={sw.iosBackground}");
    expect(src("src/screens/OnboardingScreen.tsx")).toContain("progressColors(p, !useIsDark())");
  });
});
