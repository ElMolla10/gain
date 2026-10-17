import React, { type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { translate } from "../src/i18n/format";
import { resolveWhyTargets } from "../src/logic/finishLayout";

// Render the forecast as a plain element tree (hooks stubbed) and invoke the Why action. Native navigation needs a phone.
vi.mock("react", async (orig) => {
  const real = (await orig()) as typeof import("react");
  const useState = <T,>(v: T | (() => T)) => [typeof v === "function" ? (v as () => T)() : v, () => {}] as const;
  return { ...real, default: { ...real, useState }, useState };
});
vi.mock("react-native", () => ({ View: "View" }));
vi.mock("@gain/engine", () => ({ renderReason: (r: { text: string }) => r.text }));
vi.mock("../src/logic/units", () => ({ localizeReason: (r: unknown) => r }));
vi.mock("../src/logic/bidiText", () => ({ targetRowText: () => "60 kg × 6" }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ lang: "en", unit: "kg", t: (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate("en", k, p) }) }));
vi.mock("../src/theme", () => ({ radius: { card: 12 }, space: { xs: 4, sm: 8, md: 12, lg: 16 }, type: { section: 20, label: 14, load: 36, caption: 13 }, usePalette: () => ({ tint: "tint", accent: "accent", muted: "muted", border: "border" }) }));
vi.mock("../src/ui", () => ({ AppText: "AppText", Card: "Card", QuietAction: "QuietAction" }));
vi.mock("../src/components/Icon", () => ({ Icon: "Icon" }));

type Node = ReactElement<Record<string, any>>;
const nodes = (v: unknown): Node[] => Array.isArray(v) ? v.flatMap(nodes) : React.isValidElement(v) ? [v as Node, ...nodes((v as Node).props.children)] : [];

const forecast = (reason: string) => ({
  dayName: "Upper A", dayId: "d1", gymId: "g",
  exercises: [{ exerciseId: "bench", nameEn: "Bench", nameAr: "بنش", measure: "reps", equipment: "barbell", setup: "standard", loadSpec: null, proposal: { load: 60, reps: 6, currency: "kg", reason: { text: reason } } }],
}) as never;

describe("Finish Why: real decision detail when a record exists, in-place fallback otherwise", () => {
  it("resolveWhyTargets maps only exercises whose planned target has a decision record", async () => {
    const repo = {
      getPlannedSession: vi.fn(async (): Promise<{ id: string } | null> => ({ id: "s2" })),
      getTargetForExercise: vi.fn(async (_s: string, ex: string) => ({ id: `t-${ex}` })),
      getDecision: vi.fn(async (id: string) => (id === "t-bench" ? { path: "x" } : null)),
    };
    expect(await resolveWhyTargets("d1", ["bench", "row"], repo)).toEqual({ bench: "t-bench" });
    repo.getPlannedSession.mockResolvedValueOnce(null);
    expect(await resolveWhyTargets("d1", ["bench"], repo)).toEqual({});
    repo.getPlannedSession.mockRejectedValueOnce(new Error("db"));
    expect(await resolveWhyTargets("d1", ["bench"], repo)).toEqual({});
  });

  it("with a saved record, Why calls onWhy(targetId) and shows no in-place expansion", async () => {
    const { FinishedDayForecast } = await import("../src/components/FinishedDayForecast");
    const onWhy = vi.fn();
    const tree = nodes(FinishedDayForecast({ value: forecast("Go up to 60 kg. You hit all reps."), whyTargets: { bench: "t-bench" }, onWhy }));
    const why = tree.filter((n) => (n.type as unknown) === "QuietAction");
    expect(why).toHaveLength(1);
    expect(why[0]!.props.expanded).toBeUndefined();
    why[0]!.props.onPress();
    expect(onWhy).toHaveBeenCalledWith("t-bench");
  });

  it("without a record, Why toggles the in-place reasoning and never navigates", async () => {
    const { FinishedDayForecast } = await import("../src/components/FinishedDayForecast");
    const onWhy = vi.fn();
    const tree = nodes(FinishedDayForecast({ value: forecast("Go up to 60 kg. You hit all reps."), whyTargets: {}, onWhy }));
    const why = tree.filter((n) => (n.type as unknown) === "QuietAction");
    expect(why).toHaveLength(1);
    expect(why[0]!.props.expanded).toBe(false);
    why[0]!.props.onPress();
    expect(onWhy).not.toHaveBeenCalled();
    // Nothing more to say and no record: the action is hidden.
    const bare = nodes(FinishedDayForecast({ value: forecast("Go up to 60 kg."), whyTargets: {}, onWhy }));
    expect(bare.filter((n) => (n.type as unknown) === "QuietAction")).toHaveLength(0);
  });

  it("FinishScreen wires onWhy to the same Why destination used elsewhere", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const f = readFileSync(join(__dirname, "..", "src", "screens", "FinishScreen.tsx"), "utf8");
    expect(f).toMatch(/onWhy=\{\(targetId\) => navigation\.navigate\("Why", \{ targetId \}\)\}/);
    expect(f).toContain("resolveWhyTargets(next.dayId");
  });
});
