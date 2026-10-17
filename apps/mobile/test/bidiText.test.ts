import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hasArabic, ltrAllowed } from "../src/fonts";
import { FSI, LRI, PDI, isolateParam, translate } from "../src/i18n/format";
import { EN_DASH, loadTargetText, plannedScheme, previousCellText, targetRowText } from "../src/logic/bidiText";

const L = { s: "s", m: "m" };
const iso = (s: string) => `${LRI}${s}${PDI}`;

describe("bidi-safe target strings (T-1, F-2, L-10)", () => {
  it("builds the load like the logger: formatLoad (number isolated, unit in the language) × isolated reps, never wrapped whole", () => {
    expect(loadTargetText(40, 9, "reps", "en", "kg", L)).toBe(`${iso("40")} kg × ${iso("9")}`);
    const ar = loadTargetText(40, 9, "reps", "ar", "kg", L);
    expect(ar).toBe(`${iso("40")} كجم × ${iso("9")}`);
    // The whole string is NOT one LTR isolate (that is what laid it out as "كجم × 9 40").
    expect(ar.startsWith(LRI + LRI)).toBe(false);
    expect(ar.endsWith(PDI + PDI)).toBe(false);
  });
  it("timed targets: loaded carries keep the unit in the language; a bare hold is one isolated quantity", () => {
    expect(loadTargetText(24, 30, "distance", "ar", "kg", { s: "ث", m: "م" })).toBe(`${iso("24")} كجم × ${iso("30 م")}`);
    expect(loadTargetText(0, 45, "time", "en", "kg", L)).toBe(iso("45 s"));
  });
  it("target rows pick reps / seconds / metres by measure and respect lb", () => {
    expect(targetRowText({ measure: "reps", reps: 8, effectiveLoad: 72.5 }, "en", "kg", L)).toBe(`${iso("72.5")} kg × ${iso("8")}`);
    expect(targetRowText({ measure: "time", reps: null, durationS: 45, effectiveLoad: 0 }, "en", "kg", L)).toBe(iso("45 s"));
    expect(targetRowText({ measure: "reps", reps: 5, effectiveLoad: 100 }, "ar", "lb", L)).toBe(`${iso("220.5")} باوند × ${iso("5")}`);
  });
});

describe("planned scheme (T-2)", () => {
  it("isolates only the scheme and uses an en dash U+2013 with no spaces", () => {
    expect(EN_DASH).toBe("\u2013");
    expect(plannedScheme(3, 6, 10, "reps", L)).toBe(iso("3 × 6–10"));
    expect(plannedScheme(3, 30, 45, "time", L)).toBe(iso("3 × 30–45 s"));
    expect(plannedScheme(3, 6, 10, "reps", L)).not.toMatch(/-/);
  });
});

describe("previous cell (L-3)", () => {
  const last = [{ load: 55, reps: 10 }, { load: 20, reps: 0, durationS: 35 }];
  it("is unitless pure digits, so it reads '55 × 10' in both languages and may be drawn ltr", () => {
    const s = previousCellText(last, 0, "reps", "kg", L);
    expect(s).toBe(iso("55 × 10"));
    expect(hasArabic(s)).toBe(false);
    expect(previousCellText(last, 1, "time", "kg", L)).toBe(iso("20 × 35 s"));
    expect(previousCellText(last, 5, "reps", "kg", L)).toBe("—");
    expect(previousCellText(null, 0, "reps", "kg", L)).toBe("—");
  });
});

describe("S-1: ltr only for text with no Arabic letters", () => {
  it("ltrAllowed refuses any child holding an Arabic letter", () => {
    expect(ltrAllowed("12:30")).toBe(true);
    expect(ltrAllowed(["55", " × ", 10])).toBe(true);
    expect(ltrAllowed(`${iso("40")} كجم`)).toBe(false);
    expect(ltrAllowed(["الجاية: ", "60"])).toBe(false);
  });
  it("translate never forces LTR on a value that already holds Arabic: it gets a first-strong isolate", () => {
    expect(isolateParam("60")).toBe(iso("60"));
    const load = `${iso("60")} كجم`;
    expect(isolateParam(load)).toBe(`${FSI}${load}${PDI}`);
    expect(translate("ar", "dec.target", { load, reps: iso("8") })).not.toContain(`${LRI}${load}`);
  });
  it("source audit: no `<AppText ltr>` renders a translation, a formatted load or the unit word (all can hold Arabic)", () => {
    const root = join(__dirname, "..", "src");
    const walk = (d: string, out: string[] = []): string[] => {
      for (const n of readdirSync(d)) {
        const f = join(d, n);
        if (statSync(f).isDirectory()) walk(f, out);
        else if (n.endsWith(".tsx")) out.push(f);
      }
      return out;
    };
    const bad: string[] = [];
    for (const f of walk(root)) {
      const src = readFileSync(f, "utf8");
      const re = /<AppText\b[^>]*\bltr(?:=\{true\})?[\s>][^]*?<\/AppText>/g;
      for (const m of src.matchAll(re)) {
        const el = m[0];
        // The brand name is Latin in both languages.
        const body = el.replace(/t\("app\.name"\)/g, "");
        if (/\bt\(|\bfmt\(|formatLoad\(|unitText|unitLabel\(|plates?\.text|\.text\}/.test(body)) bad.push(`${f.replace(root, "src")}: ${el.slice(0, 120)}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("A-R1: loads never wrap away from their unit or reps (U+00A0)", () => {
  it("formatLoad, loadTargetText, the scheme and the Previous cell use no-break spaces", async () => {
    const { formatLoad, NBSP } = await import("../src/i18n/format");
    expect(NBSP).toBe("\u00A0");
    for (const s of [formatLoad(57.5, "ar", "kg"), formatLoad(57.5, "en", "lb"), loadTargetText(45, 8, "reps", "ar", "kg", L), plannedScheme(3, 6, 10, "reps", L)]) {
      expect(s.replace(/[\u2066-\u2069]/g, "")).not.toMatch(/ /);
    }
    expect(loadTargetText(45, 8, "reps", "ar", "kg", L)).toMatch(/\u00A0×\u00A0/);
  });
});
