import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatDay, formatNumber, toWesternDigits } from "../src/logic/dateText";

const NOW = new Date(2026, 9, 18, 12).getTime();
const sep16 = new Date(2026, 8, 16, 18, 30).getTime(); // a Wednesday

describe("one date format with Western digits (plan 1.2)", () => {
  it("EN: no year in the current year, year otherwise", () => {
    expect(formatDay(sep16, "en", NOW)).toBe("Wed 16 Sep");
    expect(formatDay(new Date(2025, 8, 16, 12).getTime(), "en", NOW)).toBe("Tue 16 Sep 2025");
  });
  it("AR: Arabic weekday and month, Western digits only", () => {
    const s = formatDay(sep16, "ar", NOW);
    expect(s).toBe("الأربعاء 16 سبتمبر");
    expect(s).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
    expect(formatDay(new Date(2025, 0, 2, 12).getTime(), "ar", NOW)).toBe("الخميس 2 يناير 2025");
  });
  it("reads a YYYY-MM-DD training day at local noon and ISO timestamps; bad input shows as it is", () => {
    expect(formatDay("2026-09-16", "en", NOW)).toBe("Wed 16 Sep");
    expect(formatDay(new Date(2026, 8, 16, 9).toISOString(), "en", NOW)).toBe("Wed 16 Sep");
    expect(formatDay("garbage", "en", NOW)).toBe("garbage");
  });
  it("short variant (chart axis): day + month, no weekday; year rule unchanged", () => {
    expect(formatDay(sep16, "en", NOW, true)).toBe("16 Sep");
    expect(formatDay(sep16, "ar", NOW, true)).toBe("16 سبتمبر");
    expect(formatDay(new Date(2025, 8, 16, 12).getTime(), "en", NOW, true)).toBe("16 Sep 2025");
  });
  it("the remaining UI dates use the formatter, never the ISO helper, and are never forced LTR", () => {
    for (const f of ["screens/SessionDetailScreen.tsx", "screens/DecisionLogScreen.tsx", "screens/SyncScreen.tsx", "screens/LiftTrendView.tsx", "components/TrendChart.tsx", "components/WeeklyReviewCard.tsx"]) {
      const src = readFileSync(join(__dirname, "../src", f), "utf8");
      expect(src, f).not.toContain("localDateText");
      expect(src, f).toContain("formatDay(");
      expect(src, f).not.toMatch(/<AppText ltr[^>]*>\{formatDay/);
      expect(src, f).not.toContain("isolateLtr(formatDay");
    }
    expect(readFileSync(join(__dirname, "../src/components/TrendChart.tsx"), "utf8")).toContain("formatDay(ms, lang, Date.now(), true)");
  });
  it("maps Eastern Arabic-Indic digits to 0–9", () => {
    expect(toWesternDigits("١٦")).toBe("16");
    expect(toWesternDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
    expect(toWesternDigits("16 سبتمبر")).toBe("16 سبتمبر");
  });
  it("numbers use Western digits in Arabic too", () => {
    expect(formatNumber(1234.56, "ar", 1)).toBe("1,234.6");
    expect(formatNumber(87, "ar")).toMatch(/^[0-9]+$/);
  });
  it('no "ar-EG" left in the app source outside dateText.ts', () => {
    const root = join(__dirname, "../src");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f) && !p.endsWith("dateText.ts") && readFileSync(p, "utf8").includes('"ar-EG"')) hits.push(p);
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  });
});
