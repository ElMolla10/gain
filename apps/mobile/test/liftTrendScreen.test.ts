import React, { type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { liftTrend, type HistorySession, type LoggedSet } from "@gain/engine";
import { translate } from "../src/i18n/format";
import { groupSessionsByDate, localDateText } from "../src/logic/trendChart";
import { LiftTrendView } from "../src/screens/LiftTrendView";
import type { LiftItem } from "../src/db/historyRepo";

const slots = vi.hoisted(() => ({ values: [] as unknown[], i: 0 }));
const i18n = vi.hoisted(() => ({ lang: "en" as "en" | "ar", unit: "kg" as "kg" | "lb" }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: <T,>(initial: T | (() => T)): [T, (v: T | ((prev: T) => T)) => void] => {
      const idx = slots.i++;
      if (slots.values[idx] === undefined) slots.values[idx] = typeof initial === "function" ? (initial as () => T)() : initial;
      return [slots.values[idx] as T, (v) => { slots.values[idx] = typeof v === "function" ? (v as (prev: T) => T)(slots.values[idx] as T) : v; }];
    },
    useMemo: <T,>(fn: () => T) => fn(),
    useCallback: <T,>(fn: T) => fn,
  };
});

vi.mock("react-native", () => {
  const ReactActual = require("react") as typeof import("react");
  return {
    View: "View",
    ScrollView: "ScrollView",
    Pressable: "Pressable",
    TextInput: "TextInput",
    Platform: { OS: "ios", select: (o: Record<string, unknown>) => o.ios ?? o.default },
    FlatList: (props: { data: unknown[]; ListEmptyComponent?: unknown; renderItem: (args: { item: unknown; index: number }) => unknown }) =>
      ReactActual.createElement("FlatList", null, (props.data.length === 0 ? props.ListEmptyComponent : props.data.map((item, index) => props.renderItem({ item, index }))) as React.ReactNode),
  };
});
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock("../src/i18n", () => ({
  useI18n: () => ({
    t: (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate(i18n.lang, key, params),
    lang: i18n.lang,
    unit: i18n.unit,
    unitText: i18n.lang === "ar" ? (i18n.unit === "kg" ? "كجم" : "رطل") : i18n.unit,
    fmt: (kg: number) => `${kg} kg`,
  }),
}));
vi.mock("../src/theme", () => ({
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radius: { input: 8, button: 12, card: 16, sheet: 24, pill: 999 },
  MIN_TOUCH: 48,
  type: { display: 48, load: 36, title: 28, section: 20, sectionSmall: 16, body: 16, label: 14, caption: 13 },
  usePalette: () => ({ muted: "muted", border: "border", text: "text", accent: "accent", card: "card", raised: "raised", fill: "fill", onFill: "onFill", tint: "tint", edge: "edge" }),
}));
vi.mock("../src/ui", () => ({ AppText: "AppText", Screen: "Screen", useInputFont: () => ({}) }));
vi.mock("../src/components/trend/E1rmChart", () => ({ E1rmChart: "E1rmChart" }));

type Node = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Node[] {
  if (value == null || typeof value === "boolean") return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement(value)) return [];
  const node = value as Node;
  if (typeof node.type === "function") return nodes((node.type as (p: unknown) => unknown)(node.props));
  return [node, ...nodes(node.props.children)];
}
const strip = (s: string) => s.replace(/[\u2066-\u2069]/g, "");
function texts(tree: Node[]): string[] {
  return tree.flatMap((n) => {
    const c = n.props.children;
    if (typeof c === "string" || typeof c === "number") return [strip(String(c))];
    if (Array.isArray(c)) return [c.filter((x) => typeof x === "string" || typeof x === "number").map((x) => strip(String(x))).join("")];
    return [];
  });
}

