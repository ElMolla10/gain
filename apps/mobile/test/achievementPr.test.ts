import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LRI, NBSP, PDI, translate } from "../src/i18n/format";
import { enProgress, arProgress } from "../src/i18n/strings.progress";
import { prCopy } from "../src/logic/achievementCopy";
import { latestPr, prBaseline, prStair, stairGeometry, STAIR_H } from "../src/logic/achievementShowcase";
import { byType, expand, nodes, texts } from "./achievementRender";
import { BENCH, CURL, PULLUP, pr, sampleCabinet } from "./achievementFixtures";

const settings = vi.hoisted(() => ({ lang: "en" as "en" | "ar", fontScale: 1 }));
vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig()));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", ScrollView: "ScrollView", useWindowDimensions: () => ({ fontScale: settings.fontScale, width: 400, height: 800 }) }));
vi.mock("react-native-svg", () => ({ default: "Svg", Circle: "Circle", ClipPath: "ClipPath", Defs: "Defs", Ellipse: "Ellipse", G: "G", LinearGradient: "LinearGradient", Path: "Path", RadialGradient: "RadialGradient", Rect: "Rect", Stop: "Stop", Text: "SvgText", TextPath: "TextPath" }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ lang: settings.lang, unit: "kg", direction: settings.lang === "ar" ? "rtl" : "ltr", t: (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(settings.lang, k, p) }) }));
vi.mock("../src/theme", async () => {
  const pal = await import("../src/palettes");
  return {
    space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
    radius: { button: 12, card: 16 },
    type: { display: 48, load: 36, title: 28, section: 20, body: 16, label: 14, caption: 13 },
    usePalette: () => ({ muted: "muted", text: "text", border: "border", card: "card", raised: "raised", accent: "accent", tint: "tint" }),
    useAchievementArt: () => pal.achievementArtDark,
    useIsDark: () => true,
  };
});
vi.mock("../src/ui", () => ({ AppText: "AppText", Card: "Card", SectionTitle: "SectionTitle" }));
vi.mock("../src/components/Icon", () => ({ Icon: "Icon" }));

import { PLAQUE_W, PLAQUE_W_LARGE, PrPlaques, PrSpotlight } from "../src/components/achievements/PrSpotlight";
import { PrStaircase } from "../src/components/achievements/PrStaircase";

