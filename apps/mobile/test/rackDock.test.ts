import type { GymLoadSpec } from "@gain/engine";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../src/i18n/format";
import { gridPlates, gridShapeCount } from "../src/logic/barArt";
import { dockModel, type DockExercise, type DockModel, type DockTimer } from "../src/logic/dockModel";
import { dockA11y, dockButtonText, dockLoggedText, dockNumberText } from "../src/logic/dockText";
import type { SetRowDraft } from "../src/logic/workoutRows";
import { byType, expand, nodes, texts } from "./achievementRender";

const settings = vi.hoisted(() => ({ lang: "en" as "en" | "ar", fontScale: 1, height: 800, dark: true, reduced: false }));
const anim = vi.hoisted(() => ({ loops: 0, timings: [] as { duration: number; native: boolean }[] }));
const hap = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("../src/haptics", () => ({ haptics: { tick: () => hap.calls.push("tick"), selection: () => hap.calls.push("selection"), pickup: () => hap.calls.push("pickup") } }));
vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig(), { useContext: () => null }));
vi.mock("react-native", () => {
  class Value { v: number; constructor(v: number) { this.v = v; } setValue(v: number) { this.v = v; } interpolate() { return this; } }
  const handle = { start: () => {}, stop: () => {} };
  return {
    View: "View", Pressable: "Pressable", ActivityIndicator: "ActivityIndicator", AccessibilityInfo: { announceForAccessibility: () => {} },
    useWindowDimensions: () => ({ fontScale: settings.fontScale, width: 412, height: settings.height }),
    Animated: { View: "Animated.View", Value, timing: (_v: unknown, c: { duration: number; useNativeDriver: boolean }) => { anim.timings.push({ duration: c.duration, native: c.useNativeDriver }); return handle; }, sequence: () => handle, parallel: () => handle, loop: () => { anim.loops++; return handle; } },
    Easing: { linear: (x: number) => x, ease: (x: number) => x, cubic: (x: number) => x, in: (f: unknown) => f, out: (f: unknown) => f, inOut: (f: unknown) => f },
  };
});
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }) }));
vi.mock("react-native-svg", () => ({ default: "Svg", Circle: "Circle", Defs: "Defs", Ellipse: "Ellipse", G: "G", LinearGradient: "LinearGradient", Path: "Path", Rect: "Rect", Stop: "Stop" }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ lang: settings.lang, unit: "kg", direction: settings.lang === "ar" ? "rtl" : "ltr", t: (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(settings.lang, k, p) }) }));
vi.mock("../src/theme", () => ({
  radius: { button: 8, card: 12 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  type: { title: 28 },
  usePalette: () => ({ fillEdge: "fillEdge" }),
  useLogPalette: () => ({ card: "card", line: "line", accent: "accent", activeBg: "activeBg", fill: "fill", onFill: "onFill", fillPressed: "fillPressed", muted: "muted", warn: "warn", text: "text", edge: "edge", field: "field" }),
  useIsDark: () => settings.dark,
}));
vi.mock("../src/ui", () => ({ AppText: "AppText", useReducedMotion: () => settings.reduced }));
vi.mock("../src/components/Icon", () => ({ Icon: "Icon" }));
vi.mock("../src/components/WorkoutStats", () => ({ RestClock: "RestClock" }));
vi.mock("../src/components/RackDockExpanded", () => ({ RackDockExpanded: "RackDockExpanded" }));

import { RackDockView, RestDrain, sameDockProps, type RackDockProps } from "../src/components/RackDock";
import { dockStep, drainFraction, RACK_MOTION, stepHaptics } from "../src/logic/rackMotion";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let n = 0;
const row = (o: Partial<SetRowDraft> = {}): SetRowDraft => ({ key: `d${n++}`, load: null, reps: null, rir: null, warmup: false, tags: [], saved: false, dirty: false, ghostLoad: 80, ghostReps: 8, ...o });
const bar: GymLoadSpec = { equipment: "barbell", min: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] };
const bench: DockExercise = { exerciseId: "bench", equipment: "barbell", loadSpec: bar };
const off: DockTimer = { on: false, endsAt: null, over: false, now: 1000 };
const strip = (s: string) => s.replace(/[\u2066-\u2069]/g, "").replace(/\u00a0/g, " ");
const t = (lang: "en" | "ar") => (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(lang, k, p);
const actions = { current: { log: vi.fn(), finish: vi.fn(), adjustRest: vi.fn(), toggleRest: vi.fn(), expandInfo: () => null } };
const props = (model: DockModel, o: Partial<RackDockProps> = {}): RackDockProps => ({ model, name: "Bench press", logged: 18, timer: { endsAt: null, durationMs: 90_000 }, restFor: null, saving: false, unit: "kg", actions, ...o });
const render = (p: RackDockProps) => expand(React.createElement(RackDockView, p));
const compact = () => dockModel([bench], { bench: [row({ saved: true, load: 70, reps: 8 }), row()] }, null, off);

beforeEach(() => {
  settings.lang = "en";
  settings.fontScale = 1;
  settings.height = 800;
  settings.dark = true;
  settings.reduced = false;
  anim.loops = 0;
  anim.timings = [];
  hap.calls = [];
});

describe("RackDock render", () => {
  it.each([["en", true], ["ar", true], ["en", false]] as const)("compact %s (dark %s): mini, number, change, Log set", (lang, dark) => {
    settings.lang = lang;
    settings.dark = dark;
    const tree = render(props(compact()));
    const all = texts(tree).map(strip);
    expect(all).toContain(lang === "en" ? "80 kg × 8" : "80 كجم × 8");
    expect(all).toContain(lang === "en" ? "+5 each side" : "حمّل 5 في كل ناحية");
    expect(all).toContain(lang === "en" ? "Log set" : "سجّل المجموعة");
    expect(byType(tree, "Svg").length).toBe(1);
    expect(byType(tree, "RestClock")).toHaveLength(0);
  });
  it("Log set stays on the physical right in both languages (the action row is LTR, the button last)", () => {
    for (const lang of ["en", "ar"] as const) {
      settings.lang = lang;
      const tree = render(props(compact()));
      const rowEl = nodes(tree).find((x) => x.type === "View" && x.props.style?.direction === "ltr" && x.props.style?.flexDirection === "row")!;
      const kids = (Array.isArray(rowEl.props.children) ? rowEl.props.children : [rowEl.props.children]).flat().filter(Boolean);
      expect(kids.at(-1).props.nativeID).toBe("rack-dock-log");
      expect(kids.at(-1).props.style({ pressed: false }).minHeight).toBeGreaterThanOrEqual(60);
      expect(kids.at(-1).props.style({ pressed: false }).minWidth).toBeGreaterThanOrEqual(152);
    }
  });
  it("rest mode shows the clock and ±15 / Stop; rest off renders no time text", () => {
    const resting = dockModel([bench], { bench: [row({ saved: true, load: 70, reps: 8 }), row()] }, null, { on: true, endsAt: 60_000, over: false, now: 1000 });
    const tree = render(props(resting, { timer: { endsAt: 60_000, durationMs: 90_000 } }));
    expect(byType(tree, "RestClock")).toHaveLength(1);
    expect(texts(tree).map(strip)).toEqual(expect.arrayContaining(["−15", "+15", "Stop", "Log set"]));
    const offTree = render(props(compact()));
    expect(byType(offTree, "RestClock")).toHaveLength(0);
    expect(texts(offTree).some((s) => /\d:\d\d/.test(s))).toBe(false);
  });
  it("over: tint, 4 dp accent edge, 'Rest is over' with a check", () => {
    const over = dockModel([bench], { bench: [row({ saved: true, load: 70, reps: 8 }), row()] }, null, { on: true, endsAt: null, over: true, now: 1000 });
    const tree = render(props(over));
    const shell = nodes(tree).find((x) => x.props.style?.borderTopWidth !== undefined)!;
    expect([shell.props.style.borderTopWidth, shell.props.style.backgroundColor, shell.props.style.borderColor]).toEqual([4, "activeBg", "accent"]);
    expect(texts(tree)).toContain("Rest is over");
  });
  it("done: All N sets logged with Finish in the Log set slot", () => {
    const done = dockModel([bench], { bench: [row({ saved: true, load: 80, reps: 8 })] }, null, off);
    const tree = render(props(done));
    expect(texts(tree).map(strip)).toEqual(expect.arrayContaining(["All 18 sets logged", "Finish"]));
    settings.lang = "ar";
    expect(texts(render(props(done))).map(strip)).toContain("اتسجّلت كل المجموعات (18)");
  });
  it("k15: no mini and a full-width Log set", () => {
    settings.fontScale = 1.5;
    const tree = render(props(compact()));
    expect(byType(tree, "Svg")).toHaveLength(0);
    const btn = nodes(tree).find((x) => x.props.nativeID === "rack-dock-log")!;
    expect(btn.props.style({ pressed: false }).alignSelf).toBe("stretch");
  });
  it("short screens (≤667): one line, no caption row, ~84 dp", () => {
    settings.height = 667;
    const tree = render(props(compact()));
    expect(texts(tree).some((s) => s.includes("Bench press ·"))).toBe(false);
    const shell = nodes(tree).find((x) => x.props.style?.borderTopWidth !== undefined)!;
    // padding 12 + Log set 60 + 12 = 84 above the bottom inset.
    expect(shell.props.style.paddingTop + 60 + (shell.props.style.paddingBottom - 20)).toBe(84);
  });
  it("invalid input: disabled with the reason as the line", () => {
    const bad = dockModel([bench], { bench: [row({ invalidReps: true })] }, null, off);
    const tree = render(props(bad));
    expect(texts(tree)).toContain("Fix the reps to log");
    const btn = nodes(tree).find((x) => x.props.nativeID === "rack-dock-log")!;
    expect(btn.props.disabled).toBe(true);
    settings.lang = "ar";
    expect(texts(render(props(bad)))).toContain("صلّح العدّات عشان تسجّل");
  });
  it("hidden while typing renders nothing", () => {
    const r = row();
    expect(render(props(dockModel([bench], { bench: [r] }, null, off, { editing: r.key })))).toBeNull();
  });
  it("art is hidden from the screen reader and never mirrors", () => {
    settings.lang = "ar";
    const svg = byType(render(props(compact())), "Svg")[0]!;
    expect(svg.props.accessibilityElementsHidden).toBe(true);
    expect(svg.props.style.direction).toBe("ltr");
  });
});

describe("dock text", () => {
  it("a11y group, button label, update label, announcement", () => {
    const m = compact();
    expect(strip(dockA11y(m, "Bench press", { lang: "en", unit: "kg", t: t("en") }))).toBe("Set 2 of 2, Bench press. 80 kg for 8 reps. +5 each side.");
    expect(strip(dockA11y(m, "بنش", { lang: "ar", unit: "kg", t: t("ar") }))).toContain("، بنش.");
    expect(dockButtonText({ ...m, update: true }, t("en"))).toBe("Update set ⁦2⁩");
    const done = dockModel([bench], { bench: [row({ saved: true, load: 80, reps: 8 })] }, null, off);
    expect(strip(dockLoggedText(m, done, { lang: "en", unit: "kg", t: t("en") }))).toBe("Set 2 of 2 logged");
  });
  it("timed and bodyweight numbers", () => {
    const m = compact();
    expect(strip(dockNumberText({ ...m, measure: "time", reps: 45 }, { lang: "en", unit: "kg", t: t("en") }))).toBe("45 s");
    expect(strip(dockNumberText({ ...m, objKind: "belt", load: 0, reps: 8 }, { lang: "en", unit: "kg", t: t("en") }))).toBe("× 8");
  });
  it("the grid mini stays ≤12 shapes at the worst case", () => {
    expect(gridPlates([25, 25, 25, 15, 5, 2.5, 1.25])).toHaveLength(4);
    expect(gridShapeCount([25, 25, 25, 15, 5, 2.5, 1.25])).toBeLessThanOrEqual(12);
  });
});

describe("dock memo", () => {
  it("same primitives = no re-render; a new model object with equal fields is equal", () => {
    const a = props(compact());
    expect(sameDockProps(a, { ...a, model: { ...a.model, perSide: [...a.model.perSide] } })).toBe(true);
    expect(sameDockProps(a, { ...a, saving: true })).toBe(false);
    expect(sameDockProps(a, { ...a, model: { ...a.model, reps: 9 } })).toBe(false);
  });
});

describe("logger motion (PR E)", () => {
  const twoEx = (rows: Record<string, SetRowDraft[]>) => dockModel([bench, { exerciseId: "db", equipment: "dumbbell", loadSpec: { equipment: "dumbbell", loads: [20, 22, 24] } }], rows, null, off);
  it("a log steps the dock: plates added = one Light; strip silent; new exercise = Selection", () => {
    const a = row({ saved: true, load: 70, reps: 8 });
    const b = row();
    const before = dockModel([bench], { bench: [a, b, row()] }, null, off);
    const added = dockModel([bench], { bench: [a, { ...b, saved: true, load: 80, reps: 8 }, row({ ghostLoad: 90 })] }, null, off);
    expect(dockStep(before, added)).toEqual({ rack: true, platesAdded: true, nextObject: false });
    expect(stepHaptics(dockStep(before, added))).toEqual(["light"]);
    const stripped = dockModel([bench], { bench: [a, { ...b, saved: true, load: 80, reps: 8 }, row({ ghostLoad: 70 })] }, null, off);
    expect(stepHaptics(dockStep(before, stripped))).toEqual([]);
    const ex1 = twoEx({ bench: [row()], db: [row({ ghostLoad: 22 })] });
    const ex2 = twoEx({ bench: [row({ saved: true, load: 80, reps: 8 })], db: [row({ ghostLoad: 22 })] });
    expect(stepHaptics(dockStep(ex1, ex2))).toEqual(["selection"]);
  });
  it("typing never animates: a hidden model steps nothing", () => {
    const r = row();
    const hidden = dockModel([bench], { bench: [r] }, null, off, { editing: r.key });
    expect(dockStep(hidden, compact())).toEqual({ rack: false, platesAdded: false, nextObject: false });
    expect(dockStep(compact(), hidden)).toEqual({ rack: false, platesAdded: false, nextObject: false });
  });
  it("rest drain: one native scaleX timing; Reduce Motion is a static hairline with a fill ratio", () => {
    expect(drainFraction(61_000, 90_000, 16_000)).toBeCloseTo(0.5);
    const now = Date.now();
    const drawn = expand(React.createElement(RestDrain, { endsAt: now + 45_000, durationMs: 90_000, reduced: false, rtl: true, color: "accent" })) as { type: string; props: { style: { transformOrigin: string } } };
    expect(drawn.type).toBe("Animated.View");
    expect(drawn.props.style.transformOrigin).toBe("right");
    const still = expand(React.createElement(RestDrain, { endsAt: now + 45_000, durationMs: 90_000, reduced: true, rtl: false, color: "accent" })) as { type: string; props: { style: { width: string } } };
    expect(still.type).toBe("View");
    expect(still.props.style.width).toBe("50%");
  });
  it("Reduce Motion renders without Animated loops; the dock never uses Animated.loop", () => {
    settings.reduced = true;
    render(props(compact()));
    expect(anim.loops).toBe(0);
    const src = readFileSync(join(__dirname, "..", "src", "components", "RackDock.tsx"), "utf8");
    expect(src).not.toContain("Animated.loop");
    expect(src).not.toMatch(/reanimated/i);
  });
  it("the number is the unrack target; haptics only on Log (tick) and expand (pickup) besides the step table", () => {
    const tree = render(props(compact()));
    expect(nodes(tree).some((x) => x.props.nativeID === "rack-dock-number")).toBe(true);
    nodes(tree).find((x) => x.props.nativeID === "rack-dock-log")!.props.onPress();
    expect(hap.calls).toEqual(["tick"]);
    const src = readFileSync(join(__dirname, "..", "src", "components", "RackDock.tsx"), "utf8");
    expect(src.match(/haptics\.\w+/g)!.sort()).toEqual(["haptics.pickup", "haptics.selection", "haptics.tick", "haptics.tick"].sort());
    expect(RACK_MOTION.unrack).toBe(320);
    expect(RACK_MOTION.unrackMiniFrom).toBe(4);
  });
});
