import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { GymLoadSpec } from "@gain/engine";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isolateLtr, LRI, NBSP, PDI, translate } from "../src/i18n/format";
import { barLayout, barShapeCount, plateLook } from "../src/logic/barArt";
import { defaultGymLoads } from "../src/logic/defaultGym";
import { todayHero, type HeroExercise, type TodayHero } from "../src/logic/todayHero";
import { engravingPlates, heroA11yLabel, heroNumberText, type Shown } from "../src/logic/todayHeroText";
import { BAR_STEEL, darkPalette, lightPalette, PLATE_NUMERAL_INK, TODAY_PLATES, type TodayPlateName } from "../src/palettes";
import { byType, expand, nodes, texts } from "./achievementRender";

const settings = vi.hoisted(() => ({ lang: "en" as "en" | "ar", fontScale: 1 }));
vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig(), { useContext: () => null }));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", useWindowDimensions: () => ({ fontScale: settings.fontScale, width: 400, height: 800 }) }));
vi.mock("react-native-svg", () => ({ default: "Svg", Circle: "Circle", Defs: "Defs", Ellipse: "Ellipse", G: "G", Line: "Line", LinearGradient: "LinearGradient", Path: "Path", Polygon: "Polygon", Rect: "Rect", Stop: "Stop", Text: "SvgText" }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ lang: settings.lang, unit: "kg", direction: settings.lang === "ar" ? "rtl" : "ltr", t: (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(settings.lang, k, p) }) }));
vi.mock("../src/theme", () => ({
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  type: { display: 48, load: 36, title: 28, section: 20, body: 16, label: 14, caption: 13 },
  usePalette: () => ({ muted: "muted", text: "text", edge: "edge", accent: "accent" }),
  useIsDark: () => true,
}));
vi.mock("../src/ui", () => ({ AppText: "AppText", QuietAction: "QuietAction" }));

import { TodayBar } from "../src/components/today/TodayBar";

const L = { s: "s", m: "m" };
const gym = (extra: GymLoadSpec[] = []) => ({ gymId: "g", loads: [...defaultGymLoads("kg").filter((s) => !extra.some((e) => e.equipment === s.equipment)), ...extra] });
const ex = (over: Partial<HeroExercise> = {}): HeroExercise => ({ exerciseId: "bench", nameEn: "Barbell Bench Press", nameAr: "بنش برس", equipment: "barbell", setup: "free", measure: "reps", pattern: "horizontal_push", loadSpec: null, isGoalLift: true, ...over });
const hero = (load: number, over: Partial<HeroExercise> = {}, g = gym(), reps = 6, normalLoad?: number): TodayHero => todayHero({ target: { exerciseId: "bench", load, reps, measure: "reps" }, exercise: ex(over), gym: g, normalLoad })!;
const t = (lang: "en" | "ar") => (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(lang, k, p);
const strip = (s: string) => s.replace(/[\u2066-\u2069]/g, "");
const render = (h: TodayHero, name = "Barbell Bench Press", onOpenPath?: () => void) => expand(React.createElement(TodayBar, { hero: h, name, onOpenPath }));

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

beforeEach(() => {
  settings.lang = "en";
  settings.fontScale = 1;
});

describe("Today's Bar tokens (spec §2.1)", () => {
  const names = Object.keys(TODAY_PLATES) as TodayPlateName[];
  it("dark: every plate face ≥ 3:1 on the background, or its lip / bevel (iron)", () => {
    for (const n of names) expect(Math.max(contrast(TODAY_PLATES[n].face, darkPalette.bg), contrast(TODAY_PLATES[n].lip, darkPalette.bg)), n).toBeGreaterThanOrEqual(3);
  });
  it("light: every plate lip ≥ 3:1 on bone; light bar steel ≥ 3:1", () => {
    for (const n of names) expect(contrast(TODAY_PLATES[n].lip, lightPalette.bg), n).toBeGreaterThanOrEqual(3);
    expect(contrast(BAR_STEEL.light.base, lightPalette.bg)).toBeGreaterThanOrEqual(3);
  });
  it("face-on numerals ≥ 4.5:1", () => {
    for (const n of names) expect(contrast(PLATE_NUMERAL_INK[n], TODAY_PLATES[n].face), n).toBeGreaterThanOrEqual(4.5);
  });
});

describe("bar geometry (spec §2.2)", () => {
  it("worst case [25,25,25,5,2.5,1.25] fits the sleeve in ≤ 24 shapes, mirrored about the centre", () => {
    const l = barLayout([25, 25, 25, 5, 2.5, 1.25], { unit: "kg" });
    expect(barShapeCount(l)).toBeLessThanOrEqual(24);
    const left = l.plates.slice(0, 6);
    const right = l.plates.slice(6);
    expect(Math.min(...left.map((p) => p.x))).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < 6; i++) expect(left[i]!.x + left[i]!.w + right[i]!.x).toBeCloseTo(380, 6);
    expect(left.map((p) => p.token)).toEqual(["red", "red", "red", "white", "red", "chrome"]);
  });
  it("plates stack from the inner collar outward, heaviest first; an empty bar has no clamps", () => {
    const l = barLayout([25, 15, 1.25], { unit: "kg" });
    const left = l.plates.slice(0, 3);
    expect(left[0]!.x).toBeGreaterThan(left[1]!.x);
    expect(left[0]!.h).toBeGreaterThan(left[2]!.h);
    expect(barLayout([], { unit: "kg" }).clamps).toEqual([]);
    expect(plateLook(20.41166, "lb").token).toBe("iron");
  });
  it("the rendered bar draws exactly barShapeCount shapes", () => {
    const tree = render(hero(187.5));
    const svg = byType(tree, "Svg")[0]!;
    const shapes = nodes(svg).filter((n) => ["Rect", "Ellipse", "Circle", "Path", "Line", "Polygon"].includes(n.type as string));
    expect(shapes.length).toBe(barShapeCount(barLayout([25, 25, 25, 5, 2.5, 1.25], { unit: "kg" })));
  });
});

