import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LRI, NBSP, PDI, translate } from "../src/i18n/format";
import { medalsValue, plateCopy, sleeveCopy } from "../src/logic/achievementCopy";
import { achievementArtDark, achievementArtLight, PLATE_COLOURS } from "../src/palettes";
import { byType, expand, nodes, texts } from "./achievementRender";

const settings = vi.hoisted(() => ({ lang: "en" as "en" | "ar", fontScale: 1, dark: true }));
vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig()));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", useWindowDimensions: () => ({ fontScale: settings.fontScale, width: 400, height: 800 }) }));
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

describe("plate copy", () => {
  it("EN: tier, days to the next plate, one spoken label", () => {
    const c = plateCopy(412, false, "en", t("en"));
    expect(c.numeral).toBe("412");
    expect(c.label).toBe("training days");
    expect(c.caption).toBe(`${iso("Yellow plate")} · ${iso("88")} days to ${iso("the blue plate")}`);
    expect(c.a11y.startsWith(`${iso("412 training days")}, `)).toBe(true);
    expect(plateCopy(1, false, "en", t("en")).label).toBe("training day");
    expect(plateCopy(99, false, "en", t("en")).caption).toContain(`${iso("1")} day to`);
  });
  it("AR: Arabic count nouns, Arabic values never LTR-isolated, Western digits", () => {
    const c = plateCopy(412, false, "ar", t("ar"));
    expect(c.label).toBe("يوم تمرين");
    expect(c.caption).toBe(`\u2068طارة صفرا${PDI} · فاضل ${iso("88")} يوم على \u2068الطارة الزرقا${PDI}`);
    expect(c.caption).not.toContain(`${LRI}طارة`);
    expect(plateCopy(5, false, "ar", t("ar")).label).toBe("أيام تمرين");
    expect(plateCopy(95, false, "ar", t("ar")).caption).toContain(`فاضل ${iso("5")} أيام`);
    expect(c.a11y).toContain("،");
  });
  it("the red plate has no next; the floor reads 1000+; zero is the empty state", () => {
    expect(plateCopy(1043, false, "en", t("en")).caption).toBe(`${iso("Red plate")} · the top plate`);
    expect(plateCopy(1000, true, "en", t("en")).numeral).toBe("1000+");
    const empty = plateCopy(0, false, "en", t("en"));
    expect([empty.empty, empty.caption, empty.body]).toEqual([true, "Your first plate is waiting", "A training day counts once you log 3 working sets."]);
    expect(plateCopy(null, false, "ar", t("ar")).caption).toBe("أول طارة مستنياك");
  });
  it("sleeve and medals: Arabic uses من, never a slash", () => {
    expect(sleeveCopy(1, 2, t("en")).line).toBe(`${iso("1")} of ${iso("2")} days loaded`);
    expect(sleeveCopy(2, 2, t("en")).line).toBe("This week is qualified.");
    expect(sleeveCopy(1, 2, t("ar")).line).toBe(`${iso("1")} من ${iso("2")} أيام على البار`);
    expect(sleeveCopy(1, 2, t("ar")).a11y).toBe(`الأسبوع ده: ${iso("1")} من ${iso("2")} أيام`);
    expect(medalsValue(11, 17, t("en"))).toBe(`${iso("11")}${NBSP}/${NBSP}${iso("17")}`);
    const ar = medalsValue(11, 17, t("ar"));
    expect(ar).toBe(`${iso("11")} من ${iso("17")}`);
    expect(ar).not.toContain("/");
  });
});

describe("LifetimePlate", () => {
  it("is one accessibility element; the art is hidden; numeral and label are UI text in the collar", () => {
    const tree = render(React.createElement(LifetimePlate, { days: 412, daysIsFloor: false }));
    const root = nodes(tree)[0]!;
    expect(root.props.accessible).toBe(true);
    expect(root.props.accessibilityLabel).toBe(plateCopy(412, false, "en", t("en")).a11y);
    const svg = byType(tree, "Svg")[0]!;
    expect(svg.props.accessibilityElementsHidden).toBe(true);
    expect(svg.props.width).toBe(PLATE_SIZE);
    expect(svg.props.style).toEqual({ direction: "ltr" });
    expect(texts(tree)).toEqual(["412", "training days", plateCopy(412, false, "en", t("en")).caption]);
    // Numeral is pure digits, so it may be drawn ltr (S-1); the label is not.
    const [numeral, label] = byType(tree, "AppText");
    expect(numeral!.props.ltr).toBe(true);
    expect(label!.props.ltr).toBeUndefined();
  });
  it("draws the yellow face and an arc in the NEXT plate's colour; engraving is Latin brand + numerals only", () => {
    const tree = render(React.createElement(LifetimePlate, { days: 412 }));
    const stops = byType(tree, "Stop").map((s) => s.props.stopColor);
    expect(stops).toContain(PLATE_COLOURS.yellow.face);
    const arc = byType(tree, "Circle").find((c) => c.props.strokeDasharray);
    expect(arc!.props.stroke).toBe(PLATE_COLOURS.blue.arcDark);
    const engraving = byType(tree, "TextPath")[0]!.props.children as string;
    expect(engraving).toMatch(/^[A-Z0-9 ·]+$/);
    expect(engraving).toContain("GAIN · 250");
    settings.dark = false;
    const light = render(React.createElement(LifetimePlate, { days: 412 }));
    expect(byType(light, "Circle").find((c) => c.props.strokeDasharray)!.props.stroke).toBe(PLATE_COLOURS.blue.arcLight);
  });
  it("mono fallback and the red plate use the accent arc (olive on light, never lime: S-10)", () => {
    const mono = render(React.createElement(LifetimePlate, { days: 412, variant: "mono" }));
    expect(byType(mono, "Circle").find((c) => c.props.strokeDasharray)!.props.stroke).toBe(achievementArtDark.arcDone);
    settings.dark = false;
    const red = render(React.createElement(LifetimePlate, { days: 1043 }));
    expect(byType(red, "Circle").find((c) => c.props.strokeDasharray)!.props.stroke).toBe(achievementArtLight.arcDone);
    expect(achievementArtLight.arcDone).toBe("#3C5700");
  });
  it("empty: dashed outline, no arc, the first-plate copy", () => {
    const tree = render(React.createElement(LifetimePlate, { days: 0 }));
    expect(byType(tree, "Circle").some((c) => c.props.strokeDasharray === "6 5")).toBe(true);
    expect(byType(tree, "Circle").some((c) => typeof c.props.strokeDasharray === "string" && c.props.strokeDasharray.includes(" 653"))).toBe(false);
    expect(texts(tree)).toContain("Your first plate is waiting");
  });
  it("large text: the plate shrinks to 200 and the label moves under it", () => {
    settings.fontScale = 1.5;
    const tree = render(React.createElement(LifetimePlate, { days: 412 }));
    expect(byType(tree, "Svg")[0]!.props.width).toBe(PLATE_SIZE_LARGE_TEXT);
    expect(texts(tree)).toEqual(["412", "412 training days", plateCopy(412, false, "en", t("en")).caption]);
  });
  it("AR render: label in Arabic, numeral stays digits, the art does not mirror", () => {
    settings.lang = "ar";
    const tree = render(React.createElement(LifetimePlate, { days: 1043 }));
    expect(texts(tree).slice(0, 2)).toEqual(["1043", "يوم تمرين"]);
    expect(byType(tree, "Svg")[0]!.props.style).toEqual({ direction: "ltr" });
    expect(nodes(tree).some((n) => JSON.stringify(n.props.style ?? {}).includes("scaleX"))).toBe(false);
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
