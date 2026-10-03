import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gainTokens } from "../src/design/tokens";
import { parseAppearance, darkPalette, lightPalette, logDarkPalette, logLightPalette } from "../src/palettes";

const root = join(__dirname, "..");
const walk = (d: string, out: string[] = []): string[] => {
  for (const n of readdirSync(d)) {
    const f = join(d, n);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.tsx$/.test(n)) out.push(f);
  }
  return out;
};
const files = [...walk(join(root, "src")), join(root, "App.tsx")];

describe("design: one identity (lime + charcoal), one type scale", () => {
  it("the logger and every screen share the same fill and background in both themes", () => {
    expect(logDarkPalette.fill).toBe(darkPalette.fill);
    expect(logLightPalette.fill).toBe(lightPalette.fill);
    expect(logDarkPalette.bg).toBe(darkPalette.bg);
    expect(logDarkPalette.card).toBe(darkPalette.card);
    expect(logLightPalette.bg).toBe(lightPalette.bg);
    expect(logLightPalette.card).toBe(lightPalette.card);
  });
  it("the palettes are the kit's tokens: ink / surface / raised / border in dark, paper / white in light, lime fill in both", () => {
    const c = gainTokens.colors;
    expect(darkPalette.bg).toBe(c.ink);
    expect(darkPalette.card).toBe(c.surface);
    expect(darkPalette.raised).toBe(c.raised);
    expect(darkPalette.border).toBe(c.border);
    expect(darkPalette.text).toBe(c.text);
    expect(darkPalette.accent).toBe(c.lime);
    expect(darkPalette.fill).toBe(c.lime);
    expect(darkPalette.onFill).toBe(c.darkAccentText);
    expect(lightPalette.bg).toBe(c.lightBackground);
    expect(lightPalette.card).toBe(c.lightSurface);
    expect(lightPalette.text).toBe(c.lightText);
    expect(lightPalette.muted).toBe(c.lightMuted);
    expect(lightPalette.accent).toBe(c.lightAccentText); // lime is never used as text on paper
    expect(lightPalette.fill).toBe(c.lime);
    expect(lightPalette.onFill).toBe(c.darkAccentText);
  });
  it("dark is charcoal (not pure black, not blue-tinted) and the brand accent is lime", () => {
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [r, g, b] = rgb(darkPalette.bg);
    expect(Math.max(r!, g!, b!)).toBeLessThan(0x30);
    expect(Math.max(r!, g!, b!)).toBeGreaterThan(0x0f);
    const [ar, ag, ab] = rgb(darkPalette.fill);
    expect(ag!).toBeGreaterThan(ar!);
    expect(ar!).toBeGreaterThan(ab! * 3); // lime: yellow-green, almost no blue (not mint)
  });
  it("font sizes follow the kit's type scale (13 / 14 / 16 / 17 / 20 / 28 / 36 / 48)", () => {
    const allowed = new Set<number>([13, 14, 16, 17, 20, 28, 36, 48]);
    const bad: string[] = [];
    for (const f of files) {
      readFileSync(f, "utf8").split("\n").forEach((ln, i) => {
        for (const m of ln.matchAll(/fontSize: ?(\d+)/g)) if (!allowed.has(Number(m[1]))) bad.push(`${f.slice(root.length + 1)}:${i + 1} ${m[1]}`);
      });
    }
    expect(bad).toEqual([]);
  });
  it("touch targets stay at 48 dp or more", () => {
    expect(readFileSync(join(root, "src/theme.ts"), "utf8")).toContain("MIN_TOUCH = gainTokens.interaction.minTouchTarget");
    expect(gainTokens.interaction.minTouchTarget).toBeGreaterThanOrEqual(48);
    expect(gainTokens.interaction.inputHeight).toBeGreaterThanOrEqual(48);
  });
  it("the earlier mint (#78e2b0-ish) and stock blue are gone from the app source", () => {
    for (const f of [...files, join(root, "src/palettes.ts")]) {
      expect(readFileSync(f, "utf8").toLowerCase(), f).not.toMatch(/#1f6feb|#2563eb|#5aa2ff|#1d5fd0|#1558c0/);
    }
  });
  it("appearance defaults to dark; light and system are opt-in", () => {
    expect(parseAppearance(null)).toBe("dark");
    expect(parseAppearance("junk")).toBe("dark");
    expect(parseAppearance("light")).toBe("light");
    expect(parseAppearance("system")).toBe("system");
  });
});