describe("number line and engraving bidi", () => {
  it("AR number = isolateLtr(102.5) NBSP كجم NBSP × NBSP isolateLtr(6); EN keeps the same order", () => {
    expect(heroNumberText(hero(102.5) as Shown, "ar", "kg", L)).toBe(`${isolateLtr("102.5")}${NBSP}كجم${NBSP}×${NBSP}${isolateLtr("6")}`);
    expect(strip(heroNumberText(hero(102.5) as Shown, "en", "kg", L))).toBe(`102.5${NBSP}kg${NBSP}×${NBSP}6`);
  });
  it("the engraving keeps logical heaviest-first order and isolates only numbers", () => {
    expect(engravingPlates([25, 15, 1.25], "kg")).toBe(`${isolateLtr("25")} · ${isolateLtr("15")} · ${isolateLtr("1.25")}`);
  });
  it("no Arabic inside any LRI isolate in either rendered tree", () => {
    for (const lang of ["en", "ar"] as const) {
      settings.lang = lang;
      for (const h of [hero(102.5), hero(20), hero(28, { equipment: "dumbbell" }), hero(50, { equipment: "cable" }), hero(10, { equipment: "plate", setup: "bodyweight_plus_added" })]) {
        for (const s of texts(render(h, lang === "ar" ? "بنش برس" : "Bench"))) {
          for (const m of s.matchAll(new RegExp(`${LRI}([^${PDI}]*)${PDI}`, "g"))) expect(m[1]).not.toMatch(/[\u0600-\u06FF]/);
        }
      }
    }
  });
});