const iso = (s: string) => `${LRI}${s}${PDI}`;
const t = (lang: "en" | "ar") => (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(lang, k, p);
const NOW = new Date(2026, 9, 18, 12).getTime();
const plain = (s: string) => s.replace(/[\u2066-\u2069]/g, "").replace(/\u00a0/g, " ");

beforeEach(() => {
  settings.lang = "en";
  settings.fontScale = 1;
});

describe("PR words", () => {
  it('AR before/after keep "16 كجم × 6" order, to the code point', () => {
    const cab = sampleCabinet();
    const c = prCopy(latestPr(cab)!, cab, "ar", "kg", t("ar"), NOW);
    expect(c.after).toBe(`${iso("16")}${NBSP}كجم${NBSP}×${NBSP}${iso("6")}`);
    expect([...c.after].map((ch) => ch.codePointAt(0)!.toString(16))).toEqual(["2066", "31", "36", "2069", "a0", "643", "62c", "645", "a0", "d7", "a0", "2066", "36", "2069"]);
    expect(c.before).toBe(`${iso("12")}${NBSP}كجم${NBSP}×${NBSP}${iso("9")}`);
    expect(c.after).not.toContain(`${LRI}كجم`);
  });
  it("the staircase spoken summary and caption", () => {
    const cab = sampleCabinet();
    const en = prCopy(latestPr(cab)!, cab, "en", "kg", t("en"), NOW);
    expect(plain(en.stairA11y)).toBe("3 verified PRs on Preacher Curl since 3 Mar, latest 16 kg × 6");
    expect(plain(en.caption)).toBe("3 verified PRs on this lift since 3 Mar");
    expect(en.caption).toContain(iso(`3${NBSP}Mar`));
    const ar = prCopy(latestPr(cab)!, cab, "ar", "kg", t("ar"), NOW);
    expect(plain(ar.stairA11y)).toBe("3 أرقام موثّقة على بريتشر كيرل من 3 مارس، آخرها 16 كجم × 6");
    const one = [pr("solo", BENCH, [60, 8], [62.5, 8], { date: "2026-06-01" })];
    expect(plain(prCopy(latestPr(one)!, one, "en", "kg", t("en"), NOW).caption)).toBe("1 verified PR on this lift since 1 Jun");
    expect(plain(prCopy(latestPr(one)!, one, "ar", "kg", t("ar"), NOW).caption)).toBe("1 رقم موثّق على التمرين ده من 1 يونيو");
  });
  it('is "Latest verified PR", never "best", in either language', () => {
    expect(translate("en", "achv.r2.pr.eyebrow")).toBe("Latest verified PR");
    expect(translate("ar", "achv.r2.pr.eyebrow")).toBe("آخر رقم موثّق");
    const r2 = (o: Record<string, string>) => Object.entries(o).filter(([k]) => k.startsWith("achv.r2."));
    for (const [k, v] of r2(enProgress)) expect(v, k).not.toMatch(/\bbest\b/i);
    for (const [k, v] of r2(arProgress)) expect(v, k).not.toMatch(/أفضل|أحسن/);
  });
});

describe("staircase", () => {
  it("one step per PR, oldest first, never coming down; rep-only steps get a tick", () => {
    const cab = sampleCabinet();
    const steps = prStair(cab, CURL);
    expect(steps.map((s) => [s.load, s.reps, s.repOnly])).toEqual([[12, 8, false], [12, 9, true], [16, 6, false]]);
    expect(prBaseline(cab, CURL)).toBe(10);
    const g = stairGeometry(steps, 10);
    const ys = [...g.path.matchAll(/V([\d.]+)/g)].map((m) => Number(m[1]));
    expect(ys).toHaveLength(3);
    for (let i = 1; i < ys.length; i++) expect(ys[i]!).toBeLessThanOrEqual(ys[i - 1]!);
    expect(ys[1]).toBe(ys[0]);
    expect(g.ticks).toHaveLength(1);
    expect(g.dot.y).toBe(ys[2]);
    expect(g.dot.y).toBeLessThan(STAIR_H / 2);
  });
  it("assisted lifts rise as assistance falls; a lighter path-B set holds the level; flat loads still step evenly", () => {
    const assisted = stairGeometry([{ load: 25, reps: 8, localDate: "a", repOnly: false }, { load: 20, reps: 8, localDate: "b", repOnly: false }], 30, true);
    const ay = [...assisted.path.matchAll(/V([\d.]+)/g)].map((m) => Number(m[1]));
    expect(ay[1]!).toBeLessThan(ay[0]!);
    const pathB = stairGeometry([{ load: 60, reps: 8, localDate: "a", repOnly: false }, { load: 57.5, reps: 10, localDate: "b", repOnly: false }], 55);
    const by = [...pathB.path.matchAll(/V([\d.]+)/g)].map((m) => Number(m[1]));
    expect(by[1]).toBe(by[0]);
    const flat = stairGeometry([{ load: 60, reps: 8, localDate: "a", repOnly: false }, { load: 60, reps: 8, localDate: "b", repOnly: false }], 60);
    const fy = [...flat.path.matchAll(/V([\d.]+)/g)].map((m) => Number(m[1]));
    expect(fy[1]!).toBeLessThan(fy[0]!);
  });
  it("never mirrors, draws no numbers, and speaks its summary", () => {
    settings.lang = "ar";
    const tree = expand(React.createElement(PrStaircase, { steps: prStair(sampleCabinet(), CURL), baseline: 10, label: "summary" }));
    const root = nodes(tree)[0]!;
    expect(root.props.style.direction).toBe("ltr");
    expect(root.props.style.transform).toBeUndefined();
    expect(root.props.accessibilityLabel).toBe("summary");
    expect(byType(tree, "SvgText")).toHaveLength(0);
  });
});

describe("spotlight and plaques", () => {
  it("EN: eyebrow, lift, before → after (36 dp), delta chip, chevron to the lift trend", () => {
    const cab = sampleCabinet();
    const opened: string[] = [];
    const tree = expand(React.createElement(PrSpotlight, { pr: latestPr(cab), cabinet: cab, onOpenTrend: (r) => opened.push(r.id), onOpen: () => {} }));
    const all = texts(tree);
    expect(all).toEqual(expect.arrayContaining(["Latest verified PR", "Preacher Curl", "Before", "Now", `Stronger at ${iso("6\u201310")} reps`]));
    const after = byType(tree, "AppText").find((n) => n.props.style?.fontSize === 36)!;
    expect(plain(String(after.props.children))).toBe("16 kg × 6");
    expect(byType(tree, "Icon")[0]!.props).toMatchObject({ name: "chevron", mirror: true });
    const card = byType(tree, "Pressable")[0]!;
    card.props.onPress();
    expect(opened).toEqual(["pr4"]);
    expect(card.props.accessibilityHint).toBe("Opens this exercise's progress");
    // The before → after arrow is upright in English.
    expect(nodes(tree).find((n) => n.props.style?.transform?.[0]?.scaleX !== undefined)!.props.style.transform[0].scaleX).toBe(1);
  });
  it("AR: the arrow mirrors, the staircase does not", () => {
    settings.lang = "ar";
    const cab = sampleCabinet();
    const tree = expand(React.createElement(PrSpotlight, { pr: latestPr(cab), cabinet: cab, onOpen: () => {} }));
    expect(nodes(tree).find((n) => n.props.style?.transform?.[0]?.scaleX !== undefined)!.props.style.transform[0].scaleX).toBe(-1);
    expect(texts(tree)).toEqual(expect.arrayContaining(["آخر رقم موثّق", "قبل", "دلوقتي"]));
  });
  it("assisted lift: the chip says less assistance", () => {
    const row = pr("a1", PULLUP, [30, 8], [25, 8], { nameEn: "Assisted Pull-up" });
    const tree = expand(React.createElement(PrSpotlight, { pr: latestPr([row]), cabinet: [row], onOpen: () => {} }));
    expect(texts(tree).some((s) => plain(s) === "−5 kg assistance")).toBe(true);
  });
  it("empty: the baseline rule", () => {
    const tree = expand(React.createElement(PrSpotlight, { pr: null, cabinet: [], onOpen: () => {} }));
    expect(texts(tree)).toEqual(["Your first verified PR is coming", "It shows up on your 3rd session of a lift. The first two set the baseline."]);
  });
  it("plaques: other lifts only, 156 dp (220 at large text), with a PR count; hidden when none", () => {
    const cab = sampleCabinet();
    let tree = expand(React.createElement(PrPlaques, { cabinet: cab, onOpen: () => {} }));
    const cards = byType(tree, "Pressable");
    expect(cards).toHaveLength(1);
    expect(cards[0]!.props.style({ pressed: false }).width).toBe(PLAQUE_W);
    expect(texts(tree)).toEqual(expect.arrayContaining(["Bench Press", `${iso("1")} PR`]));
    settings.fontScale = 1.5;
    tree = expand(React.createElement(PrPlaques, { cabinet: cab, onOpen: () => {} }));
    expect(byType(tree, "Pressable")[0]!.props.style({ pressed: false }).width).toBe(PLAQUE_W_LARGE);
    expect(expand(React.createElement(PrPlaques, { cabinet: [pr("x", BENCH, [60, 8], [62.5, 8])], onOpen: () => {} }))).toBeNull();
  });
});
