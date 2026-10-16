import React, { type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { liftTrend, type HistorySession, type LoggedSet } from "@gain/engine";
import { translate } from "../src/i18n/format";
import { groupSessionsByDate } from "../src/logic/trendChart";
import { LiftTrendView } from "../src/screens/LiftTrendView";
import type { LiftItem } from "../src/db/historyRepo";

const slots = vi.hoisted(() => ({ values: [] as unknown[], i: 0 }));
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
  type Section = { date: string; data: unknown[] };
  return {
    View: "View",
    ScrollView: "ScrollView",
    SectionList: (props: {
      sections: Section[];
      ListEmptyComponent?: unknown;
      renderSectionHeader?: (args: { section: Section }) => unknown;
      renderItem: (args: { item: unknown; index: number }) => unknown;
    }) =>
      ReactActual.createElement(
        "SectionList",
        null,
        (props.sections.length === 0
          ? props.ListEmptyComponent
          : props.sections.flatMap((section) => [
              props.renderSectionHeader?.({ section }),
              ...section.data.map((item, index) => props.renderItem({ item, index })),
            ])) as React.ReactNode,
      ),
  };
});
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ t: (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate("en", key, params), lang: "en", unit: "kg", unitText: "kg", fmt: (kg: number) => `${kg} kg` }) }));
vi.mock("../src/theme", () => ({ space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 }, type: { section: 20, load: 36, caption: 13 }, usePalette: () => ({ muted: "muted", border: "border", text: "text" }) }));
vi.mock("../src/ui", () => ({ AppText: "AppText", BigButton: "BigButton", Card: "Card", Chip: "Chip", Screen: "Screen" }));
vi.mock("../src/components/TrendChart", () => ({ TrendChart: "TrendChart" }));

type Node = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Node[] {
  if (value == null || typeof value === "boolean") return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement(value)) return [];
  const node = value as Node;
  if (typeof node.type === "function") return nodes((node.type as (p: unknown) => unknown)(node.props));
  return [node, ...nodes(node.props.children)];
}
function texts(tree: Node[]): string[] {
  const strip = (s: string) => s.replace(/\u2066|\u2069/g, "");
  return tree.flatMap((n) => {
    const c = n.props.children;
    if (typeof c === "string" || typeof c === "number") return [strip(String(c))];
    if (Array.isArray(c)) return c.filter((x) => typeof x === "string" || typeof x === "number").map((x) => strip(String(x)));
    return [];
  });
}

const line = { exerciseId: "bench", gymId: "g", setup: "free" as const };
const T0 = new Date(2026, 0, 5).getTime();
const DAY = 86_400_000;
const w = (load: number, reps: number, extra: Partial<LoggedSet> = {}): LoggedSet => ({ load, reps, ...extra });
const sess = (day: number, sets: LoggedSet[]): HistorySession => ({ line, performedAt: new Date(T0 + day * DAY).toISOString(), sets });

const lift: LiftItem = {
  lineId: "l1",
  exerciseId: "bench",
  nameEn: "Barbell Bench Press",
  nameAr: "بنش",
  gymName: "Gym",
  setup: "free",
  measure: "reps",
  sessions: 2,
  lastAt: T0 + DAY,
  hasImported: false,
};

describe("groupSessionsByDate", () => {
  it("groups consecutive sessions on the same local date, newest first preserved", () => {
    const a = sess(0, [w(60, 5)]);
    const b = { ...a, sets: [w(62.5, 5)] };
    const later = sess(3, [w(70, 5)]);
    expect(groupSessionsByDate([later, a, b]).map((g) => [g.date, g.data.length])).toEqual([
      ["2026-01-08", 1],
      ["2026-01-05", 2],
    ]);
  });
});