describe("TodayBar presentation (EN / AR)", () => {
  it("EN barbell: eyebrow, 48/20/36 number, the plate line; one a11y element with the art hidden", () => {
    const tree = render(hero(102.5));
    const all = texts(tree).map(strip);
    expect(all[0]).toBe("Barbell Bench Press · Goal lift");
    const deep = (c: unknown): string => (typeof c === "string" || typeof c === "number" ? String(c) : Array.isArray(c) ? c.map(deep).join("") : c && typeof c === "object" && "props" in c ? deep((c as { props: { children: unknown } }).props.children) : "");
    const line = byType(tree, "AppText").find((n) => n.props.style?.fontSize === 48)!;
    expect(strip(deep(line.props.children))).toBe(`102.5${NBSP}kg${NBSP}×${NBSP}6`);
    expect(all.some((s) => s.startsWith("Each side: 25 · 15 · 1.25"))).toBe(true);
    const sizes = byType(tree, "AppText").map((n) => n.props.style?.fontSize);
    expect(sizes).toEqual(expect.arrayContaining([48, 20, 36]));
    const a11y = nodes(tree).filter((n) => n.props.accessible);
    expect(a11y).toHaveLength(1);
    expect(byType(tree, "Svg")[0]!.props.accessibilityElementsHidden).toBe(true);
    expect(byType(tree, "Svg")[0]!.props.style.direction).toBe("ltr");
  });
  it("AR: no caps or letter spacing on the eyebrow; the art does not mirror", () => {
    settings.lang = "ar";
    const tree = render(hero(102.5), "بنش برس");
    const eyebrow = byType(tree, "AppText")[0]!;
    expect(eyebrow.props.style.letterSpacing ?? 0).toBe(0);
    expect(eyebrow.props.style.textTransform).toBeUndefined();
    expect(strip(texts(tree)[0]!)).toBe("بنش برس · تمرين الهدف");
    expect(byType(tree, "Svg")[0]!.props.style.direction).toBe("ltr");
  });
  it("Warm-ups opens the load path, outside the hero element; none on assisted", () => {
    const open = vi.fn();
    const tree = render(hero(102.5), "Bench", open);
    const q = byType(tree, "QuietAction");
    expect(q).toHaveLength(1);
    q[0]!.props.onPress();
    expect(open).toHaveBeenCalled();
    expect(byType(render(hero(25, { equipment: "assisted", setup: "assisted" }), "Assisted pull-up", open), "QuietAction")).toHaveLength(0);
  });
  it("art slot 132, 96 above fontScale 1.3", () => {
    expect(byType(render(hero(102.5)), "Svg")[0]!.props.height).toBe(132);
    settings.fontScale = 1.5;
    expect(byType(render(hero(102.5)), "Svg")[0]!.props.height).toBe(96);
  });
  it("the stack prints no number on the pin", () => {
    const tree = render(hero(50, { equipment: "cable" }), "Lat pulldown");
    expect(byType(tree, "SvgText")).toHaveLength(0);
  });
});

describe("hero accessibility label (spec §8)", () => {
  const label = (h: TodayHero, name: string, lang: "en" | "ar" = "en") => strip(heroA11yLabel(h, t(lang), lang, "kg", L, name));
  it("barbell, nearest, empty, lighter week", () => {
    expect(label(hero(102.5), "Barbell bench press")).toBe("Barbell bench press, goal lift. Target 102.5 kilograms for 6. Per side: 25, 15, 1.25.");
    const near = hero(102.5, {}, gym([{ equipment: "barbell", increment: 2.5, min: 20, max: 200, plates: [5, 10, 15, 20, 25] }]));
    expect(label(near, "Bench")).toContain("Nearest you can load: 100 kilograms; the target was 102.5.");
    expect(label(hero(20), "Bench")).toContain("Empty bar, 20 kilograms.");
    expect(label(hero(90, {}, gym(), 6, 102.5), "Bench")).toContain("Lighter week: 90 kilograms, normally 102.5.");
  });
  it("stack, assisted, belt", () => {
    expect(label(hero(50, { equipment: "cable", isGoalLift: false }), "Lat pulldown")).toBe("Lat pulldown. Stack 50 kilograms for 6.");
    expect(label(hero(25, { equipment: "assisted", setup: "assisted", isGoalLift: false }), "Assisted pull-up")).toBe("Assisted pull-up. Assistance 25 kilograms; less assistance is stronger.");
    expect(label(hero(10, { equipment: "plate", setup: "bodyweight_plus_added", isGoalLift: false }, gym(), 8), "Dips")).toBe("Dips. Bodyweight plus 10 kilograms on the belt, for 8.");
  });
  it("Arabic label reads in Arabic with Western digits", () => {
    const s = label(hero(102.5), "بنش برس", "ar");
    expect(s).toContain("الهدف 102.5 كيلو");
    expect(s).toContain("كل ناحية: 25، 15، 1.25");
  });
});

describe("art never mirrors", () => {
  it("no scaleX(-1) in components/today", () => {
    const dir = join(__dirname, "..", "src", "components", "today");
    for (const f of readdirSync(dir)) expect(readFileSync(join(dir, f), "utf8"), f).not.toMatch(/scaleX/);
  });
});
