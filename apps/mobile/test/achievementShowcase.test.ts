import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateAchievements, UNIQUE_BADGE_IDS, type AchievementEvidence } from "@gain/engine";
import { FSI, LRI, NBSP, PDI, translate } from "../src/i18n/format";
import { buildCabinet } from "../src/logic/achievementSurface";
import {
  almostThere,
  arPluralKey,
  collapseForPartial,
  daysToNext,
  familyTrack,
  latestPr,
  ledgerSummary,
  medalCount,
  medalOrdinal,
  nextPlate,
  plaques,
  plateProgress,
  plateTier,
  prDelta,
  prStair,
  shelfOf,
  shelves,
  trainingDays,
} from "../src/logic/achievementShowcase";
import { BENCH, CURL, PULLUP, earned, pr, progress, row, sampleCabinet } from "./achievementFixtures";

const iso = (s: string) => `${LRI}${s}${PDI}`;
const tEn = (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate("en", k, p);
const tAr = (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate("ar", k, p);
const evidenceOf = (r: ReturnType<typeof pr>) => r.evidence as Extract<AchievementEvidence, { kind: "strength_pr" }>;

describe("training days and the Lifetime Plate", () => {
  it("reads the lowest-target in-progress hundred_club row", () => {
    expect(trainingDays(sampleCabinet())).toEqual({ days: 412, floor: false });
  });
  it("falls back to the 1000+ floor when every tier is earned and no count was passed through", () => {
    const all = buildCabinet([100, 250, 500, 1000].map((tier, i) => earned(`hundred_club_${tier}`, i + 1)));
    expect(trainingDays(all)).toEqual({ days: 1000, floor: true });
  });
  it("prefers the engine's passed-through qualifyingDays (no floor past 1000)", () => {
    const all = buildCabinet([100, 250, 500, 1000].map((tier, i) => earned(`hundred_club_${tier}`, i + 1)));
    expect(trainingDays(all, { qualifyingDays: 1043 })).toEqual({ days: 1043, floor: false });
    expect(trainingDays(sampleCabinet(), { qualifyingDays: 413 })).toEqual({ days: 413, floor: false });
  });
  it("is unknown before anything was evaluated", () => {
    expect(trainingDays(buildCabinet([]))).toEqual({ days: null, floor: false });
  });
  it("plate thresholds come from HUNDRED_CLUB_TIERS", () => {
    const at = (d: number) => [plateTier(d), nextPlate(d), daysToNext(d)];
    expect(at(0)).toEqual(["steel", "green", 100]);
    expect(at(99)).toEqual(["steel", "green", 1]);
    expect(at(100)).toEqual(["green", "yellow", 150]);
    expect(at(249)).toEqual(["green", "yellow", 1]);
    expect(at(250)).toEqual(["yellow", "blue", 250]);
    expect(at(499)).toEqual(["yellow", "blue", 1]);
    expect(at(500)).toEqual(["blue", "red", 500]);
    expect(at(999)).toEqual(["blue", "red", 1]);
    expect(at(1000)).toEqual(["red", null, null]);
    expect(at(1043)).toEqual(["red", null, null]);
    expect(plateTier(null)).toBe("steel");
  });
  it("rim progress runs from this plate's threshold to the next", () => {
    expect(plateProgress(412)).toBeCloseTo((412 - 250) / 250);
    expect(plateProgress(100)).toBe(0);
    expect(plateProgress(1000)).toBe(1);
  });
  it("the engine's passthrough equals the in-progress row count it already emits", () => {
    const day = (n: number) => `2026-01-${String(5 + n).padStart(2, "0")}`;
    const sets = (id: string) => [0, 1, 2].map((i) => ({ id: `${id}${i}`, exerciseId: "bench", equipment: "barbell" as const, setup: "free" as const, load: 60, reps: 8, warmup: false, tags: [], outlierStatus: "none" as const }));
    const sessions = [0, 1, 2].map((n) => ({ id: `s${n}`, finishedAtUtc: n, localCalendarDate: day(n), sets: sets(`s${n}`) }));
    const r = evaluateAchievements(sessions, { nowLocalDate: day(2) });
    expect(r.stats.qualifyingDays).toBe(3);
    expect(r.inProgress.find((p) => p.badgeId === "hundred_club_100")?.current).toBe(3);
  });
});

describe("strength PRs", () => {
  it("latest is the newest earned PR, never a 'best'", () => {
    expect(latestPr(sampleCabinet())?.id).toBe("pr4");
    expect(latestPr(buildCabinet([]))).toBeNull();
  });
  it("the staircase holds every PR on the same identity, oldest first, with rep-only steps marked", () => {
    const stair = prStair(sampleCabinet(), CURL);
    expect(stair.map((s) => [s.load, s.reps, s.repOnly])).toEqual([
      [12, 8, false],
      [12, 9, true],
      [16, 6, false],
    ]);
    expect(prStair(sampleCabinet(), { ...CURL, setup: "assisted" })).toEqual([]);
  });
  it("plaques show the latest PR on each other lift with its count", () => {
    const cab = [...sampleCabinet(), pr("pr5", BENCH, [62.5, 8], [65, 8], { at: 280 }), pr("pr6", PULLUP, [30, 8], [25, 8], { at: 90 })];
    const list = plaques(cab);
    expect(list.map((p) => [p.row.id, p.count])).toEqual([
      ["pr5", 2],
      ["pr6", 1],
    ]);
    expect(plaques(cab, 1)).toHaveLength(1);
  });
  describe("prDelta: real sets, exact code points", () => {
    it("heavier: isolated +number, no-break space, unit in the language", () => {
      const ev = evidenceOf(pr("x", BENCH, [60, 8], [64, 8]));
      expect(prDelta(ev, "en", "kg", tEn)).toBe(`${iso("+4")}${NBSP}kg`);
      const ar = prDelta(ev, "ar", "kg", tAr);
      expect(ar).toBe(`${iso("+4")}${NBSP}كجم`);
      expect(ar).not.toContain(`${LRI}كجم`);
      expect(prDelta(ev, "en", "lb", tEn)).toBe(`${iso("+8.8")}${NBSP}lb`);
    });
    it("assisted: less assistance reads as a true minus with the word", () => {
      const ev = evidenceOf(pr("x", PULLUP, [30, 8], [25, 8]));
      expect(prDelta(ev, "en", "kg", tEn)).toBe(`${iso(`${iso("\u22125")}${NBSP}kg`)} assistance`);
      const ar = prDelta(ev, "ar", "kg", tAr);
      // The Arabic value gets a first-strong isolate, never an LTR one (S-1).
      expect(ar).toBe(`${FSI}${iso("\u22125")}${NBSP}كجم${PDI} مساعدة`);
    });
    it("reps only: +1 rep / +2 reps; Arabic takes the plural only for 3–10", () => {
      expect(prDelta(evidenceOf(pr("x", BENCH, [60, 8], [60, 9])), "en", "kg", tEn)).toBe(`${iso("+1")} rep`);
      expect(prDelta(evidenceOf(pr("x", BENCH, [60, 8], [60, 10])), "en", "kg", tEn)).toBe(`${iso("+2")} reps`);
      expect(prDelta(evidenceOf(pr("x", BENCH, [60, 5], [60, 8])), "ar", "kg", tAr)).toBe(`${iso("+3")} تكرارات`);
      expect(prDelta(evidenceOf(pr("x", BENCH, [60, 8], [60, 9])), "ar", "kg", tAr)).toBe(`${iso("+1")} تكرار`);
    });
    it("path B: the rep band with an en dash, never an e1RM figure", () => {
      const ev = evidenceOf(pr("x", BENCH, [60, 9], [62.5, 7], { path: "B" }));
      expect(prDelta(ev, "en", "kg", tEn)).toBe(`Stronger at ${iso("6\u201310")} reps`);
      expect(prDelta(ev, "ar", "kg", tAr)).toBe(`أقوى في نطاق ${iso("6\u201310")} تكرار`);
      expect(prDelta(ev, "en", "kg", tEn)).not.toMatch(/%|1RM/);
    });
  });
  it("Arabic count nouns: plural for 3–10, singular otherwise", () => {
    expect([1, 2, 3, 10, 11, 22].map((n) => arPluralKey(n, "one", "few"))).toEqual(["one", "one", "few", "few", "one", "one"]);
  });
});

describe("medals and shelves", () => {
  it("maps every catalog badge to one of four shelves", () => {
    expect(shelfOf("strength_pr")).toBe("strength");
    expect(shelfOf("iron_carry")).toBe("strength");
    expect(shelfOf("pin_target")).toBe("strength");
    expect(shelfOf("quest_rhythm")).toBe("consistency");
    expect(shelfOf("qualified_weeks_12")).toBe("consistency");
    expect(shelfOf("hundred_club_500")).toBe("lifetime");
    expect(shelfOf("multi_year_5")).toBe("lifetime");
    expect(shelfOf("full_spectrum_12")).toBe("mastery");
  });
  it("collapses repeatables to ×N and draws never-earned repeatables from the catalog as locked", () => {
    const groups = shelves(sampleCabinet());
    expect(groups.map((g) => g.shelf)).toEqual(["strength", "consistency", "lifetime", "mastery"]);
    const strength = groups[0]!.items;
    const prSlot = strength.find((i) => i.badgeId === "strength_pr")!;
    expect([prSlot.state, prSlot.count, prSlot.repeatable, prSlot.row?.id]).toEqual(["earned", 4, true, "pr4"]);
    for (const id of ["pin_target", "iron_hold", "iron_carry", "block_builder"]) {
      const slot = strength.find((i) => i.badgeId === id)!;
      expect([slot.state, slot.count, slot.row]).toEqual(["locked", 0, null]);
    }
    const comeback = groups[1]!.items.find((i) => i.badgeId === "comeback")!;
    expect(comeback.count).toBe(2);
    expect(groups[2]!.earned).toBe(3);
    expect(groups[2]!.items.map((i) => i.state)).toEqual(["earned", "earned", "in_progress", "in_progress", "earned", "in_progress", "in_progress"]);
    // Every non-quest catalog badge appears exactly once, and the four quest kinds share one "Monthly quests" slot: 24 slots.
    const slots = groups.flatMap((g) => g.items);
    expect(slots.length).toBe(24);
    expect(groups.map((g) => g.items.length)).toEqual([6, 5, 7, 6]);
    expect(slots.filter((i) => i.badgeId.startsWith("quest_")).map((i) => i.slot)).toEqual(["quest"]);
  });
  it("a partial shelf keeps everything earned plus the next 2, closest first", () => {
    const lifetime = shelves(sampleCabinet())[2]!.items;
    const { visible, hidden } = collapseForPartial(lifetime);
    expect(visible.map((i) => i.badgeId)).toEqual(["hundred_club_100", "hundred_club_250", "hundred_club_500", "multi_year_2", "multi_year_3"]);
    expect(hidden).toBe(2);
  });
  it("almost there: top 3 in-progress uniques, never hundred_club_* or quest_*", () => {
    const cab = [...sampleCabinet(), progress("quest_rhythm", 2, 3)];
    const ids = almostThere(cab).map((r) => r.badgeId);
    expect(ids).toEqual(["dedicated_50", "full_spectrum_4", "workhorse"]);
    expect(ids.some((id) => id.startsWith("hundred_club_") || id.startsWith("quest_"))).toBe(false);
  });
  it("medal ordinal counts earned uniques by earn time; repeatables have none", () => {
    const cab = sampleCabinet();
    expect(medalOrdinal(cab, "e:first_session:10")).toBe(1);
    expect(medalOrdinal(cab, "e:hundred_club_250:50")).toBe(7);
    expect(medalOrdinal(cab, "pr4")).toBeNull();
    expect(medalCount(cab)).toEqual({ earned: 8, total: UNIQUE_BADGE_IDS.size });
    expect(UNIQUE_BADGE_IDS.size).toBe(17);
  });
  it("family track lists every tier with its state", () => {
    expect(familyTrack(sampleCabinet(), "dedicated_25").map((s) => [s.tier, s.state, s.current])).toEqual([
      [10, "earned", null],
      [25, "earned", null],
      [50, "in_progress", 38],
      [100, "in_progress", 38],
    ]);
    expect(familyTrack(sampleCabinet(), "qualified_weeks_4").map((s) => s.badgeId)).toEqual(["qualified_weeks_4", "qualified_weeks_12"]);
    expect(familyTrack(sampleCabinet(), "full_spectrum_12")).toHaveLength(2);
    expect(familyTrack(sampleCabinet(), "strength_pr")).toEqual([]);
  });
  it("ledger summary: count, the first milestone date and the latest 3", () => {
    const cab = sampleCabinet().filter((r) => r.status === "earned");
    const s = ledgerSummary(cab);
    expect(s.since).toBe("2024-03-09");
    expect(s.latest.map((r) => r.id)).toEqual(["pr4", "pr3", "pr2"]);
    expect(s.count).toBeGreaterThan(10);
    expect(ledgerSummary([])).toEqual({ count: 0, since: null, latest: [] });
    expect(row({ id: "x", badgeId: "first_session" }).status).toBe("earned");
  });
});

describe("guard rails", () => {
  const src = readFileSync(join(__dirname, "..", "src", "logic", "achievementShowcase.ts"), "utf8").replace(/\/\*[^]*?\*\/|\/\/.*$/gm, "");
  it("is presentation only: no rule evaluation, repo or network access, no invented metrics", () => {
    expect(src).not.toMatch(/evaluateAchievements|achievementRepo|fetch\(|qualifiedWeeksConsecutive/);
    expect(src).not.toMatch(/\b(xp|rarity|streak|level)\b/i);
    expect(src).not.toMatch(/finishChoice/);
  });
});
