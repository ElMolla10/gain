import React, { useEffect, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionDetailScreen } from "../src/screens/SessionDetailScreen";

const host = vi.hoisted(() => ({ values: [] as any[], index: 0, effects: [] as (() => void)[], services: null as any }));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  const same = (a?: unknown[], b?: unknown[]) => !!a && !!b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const memo = (fn: () => unknown, deps?: unknown[]) => {
    const i = host.index++;
    if (!host.values[i] || !same(host.values[i].deps, deps)) host.values[i] = { value: fn(), deps };
    return host.values[i].value;
  };
  const effect = (fn: () => void, deps?: unknown[]) => {
    const i = host.index++;
    if (host.values[i] && same(host.values[i].deps, deps)) return;
    host.values[i] = { deps }; host.effects.push(fn);
  };
  return { ...actual,
    useState: (initial: unknown) => {
      const i = host.index++;
      if (!(i in host.values)) host.values[i] = typeof initial === "function" ? initial() : initial;
      return [host.values[i], (next: any) => { host.values[i] = typeof next === "function" ? next(host.values[i]) : next; }];
    },
    useCallback: (fn: unknown, deps: unknown[]) => memo(() => fn, deps),
    useEffect: effect, useLayoutEffect: effect,
  };
});
const nav = vi.hoisted(() => ({ goBack: vi.fn(), setOptions: vi.fn() }));
vi.mock("@react-navigation/native", () => ({ useNavigation: () => nav, useRoute: () => ({ params: { sessionId: "s1" } }), useFocusEffect: (fn: () => void) => useEffect(fn, [fn]) }));
vi.mock("react-native", () => ({ View: "View", Alert: { alert: vi.fn() }, Share: { share: vi.fn() } }));
vi.mock("../src/AppContext", () => ({ useServices: () => host.services }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ t: (key: string) => key, lang: "en", unit: "kg", unitText: "kg", fmt: String }) }));
vi.mock("../src/theme", () => ({ MIN_TOUCH: 48, space: { sm: 8, lg: 24 }, type: { caption: 12, body: 16, section: 20, label: 12 }, usePalette: () => ({}) }));
vi.mock("../src/ui", () => Object.fromEntries(["AppText", "BigButton", "Card", "EmptyState", "ErrorState", "Field", "InlineStatus", "LoadingState", "Screen"].map(n => [n, n])));
vi.mock("../src/components/AchievementCard", () => ({ AchievementCard: "AchievementCard" }));
vi.mock("../src/components/history/SessionPostMortemHero", () => ({ SessionPostMortemHero: "SessionPostMortemHero" }));
vi.mock("../src/diagnostics", () => ({ diagnostics: { record: vi.fn() } }));
vi.mock("../src/native/appleHealth", () => ({ appleHealth: { deleteWorkout: vi.fn() } }));

type Node = ReactElement<Record<string, any>>;
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement(value)) return [];
  const n = value as Node;
  return [n, ...nodes(n.props.children)];
}
function render() {
  host.index = 0;
  const tree = SessionDetailScreen();
  host.effects.splice(0).forEach(fn => fn());
  return nodes(tree);
}
function button(label: string) {
  const n = render().find(n => n.props.label === label);
  expect(n, label).toBeTruthy(); return n!;
}
const detail = { id: "s1", dayName: "Upper", gymName: "Gym", startedAt: 1700000000000, finishedAt: 1700000060000, pausedMs: 0, imported: false,
  exercises: [{ exerciseId: "bench", nameEn: "Bench", nameAr: "بنش", setup: "barbell", measure: "reps", sets: [{ id: "set1", load: 60, reps: 8, durationS: null, distanceM: null, rir: 2, warmup: false, tags: [], outlierStatus: "none" }] }] };
beforeEach(() => {
  host.values = []; host.effects = []; host.index = 0;
  host.services = { history: { getSession: vi.fn(async () => detail), removeSet: vi.fn(async () => {}), updateSet: vi.fn(async () => {}) }, finish: { summarizeSession: vi.fn(async () => null) }, workout: {} };
});

describe("finished workout detail failures", () => {
  it("a failed initial read offers retry and recovers to the saved workout", async () => {
    host.services.history.getSession.mockRejectedValueOnce(new Error("busy database"));
    render();
    await vi.waitFor(() => expect(render().some(n => n.type === "ErrorState")).toBe(true));
    const error = render().find(n => n.type === "ErrorState")!;
    expect(error.props.retryLabel).toBeTruthy();
    await error.props.onRetry();
    expect(render().some(n => n.type === "SessionPostMortemHero")).toBe(true);
  });
  it("keeps the last good workout visible when refresh fails after a correction", async () => {
    render();
    await vi.waitFor(() => expect(render().some(n => n.type === "SessionPostMortemHero")).toBe(true));
    button("history.editWorkout").props.onPress();
    button("history.edit").props.onPress();
    host.services.history.getSession.mockRejectedValueOnce(new Error("busy refresh"));
    await button("history.save").props.onPress();
    await vi.waitFor(() => expect(render().some(n => n.type === "InlineStatus" && n.props.text === "history.error.body")).toBe(true));
    expect(render().some(n => n.type === "SessionPostMortemHero")).toBe(true);
    button("history.error.retry").props.onPress();
    await vi.waitFor(() => expect(render().some(n => n.type === "InlineStatus" && n.props.text === "history.error.body")).toBe(false));
  });
  it("a failed set deletion remains visibly failed and can be retried", async () => {
    host.services.history.removeSet.mockRejectedValueOnce(new Error("storage failure"));
    render();
    await vi.waitFor(() => expect(render().some(n => n.type === "SessionPostMortemHero")).toBe(true));
    button("history.editWorkout").props.onPress();
    button("history.delete").props.onPress();
    await button("history.deleteYes").props.onPress();
    expect(render().some(n => n.type === "InlineStatus" && n.props.kind === "error")).toBe(true);
    expect(button("history.deleteYes")).toBeTruthy();
    await button("history.deleteYes").props.onPress();
    expect(host.services.history.removeSet).toHaveBeenCalledTimes(2);
    expect(render().some(n => n.type === "InlineStatus" && n.props.kind === "error")).toBe(false);
  });
});
