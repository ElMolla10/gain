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

describe("permanent collection selectors",()=>{
 it("keeps 21 slots, 15 medals and six plates, excluding legacy and quests from totals",()=>{
  const cab=buildCabinet([earned("first_workout",1),earned("lifetime_plate_50",2),earned("workhorse",3),earned("quest_rhythm",4)]);
  expect(medalCount(cab)).toEqual({earned:1,total:15});expect(shelves(cab).slice(0,4).flatMap(g=>g.items)).toHaveLength(21);
  expect(shelves(cab).find(g=>g.shelf==="lifetime")!.items).toHaveLength(6);
  expect(medalOrdinal(cab,"e:first_workout:1")).toBe(1);expect(medalOrdinal(cab,"e:lifetime_plate_50:2")).toBeNull();
 });
 it.each([[0,"steel","steel",10],[9,"steel","steel",1],[10,"steel","green",40],[49,"steel","green",1],[50,"green","yellow",50],[76,"green","yellow",24],[100,"yellow","blue",150],[250,"blue","red",250],[500,"red","black",500],[1000,"black",null,null]])("plate progress at %i dates",(n,tier,next,left)=>{
  expect(plateTier(Number(n))).toBe(tier);expect(nextPlate(Number(n))).toBe(next);expect(daysToNext(Number(n))).toBe(left);
 });
 it("reads progress from live rows and prefers engine stats",()=>{
  const cab=buildCabinet([progress("lifetime_plate_100",76,100)]);expect(trainingDays(cab)).toEqual({days:76,floor:false});expect(trainingDays(cab,{qualifyingDays:77}).days).toBe(77);
 });
 it("does not duplicate migrated PRs or call weaker legacy PRs verified",()=>{
  const cab=buildCabinet([earned("strength_pr",1),pr("valid",BENCH,[70,8],[70,9])]);
  expect(latestPr(cab)?.id).toBe("valid");expect(prStair(cab,BENCH)).toHaveLength(1);
  expect(latestPr(buildCabinet([earned("strength_pr",1)]))).toBeNull();
 });
 it("builds complete canonical family tracks",()=>{
  const cab=buildCabinet([earned("showing_up_4",1),progress("showing_up_12",5,12)]);
  expect(familyTrack(cab,"showing_up_4").map(s=>[s.tier,s.state])).toEqual([[4,"earned"],[12,"in_progress"],[26,"locked"],[52,"locked"]]);
 });
 it("next milestones exclude retired goals and optional quests",()=>{
  const cab=buildCabinet([progress("dedicated_days_50",38,50),progress("lifetime_plate_100",76,100),progress("workhorse",2,3)]);
  expect(almostThere(cab).map(r=>r.badgeId)).toContain("dedicated_days_50");expect(almostThere(cab).map(r=>r.badgeId)).not.toContain("workhorse");
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
