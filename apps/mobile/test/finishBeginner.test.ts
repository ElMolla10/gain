import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../src/i18n/format";
import { FinishScreen } from "../src/screens/FinishScreen";
import { AchievementCard } from "../src/components/AchievementCard";
import { FinishMuscleStrip } from "../src/components/FinishMuscleStrip";
import { FinishRpeCheck } from "../src/components/FinishRpeCheck";
import { CollapsibleCard } from "../src/ui";
import { nodes } from "./achievementRender";

type State = { values: any[]; index: number };
const host = vi.hoisted(() => ({ active: { values: [] as any[], index: 0 }, lang: "en" as "en" | "ar" }));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  const hooks = {
    useState: (initial: unknown) => {
      const state = host.active, i = state.index++;
      if (!(i in state.values)) state.values[i] = typeof initial === "function" ? initial() : initial;
      return [state.values[i], (next: any) => { state.values[i] = typeof next === "function" ? next(state.values[i]) : next; }];
    },
    useRef: (initial: unknown) => { const state = host.active, i = state.index++; return state.values[i] ??= { current: initial }; },
    useMemo: (fn: () => unknown) => fn(), useEffect: () => {}, useLayoutEffect: () => {},
  };
  return { ...actual, ...hooks, default: { ...((actual as { default?: typeof actual }).default ?? actual), ...hooks } };
});
vi.mock("react-native", () => ({ Platform: { OS: "ios" }, View: "View", Pressable: "Pressable", Share: { share: vi.fn() }, StyleSheet: { flatten: (s: unknown) => s }, useWindowDimensions: () => ({ width: 390, height: 844, fontScale: 1 }) }));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ lang: host.lang, unit: "kg", unitText: "kg", direction: host.lang === "ar" ? "rtl" : "ltr", t: (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(host.lang, k, p) }) }));
vi.mock("../src/theme", async () => ({ ...(await import("../src/palettes")), MIN_TOUCH: 48, space: { xs: 4, sm: 8, md: 12, lg: 16 }, radius: { card: 12 }, type: { title: 28, section: 20, body: 16, label: 14, caption: 12 }, usePalette: () => ({}), achievementPalette: {} }));
vi.mock("../src/ui", async original => {
  const actual = await original<typeof import("../src/ui")>();
  return { ...Object.fromEntries(["AppText", "BigButton", "Card", "ErrorState", "InlineStatus", "LoadingState", "Notice", "Screen"].map(n => [n, n])), CollapsibleCard: actual.CollapsibleCard };
});
vi.mock("../src/components/Icon", () => ({ Icon: "Icon" }));
vi.mock("../src/components/LogParts", () => ({ MenuSheet: "MenuSheet" }));
vi.mock("../src/components/SaveStatusLine", () => ({ SaveStatusLine: "SaveStatusLine" }));
vi.mock("../src/components/HealthNote", () => ({ HealthNote: "HealthNote" }));
vi.mock("../src/components/FinishedDayForecast", () => ({ FinishedDayForecast: "FinishedDayForecast" }));
vi.mock("../src/components/HeroAchievement", () => ({ HeroAchievement: "HeroAchievement" }));
vi.mock("../src/haptics", () => ({ haptics: { selection: vi.fn() } }));
vi.mock("../src/diagnostics", () => ({ diagnostics: { record: vi.fn() } }));
const navigation = vi.hoisted(() => ({ navigate: vi.fn(), popToTop: vi.fn() }));
vi.mock("@react-navigation/native", () => ({ useNavigation: () => navigation, useRoute: () => ({ params: { sessionId: "s1" } }) }));
vi.mock("../src/AppContext", () => ({ useServices: () => ({}) }));
vi.mock("expo-print", () => ({ printToFileAsync: vi.fn() }));
const sharing = vi.hoisted(() => ({ isAvailableAsync: vi.fn(async () => true), shareAsync: vi.fn(async () => {}) }));
vi.mock("expo-sharing", () => sharing);
const capture = vi.hoisted(() => ({ captureRef: vi.fn(async () => "file:///test.png"), releaseCapture: vi.fn() }));
vi.mock("react-native-view-shot", () => capture);

const summary = { totals: { counted: 3, exercises: 1, warmups: 0, unconfirmed: 0, records: 0 }, exercises: [] };
const detail = { id: "s1", dayName: "Upper", gymName: "Gym", startedAt: 1700000000000, finishedAt: 1700001800000, pausedMs: 0, imported: false, exercises: [] };
function render<T>(state: State, fn: () => T): T { host.active = state; state.index = 0; return fn(); }
function finish() {
  // Render an already-loaded recap, bypassing only asynchronous repositories.
  const state = { values: [summary, detail, false, "none"], index: 0 };
  return render(state, FinishScreen);
}
beforeEach(() => { host.lang = "en"; vi.clearAllMocks(); });

