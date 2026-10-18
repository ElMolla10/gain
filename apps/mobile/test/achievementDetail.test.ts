import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LRI, PDI, translate } from "../src/i18n/format";
import { medalBack, trackTitle } from "../src/logic/achievementCopy";
import { formatDayFull } from "../src/logic/dateText";
import { byType, expand, nodes, texts } from "./achievementRender";
import { earned, progress, row, sampleCabinet } from "./achievementFixtures";

const settings = vi.hoisted(() => ({ lang: "en" as "en" | "ar", reduced: false }));
const anim = vi.hoisted(() => ({ timings: [] as { toValue: number; duration: number }[] }));
vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig()));
vi.mock("react-native", () => {
  class Value {
    v: number;
    constructor(v: number) { this.v = v; }
    setValue(v: number) { this.v = v; }
    interpolate(c: unknown) { return { interpolated: c }; }
  }
  class ValueXY {
    x: Value; y: Value;
    constructor(v: { x: number; y: number }) { this.x = new Value(v.x); this.y = new Value(v.y); }
    setValue(v: { x: number; y: number }) { this.x.setValue(v.x); this.y.setValue(v.y); }
  }
  return {
    View: "View",
    Pressable: "Pressable",
    Share: { share: vi.fn(async () => ({})) },
    Easing: { inOut: (f: unknown) => f, cubic: () => 0 },
    PanResponder: { create: (cfg: Record<string, unknown>) => ({ panHandlers: { onResponderMove: cfg.onPanResponderMove, onStartShouldSetResponder: cfg.onStartShouldSetPanResponder } }) },
    Animated: {
      View: "AnimatedView",
      Value,
      ValueXY,
      timing: (_v: unknown, cfg: { toValue: number; duration: number }) => ({ start: () => anim.timings.push(cfg) }),
      spring: () => ({ start: () => {} }),
    },
    useWindowDimensions: () => ({ fontScale: 1, width: 400, height: 800 }),
  };
});
vi.mock("react-native-svg", () => ({ default: "Svg", Circle: "Circle", ClipPath: "ClipPath", Defs: "Defs", Ellipse: "Ellipse", G: "G", LinearGradient: "LinearGradient", Path: "Path", RadialGradient: "RadialGradient", Rect: "Rect", Stop: "Stop", Text: "SvgText", TextPath: "TextPath" }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ lang: settings.lang, unit: "kg", direction: settings.lang === "ar" ? "rtl" : "ltr", t: (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(settings.lang, k, p) }) }));
vi.mock("../src/theme", async () => {
  const pal = await import("../src/palettes");
  return {
    space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
    radius: { button: 12, card: 16 },
    type: { display: 48, load: 36, title: 28, section: 20, body: 16, label: 14, caption: 13 },
    usePalette: () => ({ muted: "muted", text: "text", border: "border", card: "card", raised: "raised", accent: "accent", edge: "edge" }),
    useAchievementArt: () => pal.achievementArtDark,
    useIsDark: () => true,
  };
});
vi.mock("../src/ui", () => ({ AppText: "AppText", BigButton: "BigButton", Sheet: "Sheet", useReducedMotion: () => settings.reduced }));
vi.mock("../src/achievementTelemetry", () => ({ telemetry: { record: vi.fn() } }));
vi.mock("../src/diagnostics", () => ({ diagnostics: { record: vi.fn() } }));

import { MedalBackFace } from "../src/components/achievements/MedalBack";
import { DETAIL_MEDAL, FADE_MS, FLIP_MS, MedalDetailSheet, TILT_MAX, tiltFor } from "../src/components/achievements/MedalDetailSheet";

