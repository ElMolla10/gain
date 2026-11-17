import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { ACHIEVEMENT_CATALOG, LEGACY_ACHIEVEMENT_CATALOG, COLLECTION_CATALOG } from "@gain/engine";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LRI, PDI, translate } from "../src/i18n/format";
import { medalA11y, medalStateLine } from "../src/logic/achievementCopy";
import { isPartialCabinet, monthOf, nextMedals, shelfSections, shelves, slotNameKey, slotRow } from "../src/logic/achievementShowcase";
import { MEDAL_MATERIALS, SEAL_COLOUR, achievementArtDark, achievementArtLight } from "../src/palettes";
import { byType, expand, nodes, texts } from "./achievementRender";
import { earned, progress, row, sampleCabinet } from "./achievementFixtures";

const settings = vi.hoisted(() => ({ lang: "en" as "en" | "ar", fontScale: 1, dark: true }));
const services = vi.hoisted(() => ({ pickQuest: vi.fn(async () => {}) }));
vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig(), { useContext: () => null }));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", ScrollView: "ScrollView", useWindowDimensions: () => ({ fontScale: settings.fontScale, width: 400, height: 800 }) }));
vi.mock("react-native-svg", () => ({ SvgXml: "SvgXml", default: "Svg", Circle: "Circle", ClipPath: "ClipPath", Defs: "Defs", Ellipse: "Ellipse", G: "G", LinearGradient: "LinearGradient", Path: "Path", RadialGradient: "RadialGradient", Rect: "Rect", Stop: "Stop", Text: "SvgText", TextPath: "TextPath" }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ lang: settings.lang, unit: "kg", direction: settings.lang === "ar" ? "rtl" : "ltr", t: (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(settings.lang, k, p) }) }));
vi.mock("../src/theme", async () => {
  const pal = await import("../src/palettes");
  return {
    space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
    radius: { button: 12, card: 16 },
    type: { display: 48, load: 36, title: 28, section: 20, body: 16, label: 14, caption: 13 },
    usePalette: () => ({ muted: "muted", text: "text", border: "border", card: "card", raised: "raised", accent: "accent" }),
    useAchievementArt: () => (settings.dark ? pal.achievementArtDark : pal.achievementArtLight),
    useIsDark: () => settings.dark,
  };
});
vi.mock("../src/ui", () => ({ AppText: "AppText", Card: "Card", SectionTitle: "SectionTitle", QuietAction: "QuietAction", BigButton: "BigButton", Sheet: "Sheet" }));
vi.mock("../src/components/Icon", () => ({ Icon: "Icon" }));
vi.mock("../src/AppContext", () => ({ useServices: () => ({ achievements: services }) }));
vi.mock("../src/achievementTelemetry", () => ({ telemetry: { record: vi.fn() } }));
vi.mock("../src/diagnostics", () => ({ diagnostics: { record: vi.fn() } }));

import { AlmostThere, ALMOST_MEDAL } from "../src/components/achievements/AlmostThere";
import { CabinetShelf, SHELF_MEDAL, SLOT_MIN_HEIGHT, shelfColumns } from "../src/components/achievements/CabinetShelf";
import { LedgerTeaser } from "../src/components/achievements/LedgerTeaser";
import { bossLabel, materialFor, Medal, MEDAL_LOD } from "../src/components/achievements/Medal";
import { MEDAL_ART } from "../src/components/achievements/medalArt";
import { MonthSeal, questMonth, sealMode } from "../src/components/achievements/MonthSeal";
import { CompactShelves, LatestPrCard, NextMedals } from "../src/components/achievements/CompactCabinet";
import { PlateBadge, PLATE_BADGE_SIZE } from "../src/components/achievements/PlateBadge";
import { PLATE_COLOURS } from "../src/palettes";
import { latestPr } from "../src/logic/achievementShowcase";