describe("Finish keeps the beginner path brief", () => {
  it.each(["en", "ar"] as const)("%s: keeps effort and primary actions outside closed details", lang => {
    host.lang = lang;
    const tree = finish();
    const all = nodes(tree);
    const details = all.find(n => n.type === CollapsibleCard)!;
    expect(details).toBeTruthy();
    expect(details.props.title).toBe(translate(lang, "finish.details"));
    expect(details.props.defaultOpen ?? false).toBe(false);
    const secondary = nodes(details.props.children);
    expect(secondary.some(n => n.type === FinishMuscleStrip)).toBe(true);
    expect(secondary.some(n => n.type === AchievementCard)).toBe(true);
    const improved = translate(lang, "progress.improved");
    expect(secondary.some(n => n.props.children === improved)).toBe(true);
    expect(secondary.some(n => n.type === FinishRpeCheck)).toBe(false);
    expect(all.some(n => n.type === FinishRpeCheck)).toBe(true);
    const effortChange = vi.fn();
    const effortState: State = { values: [], index: 0 };
    const effort = render(effortState, () => FinishRpeCheck({ value: null, onChange: effortChange }));
    const question = lang === "en" ? "How did the workout feel? (optional)" : "التمرين كان عامل إزاي؟ (اختياري)";
    expect(nodes(effort).some(n => n.props.children === question)).toBe(true);
    const choices = nodes(effort).filter(n => n.type === "Pressable");
    expect(choices).toHaveLength(3);
    choices[0]!.props.onPress(); expect(effortChange).toHaveBeenCalledWith("smooth");
    expect(translate(lang, "finish.heroPlaque.bankedSubtitle", { n: 3 })).toBe(lang === "en" ? "\u20663\u2069 sets saved to your history" : "تم حفظ \u20663\u2069 مجموعة في سجل تمرينك");
    expect(all.some(n => n.type === "SaveStatusLine")).toBe(true);
    expect(all.some(n => n.type === "FinishedDayForecast")).toBe(true);
    expect(all.some(n => n.props.children === translate(lang, "finish.heroPlaque.bankedTitle"))).toBe(true);
    expect(all.some(n => n.type === "BigButton" && n.props.label === translate(lang, "finish.share"))).toBe(true);
    const done = nodes(tree.props.footer).find(n => n.type === "BigButton")!;
    done.props.onPress(); expect(navigation.popToTop).toHaveBeenCalledOnce();
  });

  it("closed details hide content accessibly but keep the achievement share callback usable", async () => {
    const tree = finish();
    const details = nodes(tree).find(n => n.type === CollapsibleCard)!;
    const state: State = { values: [], index: 0 };
    let panel = render(state, () => CollapsibleCard(details.props as any));
    nodes(panel).find(n => n.props.onLayout)!.props.onLayout({ nativeEvent: { layout: { height: 500 } } });
    panel = render(state, () => CollapsibleCard(details.props as any));
    const hidden = nodes(panel).find(n => n.props.accessibilityElementsHidden === true)!;
    expect(hidden.props.style).toMatchObject({ height: 0, overflow: "hidden" });
    expect(hidden.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(hidden.props["aria-hidden"]).toBe(true);
    const card = nodes(hidden).find(n => n.type === AchievementCard)!;
    expect(card).toBeTruthy(); // The closed panel still contains the mounted child.
    const cardState: State = { values: [], index: 0 };
    let poster = render(cardState, () => AchievementCard(card.props as any));
    const captureView = nodes(poster).find(n => n.props.collapsable === false)!;
    captureView.props.ref.current = {};
    captureView.props.onLayout({ nativeEvent: { layout: { width: 300, height: 400 } } });
    poster = render(cardState, () => AchievementCard(card.props as any));
    expect(card.props.shareRef.current).toBeTypeOf("function");
    expect(nodes(poster).some(n => n.type === "BigButton")).toBe(false); // No duplicate Share button.
    const shareAction = vi.fn(card.props.shareRef.current);
    card.props.shareRef.current = shareAction;
    vi.useFakeTimers();
    try {
      const menu = nodes(tree).find(n => n.type === "MenuSheet")!;
      menu.props.items.find((item: any) => item.label === translate("en", "progress.share")).onPress();
      await vi.runAllTimersAsync();
      expect(shareAction).toHaveBeenCalledOnce();
      await shareAction.mock.results[0]!.value;
      expect(capture.captureRef).toHaveBeenCalledOnce();
      expect(sharing.shareAsync).toHaveBeenCalledWith("file:///test.png", expect.objectContaining({ mimeType: "image/png" }));
      expect(capture.releaseCapture).toHaveBeenCalledWith("file:///test.png");
    } finally { vi.useRealTimers(); }
    nodes(panel).find(n => n.type === "Pressable")!.props.onPress();
    const opened = render(state, () => CollapsibleCard(details.props as any));
    expect(nodes(opened).some(n => n.props.accessibilityElementsHidden === false)).toBe(true);
  });
});
