import { describe, expect, it } from "vitest";
import { LRI, NBSP, PDI, translate } from "../src/i18n/format";
import { deltaChip, doneAround, reasonTail, welcomeBackGap } from "../src/logic/todayCopy";

const t = (lang: "en" | "ar") => (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(lang, k, p);
const iso = (s: string) => `${LRI}${s}${PDI}`;
const ctx = (lang: "en" | "ar", lighterWeek = false) => ({ lang, unit: "kg" as const, t: t(lang), lighterWeek });
const DAY = 86_400_000;

describe("reasonTail", () => {
  it("drops the first sentence that restates the target; a single sentence gives its short form", () => {
    expect(reasonTail("Go up to 102.5 kg for 6. You hit 10 at 100 kg.")).toBe("You hit 10 at 100 kg.");
    expect(reasonTail("ارفع لـ 102.5 كجم × 6. عملت 10 على 100 كجم.")).toBe("عملت 10 على 100 كجم.");
    expect(reasonTail("Same weight, aim for one more rep.")).toBe("Same weight, aim for one more rep.");
    expect(reasonTail("  ")).toBe("");
  });
});

describe("deltaChip", () => {
  const last = { topLoad: 100, repsAtTop: 8 };
  it("load up is one isolated signed run with the unit in the language", () => {
    expect(deltaChip({ load: 102.5, reps: 6, status: "proposed" }, last, ctx("en"))).toEqual({ kind: "loadUp", text: `${iso("+2.5")}${NBSP}kg` });
    expect(deltaChip({ load: 102.5, reps: 6, status: "proposed" }, last, ctx("ar")).text).toBe(`${iso("+2.5")}${NBSP}كجم`);
  });
  it("rep up / same / down / new / edited / lighter week, EN and AR", () => {
    expect(deltaChip({ load: 100, reps: 9, status: "proposed" }, last, ctx("en"))).toEqual({ kind: "repUp", text: `${iso("+1")} rep` });
    expect(deltaChip({ load: 100, reps: 10, status: "proposed" }, last, ctx("en")).text).toBe(`${iso("+2")} reps`);
    expect(deltaChip({ load: 100, reps: 10, status: "proposed" }, last, ctx("ar")).text).toBe(`${iso("+2")} عدّة`);
    expect(deltaChip({ load: 100, reps: 13, status: "proposed" }, { topLoad: 100, repsAtTop: 8 }, ctx("ar")).text).toBe(`${iso("+5")} عدّات`);
    expect(deltaChip({ load: 100, reps: 8, status: "proposed" }, last, ctx("en"))).toEqual({ kind: "same", text: `Same, aim ${iso("8")}` });
    expect(deltaChip({ load: 95, reps: 8, status: "proposed" }, last, ctx("en")).kind).toBe("down");
    expect(deltaChip({ load: 100, reps: 8, status: "proposed" }, null, ctx("en"))).toEqual({ kind: "new", text: "New" });
    expect(deltaChip({ load: 110, reps: 8, status: "edited" }, last, ctx("ar"))).toEqual({ kind: "edited", text: "تعديلك" });
    expect(deltaChip({ load: 90, reps: 8, status: "proposed" }, last, ctx("en", true))).toEqual({ kind: "lighter", text: "Lighter week" });
  });
});

describe("doneAround and welcome back", () => {
  it("24-hour HH:MM with Western digits", () => {
    const now = new Date(2026, 9, 18, 6, 8).getTime();
    expect(doneAround(now, 54)).toBe("07:02");
    expect(doneAround(now, 0)).toBe("06:08");
  });
  it("14 days or more since the last training day; 13 is not a welcome back; nothing logged → null", () => {
    const now = 100 * DAY;
    expect(welcomeBackGap([now - 13 * DAY], now)).toBeNull();
    expect(welcomeBackGap([now - 30 * DAY, now - 14 * DAY], now)).toBe(14);
    expect(welcomeBackGap([], now)).toBeNull();
  });
});
