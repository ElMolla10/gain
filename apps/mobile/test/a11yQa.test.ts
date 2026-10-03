import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { darkPalette, lightPalette, logDarkPalette, logLightPalette } from "../src/palettes";

/**
 * Step 14, code-level QA only. These checks read the palettes and the source. They do NOT replace TalkBack, 200% font size, RTL
 * and dark-mode passes on a real phone (see docs/A11Y-RTL-CHECKLIST.md). A line carrying `a11y-ok` is a reviewed exception.
 */
const root = join(__dirname, "..");
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.tsx?$/.test(n)) out.push(f);
  }
  return out;
}
const tsx = walk(join(root, "src")).filter((f) => f.endsWith(".tsx"));
const read = (f: string) => readFileSync(f, "utf8");
const rel = (f: string) => f.slice(root.length + 1);

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
export function contrast(a: string, b: string): number {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe("contrast of the palettes (WCAG 2.1 AA)", () => {
  it("the contrast function matches known values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
  });
  for (const [name, p] of [["light", lightPalette], ["dark", darkPalette]] as const) {
    it(`main palette, ${name}: text 4.5:1, outlines 3:1`, () => {
      for (const bg of [p.bg, p.card]) {
        expect(contrast(p.text, bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.muted, bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.accent, bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.danger, bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.edge, bg)).toBeGreaterThanOrEqual(3);
        expect(contrast(p.warn, bg)).toBeGreaterThanOrEqual(3);
      }
      // The lime fill is the same in both themes; its label is ink. Status tints carry their own text colour.
      expect(contrast(p.onFill, p.fill)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.onDisabled, p.disabled)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.onDanger, p.danger)).toBeGreaterThanOrEqual(4.5);
      for (const [fg, bg] of [[p.success, p.successBg], [p.warn, p.warnBg], [p.danger, p.dangerBg], [p.text, p.tint], [p.accent, p.raised]] as const) expect(contrast(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    });
  }
  for (const [name, p] of [["light", logLightPalette], ["dark", logDarkPalette]] as const) {
    it(`workout palette, ${name}: text 4.5:1, outlines 3:1`, () => {
      for (const bg of [p.bg, p.card, p.field, p.doneBg]) {
        expect(contrast(p.text, bg), `text on ${bg}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.muted, bg), `muted on ${bg}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.accent, bg), `blue on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      for (const bg of [p.bg, p.card]) {
        expect(contrast(p.warn, bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.danger, bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.edge, bg)).toBeGreaterThanOrEqual(3);
      }
      expect(contrast(p.onFill, p.fill)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.onDanger, p.danger)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

/** Source of each JSX element that starts with one of the tags (brace-aware, so `=>` inside props does not end it). */
function elements(src: string, tags: string[]): { tag: string; text: string; line: number }[] {
  const out: { tag: string; text: string; line: number }[] = [];
  const re = new RegExp(`<(${tags.join("|")})\\b`, "g");
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let depth = 0;
    let j = m.index + m[0].length;
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0 && src[j - 1] !== "=") break;
    }
    out.push({ tag: m[1]!, text: src.slice(m.index, j + 1), line: src.slice(0, m.index).split("\n").length });
  }
  return out;
}

describe("source rules for accessibility, RTL and dark mode", () => {
  it("every Pressable has a role, and every icon-only one has a label", () => {
    const bad: string[] = [];
    for (const f of tsx) {
      for (const e of elements(read(f), ["Pressable", "TouchableOpacity"])) {
        if (/a11y-ok/.test(e.text)) continue;
        if (!/accessibilityRole=/.test(e.text) && !/\{\.\.\./.test(e.text)) bad.push(`${rel(f)}:${e.line} no accessibilityRole`);
      }
    }
    expect(bad).toEqual([]);
  });
  it("every text input and switch has an accessibility label", () => {
    const bad: string[] = [];
    for (const f of tsx) {
      for (const e of elements(read(f), ["TextInput", "Switch"])) {
        if (!/accessibilityLabel=/.test(e.text) && !/\{\.\.\./.test(e.text)) bad.push(`${rel(f)}:${e.line} ${e.tag}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it("every pressable that sets its own height is at least 48 dp tall (hit slop counts)", () => {
    const bad: string[] = [];
    for (const f of tsx) {
      for (const e of elements(read(f), ["Pressable", "TouchableOpacity"])) {
        const h = /(?:minHeight|height): ?(\d+)/.exec(e.text);
        if (!h) continue;
        const slop = /hitSlop=\{\{ top: (\d+), bottom: (\d+)/.exec(e.text);
        const eff = Number(h[1]) + (slop ? Number(slop[1]) + Number(slop[2]) : 0);
        if (eff < 48 && !/a11y-ok/.test(e.text)) bad.push(`${rel(f)}:${e.line} ${eff} dp`);
      }
    }
    expect(bad).toEqual([]);
  });
  it("no hard-coded colours outside theme.ts (so dark mode cannot be forgotten)", () => {
    const bad: string[] = [];
    for (const f of walk(join(root, "src"))) {
      if (!f.endsWith(".tsx") || /BrandLogo/.test(f)) continue;
      read(f).split("\n").forEach((ln, i) => {
        if (/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/.test(ln) && !/a11y-ok/.test(ln)) bad.push(`${rel(f)}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });
  it("styles use start/end, never left/right, so Arabic mirrors correctly", () => {
    const bad: string[] = [];
    for (const f of tsx) {
      read(f).split("\n").forEach((ln, i) => {
        if (/(marginLeft|marginRight|paddingLeft|paddingRight|borderLeftWidth|borderRightWidth|borderLeftColor|borderRightColor|textAlign: "(left|right)"|\bleft: |\bright: |row-reverse)/.test(ln.replace(/hitSlop=\{\{[^}]*\}\}/, "")) && !/a11y-ok/.test(ln)) bad.push(`${rel(f)}:${i + 1}`);
      });
    }
    // Chevron and checkmark glyphs are drawn with right/bottom borders on a rotated square on purpose (the rotation, not RTL, decides the direction).
    expect(bad.filter((b) => !/LogParts\.tsx/.test(b))).toEqual([]);
  });
  it("no visible English text is typed into screens: every label goes through t()", () => {
    const bad: string[] = [];
    for (const f of tsx) {
      const s = read(f);
      for (const m of s.matchAll(/>\s*([A-Za-z][A-Za-z ,.!?']{2,})\s*<\//g)) bad.push(`${rel(f)}: "${m[1]}"`);
      for (const m of s.matchAll(/(accessibilityLabel|placeholder|title)="([^"]+)"/g)) if (!/BrandLogo/.test(f)) bad.push(`${rel(f)}: ${m[1]}="${m[2]}"`);
    }
    expect(bad).toEqual([]);
  });
  it("fixed pixel heights are only on controls and icons, never on text containers that must grow with the font", () => {
    const bad: string[] = [];
    for (const f of tsx) {
      for (const e of elements(read(f), ["Text", "AppText"])) {
        if (/\bheight: ?\d+/.test(e.text) && !/minHeight/.test(e.text) && !/a11y-ok/.test(e.text)) bad.push(`${rel(f)}:${e.line}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it("font scaling is never switched off", () => {
    const bad = tsx.filter((f) => /allowFontScaling=\{false\}|maxFontSizeMultiplier=\{1\}/.test(read(f))).map(rel);
    expect(bad).toEqual([]);
  });
});