describe("LiftTrendView tabs", () => {
  const sessions = [sess(0, [w(60, 5), w(80, 5)]), sess(7, [w(70, 8, { rir: 2 })])];
  const trend = liftTrend(sessions, "free");
  const render = () => {
    slots.i = 0;
    return nodes(LiftTrendView({ lift, trend, sessions, onOpenLoads: vi.fn() }) as ReactElement);
  };
  beforeEach(() => {
    slots.values = [];
    slots.i = 0;
  });

  it("starts on Summary with the direction block, PR records and chart controls", () => {
    const tree = render();
    const labels = tree.filter((n) => n.type === "Chip").map((n) => n.props.label);
    expect(labels).toContain("Summary");
    expect(labels).toContain("History");
    expect(tree.find((n) => n.type === "Chip" && n.props.label === "Summary")!.props.selected).toBe(true);
    expect(tree.find((n) => n.type === "Chip" && n.props.label === "History")!.props.selected).toBe(false);
    expect(labels).toContain("Weight");
    expect(labels).toContain("Estimated 1RM");
    expect(labels).toContain("Volume");
    expect(labels).toContain("3 months");
    expect(labels).toContain("All time");
    const copy = texts(tree).join(" ");
    expect(copy).toContain("Latest:");
    expect(copy).toContain("Best:");
    expect(copy).toContain("Personal records");
    expect(copy).toContain("Heaviest");
    expect(copy).toContain("Estimated 1RM");
    expect(copy).toContain("5 reps:");
    expect(tree.some((n) => n.type === "TrendChart")).toBe(true);
    expect(tree.some((n) => n.type === "SectionList")).toBe(false);
  });

  it("switches to History and lists every set grouped by date, with a PR badge", () => {
    const first = render();
    (first.find((n) => n.type === "Chip" && n.props.label === "History")!.props.onPress as () => void)();
    const tree = render();
    expect(tree.find((n) => n.type === "Chip" && n.props.label === "History")!.props.selected).toBe(true);
    expect(tree.some((n) => n.type === "SectionList")).toBe(true);
    const copy = texts(tree).join(" ");
    expect(copy).toContain("2026-01-05");
    expect(copy).toContain("2026-01-12");
    expect(copy).toContain("80 kg");
    expect(copy).toContain("70 kg");
    expect(copy).toContain("left in the tank");
    expect(copy).toContain("Heaviest");
    (tree.find((n) => n.type === "Chip" && n.props.label === "Summary")!.props.onPress as () => void)();
    expect(render().some((n) => n.type === "TrendChart")).toBe(true);
  });

  it("chart metric and range chips can be switched", () => {
    const first = render();
    (first.find((n) => n.type === "Chip" && n.props.label === "Volume")!.props.onPress as () => void)();
    const volume = render();
    expect(volume.find((n) => n.type === "Chip" && n.props.label === "Volume")!.props.selected).toBe(true);
    expect(volume.some((n) => n.type === "TrendChart")).toBe(true);
    (volume.find((n) => n.type === "Chip" && n.props.label === "3 months")!.props.onPress as () => void)();
    const ranged = render();
    expect(ranged.find((n) => n.type === "Chip" && n.props.label === "3 months")!.props.selected).toBe(true);
    (ranged.find((n) => n.type === "Chip" && n.props.label === "All time")!.props.onPress as () => void)();
    expect(render().some((n) => n.type === "TrendChart")).toBe(true);
  });

  it("shows the monthly pace, next-workout rec and gym/setup chips on Summary", () => {
    slots.i = 0;
    const onPickSetup = vi.fn();
    const tree = nodes(LiftTrendView({
      lift, trend, sessions, onOpenLoads: vi.fn(),
      paceHeadline: "Bench 100 kg x 5: on pace",
      paceDetails: ["Target date: 2026-12-01"],
      nextTarget: "62.5 kg × 8",
      setups: [
        { lineId: "l1", label: "Gym · Free", selected: true },
        { lineId: "l2", label: "Home · Free", selected: false },
      ],
      onPickSetup,
    }) as ReactElement);
    const copy = texts(tree).join(" ");
    expect(copy).toContain("Monthly goal");
    expect(copy).toContain("on pace");
    expect(copy).toContain("Next workout:");
    expect(copy).toContain("62.5 kg");
    const labels = tree.filter((n) => n.type === "Chip").map((n) => n.props.label);
    expect(labels).toContain("Gym · Free");
    expect(labels).toContain("Home · Free");
    (tree.find((n) => n.type === "Chip" && n.props.label === "Home · Free")!.props.onPress as () => void)();
    expect(onPickSetup).toHaveBeenCalledWith("l2");
  });

  it("shows available weights and the four jump chips, and picking one asks to save", () => {
    const onPickJump = vi.fn();
    slots.i = 0;
    const tree = nodes(LiftTrendView({
      lift, trend, sessions, onOpenLoads: vi.fn(),
      loads: {
        equipment: "barbell",
        own: null,
        gym: { equipment: "barbell", increment: 2.5, min: 20, max: 200 },
        onPickJump,
      },
    }) as ReactElement);
    const copy = texts(tree).join(" ");
    expect(copy).toContain("Available weights");
    expect(copy).toContain("Standard steps");
    expect(copy).toContain("steps of 2.5 kg");
    const strip = (s: unknown) => String(s).replace(/\u2066|\u2069/g, "");
    const labels = tree.filter((n) => n.type === "Chip").map((n) => strip(n.props.label));
    expect(labels).toContain("2.5 kg jumps");
    expect(labels).toContain("2 kg jumps");
    expect(labels).toContain("5 kg jumps");
    expect(labels).toContain("10 kg jumps");
    const jumpChip = (text: string) => tree.find((n) => n.type === "Chip" && strip(n.props.label) === text)!;
    expect(jumpChip("2.5 kg jumps").props.selected).toBe(true);
    expect(jumpChip("5 kg jumps").props.selected).toBe(false);
    (jumpChip("5 kg jumps").props.onPress as () => void)();
    expect(onPickJump).toHaveBeenCalledWith(5);
  });
});
