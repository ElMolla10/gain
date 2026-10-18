import React from "react";
import { ACHIEVEMENT_CATALOG } from "@gain/engine";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LRI, PDI, translate } from "../src/i18n/format";
import { medalA11y, medalStateLine } from "../src/logic/achievementCopy";
import { isPartialCabinet, monthOf, shelfSections, shelves, slotNameKey, slotRow } from "../src/logic/achievementShowcase";
import { MEDAL_MATERIALS, SEAL_COLOUR, achievementArtDark, achievementArtLight } from "../src/palettes";
import { byType, expand, nodes, texts } from "./achievementRender";
import { earned, progress, row, sampleCabinet } from "./achievementFixtures";

const settings = vi.hoisted(() => ({ lang: "en" as "en" | "ar", fontScale: 1, dark: true }));
const services = vi.hoisted(() => ({ pickQuest: vi.fn(async () => {}) }));
vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig(), { useContext: () => null }));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", ScrollView: "ScrollView", useWindowDimensions: () => ({ fontScale: settings.fontScale, width: 400, height: 800 }) }));
vi.mock("react-native-svg", () => ({ default: "Svg", Circle: "Circle", ClipPath: "ClipPath", Defs: "Defs", Ellipse: "Ellipse", G: "G", LinearGradient: "LinearGradient", Path: "Path", RadialGradient: "RadialGradient", Rect: "Rect", Stop: "Stop", Text: "SvgText", TextPath: "TextPath" }));
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
    for (const def of ACHIEVEMENT_CATALOG) {
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

describe("medal words", () => {
  const groups = () => shelves(sampleCabinet());
  const slot = (id: string) => groups().flatMap((g) => g.items).find((i) => i.slot === id)!;
  it("state lines: date (short), ×N as one isolated run, x of y, Locked", () => {
    expect(medalStateLine(slot("first_session"), "en", t("en"), NOW)).toBe("9 Mar 2024");
    expect(medalStateLine(slot("comeback"), "en", t("en"), NOW)).toBe(iso("\u00d72"));
    expect(medalStateLine(slot("comeback"), "ar", t("ar"), NOW)).toBe(iso("\u00d72"));
    expect(medalStateLine(slot("dedicated_50"), "en", t("en"), NOW)).toBe(`${iso("38")} of ${iso("50")}`);
    expect(medalStateLine(slot("dedicated_50"), "ar", t("ar"), NOW)).toBe(`${iso("38")} من ${iso("50")}`);
    expect(medalStateLine(slot("pin_target"), "en", t("en"), NOW)).toBe("Locked");
    expect(medalStateLine(slot("pin_target"), "ar", t("ar"), NOW)).toBe("لسه");
  });
  it("each state's spoken label (spec §9)", () => {
    expect(medalA11y(slot("first_session"), "First session", "en", t("en"), NOW)).toBe(`${iso("First session")}, ${iso("Foundation")}, earned ${iso("9 Mar 2024")}`);
    expect(medalA11y(slot("comeback"), "Comeback", "en", t("en"), NOW)).toBe(`${iso("Comeback")}, ${iso("Masterwork")}, earned ${iso("2")} times, latest ${iso("20 Jan")}`);
    expect(medalA11y(slot("dedicated_50"), "Dedicated · 50 sessions", "en", t("en"), NOW)).toBe(`${iso("Dedicated · 50 sessions")}, in progress, ${iso("38")} of ${iso("50")}`);
    expect(medalA11y(slot("pin_target"), "Target reached", "en", t("en"), NOW)).toBe(`${iso("Target reached")}, locked`);
    const ar = medalA11y(slot("dedicated_50"), "التزام · 50 تمرينة", "ar", t("ar"), NOW);
    expect(ar).toBe(`\u2068التزام · 50 تمرينة${PDI}، جاري، ${iso("38")} من ${iso("50")}`);
    expect(medalA11y(slot("pin_target"), "الهدف اتحقق", "ar", t("ar"), NOW)).toBe(`\u2068الهدف اتحقق${PDI}، لسه`);
  });
});

describe("shelf grouping", () => {
  it("Lifetime and Mastery split into tracks; Strength and Consistency are one run", () => {
    const g = shelves(sampleCabinet());
    expect(g[0]!.items.map((i) => i.slot)).toEqual(["strength_pr", "workhorse", "block_builder", "pin_target", "iron_hold", "iron_carry"]);
    expect(g[1]!.items.map((i) => i.slot)).toEqual(["first_session", "qualified_weeks_4", "qualified_weeks_12", "comeback", "quest"]);
    expect(shelfSections(g[0]!.items).map((s) => s.track)).toEqual([null]);
    expect(shelfSections(g[1]!.items).map((s) => s.track)).toEqual([null]);
    expect(shelfSections(g[2]!.items).map((s) => [s.track, s.items.length])).toEqual([["days", 4], ["years", 3]]);
    expect(shelfSections(g[3]!.items).map((s) => [s.track, s.items.length])).toEqual([["dedicated", 4], ["spectrum", 2]]);
  });
  it("short slot names inside a track, the catalog name elsewhere", () => {
    expect(slotNameKey({ badgeId: "hundred_club_500", i18nKey: "achv.hundred500" })).toBe("achv.r2.slot.days500");
    expect(slotNameKey({ badgeId: "dedicated_10", i18nKey: "achv.dedicated10" })).toBe("achv.r2.slot.sessions10");
    expect(slotNameKey({ badgeId: "full_spectrum_12", i18nKey: "achv.spectrum12" })).toBe("achv.r2.slot.weeks12");
    expect(slotNameKey({ badgeId: "multi_year_2", i18nKey: "achv.years2" })).toBe("achv.r2.slot.years2");
    expect(slotNameKey({ badgeId: "qualified_weeks_4", i18nKey: "achv.weeks4" })).toBe("achv.weeks4");
    expect(translate("ar", "achv.r2.slot.years2")).toBe("سنتين");
  });
  it("the quest slot stacks every earned quest and shows the newest one's month", () => {
    const cab = [...sampleCabinet(), earned("quest_craft", 400, "2026-09-30"), earned("quest_rhythm", 380, "2026-08-31")];
    const q = shelves(cab)[1]!.items.find((i) => i.slot === "quest")!;
    expect([q.badgeId, q.count, q.state, q.i18nKey]).toEqual(["quest_craft", 2, "earned", "achv.r2.quests"]);
    expect(monthOf(q.row)).toBe(9);
    // A never-earned repeatable opens a locked stand-in drawn from the catalog.
    const pin = shelves(cab)[0]!.items.find((i) => i.slot === "pin_target")!;
    expect([slotRow(pin).status, slotRow(pin).badgeId, slotRow(pin).family]).toEqual(["locked", "pin_target", "pin_target"]);
  });
  it("partial = 1–5 earned slots; nothing earned shows full (all locked) shelves", () => {
    expect(isPartialCabinet(shelves(sampleCabinet()))).toBe(false);
    expect(isPartialCabinet(shelves([earned("first_session", 1)]))).toBe(true);
    expect(isPartialCabinet(shelves([]))).toBe(false);
  });
  it("4 / 3 / 2 columns by fontScale", () => {
    expect([shelfColumns(1), shelfColumns(1.3), shelfColumns(1.31), shelfColumns(1.6), shelfColumns(1.61)]).toEqual([4, 4, 3, 3, 2]);
  });
});

describe("CabinetShelf render", () => {
  const strength = () => shelves(sampleCabinet())[0]!.items;
  const slots = (tree: unknown) => byType(tree, "Pressable");
  it("EN: name + state line per slot, ×N isolated, ghost medals behind a stack, ≥104 dp slots with a hint", () => {
    const tree = expand(React.createElement(CabinetShelf, { shelf: "strength", items: strength(), onOpen: () => {} }));
    const all = texts(tree);
    expect(all).toContain("Strength");
    expect(all).toContain(`${iso("1")} of ${iso("6")}`);
    expect(all).toContain("Verified strength PR");
    expect(all).toContain(iso("\u00d74"));
    expect(all.filter((s) => s === "Locked")).toHaveLength(4);
    const s = slots(tree);
    expect(s).toHaveLength(6);
    for (const p of s) {
      expect(p.props.accessibilityHint).toBe("Opens details");
      expect(p.props.style({ pressed: false }).minHeight).toBe(SLOT_MIN_HEIGHT);
      expect(p.props.style({ pressed: false }).width).toBe("25%");
    }
    const pr = s.find((p) => String(p.props.accessibilityLabel).startsWith(iso("Verified strength PR")))!;
    expect(byType(pr, "Svg")).toHaveLength(3);
    expect(nodes(pr).filter((n) => n.props.style?.opacity === 0.4)).toHaveLength(1);
    const wh = s.find((p) => String(p.props.accessibilityLabel).startsWith(iso("Workhorse")))!;
    expect(wh.props.accessibilityValue).toEqual({ min: 0, max: 3, now: 2 });
    expect(byType(tree, "Svg").every((n) => n.props.width === SHELF_MEDAL)).toBe(true);
    // Ledge under each row of 4 (6 slots → 2 rows).
    expect(nodes(tree).filter((n) => n.props.style?.height === 10)).toHaveLength(2);
  });
  it("AR: Arabic labels, ×N still one isolated LTR run, x من y", () => {
    settings.lang = "ar";
    const tree = expand(React.createElement(CabinetShelf, { shelf: "strength", items: strength(), onOpen: () => {} }));
    const all = texts(tree);
    expect(all).toContain("القوة");
    expect(all).toContain(`${iso("1")} من ${iso("6")}`);
    expect(all).toContain(iso("\u00d74"));
    expect(all.join(" ")).not.toContain("4\u00d7");
    expect(all.filter((s) => s === "لسه")).toHaveLength(4);
  });
  it("tracks get their labels; 3 columns at large text", () => {
    settings.fontScale = 1.5;
    const tree = expand(React.createElement(CabinetShelf, { shelf: "lifetime", items: shelves(sampleCabinet())[2]!.items, onOpen: () => {} }));
    expect(texts(tree)).toEqual(expect.arrayContaining(["Training days", "Years", "100 days", "1000 days", "2 years"]));
    expect(slots(tree)[0]!.props.style({ pressed: false }).width).toBe(`${100 / 3}%`);
  });
  it("partial: earned + next 2 and a See all toggle", () => {
    const items = shelves([earned("first_session", 1), progress("qualified_weeks_4", 1, 4), progress("qualified_weeks_12", 1, 12)])[1]!.items;
    const tree = expand(React.createElement(CabinetShelf, { shelf: "consistency", items, partial: true, onOpen: () => {} }));
    expect(slots(tree)).toHaveLength(3);
    const toggle = byType(tree, "QuietAction")[0]!;
    expect(toggle.props.label).toBe(`See all ${iso("5")}`);
    expect(toggle.props.expanded).toBe(false);
  });
});

describe("Almost there, month seal, ledger teaser", () => {
  it("Almost there: 84 dp medals with a ring and progress values", () => {
    const rows = [progress("dedicated_50", 38, 50), progress("multi_year_5", 3, 5)];
    const tree = expand(React.createElement(AlmostThere, { rows, onOpen: () => {} }));
    expect(byType(tree, "Svg").map((n) => n.props.width)).toEqual([ALMOST_MEDAL, ALMOST_MEDAL]);
    expect(byType(tree, "Pressable")[0]!.props.accessibilityValue).toEqual({ min: 0, max: 50, now: 38 });
    expect(expand(React.createElement(AlmostThere, { rows: [], onOpen: () => {} }))).toBeNull();
  });
  it("first-run: 'Your first medal' with how to get it", () => {
    const first = row({ id: "locked:first_session", badgeId: "first_session", status: "locked", earnedAtUtc: null, earnedLocalDate: null });
    const tree = expand(React.createElement(AlmostThere, { rows: [], first, onOpen: () => {} }));
    expect(texts(tree)).toEqual(expect.arrayContaining(["First session", `${iso("0")} of ${iso("1")}`, "Finish one workout with 3 working sets."]));
  });
  const quest = (over: Record<string, unknown>) => ({
    month: "2026-10",
    status: "offered" as const,
    offers: [
      { kind: "rhythm" as const, titleKey: "quest.rhythm.title", target: 3, payload: { targetWeeks: 3 } },
      { kind: "craft" as const, titleKey: "quest.craft.title", target: 1, payload: {} },
    ],
    picked: null,
    canSwap: true,
    progress: { current: 0, target: 3, complete: false },
    ...over,
  }) as never;
  it("seal modes and the pick prompt (opens the offers)", () => {
    expect(sealMode(null)).toBe("none");
    expect(sealMode(quest({}))).toBe("pick");
    const picked = { kind: "rhythm", titleKey: "quest.rhythm.title", target: 3, payload: { targetWeeks: 3 } };
    expect(sealMode(quest({ status: "picked", picked }))).toBe("progress");
    expect(sealMode(quest({ status: "completed", picked }))).toBe("done");
    expect(questMonth(quest({}))).toBe(10);
    const tree = expand(React.createElement(MonthSeal, { quest: quest({}), onChanged: () => {} }));
    expect(byType(tree, "BigButton").map((b) => b.props.label)).toEqual(["Pick this month's quest", "Choose this quest", "Choose this quest"]);
  });
  it("seal in progress: ring, month numeral and spoken progress", () => {
    const picked = { kind: "rhythm", titleKey: "quest.rhythm.title", target: 3, payload: { targetWeeks: 3 } };
    const tree = expand(React.createElement(MonthSeal, { quest: quest({ status: "picked", picked, progress: { current: 2, target: 3, complete: false } }), onChanged: () => {} }));
    const card = byType(tree, "Pressable")[0]!;
    expect(card.props.accessibilityLabel).toBe(`This month's quest, ${iso("Hit 3 qualified weeks this month")}, ${iso("2")} of ${iso("3")}`);
    expect(card.props.accessibilityValue).toEqual({ min: 0, max: 3, now: 2 });
    expect(byType(tree, "SvgText").map((n) => n.props.children)).toEqual(["10"]);
  });
  it("ledger teaser: hidden when empty; summary + latest 3 newest first", () => {
    expect(expand(React.createElement(LedgerTeaser, { earned: [], onOpenLedger: () => {}, onOpen: () => {} }))).toBeNull();
    const rows = [earned("first_session", 10, "2024-03-09"), earned("qualified_weeks_4", 20, "2024-04-02"), earned("dedicated_10", 30, "2024-07-01"), earned("comeback", 40, "2025-08-01")];
    const tree = expand(React.createElement(LedgerTeaser, { earned: rows, onOpenLedger: () => {}, onOpen: () => {} }));
    const buttons = byType(tree, "Pressable");
    expect(buttons).toHaveLength(4);
    expect(String(buttons[0]!.props.accessibilityLabel)).toContain("Comeback");
    expect(texts(tree)).toContain("Open the Ledger");
  });
});
