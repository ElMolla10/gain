import type { SessionSummary } from "@gain/engine";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isolateLtr, NBSP, translate } from "../src/i18n/format";
import type { DayLoadPreview, TargetRow } from "../src/db/finishRepo";
import { deltaChip } from "../src/logic/todayCopy";
import { todayRows } from "../src/logic/todayRows";
import { clock, lastText, rackA11yLabel, stubArrow, stubLines, timeLine, writtenAfter } from "../src/logic/todayStub";
import { byType, expand, nodes, texts } from "./achievementRender";

const settings = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig(), { useContext: () => null }));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", useWindowDimensions: () => ({ fontScale: 1, width: 400, height: 800 }) }));
vi.mock("react-native-svg", () => ({ default: "Svg", Path: "Path", Rect: "Rect", Defs: "Defs", G: "G", Ellipse: "Ellipse", LinearGradient: "LinearGradient", Stop: "Stop" }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ lang: settings.lang, unit: "kg", t: (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(settings.lang, k, p) }) }));
vi.mock("../src/theme", () => ({
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radius: { button: 12, pill: 999 },
  type: { display: 48, load: 36, title: 28, section: 20, body: 16, label: 14, caption: 13 },
  usePalette: () => ({ muted: "muted", text: "text", edge: "edge", raised: "raised", border: "border", bg: "bg" }),
  useIsDark: () => true,
}));
vi.mock("../src/ui", () => ({ AppText: "AppText", QuietAction: "QuietAction" }));

import { DoorStub } from "../src/components/today/DoorStub";
import { glyphFor, RackRow, RACK_ROW_HEIGHT } from "../src/components/today/RackRow";
import { RACK_GLYPHS } from "../src/components/today/glyphPaths";
import { TodayHeader } from "../src/components/today/TodayHeader";