const line = { exerciseId: "bench", gymId: "g", setup: "free" as const };
const DAY = 86_400_000;
const NOW = new Date(2026, 9, 20, 12).getTime(); // Tue 20 Oct 2026
const w = (load: number, reps: number, extra: Partial<LoggedSet> = {}): LoggedSet => ({ load, reps, ...extra });
const sess = (dayFromNow: number, sets: LoggedSet[]): HistorySession => ({ line, performedAt: new Date(NOW + dayFromNow * DAY).toISOString(), sets });
const lift: LiftItem = { lineId: "l1", exerciseId: "bench", nameEn: "Bench Press", nameAr: "بنش", gymName: "Gym", gymId: "g", setup: "free", measure: "reps", sessions: 10, lastAt: NOW, hasImported: false };

/** 10 sessions every 4 days up to 4 days ago; top set climbs 60 → 82.5 kg × 5, plus two back-off sets of 50 × 10. */
const rising = Array.from({ length: 10 }, (_, i) => sess(-40 + i * 4, [w(20, 10, { warmup: true }), w(60 + i * 2.5, 5), w(50, 10), w(50, 10)]));
const firstAt = Date.parse(rising[0]!.performedAt);
const lastAt = Date.parse(rising[9]!.performedAt);

function setup(sessions: HistorySession[], extra: Partial<Parameters<typeof LiftTrendView>[0]> = {}, importedAt = new Set<number>()) {
  const trend = liftTrend(sessions, "free", importedAt);
  const props = { lift, trend, sessions, now: NOW, ...extra };
  return () => {
    slots.i = 0;
    return nodes(LiftTrendView(props) as ReactElement);
  };
}
const byText = (tree: Node[], text: string) => tree.find((n) => n.type === "Pressable" && texts(nodes(n.props.children)).join(" ").includes(text));
const copyOf = (tree: Node[]) => texts(tree).join(" | ");

beforeEach(() => {
  slots.values = [];
  slots.i = 0;
  i18n.lang = "en";
  i18n.unit = "kg";
});

describe("groupSessionsByDate", () => {
  it("groups consecutive sessions on the same local date, newest first preserved", () => {
    const a = sess(0, [w(60, 5)]);
    const b = { ...a, sets: [w(62.5, 5)] };
    const later = sess(3, [w(70, 5)]);
    expect(groupSessionsByDate([later, a, b]).map((g) => g.data.length)).toEqual([1, 2]);
  });
});