const iso = (s: string) => `${LRI}${s}${PDI}`;
const t = (lang: "en" | "ar") => (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(lang, k, p);
const NOW = new Date(2026, 9, 18, 12).getTime();
const medal = (props: Parameters<typeof Medal>[0]) => expand(React.createElement(Medal, props));

beforeEach(() => {
  settings.lang = "en";
  settings.fontScale = 1;
  settings.dark = true;
});

describe("medal art", () => {
  it("has a master for every catalog badge, and every LOD motif fits the ≤12-shape budget", () => {
    for (const def of LEGACY_ACHIEVEMENT_CATALOG) {
      const m = MEDAL_ART[def.id];
      expect(m, def.id).toBeDefined();
      expect(m!.sil.startsWith("M"), def.id).toBe(true);
      // Silhouette + rim + motif ≤ 12 paths at LOD.
      expect(m!.lod.length + 2, def.id).toBeLessThanOrEqual(12);
    }
  });
  it("material comes from prestigeForBadge; the fall-through badges stay iron; every quest seal is the one seal colour", () => {
    expect(materialFor("strength_pr")).toBe(MEDAL_MATERIALS.steel);
    expect(materialFor("comeback")).toBe(MEDAL_MATERIALS.bronze);
    expect(materialFor("hundred_club_250")).toBe(MEDAL_MATERIALS.lime);
    for (const id of ["iron_hold", "iron_carry", "full_spectrum_12", "first_session"]) expect(materialFor(id)).toBe(MEDAL_MATERIALS.iron);
    for (const id of ["quest_rhythm", "quest_craft", "quest_balance", "quest_foundation"]) expect(materialFor(id).base).toBe(SEAL_COLOUR);
  });
  it("boss numerals are decorative duplicates: tier for weeks/days/sessions, the month for a seal", () => {
    expect(bossLabel("qualified_weeks_12")).toBe("12");
    expect(bossLabel("hundred_club_1000")).toBe("1000");
    expect(bossLabel("quest_craft", 9)).toBe("9");
    expect(bossLabel("quest_craft")).toBeNull();
    expect(bossLabel("strength_pr")).toBeNull();
  });
  it("the art is hidden from screen readers and never mirrors", () => {
    const tree = medal({ badgeId: "dedicated_50", state: "earned", size: 120 });
    const root = nodes(tree)[0]!;
    expect(root.props.accessibilityElementsHidden).toBe(true);
    expect(root.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(root.props.style.direction).toBe("ltr");
    expect(byType(tree, "SvgText").map((n) => n.props.children)).toEqual(["50"]);
  });
  it("LOD switch: at ≤56 dp no cast shadow, specular band or emboss copies; above it all three", () => {
    expect(MEDAL_LOD).toBe(56);
    const small = medal({ badgeId: "strength_pr", state: "earned", size: 56 });
    expect(byType(small, "Ellipse")).toHaveLength(0);
    expect(byType(small, "LinearGradient")).toHaveLength(0);
    expect(byType(small, "G").filter((g) => g.props.opacity === 0.55)).toHaveLength(0);
    const shapes = (tree: unknown) => [...byType(tree, "Path"), ...byType(tree, "Rect"), ...byType(tree, "Circle")].filter((n) => !nodes(byType(tree, "ClipPath")).includes(n));
    expect(shapes(small).length).toBeLessThanOrEqual(12);
    const big = medal({ badgeId: "strength_pr", state: "earned", size: 120 });
    expect(byType(big, "Ellipse")).toHaveLength(1);
    expect(byType(big, "LinearGradient")).toHaveLength(1);
    expect(byType(big, "G").filter((g) => g.props.opacity === 0.55)).toHaveLength(1);
  });
  it("states read without colour: earned gradient; in progress ring outside (lime dark, olive light); locked dashed, no motif", () => {
    const e = medal({ badgeId: "comeback", state: "earned", size: 56 });
    expect(byType(e, "RadialGradient")).toHaveLength(1);
    expect(byType(e, "Path")[0]!.props.stroke).toBe(MEDAL_MATERIALS.bronze.edge);

    const ring = (tree: unknown) => byType(tree, "Circle").find((c) => c.props.r === 52.5 && c.props.strokeDasharray);
    const pDark = medal({ badgeId: "dedicated_50", state: "in_progress", size: 84, progress: 0.76 });
    expect(ring(pDark)!.props.stroke).toBe(achievementArtDark.arcDone);
    expect(ring(pDark)!.props.transform).toBe("rotate(-90 50 50)");
    expect(byType(pDark, "Path")[0]!.props.fill).toBe(achievementArtDark.medalProgressFill);
    settings.dark = false;
    const pLight = medal({ badgeId: "dedicated_50", state: "in_progress", size: 84, progress: 0.76 });
    expect(ring(pLight)!.props.stroke).toBe("#3C5700");
    expect(achievementArtLight.arcDone).not.toBe(achievementArtDark.arcDone);
    settings.dark = true;

    const l = medal({ badgeId: "dedicated_50", state: "locked", size: 56 });
    expect(byType(l, "Path")[0]!.props.strokeDasharray).toBe("4 3.2");
    expect(byType(l, "Path")).toHaveLength(2);
    expect(byType(l, "Rect")).toHaveLength(0);
    expect(byType(l, "SvgText")).toHaveLength(0);
  });
});


import { collectionSvg } from "../src/components/achievements/collectionArt";
import { buildCabinet } from "../src/logic/achievementSurface";
describe("approved permanent Cabinet", () => {
 it.each(["en", "ar"] as const)("%s keeps four collapsed collection categories", lang => {
  settings.lang=lang;
  const tree=expand(React.createElement(CompactShelves,{groups:shelves(buildCabinet([])),quest:null,onOpen:()=>{},onQuestChanged:()=>{}}));
  expect(byType(tree,"Pressable")).toHaveLength(4);
  expect(byType(tree,"Pressable").every(n=>n.props.accessibilityState.expanded===false)).toBe(true);
 });
 it("ranks three measured milestones including the next plate, excluding legacy and quests",()=>{
  const cabinet=buildCabinet([progress("dedicated_days_50",33,50),progress("lifetime_plate_100",76,100),progress("showing_up_4",2,4),progress("workhorse",2,3),progress("quest_rhythm",2,3)]);
  expect(nextMedals(cabinet).map(r=>r.badgeId)).toEqual(["lifetime_plate_100","dedicated_days_50","showing_up_4"]);
  const tree=expand(React.createElement(NextMedals,{cabinet,onOpen:()=>{}}));expect(byType(tree,"Pressable")).toHaveLength(3);
 });
 it.each([null,0,1,9])("does not display an earned plate at %s days",days=>{
  const tree=expand(React.createElement(PlateBadge,{days}));expect(byType(tree,"Icon")).toHaveLength(1);expect(byType(tree,"SvgXml")).toHaveLength(0);
 });
 it.each([[10,"10"],[76,"50"],[100,"100"],[1000,"1K"]])("displays the threshold plate at %i days",(days,numeral)=>{
  const tree=expand(React.createElement(PlateBadge,{days:Number(days)}));expect(byType(tree,"SvgXml")[0]!.props.xml).toContain(`>${numeral}</text>`);
 });
 it.each(COLLECTION_CATALOG.map(d=>[d.id] as const))("renders the canonical artwork for %s at 32dp and detail size",id=>{
  for(const size of [32,200]){
   const tree=medal({badgeId:id,state:"earned",size});const svg=byType(tree,"SvgXml")[0]!;
   expect(svg.props.width).toBe(size);expect(svg.props.xml).toContain('<svg');expect(svg.props.xml).not.toContain('undefined');
  }
 });
 it("never substitutes another earned award for an unknown ID",()=>{
  expect(collectionSvg("unknown")).toBeNull();expect(medal({badgeId:"unknown",state:"earned",size:32})).toBeNull();
 });
 it("tiered medals retain symbols and engrave the canonical number",()=>{
  for(const d of COLLECTION_CATALOG.filter(d=>["showing_up","dedicated_days","across_the_board"].includes(d.artFamily))){
   expect(collectionSvg(d.id)).toContain(`>${d.tier}</text>`);
  }
 });
 it("keeps earned legacy awards in a separate existing-style shelf without locked legacy goals",()=>{
  const groups=shelves(buildCabinet([earned("workhorse",1)]));expect(groups.at(-1)!.shelf).toBe("legacy");
  expect(groups.at(-1)!.items.map(i=>i.badgeId)).toEqual(["workhorse"]);expect(groups.slice(0,4).flatMap(g=>g.items)).toHaveLength(21);
 });
});
