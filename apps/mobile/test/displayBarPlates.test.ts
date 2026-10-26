import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { translate } from "../src/i18n/format";
import { ar, en } from "../src/i18n/strings";
import { displayBarPlates } from "../src/logic/plateText";

const plain = (s: string) => s.replace(/[\u2066-\u2069]/g, "").replace(/\u00A0/g, " ");
const tt = (lang: "en" | "ar") => (k: "plates.each" | "plates.nearest" | "plates.bar", p?: Record<string, string | number>) => translate(lang, k, p);

describe("Goals hero / post-mortem plates: kg loads on the kg-based bar, shown in the lifter's unit (batch item 25)", () => {
  it("100 kg in kg: 40 kg per side as 25 kg + 15 kg", () => {
    const r = displayBarPlates(100, "kg", "en", tt("en"));
    expect(r.perSide).toEqual([25, 15]);
    expect(plain(r.text)).toContain("25 kg + 15 kg");
  });

  it("100 kg in lb: 45 + 35 + 5 + 2.5 lb per side (kg values for BarArt), both languages", () => {
    for (const lang of ["en", "ar"] as const) {
      const r = displayBarPlates(100, "lb", lang, tt(lang));
      const text = plain(r.text);
      const lb = lang === "en" ? "lb" : "باوند";
      for (const v of ["45", "35", "5", "2.5"]) expect(text).toContain(`${v} ${lb}`);
      expect(text).not.toContain("25 lb");
      expect(r.perSide.every((kg) => kg < 21)).toBe(true);
    }
  });

  it("below the bar, or no load: no plates and the bar text", () => {
    expect(displayBarPlates(10, "kg", "en", tt("en"))).toEqual({ perSide: [], text: en["plates.bar"] });
    expect(displayBarPlates(null, "lb", "ar", tt("ar"))).toEqual({ perSide: [], text: ar["plates.bar"] });
  });

  it("no pound plate list left in the two cards; too_thin badge is the pace.status string", () => {
    for (const f of ["goals/GoalHeroIronCard.tsx", "history/SessionPostMortemHero.tsx"]) {
      const src = readFileSync(join(__dirname, "../src/components", f), "utf8");
      expect(src).not.toContain("[45, 35, 25, 10, 5, 2.5]");
      expect(src).toContain("displayBarPlates(");
    }
    const card = readFileSync(join(__dirname, "../src/components/goals/GoalHeroIronCard.tsx"), "utf8");
    expect(card).toMatch(/paceStatus === "too_thin"\s*\?\s*t\("pace.status.too_thin"\)/);
    expect(en["pace.status.too_thin"]).toBe("not enough data yet");
  });
});
