import React, { type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../src/i18n/format";
import type { Disp } from "../src/logic/workoutTypes";
import { initialRows, editRow, markSaved } from "../src/logic/workoutRows";
import { LiveSuggestion } from "../src/components/LiveSuggestion";
import { WorkoutExerciseSection } from "../src/components/WorkoutExerciseSection";
import { WorkoutSetRow, type WorkoutSetRowProps } from "../src/components/WorkoutSetRow";

// Inspect the presentation tree and invoke its callbacks. Native keyboard/gesture delivery needs a phone.
const settings = vi.hoisted(() => ({ unit: "kg" as "kg" | "lb", lang: "en" as "en" | "ar", fontScale: 1 }));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", useWindowDimensions: () => ({ fontScale: settings.fontScale }) }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ ...settings, unitText: settings.unit, fmt: (kg: number) => `${kg} kg`, t: (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate(settings.lang, key, params) }) }));
vi.mock("../src/theme", () => ({ radius: { button: 8, card: 12 }, space: { xs: 4, sm: 8, md: 12, lg: 16 }, type: { section: 20, label: 13 }, useLogPalette: () => ({ doneBg: "done", activeBg: "active", bg: "page" }) }));
vi.mock("../src/ui", () => ({ AppText: "AppText", BigButton: "BigButton", IconButton: "IconButton", InlineStatus: "InlineStatus", Notice: "Notice" }));
vi.mock("../src/components/Icon", () => ({ Icon: "Icon" }));
vi.mock("../src/components/LogParts", () => ({ CellInput: "CellInput", SwipeRow: "SwipeRow", RestToggle: "RestToggle", TargetLine: "TargetLine" }));

type Node = ReactElement<Record<string, any>>;
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement(value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
function props(extra: Partial<WorkoutSetRowProps> = {}): WorkoutSetRowProps {
  const row = initialRows([], 3, { load: 60, reps: 8 }, () => "draft")[0]!;
  return {
    ex: { exerciseId: "bench", nameEn: "Bench Press", nameAr: "بنش", measure: "reps", trackEffort: true } as Disp,
    row, label: 2, workingIndex: 1, lastSets: [{ load: 55, reps: 9 }, { load: 60, reps: 7 }], current: true, stacked: false, busy: false,
    onPatch: vi.fn(), onKind: vi.fn(), onAskDelete: vi.fn(), onDelete: vi.fn(), onLog: vi.fn(), onUntick: vi.fn(), ...extra,
  };
}
const tick = (p: WorkoutSetRowProps) => nodes(WorkoutSetRow(p)).find(n => n.props.accessibilityRole === "checkbox")!;
const inputs = (p: WorkoutSetRowProps) => nodes(WorkoutSetRow(p)).filter(n => n.type as unknown === "CellInput");

beforeEach(() => { settings.unit = "kg"; settings.lang = "en"; settings.fontScale = 1; });
describe("extracted workout row wiring", () => {
  it("logs a ghost-filled row and unticks a saved row using its original identity", () => {
    const p = props();
    expect(tick(p).props.disabled).toBe(false);
    tick(p).props.onPress();
    expect(p.onLog).toHaveBeenCalledWith(p.row);
    expect(p.onUntick).not.toHaveBeenCalled();
    p.row = markSaved([p.row], p.row.key)[0]!;
    expect(tick(p).props.accessibilityState.checked).toBe(true);
    tick(p).props.onPress();
    expect(p.onUntick).toHaveBeenCalledWith(p.row);
  });
  it("updates an edited saved row instead of unticking it", () => {
    const p = props();
    p.row = editRow(markSaved([p.row], p.row.key), p.row.key, { reps: 9 })[0]!;
    expect(tick(p).props.accessibilityState.checked).toBe(false);
    expect(tick(p).props.accessibilityLabel).toContain("Update");
    tick(p).props.onPress();
    expect(p.onLog).toHaveBeenCalledWith(p.row);
    expect(p.onUntick).not.toHaveBeenCalled();
  });
  it("announces disabled state during saves and on incomplete unsaved rows", () => {
    for (const p of [props({ busy: true }), props({ row: initialRows([], 1, { load: null, reps: null }, () => "blank")[0]! })]) {
      expect(tick(p).props.disabled).toBe(true);
      expect(tick(p).props.accessibilityState.disabled).toBe(true);
    }
  });
  it("routes kind, long-press delete and swipe delete to the same row", () => {
    const p = props();
    const tree = nodes(WorkoutSetRow(p));
    const kind = tree.find(n => n.props.accessibilityRole === "button")!;
    kind.props.onPress(); kind.props.onLongPress();
    tree[0]!.props.onDelete();
    expect(p.onKind).toHaveBeenCalledWith(p.row);
    expect(p.onAskDelete).toHaveBeenCalledWith(p.row);
    expect(p.onDelete).toHaveBeenCalledWith(p.row);
  });
  it("converts typed pounds to kilograms and keeps the exercise/set context on each input", () => {
    settings.unit = "lb";
    const p = props(); const cells = inputs(p);
    const kg = cells[0]!.props.parse("132.3", null);
    expect(kg).toBeCloseTo(60, 1);
    cells[0]!.props.onValue(kg); cells[1]!.props.onValue(9); cells[2]!.props.onValue(2);
    expect(vi.mocked(p.onPatch).mock.calls).toEqual([[p.row.key, { load: kg, invalidLoad: false }], [p.row.key, { reps: 9, invalidReps: false }], [p.row.key, { rir: 2, invalidRir: false }]]);
    for (const cell of cells) { expect(cell.props.a11y).toContain("Bench Press"); expect(cell.props.a11y).toContain("2"); }
  });
  it("keeps a two-line large-text layout with one copy of every control", () => {
    const p = props({ stacked: true });
    const tree = nodes(WorkoutSetRow(p));
    expect(tree.filter(n => n.props.accessibilityRole === "checkbox")).toHaveLength(1);
    const cells = inputs(p);
    expect(cells).toHaveLength(3);
    expect(cells.every(n => n.props.unitLabel)).toBe(true);
    expect(tree.filter(n => n.type as unknown === "AppText").map(n => String(n.props.children)).join(" ")).toContain("60kg x 7");
  });
  it("uses quantity parsing for timed/distance rows and omits effort when disabled", () => {
    const p = props(); p.ex = { ...p.ex, measure: "distance", trackEffort: false };
    const cells = inputs(p);
    expect(cells).toHaveLength(2);
    expect(cells[1]!.props.decimal).toBe(true);
    expect(cells[1]!.props.parse("12.5")).toBe(12.5);
    cells[1]!.props.onValue(12.5);
    expect(p.onPatch).toHaveBeenCalledWith(p.row.key, { reps: 12.5, invalidReps: false });
  });
  it("keeps Arabic exercise and set context on the action label", () => {
    settings.lang = "ar";
    const p = props();
    expect(tick(p).props.accessibilityLabel).toContain("بنش");
    expect(tick(p).props.accessibilityLabel).toMatch(/[٢2]/);
  });
});

async function sectionProps(): Promise<Parameters<typeof WorkoutExerciseSection>[0]> {
  const { freshDb } = await import("./helpers");
  const { repos, workout } = await freshDb();
  await repos.seedIfNeeded();
  const gymId = (await repos.getActiveGymId())!;
  const gym = await repos.loadGymFingerprint(gymId);
  const day = (await repos.getNextDay())!.day;
  const ex = (await repos.listDayExercises(day.id))[0]!;
  const { proposal, line } = await workout.liveProposal(ex, gym);
  let n = 0;
  const list = initialRows([], 3, { load: 60, reps: 8 }, () => `row${n++}`);
  return {
    ex: { ...ex, slot: ex.exerciseId }, position: 0, gym, list,
    info: { proposal, line, last: null, stored: null, prefill: { load: 60, reps: 8 } },
    st: { slot: ex.exerciseId, removed: false, replacedBy: null, note: "", restOff: false, added: false, position: null, superset: null },
    exSets: [], outliers: {}, expanded: false, supersetLabel: "A", restDurationMs: 90000,
    busy: false, warmOpen: false, warmDone: false,
    onPatch: vi.fn(), onKind: vi.fn(), onAskDelete: vi.fn(), onDelete: vi.fn(), onLog: vi.fn(), onUntick: vi.fn(),
    onToggleRest: vi.fn(), onMenu: vi.fn(), onWhy: vi.fn(), onWhyLong: vi.fn(),
    onLiveApply: vi.fn(), onLiveReport: vi.fn(), onLiveKeep: vi.fn(), onOutlierConfirm: vi.fn(), onOutlierReject: vi.fn(),
    onWarmConfirm: vi.fn(), onWarmOpen: vi.fn(), onWarmClose: vi.fn(), onAddSet: vi.fn(),
  };
}
describe("extracted exercise section wiring", () => {
  it("preserves warm-up numbering, prior working-set indexes and the current-row identity", async () => {
    const p = await sectionProps();
    p.list = markSaved(editRow(p.list, p.list[0]!.key, { warmup: true }), p.list[0]!.key);
    const rows = nodes(WorkoutExerciseSection(p)).filter(n => n.type === WorkoutSetRow);
    expect(rows.map(n => n.props.label)).toEqual(["W", "1", "2"]);
    expect(rows.map(n => n.props.workingIndex)).toEqual([null, 0, 1]);
    expect(rows.map(n => n.props.current)).toEqual([false, true, false]);
    rows[1]!.props.onPatch(rows[1]!.props.row.key, { load: 62.5 });
    expect(p.onPatch).toHaveBeenCalledWith(p.list[1]!.key, { load: 62.5 });
  });
  it("keeps header rest/menu, target reasons, and Add set connected to screen handlers", async () => {
    const p = await sectionProps();
    const tree = nodes(WorkoutExerciseSection(p));
    tree.find(n => (n.type as unknown) === "RestToggle")!.props.onPress();
    tree.find(n => (n.type as unknown) === "IconButton")!.props.onPress();
    const target = tree.find(n => (n.type as unknown) === "TargetLine")!;
    target.props.onWhy(); target.props.onWhyLong();
    tree.find(n => (n.type as unknown) === "BigButton" && n.props.accessibilityHint)!.props.onPress();
    for (const handler of [p.onToggleRest, p.onMenu, p.onWhy, p.onWhyLong, p.onAddSet]) expect(handler).toHaveBeenCalledOnce();
    expect(tree.filter(n => (n.type as unknown) === "AppText").map(n => String(n.props.children)).join(" ")).toContain("A");
  });
  it("adapts every set row to large text without changing the action callbacks", async () => {
    settings.fontScale = 1.6;
    const p = await sectionProps();
    const rows = nodes(WorkoutExerciseSection(p)).filter(n => n.type === WorkoutSetRow);
    expect(rows).toHaveLength(p.list.length);
    expect(rows.every(n => n.props.stacked === true)).toBe(true);
    expect(rows.every(n => n.props.onLog === p.onLog && n.props.onDelete === p.onDelete)).toBe(true);
  });
});

describe("live suggestion explanations", () => {
  const presentation = () => ({ decision: { action: "maintain" as const, suggestedWeightKg: 60, predictedReps: 8.25, reason: "within_range" as const }, basis: { load: 60, reps: 10 }, repMin: 6, repMax: 10, manualLoad: false, busy: false, onApply: vi.fn(), onKeep: vi.fn(), onReport: vi.fn() });
  it("explains the observed set in the user's unit without changing the decision", () => {
    settings.unit = "lb";
    const p = presentation();
    const before = { ...p.decision };
    const tree = nodes(LiveSuggestion(p));
    const text = tree.filter(n => (n.type as unknown) === "AppText").map(n => String(n.props.children)).join(" ");
    expect(text).toContain("132.3");
    expect(text).toContain("10");
    expect(text).toContain("Sleep, readiness and rest time are unknown");
    tree.find(n => (n.type as unknown) === "BigButton" && n.props.variant === "secondary")!.props.onPress();
    expect(p.onApply).toHaveBeenCalledOnce();
    expect(p.decision).toEqual(before);
  });
  it("does not present a model estimate as the basis for a reported-symptom stop", () => {
    const p = presentation();
    const tree = nodes(LiveSuggestion({ ...p, decision: { ...p.decision, action: "stop", reason: "reported_symptoms" } }));
    const text = tree.filter(n => (n.type as unknown) === "AppText").map(n => String(n.props.children)).join(" ");
    expect(text).not.toContain("Last saved set");
    expect(text).not.toContain("Estimate from logged sets");
    expect(tree.some(n => n.props.variant === "secondary")).toBe(false);
  });
});

describe("accessible row deletion and invalid-input protection", () => {
  it("routes the screen-reader delete action through confirmation, not immediate deletion", () => {
    const p = props();
    const button = nodes(WorkoutSetRow(p)).find(n => n.props.accessibilityRole === "button")!;
    expect(button.props.accessibilityActions).toEqual([{ name: "delete", label: "Delete" }]);
    button.props.onAccessibilityAction({ nativeEvent: { actionName: "delete" } });
    expect(p.onAskDelete).toHaveBeenCalledWith(p.row);
    expect(p.onDelete).not.toHaveBeenCalled();
  });
  it("keeps a contextual label on swipe deletion and blocks invalid edits to already saved sets", () => {
    const p = props();
    expect(nodes(WorkoutSetRow(p))[0]!.props.deleteA11y).toContain("Bench Press");
    p.row = editRow(markSaved([p.row], p.row.key), p.row.key, { load: null, invalidLoad: true })[0]!;
    expect(tick(p).props.disabled).toBe(true);
    expect(tick(p).props.accessibilityState.disabled).toBe(true);
  });
  it("forwards invalid text separately from an intentionally empty target input", () => {
    const p = props(); const cell = inputs(p)[0]!;
    cell.props.onValue(null, true);
    expect(p.onPatch).toHaveBeenCalledWith(p.row.key, { load: null, invalidLoad: true });
    cell.props.onValue(null, false);
    expect(p.onPatch).toHaveBeenLastCalledWith(p.row.key, { load: null, invalidLoad: false });
  });
});
