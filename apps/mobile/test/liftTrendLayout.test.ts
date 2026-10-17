import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TrendPoint } from "@gain/engine";
import { chartBars } from "../src/logic/trendChart";
import { en, ar } from "../src/i18n/strings";

// Plan 2.6 (H-4, H-5): the number first, and a chart you can read in grayscale.
const src = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");
const pt = (i: number, load: number, imported = false): TrendPoint => ({ at: 1_000_000 * (i + 1), load, reps: 5, sets: 3, ...(imported ? { imported } : {}) });

describe("lift trend order", () => {
  const f = src("screens/LiftTrendView.tsx");
  const at = (needle: string) => {
    const i = f.indexOf(needle);
    expect(i, needle).toBeGreaterThan(-1);
    return i;
  };
  it("latest top set → direction → chart → personal path → 'What this shows'", () => {
    const big = at('fontSize: ty.load, fontWeight: "600", fontVariant: ["tabular-nums"], textAlign: "auto" }}>{setText(trend.latest)}');
    const dir = at("{t(directionKey(trend.direction, assisted))}</AppText>");
    const chart = at("<TrendChart");
    const path = at('{t("path.title")}');
    const what = at('t("trend.whatShows")');
    expect(big).toBeLessThan(dir);
    expect(dir).toBeLessThan(chart);
    expect(chart).toBeLessThan(path);
    expect(path).toBeLessThan(what);
  });
  it("the explanation sits behind a '?' with an expanded state", () => {
    expect(f).toMatch(/<QuietAction label="\?" accessibilityLabel=\{t\("trend\.whatShows"\)\} expanded=\{explainOpen\}/);
    expect(f).toMatch(/\{explainOpen \? <AppText[^>]*>\{timed \? t\("trend\.timedMeasure"\)/);
    expect(ar["trend.whatShows"]).toMatch(/[\u0600-\u06FF]/);
  });
});

describe("trend chart styles", () => {
  const c = src("components/TrendChart.tsx");
  it("logged bars are solid accent (latest full, others 55%), imported bars are a dashed outline with no fill", () => {
    expect(c).toContain('{ borderWidth: 2, borderStyle: "dashed" as const, borderColor: p.accent, backgroundColor: "transparent" }');
    expect(c).toContain("{ backgroundColor: p.accent, opacity: i === lastIndex ? 1 : 0.55 }");
    expect(c).not.toContain("p.tint");
    expect(c).toMatch(/direction: "ltr"/);
  });
  it("the best and the latest bar carry a tabular value label", () => {
    expect(c).toContain("const labelled = valueText && (i === lastIndex || i === bestIndex);");
    expect(c).toMatch(/fontSize: ty\.caption, lineHeight: LABEL, fontVariant: \["tabular-nums"\]/);
    expect(src("screens/LiftTrendView.tsx")).toMatch(/valueText=\{\(v, byQuantity\) => isolateLtr\(/);
  });
  it("bars carry their value for the labels", () => {
    expect(chartBars([pt(0, 60), pt(1, 65, true)], false).map((b) => [b.value, b.imported])).toEqual([[60, false], [65, true]]);
  });
  it("the legend describes the new styles", () => {
    expect(en["trend.chartHint"]).toContain("dashed");
    expect(ar["trend.chartHint"]).toContain("متقطّع");
  });
});