const t = (lang: "en" | "ar") => (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(lang, k, p);
const strip = (s: string) => s.replace(/[\u2066-\u2069]/g, "");
const last: SessionSummary = { performedAt: "2026-10-15", topLoad: 100, repsAtTop: 10, bestRepsAtTop: 10, lastSetReps: 10, setsAtTop: 3, workingSets: 3, rir: 1, tags: [] };
const NOW = new Date(2026, 9, 18, 6, 0).getTime();
const WRITTEN = new Date(2026, 9, 15, 21, 14).getTime();

beforeEach(() => {
  settings.lang = "en";
});

describe("stub words", () => {
  it("provenance: written + after the latest session before it; preview; edited", () => {
    const sessions = [{ dayName: "Lower B", finishedAt: WRITTEN - 60_000 }, { dayName: "Upper A", finishedAt: WRITTEN - 3 * 86_400_000 }, { dayName: "Later", finishedAt: WRITTEN + 1000 }];
    expect(writtenAfter(WRITTEN, sessions)).toBe("Lower B");
    expect(writtenAfter(WRITTEN, [])).toBeNull();
    const base = { preview: false, createdAt: WRITTEN, afterDay: "Lower B", edited: null, last: null, chip: null, reason: null };
    expect(strip(stubLines(base, { lang: "en", unit: "kg", t: t("en"), now: NOW }).provenance)).toBe("Written Thu 15 Oct 21:14, after Lower B");
    expect(strip(stubLines({ ...base, preview: true, createdAt: null }, { lang: "en", unit: "kg", t: t("en"), now: NOW }).provenance)).toBe("Preview from your history · saved when you start");
    expect(strip(stubLines({ ...base, edited: { load: 105 } }, { lang: "en", unit: "kg", t: t("en"), now: NOW }).provenance)).toBe(`You set 105${NBSP}kg yourself`);
    expect(clock(WRITTEN)).toBe("21:14");
  });
  it("last time → chip: reason tail; AR uses ← and the Arabic comma, numbers isolated, no Arabic inside an isolate", () => {
    const input = { preview: false, createdAt: WRITTEN, afterDay: null, edited: null, last, chip: deltaChip({ load: 102.5, reps: 6, status: "proposed" }, last, { lang: "en", unit: "kg", t: t("en") }).text, reason: "Go up to 102.5 kg for 6. You hit 10 at 100 kg." };
    expect(strip(stubLines(input, { lang: "en", unit: "kg", t: t("en"), now: NOW }).lastTime!)).toBe(`Last time 100${NBSP}kg${NBSP}×${NBSP}10 · 3 sets → +2.5${NBSP}kg: You hit 10 at 100 kg.`);
    const arChip = deltaChip({ load: 102.5, reps: 6, status: "proposed" }, last, { lang: "ar", unit: "kg", t: t("ar") }).text;
    const ar = stubLines({ ...input, chip: arChip, reason: "زوّد لـ 102.5 كجم. وصلت 10 على 100 كجم." }, { lang: "ar", unit: "kg", t: t("ar"), now: NOW }).lastTime!;
    expect(ar).toContain(" ← ");
    expect(ar).not.toContain("→");
    expect(ar).toContain(`${isolateLtr("100")}${NBSP}كجم${NBSP}×${NBSP}${isolateLtr("10")}`);
    expect(ar).toContain("، وصلت");
    for (const m of ar.matchAll(/\u2066([^\u2069]*)\u2069/g)) expect(m[1]).not.toMatch(/[\u0600-\u06FF]/);
    expect(stubArrow("ar")).toBe("←");
    expect(stubArrow("en")).toBe("→");
  });
  it("signed deltas are ONE isolated run", () => {
    expect(deltaChip({ load: 102.5, reps: 6, status: "proposed" }, last, { lang: "ar", unit: "kg", t: t("ar") }).text).toBe(`${isolateLtr("+2.5")}${NBSP}كجم`);
  });
  it("sets in the last-time line: AR singular/plural forms with isolated numbers", () => {
    expect(strip(lastText(last, "ar", "kg", t("ar")))).toBe(`100${NBSP}كجم${NBSP}×${NBSP}10 · 3 مجموعات`);
    expect(strip(lastText({ ...last, setsAtTop: 1 }, "en", "kg", t("en")))).toContain("· 1 set");
  });
  it("time line", () => {
    expect(strip(timeLine(6, 18, 54, "07:02", "en", t("en")))).toBe("6 exercises · 18 sets · ~54 min · done around 07:02");
    expect(strip(timeLine(1, 3, 9, "06:09", "en", t("en")))).toBe("1 exercise · 3 sets · ~9 min · done around 06:09");
    expect(strip(timeLine(6, 18, 54, "07:02", "ar", t("ar")))).toBe("6 تمارين · 18 مجموعات · حوالي 54 د · تخلص حوالي 07:02");
  });
});

describe("todayRows", () => {
  it("a stored target wins over a preview; a preview carries its last session and normal load", () => {
    const tg = { id: "t1", exerciseId: "bench", status: "edited", currency: "reps", measure: "reps", reps: 6, durationS: null, distanceM: null, effectiveLoad: 105, editedLoad: 105, reason: { key: "k", params: {} } } as unknown as TargetRow;
    const pv = [{ exerciseId: "bench", proposal: { load: 90 } }, { exerciseId: "row", proposal: { load: 60, reps: 8, currency: "reps", reason: { key: "k", params: {} }, normalLoad: 70, inputs: { sessions: [last] } } }] as unknown as DayLoadPreview[];
    const rows = todayRows([{ exerciseId: "bench", measure: "reps" }, { exerciseId: "row", measure: "reps" }, { exerciseId: "curl", measure: "reps" }], [tg], pv);
    expect(rows.map((r) => [r.exerciseId, r.preview, r.effectiveLoad])).toEqual([["bench", false, 105], ["row", true, 60]]);
    expect(rows[0]!.editedLoad).toBe(105);
    expect(rows[1]!.normalLoad).toBe(70);
    expect(rows[1]!.last).toBe(last);
  });
});

describe("rack row and stub render (EN / AR)", () => {
  const row = (extra = {}) =>
    expand(React.createElement(RackRow, { name: "Incline Dumbbell Press", scheme: "3 × 8–10", target: "28 kg × 9", noTarget: "-", chip: "+1 rep", glyph: "dumbbell", a11yLabel: rackA11yLabel({ name: "Incline Dumbbell Press", scheme: "3 × 8–10", target: "28 kg × 9", chip: "+1 rep" }, t("en"), "en"), expanded: false, onToggle: vi.fn(), ...extra }));
  it("64 dp row, one button whose label includes the chip; target in text; glyph hidden and never mirrored", () => {
    const tree = row();
    const btn = byType(tree, "Pressable")[0]!;
    expect(strip(btn.props.accessibilityLabel)).toBe("Incline Dumbbell Press, 3 × 8–10, target 28 kg × 9, +1 rep");
    expect(btn.props.style({ pressed: false }).minHeight).toBe(RACK_ROW_HEIGHT);
    expect(texts(tree)).toEqual(["Incline Dumbbell Press", "3 × 8–10", "28 kg × 9", "+1 rep"]);
    const svg = byType(tree, "Svg")[0]!;
    expect(svg.props.accessibilityElementsHidden).toBe(true);
    expect(svg.props.style.direction).toBe("ltr");
  });
  it("barbell rows: long-press (400 ms) opens the x-ray, and 'Show plates' is a custom action", () => {
    const onOpen = vi.fn();
    const tree = row({ glyph: "barbell", xray: { perSide: [25, 5], open: true, onOpen } });
    const btn = byType(tree, "Pressable")[0]!;
    expect(btn.props.delayLongPress).toBe(400);
    expect(btn.props.accessibilityActions.map((a: { label: string }) => a.label)).toEqual(["Expand", "Show plates"]);
    btn.props.onAccessibilityAction({ nativeEvent: { actionName: "longpress" } });
    expect(onOpen).toHaveBeenCalled();
    expect(byType(tree, "Svg")).toHaveLength(2);
  });
  it("AR row label in Arabic", () => {
    settings.lang = "ar";
    expect(rackA11yLabel({ name: "بنش", scheme: "3 × 8", target: "28 كجم × 9", chip: "+1 عدّة" }, t("ar"), "ar")).toBe("بنش، 3 × 8، الهدف \u206828 كجم × 9\u2069، +1 عدّة");
  });
  it("stub: provenance muted, last time in text, Why 48 dp; skeleton while loading", () => {
    const tree = expand(React.createElement(DoorStub, { provenance: "Written Thu 21:14", lastTime: "Last time …", whyLabel: "Why: Bench", onWhy: vi.fn() }));
    expect(texts(tree)).toEqual(["✎ Written Thu 21:14", "Last time …"]);
    expect(byType(tree, "QuietAction")[0]!.props.accessibilityLabel).toBe("Why: Bench");
    const loading = expand(React.createElement(DoorStub, { provenance: null, lastTime: null, loading: true, whyLabel: "Why" }));
    expect(texts(loading)).toEqual([]);
  });
  it("header: one header (the day name); Change hidden with one day; dots decorative", () => {
    const tree = expand(React.createElement(TodayHeader, { date: "Sun 18 Oct", dayName: "Upper A", label: "Suggested today", dayIndex: 0, dayCount: 4, onChange: vi.fn() }));
    expect(nodes(tree).filter((n) => n.props.accessibilityRole === "header")).toHaveLength(1);
    expect(byType(tree, "QuietAction")).toHaveLength(1);
    const one = expand(React.createElement(TodayHeader, { date: "Sun 18 Oct", dayName: "Upper A", label: "Suggested today", dayIndex: 0, dayCount: 1, onChange: vi.fn() }));
    expect(byType(one, "QuietAction")).toHaveLength(0);
  });
  it("glyphs: ≤ 6 paths each; equipment and setup pick one", () => {
    for (const [k, v] of Object.entries(RACK_GLYPHS)) expect(v.length, k).toBeLessThanOrEqual(6);
    expect(glyphFor("plate", "bodyweight_plus_added")).toBe("body");
    expect(glyphFor("machine", "assisted")).toBe("assisted");
    expect(glyphFor("cable", "free")).toBe("cable");
  });
});
