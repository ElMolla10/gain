import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FONT_FAMILIES, faceFor, familyFor, hasArabic, scaleFor, textOf } from "../src/fonts";
import { ar, en } from "../src/i18n/strings";
import { darkPalette, lightPalette } from "../src/palettes";

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("bundled fonts (IBM Plex Sans + IBM Plex Sans Arabic, OFL)", () => {
  const files = ["IBMPlexSans_400Regular", "IBMPlexSans_600SemiBold", "IBMPlexSans_700Bold", "IBMPlexSansArabic_400Regular", "IBMPlexSansArabic_600SemiBold", "IBMPlexSansArabic_700Bold"];
  it("ships the six TTFs and the licence inside the app, and registers them in app.json (no runtime download)", () => {
    const cfg = JSON.parse(read("app.json"));
    const plugin = cfg.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-font");
    expect(plugin).toBeTruthy();
    for (const f of files) {
      const p = join(root, "assets", "fonts", `${f}.ttf`);
      expect(existsSync(p), f).toBe(true);
      expect(statSync(p).size, f).toBeGreaterThan(30_000);
      expect(JSON.stringify(plugin)).toContain(`${f}.ttf`);
    }
    expect(read("assets/fonts/OFL-LICENSE.txt")).toContain("SIL OPEN FONT LICENSE");
  });
  it("never fetches fonts at runtime", () => {
    expect(read("src/useBrandFonts.ts")).not.toMatch(/https?:\/\/|fetch\(/);
  });
  it("maps CSS weights to the three bundled faces", () => {
    expect(faceFor("400")).toBe("regular");
    expect(faceFor(undefined)).toBe("regular");
    expect(faceFor("500")).toBe("regular");
    expect(faceFor("600")).toBe("semibold");
    expect(faceFor("700")).toBe("semibold");
    expect(faceFor("bold")).toBe("bold");
    expect(faceFor("800")).toBe("bold");
    expect(familyFor({ weight: "600", arabic: false })).toBe(FONT_FAMILIES.latin.semibold);
    expect(familyFor({ weight: "400", arabic: true })).toBe(FONT_FAMILIES.arabic.regular);
  });
  it("picks the Arabic face for Arabic text, also inside English strings", () => {
    expect(hasArabic("Bench Press")).toBe(false);
    expect(hasArabic("بنش برس")).toBe(true);
    expect(hasArabic("Row · سحب")).toBe(true);
    expect(textOf(["80", " × ", 5])).toBe("80 × 5");
  });
  it("Arabic body text is larger and taller than Latin at the same token size; sizes are never below the token", () => {
    expect(scaleFor(16, false)).toEqual({ fontSize: 16, lineHeight: 24 });
    expect(scaleFor(16, true).fontSize).toBeGreaterThan(16);
    expect(scaleFor(16, true).lineHeight).toBeGreaterThan(24);
    expect(scaleFor(28, true).lineHeight).toBeGreaterThanOrEqual(40);
    for (const s of [13, 14, 16, 20, 28, 36, 48]) expect(scaleFor(s, true).fontSize).toBeGreaterThanOrEqual(s);
  });
});

describe("icons", () => {
  // Icon.tsx imports react-native-svg, which the node test runner cannot load: check the registry from its source.
  const src = read("src/components/Icon.tsx");
  it("every navigation icon is drawn", () => {
    for (const k of ["today", "plan", "progress", "settings"]) expect(src, k).toMatch(new RegExp(`\\n  ${k}: \\[`));
  });
  it("every icon name in the union has a drawing", () => {
    const union = src.slice(src.indexOf("export type IconName"), src.indexOf("type Shape"));
    const names = [...union.matchAll(/"(\w+)"/g)].map((m) => m[1]!);
    expect(names.length).toBeGreaterThan(15);
    for (const n of names) expect(src, n).toMatch(new RegExp(`\\n  ${n}: \\[`));
  });
});

describe("contrast of the identity pairs (kit CONTRAST.md)", () => {
  it("lime on ink, ink on lime, and the light-theme accent text", () => {
    expect(contrast("#B7F51B", "#10120E")).toBeGreaterThan(10);
    expect(contrast(darkPalette.onFill, darkPalette.fill)).toBeGreaterThan(10);
    expect(contrast(lightPalette.accent, lightPalette.bg)).toBeGreaterThanOrEqual(7);
    expect(contrast(lightPalette.onFill, lightPalette.fill)).toBeGreaterThan(10);
  });
});

describe("brand assets", () => {
  it("launcher, adaptive layers, splash, notification and logo files exist", () => {
    for (const f of ["icon.png", "adaptive-icon-foreground.png", "adaptive-icon-background.png", "adaptive-icon-monochrome.png", "splash-icon.png", "notification-icon.png", "favicon.png", "gain-logo.png"]) {
      expect(existsSync(join(root, "assets", f)), f).toBe(true);
    }
    const cfg = JSON.parse(read("app.json")).expo;
    expect(cfg.android.adaptiveIcon.monochromeImage).toBeTruthy();
  });
});

describe("design strings", () => {
  it("saved-locally and synced are separate messages in both languages", () => {
    for (const lang of [en, ar] as Record<string, string>[]) {
      expect(lang["status.savedLocal"]).toBeTruthy();
      expect(lang["status.synced"]).toBeTruthy();
      expect(lang["status.savedLocal"]).not.toBe(lang["status.synced"]);
    }
  });
  it("the History tab is labelled Progress and keeps its route", () => {
    expect(en["tab.history"]).toBe("Progress");
    expect(read("App.tsx")).toContain('name="History"');
  });
});