describe("Exercise progression: Summary", () => {
  it("three pill tabs, Summary selected; none of the removed clutter", () => {
    const tree = setup(rising)();
    const tabs = tree.filter((n) => n.props.accessibilityRole === "tab");
    expect(tabs.map((n) => n.props.accessibilityLabel)).toEqual(["Summary", "Rep Max", "History", "3M", "1Y", "All"]);
    expect((tabs[5]!.props.accessibilityState as { selected: boolean }).selected).toBe(true);
    expect((tabs[0]!.props.accessibilityState as { selected: boolean }).selected).toBe(true);
    const copy = copyOf(tree);
    for (const gone of ["Available weights", "Exercise Path", "What this shows", "Weight", "Volume", "dashed", "Each setup has its own line"]) expect(copy).not.toContain(gone);
    expect(tree.some((n) => n.type === "BigButton")).toBe(false);
  });

  it("next workout hero: big load, unit, × and reps, with the one-line reason", () => {
    const tree = setup(rising, { nextTarget: "85 kg × 5", nextParts: { load: 85, reps: 5 }, whySentence: "Hit 82.5 × 5 last time." })();
    const copy = copyOf(tree);
    expect(copy).toContain("Next workout");
    expect(copy).toMatch(/85 \| kg \| × \| 5/);
    expect(copy).toContain("Hit 82.5 × 5 last time.");
  });

  it("without a suggestion it says so plainly", () => {
    expect(copyOf(setup(rising)())).toContain("No next-session recommendation");
  });

  it("estimated 1RM in whole kg with the robust change per month, and a 3-month projection caption", () => {
    const tree = setup(rising)();
    const copy = copyOf(tree);
    expect(copy).toContain("Estimated 1RM");
    expect(copy).toContain("96 | kg | +22 kg/month"); // 82.5 × (1 + 5/30) = 96.25
    expect(copy).toMatch(/\+22 kg\/month/);
    expect(copy).not.toMatch(/\d\.\d{2,}/); // never 93.333
    expect(copy).toMatch(/On pace for ~\d+\u00A0kg by (early|mid|late) Jan/);
    const chart = tree.find((n) => n.type === "E1rmChart")!;
    expect((chart.props.points as unknown[]).length).toBe(10);
    expect(chart.props.projection).toMatchObject({ value: expect.any(Number) });
    expect(chart.props.goal).toBeNull();
    expect(chart.props.fromLabel).toBe("Sep 2026");
  });

  it("the range control filters the chart", () => {
    const render = setup([sess(-300, [w(50, 5)]), ...rising]);
    expect(((render().find((n) => n.type === "E1rmChart")!).props.points as unknown[]).length).toBe(11);
    (byText(render(), "3M")!.props.onPress as () => void)();
    expect(((render().find((n) => n.type === "E1rmChart")!).props.points as unknown[]).length).toBe(10);
  });

  it("a goal ahead shows when you would reach it and marks the crossing; it is saved when editing ends", () => {
    const onGoalChange = vi.fn();
    const render = setup(rising, { onGoalChange });
    const input = render().find((n) => n.type === "TextInput")!;
    (input.props.onChangeText as (s: string) => void)("140");
    const tree = render();
    expect(copyOf(tree)).toMatch(/in ~2 months · (early|mid|late) Dec/);
    const chart = tree.find((n) => n.type === "E1rmChart")!;
    expect(chart.props.goal).toMatchObject({ value: 140, at: expect.any(Number) });
    expect(copyOf(tree)).not.toContain("On pace for");
    (tree.find((n) => n.type === "TextInput")!.props.onEndEditing as () => void)();
    expect(onGoalChange).toHaveBeenCalledWith(140);
  });

  it("a saved goal is shown on open; reached, far and not-on-pace goals read plainly", () => {
    expect(copyOf(setup(rising, { goalKg: 90 })())).toContain("Already reached");
    slots.values = [];
    const far = setup(rising, { goalKg: 600 })();
    expect(copyOf(far)).toContain("Over 12 months at this pace");
    expect(far.find((n) => n.type === "E1rmChart")!.props.goal).toBeNull();
    slots.values = [];
    const flat = Array.from({ length: 8 }, (_, i) => sess(-32 + i * 4, [w(80, 5)]));
    expect(copyOf(setup(flat, { goalKg: 120 })())).toContain("Not on pace yet");
  });

  it("hides the projection and goal with fewer than 4 sessions in 8 weeks", () => {
    const old = Array.from({ length: 8 }, (_, i) => sess(-200 + i * 7, [w(60 + i * 2.5, 5)]));
    const tree = setup(old, { goalKg: 100 })();
    expect(tree.some((n) => n.type === "TextInput")).toBe(false);
    expect(tree.find((n) => n.type === "E1rmChart")!.props.projection).toBeNull();
    expect(copyOf(tree)).not.toContain("On pace");
  });

  it("three stat tiles (best set, best volume with separators, PRs) and the last 3 workouts", () => {
    const prSets = [{ localDate: localDateText(lastAt), load: 82.5, reps: 5 }, { localDate: localDateText(firstAt), load: 60, reps: 5 }];
    const tree = setup(rising, { prSets })();
    const copy = copyOf(tree);
    expect(copy).toContain("Best set | 82.5 × 5");
    expect(copy).toContain("Best volume | 1,413\u00A0kg");
    expect(copy).toContain("PRs | 2");
    expect(copy).toContain("Recent");
    expect(copy).toContain("Fri 16 Oct");
    expect(copy).toContain("Mon 12 Oct");
    expect(copy).toContain("Thu 8 Oct");
    expect(copy).not.toContain("Sun 4 Oct");
  });

  it("pounds everywhere when the lifter uses lb", () => {
    i18n.unit = "lb";
    const copy = copyOf(setup(rising, { nextParts: { load: 85, reps: 5 } })());
    expect(copy).toContain("212 | lb"); // 96.25 kg
    expect(copy).toContain("187.4 | lb"); // 85 kg
    expect(copy).toContain("181.9 × 5"); // 82.5 kg
    expect(copy).toMatch(/\+48 lb\/month/);
  });
});

