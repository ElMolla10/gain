import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
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

describe("design: one identity (charcoal + mint), one type scale", () => {
  it("the logger and every screen share the same accent and background in both themes", () => {
    expect(logDarkPalette.blueFill).toBe(darkPalette.accent);
    expect(logLightPalette.blueFill).toBe(lightPalette.accent);
    expect(logDarkPalette.bg).toBe(darkPalette.bg);
    expect(logDarkPalette.card).toBe(darkPalette.card);
    expect(logLightPalette.bg).toBe(lightPalette.bg);
  });
  it("dark is charcoal (not black, not blue-tinted) and the accent is a mint green", () => {
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [r, g, b] = rgb(darkPalette.bg);
    expect(Math.max(r!, g!, b!)).toBeLessThan(0x30);
    expect(Math.max(r!, g!, b!)).toBeGreaterThan(0x0f);
    const [ar, ag, ab] = rgb(darkPalette.accent);
    expect(ag!).toBeGreaterThan(ar!);
    expect(ag!).toBeGreaterThan(ab!);
    expect(ab!).toBeGreaterThan(ar!); // mint: green with some blue, not lime
  });
  it("font sizes follow the scale: titles 28-32, sections 18-20, body 15-16, secondary 12-14", () => {
    const allowed = new Set([12, 13, 14, 15, 16, 18, 19, 20, 28, 30, 32]);
    const bad: string[] = [];
    for (const f of files) {
      readFileSync(f, "utf8").split("\n").forEach((ln, i) => {
        for (const m of ln.matchAll(/fontSize: ?(\d+)/g)) if (!allowed.has(Number(m[1]))) bad.push(`${f.slice(root.length + 1)}:${i + 1} ${m[1]}`);
      });
    }
    expect(bad).toEqual([]);
  });
  it("touch targets stay at 48 dp or more", () => {
    const m = /MIN_TOUCH = (\d+)/.exec(readFileSync(join(root, "src/theme.ts"), "utf8"));
    expect(Number(m![1])).toBeGreaterThanOrEqual(48);
  });
  it("the stock blue (#1f6feb / #2563eb / #5aa2ff) is gone from the app source", () => {
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
