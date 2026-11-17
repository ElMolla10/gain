import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LRI, NBSP, PDI, translate } from "../src/i18n/format";
import { medalsValue, plateCopy, sleeveCopy } from "../src/logic/achievementCopy";
import { achievementArtDark, achievementArtLight, PLATE_COLOURS } from "../src/palettes";
import { byType, expand, nodes, texts } from "./achievementRender";

const settings = vi.hoisted(() => ({ lang: "en" as "en" | "ar", fontScale: 1, dark: true }));
vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig()));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", useWindowDimensions: () => ({ fontScale: settings.fontScale, width: 400, height: 800 }) }));
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
vi.mock("../src/ui", () => ({ AppText: "AppText", Card: "Card" }));

import { LifetimePlate, PLATE_SIZE, PLATE_SIZE_LARGE_TEXT } from "../src/components/achievements/LifetimePlate";
import { StatTileRow } from "../src/components/achievements/StatTiles";
import { WeekSleeve } from "../src/components/achievements/WeekSleeve";

const iso = (s: string) => `${LRI}${s}${PDI}`;
const t = (lang: "en" | "ar") => (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(lang, k, p);
const render = (el: React.ReactElement) => expand(el);

beforeEach(() => {
  settings.lang = "en";
  settings.fontScale = 1;
  settings.dark = true;
});

describe("collection plate presentation",()=>{
 it.each(["en","ar"] as const)("%s speaks the current tier and remaining dates",lang=>{
  const copy=plateCopy(76,false,lang,t(lang));expect(copy.empty).toBe(false);expect(copy.caption).toContain("24");expect(copy.a11y).toContain("76");
  expect(plateCopy(9,false,lang,t(lang)).empty).toBe(true);
 });
 it("uses the actual engraved plate art with an open hub",()=>{
  const tree=render(React.createElement(LifetimePlate,{days:76}));expect(byType(tree,"SvgXml")[0]!.props.xml).toContain('>50</text>');expect(byType(tree,"SvgXml")[0]!.props.xml).toContain('r="11.6"');
  expect(nodes(tree)[0]!.props.accessibilityRole).toBe("image");
 });
 it("shrinks at accessibility text sizes without squeezing localized captions",()=>{
  settings.fontScale=1.5;const tree=render(React.createElement(LifetimePlate,{days:76}));expect(byType(tree,"SvgXml")[0]!.props.width).toBe(PLATE_SIZE_LARGE_TEXT);
 });
 it("engraves the special 1K plate in lime",()=>{
  const tree=render(React.createElement(LifetimePlate,{days:1000}));const xml=byType(tree,"SvgXml")[0]!.props.xml;expect(xml).toContain('>1K</text>');expect(xml).toContain('#b9d929');
 });
 it("keeps the medal denominator at 15 in both languages",()=>{
  for(const lang of ["en","ar"] as const)expect(medalsValue(1,15,t(lang))).toContain("15");
 });
});

describe("WeekSleeve", () => {
  it("loads solid plates for done days and dashed ghosts for the rest; one progressbar element", () => {
    const tree = render(React.createElement(WeekSleeve, { qualifiedDays: 1, dayTarget: 2 }));
    const bar = nodes(tree).find((n) => n.props.accessibilityRole === "progressbar")!;
    expect(bar.props.accessibilityLabel).toBe(`This week: ${iso("1")} of ${iso("2")} days`);
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 2, now: 1 });
    const rects = byType(tree, "Rect");
    expect(rects.filter((r) => r.props.fill === achievementArtDark.loaded)).toHaveLength(1);
    expect(rects.filter((r) => r.props.strokeDasharray === "4 3")).toHaveLength(1);
    expect(texts(tree)).toEqual(["This week", `${iso("1")} of ${iso("2")} days loaded`, "Rest days never unload the bar."]);
  });
  it("mirrors the art (not the text) in Arabic", () => {
    settings.lang = "ar";
    const tree = render(React.createElement(WeekSleeve, { qualifiedDays: 2, dayTarget: 2 }));
    const flipped = nodes(tree).filter((n) => JSON.stringify(n.props.style ?? {}).includes('"scaleX":-1'));
    expect(flipped).toHaveLength(1);
    expect(byType(flipped[0], "Svg")).toHaveLength(1);
    expect(byType(flipped[0], "AppText")).toHaveLength(0);
    expect(texts(tree)).toContain(translate("ar", "achv.pulse.qualified"));
  });
});

describe("StatTileRow", () => {
  const tiles = (lang: "en" | "ar") => [
    { value: "96", label: translate(lang, "achv.r2.stat.weeks"), onPress: vi.fn() },
    { value: "37", label: translate(lang, "achv.r2.stat.prs") },
    { value: medalsValue(11, 17, t(lang)), label: translate(lang, "achv.r2.stat.medals") },
  ];
  it("three tiles in a row, ≥64 dp; only a tile that leads somewhere is a button", () => {
    const tree = render(React.createElement(StatTileRow, { tiles: tiles("en") }));
    const row = nodes(tree)[0]!;
    expect(row.props.style.flexDirection).toBe("row");
    const buttons = nodes(tree).filter((n) => n.props.accessibilityRole === "button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.props.accessibilityLabel).toBe("96 Qualified weeks");
    const statics = nodes(tree).filter((n) => n.props.accessible && !n.props.accessibilityRole);
    expect(statics.every((n) => n.props.style.minHeight >= 64)).toBe(true);
  });
  it("stacks to one column above fontScale 1.3; AR medals read with من", () => {
    settings.fontScale = 1.4;
    settings.lang = "ar";
    const tree = render(React.createElement(StatTileRow, { tiles: tiles("ar") }));
    expect(nodes(tree)[0]!.props.style.flexDirection).toBe("column");
    expect(texts(tree).join(" ")).toContain("من");
    expect(texts(tree).join(" ")).not.toContain("/");
  });
});