const iso = (s: string) => `${LRI}${s}${PDI}`;
const t = (lang: "en" | "ar") => (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(lang, k, p);

function sheet(r: ReturnType<typeof row>, cabinet = sampleCabinet()) {
  const tree = expand(React.createElement(MedalDetailSheet, { row: r, cabinet, qualifiedWeeksLifetime: 96, weeks12Earned: true, onClose: () => {}, onViewWorkout: () => {} }));
  const root = byType(tree, "Sheet")[0]!;
  const footer = expand(root.props.footer);
  const medal = nodes(tree).find((n) => n.props.style?.width === DETAIL_MEDAL && n.props.accessible)!;
  return { tree, footer, medal, buttons: byType(footer, "BigButton").map((b) => b.props.label as string) };
}

beforeEach(() => {
  settings.lang = "en";
  settings.reduced = false;
  anim.timings.length = 0;
});

describe("medal detail sheet", () => {
  const ded25 = () => sampleCabinet().find((r) => r.badgeId === "dedicated_25")!;
  it("earned: Turn over, Share and View supporting workout; a 'turn over' a11y action that flips in 300 ms", () => {
    const { footer, medal, buttons } = sheet(ded25());
    expect(buttons).toEqual(["Turn over", "Share", "View supporting workout"]);
    expect(byType(footer, "BigButton")[0]!.props.onPress).toBeTypeOf("function");
    expect(medal.props.accessibilityActions).toEqual([{ name: "turnOver", label: "Turn over" }]);
    medal.props.onAccessibilityAction({ nativeEvent: { actionName: "turnOver" } });
    expect(anim.timings).toEqual([expect.objectContaining({ toValue: 1, duration: FLIP_MS })]);
  });
  it("locked: no share, no flip, no tilt; 'How to earn' and the rule", () => {
    const locked = row({ id: "locked:iron_carry", badgeId: "iron_carry", status: "locked", earnedAtUtc: null, earnedLocalDate: null, primarySessionId: null });
    const { tree, buttons, medal } = sheet(locked);
    expect(buttons).toEqual([]);
    expect(medal.props.accessibilityActions).toBeUndefined();
    expect(medal.props.onResponderMove).toBeUndefined();
    const all = texts(tree);
    expect(all).toContain("How to earn");
    expect(all).toContain("Locked");
    expect(all.some((s) => s.startsWith("A longer loaded carry"))).toBe(true);
  });
  it("in progress: no share or flip; the progress line and the family track with the current tier marked", () => {
    const { tree, buttons } = sheet(progress("dedicated_50", 38, 50));
    expect(buttons).toEqual([]);
    const all = texts(tree);
    expect(all).toEqual(expect.arrayContaining(["Legacy", "In progress", `${iso("38")} of ${iso("50")}`, `${iso("Dedicated")} track`, "10", "25", `${iso("38")} of ${iso("100")}`]));
    const marked = nodes(tree).filter((n) => n.props.accessibilityState?.selected === true);
    expect(marked).toHaveLength(1);
    expect(marked[0]!.props.style.borderColor).toBe("accent");
  });
  it("Reduce Motion turns tilt off and makes the flip a 200 ms crossfade", () => {
    expect(sheet(ded25()).medal.props.onResponderMove).toBeTypeOf("function");
    expect(texts(sheet(ded25()).tree)).toContain("Drag to tilt · Turn over to see the back");
    settings.reduced = true;
    const { medal, tree } = sheet(ded25());
    expect(medal.props.onResponderMove).toBeUndefined();
    expect(texts(tree)).toContain("Turn over to see the back");
    medal.props.onAccessibilityAction({ nativeEvent: { actionName: "turnOver" } });
    expect(anim.timings).toEqual([expect.objectContaining({ duration: FADE_MS })]);
    // No rotation under Reduce Motion: the faces only fade.
    const faces = byType(tree, "AnimatedView");
    for (const f of faces) expect(JSON.stringify(f.props.style)).not.toContain("rotate");
  });
  it("tilt is clamped to ±18°", () => {
    expect(tiltFor(0, 0)).toEqual({ ry: 0, rx: -0 });
    expect(tiltFor(45, -45)).toEqual({ ry: 9, rx: 9 });
    expect(tiltFor(900, 900)).toEqual({ ry: TILT_MAX, rx: -TILT_MAX });
  });
});

describe("engraved back", () => {
  it("formatDayFull always shows the year, Western digits", () => {
    expect(formatDayFull("2026-09-21", "en")).toBe("21 Sep 2026");
    expect(formatDayFull("2026-09-21", "ar")).toBe("21 سبتمبر 2026");
  });
  it("AR render of the back: track, value, Arabic count noun, full date, 'Medal n of 17'", () => {
    settings.lang = "ar";
    const cab = sampleCabinet();
    const r = cab.find((x) => x.badgeId === "dedicated_25")!;
    const copy = medalBack(r, cab, "ar", "kg", t("ar"));
    const tree = expand(React.createElement(MedalBackFace, { badgeId: r.badgeId, size: 200, copy }));
    expect(texts(tree)).toEqual(["التزام", "25", "تمرينة", "1 مارس 2025", `ميدالية ${iso("8")} من ${iso("17")}`]);
    // Pure-number value is the only LTR run; the Arabic lines are never forced LTR.
    expect(byType(tree, "AppText").filter((n) => n.props.ltr).map((n) => n.props.children)).toEqual(["25"]);
    // The art never mirrors.
    expect(nodes(tree).find((n) => n.props.accessibilityElementsHidden)!.props.style.direction).toBe("ltr");
    expect(medalBack(earned("dedicated_10", 1, "2024-07-01"), cab, "ar", "kg", t("ar")).unit).toBe("تمرينات");
  });
  it("EN back of a PR: the lift, the new load, unit × reps; tracks get their title", () => {
    const cab = sampleCabinet();
    const b = medalBack(cab.find((x) => x.id === "pr4")!, cab, "en", "kg", t("en"));
    expect([b.title, b.value, b.unit, b.date, b.ordinal]).toEqual(["Preacher Curl", "16", `kg × ${iso("6")}`, "12 Oct 2026", null]);
    expect(trackTitle("hundred_club_250", t("en"))).toBe(`${iso("Training days")} track`);
    expect(trackTitle("hundred_club_250", t("ar"))).toBe(`مسار \u2068أيام التمرين${PDI}`);
    expect(trackTitle("comeback", t("en"))).toBeNull();
  });
});
