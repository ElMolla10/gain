import { describe, expect, it } from "vitest";
import { translate } from "../src/i18n/format";
import type { StringKey } from "../src/i18n/strings";
import { goalLine, goalSettingKey, groupedNumber, isVerifiedPrSet, monthYear, parseGoal, repMaxRows, repsLabel, setsLabel, signedWhole, wholeInUnit } from "../src/logic/progressionSummary";

const strip = (s: string) => s.replace(/[\u2066-\u2069]/g, "");
const tEn = (k: StringKey, p?: Record<string, string | number>) => strip(translate("en", k, p));
const tAr = (k: StringKey, p?: Record<string, string | number>) => strip(translate("ar", k, p));
const DAY = 86_400_000;
const NOW = new Date(2026, 10, 16, 12).getTime();

describe("rounding", () => {
  it("whole numbers in the lifter's unit, never 93.333", () => {
    expect(wholeInUnit(93.333, "kg")).toBe(93);
    expect(wholeInUnit(100, "lb")).toBe(220);
    expect(signedWhole(4.2, "kg")).toBe("+4");
    expect(signedWhole(-1.6, "kg")).toBe("\u22122");
    expect(signedWhole(0.2, "kg")).toBe("0");
    expect(groupedNumber(1710.4, "en")).toBe("1,710");
    expect(groupedNumber(1710.4, "ar")).toBe("1,710");
  });
  it("month labels for the chart axis", () => {
    expect(monthYear(new Date(2025, 8, 3).getTime(), "en")).toBe("Sep 2025");
    expect(monthYear(new Date(2027, 0, 3).getTime(), "ar")).toBe("يناير 2027");
  });
});

describe("goal line", () => {
  it("dates a goal: weeks when close, months otherwise, with early / mid / late", () => {
    expect(goalLine({ kind: "eta", at: new Date(2027, 0, 5).getTime(), days: 50 }, "en", tEn)).toEqual({ text: "in ~2 months · early Jan", tone: "accent" });
    expect(goalLine({ kind: "eta", at: NOW + 30 * DAY, days: 30 }, "en", tEn)!.text).toMatch(/^in ~1 month · /);
    expect(goalLine({ kind: "eta", at: new Date(2026, 10, 30).getTime(), days: 14 }, "en", tEn)!.text).toBe("in ~2 weeks · late Nov");
    expect(goalLine({ kind: "eta", at: new Date(2027, 1, 15).getTime(), days: 91 }, "ar", tAr)!.text).toBe("خلال ~3 شهور · نص فبراير");
  });
  it("reached, far, flat and unknown", () => {
    expect(goalLine({ kind: "reached" }, "en", tEn)).toEqual({ text: "Already reached", tone: "accent" });
    expect(goalLine({ kind: "beyond" }, "en", tEn)).toEqual({ text: "Over 12 months at this pace", tone: "muted" });
    expect(goalLine({ kind: "notOnPace" }, "en", tEn)).toEqual({ text: "Not on pace yet", tone: "muted" });
    expect(goalLine({ kind: "unknown" }, "en", tEn)).toBeNull();
    expect(goalLine({ kind: "beyond" }, "ar", tAr)!.text).toMatch(/[\u0600-\u06FF]/);
  });
});

describe("counts", () => {
  it("1 rep / N reps and 1 set / N sets; Arabic plural for 3–10", () => {
    expect(repsLabel(1, "en", tEn)).toBe("1 rep");
    expect(repsLabel(5, "en", tEn)).toBe("5 reps");
    expect(setsLabel(1, "en", tEn)).toBe("1 set");
    expect(setsLabel(2, "en", tEn)).toBe("2 sets");
    expect(repsLabel(5, "ar", tAr)).toBe("5 تكرارات");
    expect(repsLabel(12, "ar", tAr)).toBe("12 تكرار");
    expect(setsLabel(3, "ar", tAr)).toBe("3 مجموعات");
  });
});

describe("rep max rows", () => {
  const rm = (reps: number, load: number) => ({ reps, set: { load, at: reps } });
  it("sorted by reps, Epley e1RM, bars against the best, one Best", () => {
    const rows = repMaxRows([rm(10, 60), rm(1, 80), rm(5, 80), rm(2, 80), rm(20, 50)], "free");
    expect(rows.map((r) => r.reps)).toEqual([1, 2, 5, 10]);
    expect(rows.filter((r) => r.best).map((r) => r.reps)).toEqual([5]);
    expect(Math.round(rows[2]!.e1rm)).toBe(93);
    expect(rows[2]!.share).toBe(1);
    expect(rows[0]!.share).toBeCloseTo(80 / (80 * (1 + 5 / 30)), 6);
  });
  it("assisted lines have no 1RM table", () => {
    expect(repMaxRows([rm(5, 20)], "assisted")).toEqual([]);
  });
});

describe("goal input and storage", () => {
  it("parses typed goals, Arabic digits and decimal commas", () => {
    expect(parseGoal("100")).toBe(100);
    expect(parseGoal("102,5")).toBe(102.5);
    expect(parseGoal("١٢٠")).toBe(120);
    expect(parseGoal("")).toBeNull();
    expect(parseGoal("0")).toBeNull();
  });
  it("is keyed per exercise and setup", () => {
    expect(goalSettingKey("bench", "free")).toBe("progress_goal:bench:free");
  });
});

describe("verified PR sets", () => {
  it("match on the local day, load and reps", () => {
    const at = new Date(2026, 9, 14, 18).getTime();
    expect(isVerifiedPrSet([{ localDate: "2026-10-14", load: 80, reps: 5 }], at, { load: 80, reps: 5 })).toBe(true);
    expect(isVerifiedPrSet([{ localDate: "2026-10-14", load: 80, reps: 5 }], at, { load: 80, reps: 4 })).toBe(false);
    expect(isVerifiedPrSet([{ localDate: "2026-10-13", load: 80, reps: 5 }], at, { load: 80, reps: 5 })).toBe(false);
  });
});

describe("stable PR evidence",()=>{
 it("matches the actual set across timezone changes and equal repeat sets",()=>{
  const refs=[{setId:"winning-hold",localDate:"2026-01-01",load:20,reps:1}];
  expect(isVerifiedPrSet(refs,Date.parse("2026-01-02T23:00:00Z"),{id:"winning-hold",load:20,reps:1})).toBe(true);
  expect(isVerifiedPrSet(refs,Date.parse("2026-01-01T12:00:00Z"),{id:"equal-repeat",load:20,reps:1})).toBe(false);
 });
});
