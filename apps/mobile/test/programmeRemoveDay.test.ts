import React, { type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../src/i18n/format";
import { ar, en } from "../src/i18n/strings";
import { newExercise, type ProgrammeDraft } from "../src/logic/programmeDraft";

// Render ProgrammeEditorView as a plain function: hooks return their initial state, native pieces are host strings.
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => [typeof initial === "function" ? (initial as () => unknown)() : initial, () => {}], useMemo: (fn: () => unknown) => fn() };
});
const native = vi.hoisted(() => ({ alert: vi.fn() }));
vi.mock("react-native", () => ({ Alert: { alert: native.alert }, Pressable: "Pressable", View: "View" }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ t: (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate("en", key, params), lang: "en" }) }));
vi.mock("../src/theme", () => ({ space: { xs: 4, sm: 8, md: 12, lg: 16 }, type: { section: 20, label: 13 }, usePalette: () => ({}) }));
vi.mock("../src/ui", () => ({ AppText: "AppText", BigButton: "BigButton", Card: "Card", Chip: "Chip", Field: "Field", IconButton: "IconButton", QuietAction: "QuietAction", Stepper: "Stepper" }));
vi.mock("../src/components/ExposureView", () => ({ EffectView: "EffectView", ExposureView: "ExposureView" }));
vi.mock("../src/components/ExercisePicker", () => ({ ExercisePicker: "ExercisePicker" }));
vi.mock("../src/components/ExerciseReorderModal", () => ({ ExerciseReorderModal: "ExerciseReorderModal" }));
vi.mock("../src/components/WorkoutSettingsModal", () => ({ WorkoutSettingsModal: "WorkoutSettingsModal" }));
vi.mock("../src/components/LogParts", () => ({ MenuSheet: "MenuSheet" }));
vi.mock("../src/components/Icon", () => ({ Icon: "Icon" }));

const { ProgrammeEditorView, removeBodyKey } = await import("../src/components/ProgrammeEditorView");

type Node = ReactElement<Record<string, any>>;
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement(value)) return [];
  const n = value as Node;
  return [n, ...nodes(n.props.children)];
}

const draft: ProgrammeDraft = {
  name: "My plan",
  days: [
    { name: "Push", exercises: [newExercise("bench"), newExercise("ohp"), newExercise("dips")] },
    { name: "", exercises: [newExercise("row")] },
    { name: "Spare", exercises: [] },
  ],
};

function removeChips(onChange: (d: ProgrammeDraft) => void) {
  const tree = nodes(ProgrammeEditorView({ draft, onChange, baseline: null, library: [], daysPerWeek: null, onCreateExercise: async () => "x" }));
  return tree.filter(n => n.type === "QuietAction" && n.props.label === en["prog.day.remove"]);
}

beforeEach(() => native.alert.mockReset());
const plain = (s: string) => s.replace(/[\u2066-\u2069]/g, "");

describe("'Remove this day' asks first (data-loss item 8)", () => {
  it("a day with exercises shows a confirm naming the day and its exercise count, and changes nothing yet", () => {
    const onChange = vi.fn();
    removeChips(onChange)[0]!.props.onPress();
    expect(onChange).not.toHaveBeenCalled();
    expect(native.alert).toHaveBeenCalledOnce();
    const [title, body, buttons] = native.alert.mock.calls[0]!;
    expect(plain(title)).toBe("Remove Push?");
    expect(body).toBe(translate("en", "prog.day.removeBody", { day: "Push", n: 3 }));
    expect(plain(body)).toContain("Push and its 3 exercises");
    expect(buttons.map((b: { text: string; style?: string }) => [b.text, b.style])).toEqual([[en["finish.cancel"], "cancel"], [en["prog.ex.remove"], "destructive"]]);
  });

  it("the destructive button removes exactly that day; Cancel leaves the draft alone", () => {
    const onChange = vi.fn();
    removeChips(onChange)[0]!.props.onPress();
    const buttons = native.alert.mock.calls[0]![2] as { style?: string; onPress?: () => void }[];
    buttons.find(b => b.style === "cancel")!.onPress?.();
    expect(onChange).not.toHaveBeenCalled();
    buttons.find(b => b.style === "destructive")!.onPress!();
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0]![0].days.map((d: { name: string }) => d.name)).toEqual(["", "Spare"]);
  });

  it("a blank day name falls back to 'Day N'", () => {
    removeChips(vi.fn())[1]!.props.onPress();
    expect(plain(native.alert.mock.calls[0]![0])).toBe("Remove Day 2?");
    expect(plain(native.alert.mock.calls[0]![1])).toContain("Day 2 and its 1 exercise from");
  });

  it("an empty day is removed straight away, with no dialog", () => {
    const onChange = vi.fn();
    removeChips(onChange)[2]!.props.onPress();
    expect(native.alert).not.toHaveBeenCalled();
    expect(onChange.mock.calls[0]![0].days.map((d: { name: string }) => d.name)).toEqual(["Push", ""]);
  });

  it("counts read naturally: 1 exercise / N exercises; Arabic plural noun only for 3–10", () => {
    expect(removeBodyKey(1, "en")).toBe("prog.day.removeBody.one");
    for (const n of [2, 3, 11]) expect(removeBodyKey(n, "en")).toBe("prog.day.removeBody");
    for (const n of [1, 2, 11, 20]) expect(removeBodyKey(n, "ar")).toBe("prog.day.removeBody.one");
    for (const n of [3, 10]) expect(removeBodyKey(n, "ar")).toBe("prog.day.removeBody");
    expect(plain(translate("en", "prog.day.removeBody.one", { day: "Legs", n: 1 }))).toContain("its 1 exercise from");
    expect(plain(translate("ar", "prog.day.removeBody", { day: "رجل", n: 3 }))).toContain("3 تمارين");
    expect(plain(translate("ar", "prog.day.removeBody.one", { day: "رجل", n: 1 }))).toContain("1 تمرين ");
  });

  it("the remove control sits at the bottom of the day card as a danger text action, after Add exercise", () => {
    const tree = nodes(ProgrammeEditorView({ draft, onChange: vi.fn(), baseline: null, library: [], daysPerWeek: null, onCreateExercise: async () => "x" }));
    const firstCard = tree.find(n => n.type === "Card")!;
    const inCard = nodes(firstCard.props.children);
    const add = inCard.findIndex(n => n.type === "BigButton" && n.props.label === en["prog.ex.add"]);
    const remove = inCard.findIndex(n => n.type === "QuietAction" && n.props.label === en["prog.day.remove"]);
    expect(add).toBeGreaterThan(-1);
    expect(remove).toBeGreaterThan(add);
    expect(inCard[remove]!.props).toMatchObject({ tone: "danger", icon: "trash" });
    expect(tree.some(n => n.type === "Chip" && n.props.label === en["prog.day.remove"])).toBe(false);
  });

  it("has English and Egyptian Arabic copy with matching placeholders", () => {
    for (const key of ["prog.day.removeTitle", "prog.day.removeBody", "prog.day.removeBody.one"] as const) {
      expect(ar[key]).toMatch(/[\u0600-\u06ff]/);
      expect((en[key].match(/\{\w+\}/g) ?? []).sort()).toEqual((ar[key].match(/\{\w+\}/g) ?? []).sort());
    }
  });
});