describe("Exercise progression: Rep Max", () => {
  it("hero with the best e1RM and its set; rows sorted by reps with 1 rep / N reps, whole-kg e1RM and a Best chip", () => {
    const sessions = [sess(-20, [w(100, 1), w(80, 8)]), sess(-10, [w(90, 5), w(70, 12), w(60, 20)]), sess(-5, [w(95, 2)])];
    const render = setup(sessions);
    (byText(render(), "Rep Max")!.props.onPress as () => void)();
    const tree = render();
    const copy = copyOf(tree);
    expect(copy).toContain("Best estimated 1RM");
    expect(copy).toContain("from 90\u00A0kg × 5"); // 90 × 7/6 = 105
    expect(copy).toMatch(/105 \| kg/);
    const rows = tree.filter((n) => typeof n.props.accessibilityLabel === "string" && /rep/.test(n.props.accessibilityLabel as string) && n.type === "View");
    expect(rows.map((n) => strip(n.props.accessibilityLabel as string).split(",")[0])).toEqual(["1 rep", "2 reps", "5 reps", "8 reps", "12 reps"]);
    expect(rows.filter((n) => (n.props.accessibilityLabel as string).endsWith("Best"))).toHaveLength(1);
    expect(copy).toContain("≈ 101\u00A0kg 1RM"); // 95 × (1 + 2/30) = 101.33
    expect(copy).not.toContain("20 reps");
  });
});

describe("Exercise progression: History", () => {
  it("See all opens History: human dates, N sets · volume, PR chips and the Imported tag", () => {
    const prSets = [{ localDate: localDateText(lastAt), load: 82.5, reps: 5 }];
    const render = setup(rising, { prSets }, new Set([firstAt]));
    (byText(render(), "See all")!.props.onPress as () => void)();
    const tree = render();
    expect(tree.some((n) => n.type === "FlatList")).toBe(true);
    const copy = copyOf(tree);
    expect(copy).toContain("Fri 16 Oct");
    expect(copy).toContain("3 sets · 1,413\u00A0kg");
    expect(copy).toContain("82.5\u00A0kg\u00A0×\u00A05");
    expect(copy).not.toContain("20\u00A0kg"); // warm-ups are left out
    expect(texts(tree).filter((x) => x === "PR")).toHaveLength(1);
    expect(texts(tree).filter((x) => x === "Imported")).toHaveLength(1);
    expect(copy).not.toContain("2026");
  });

  it("dates outside the current year carry the year", () => {
    const render = setup([sess(-400, [w(60, 5)])]);
    (byText(render(), "History")!.props.onPress as () => void)();
    expect(copyOf(render())).toMatch(/2025/);
  });
});

describe("Exercise progression: Arabic", () => {
  it("every new label is Arabic, numbers stay Western and isolated", () => {
    i18n.lang = "ar";
    const render = setup(rising, { goalKg: 140 });
    const copy = copyOf(render());
    expect(copy).toContain("التمرينة الجاية");
    expect(copy).toContain("أقصى وزن متقدّر");
    expect(copy).toMatch(/خلال ~2 شهر · (أوائل|نص|أواخر) ديسمبر/);
    expect(copy).toContain("أحسن مجموعة");
    expect(copy).toContain("1,413\u00A0كجم");
    (byText(render(), "أقصى تكرارات")!.props.onPress as () => void)();
    expect(copyOf(render())).toMatch(/5 تكرارات/);
  });
});
