import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expand, texts } from "./achievementRender";
const host = vi.hoisted(() => ({ session: {} as any }));
vi.mock("react", async original => (await import("./achievementRender")).mockReactHooks(await original()));
vi.mock("react-native", () => ({ View: "View", ScrollView: "ScrollView", Pressable: "Pressable", Platform: { OS: "ios" }, useWindowDimensions: () => ({ fontScale: 1 }) }));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34 }) }));
vi.mock("@react-navigation/native", () => ({ useIsFocused: () => false }));
vi.mock("../src/hooks/useWorkoutSession", () => ({ useWorkoutSession: () => host.session }));
vi.mock("../src/AppContext", () => ({ useServices: () => ({ repos: {} }) }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ t: (k: string) => k, lang: "en", unit: "kg", unitText: "kg", direction: "ltr" }) }));
vi.mock("../src/theme", () => ({ MIN_TOUCH: 48, space: {}, radius: {}, type: {}, useLogPalette: () => ({}) }));
vi.mock("../src/ui", () => Object.fromEntries(["AppText", "BigButton", "QuietAction", "ErrorState", "IconButton", "InlineStatus", "LoadingState", "Notice"].map(n => [n, n])));
vi.mock("../src/components/Icon", () => ({ Icon: "Icon" }));
vi.mock("../src/components/RackDock", () => ({ RackDock: "RackDock" }));
vi.mock("../src/components/WorkoutExerciseSection", () => ({ ExerciseBlock: "ExerciseBlock" }));
vi.mock("../src/components/WorkoutDetailsPanel", () => ({ WorkoutDetailsPanel: () => null }));
vi.mock("../src/components/WorkoutStats", () => ({ RestClock: "RestClock", LiveDuration: "LiveDuration", Stat: "Stat" }));
vi.mock("../src/components/WorkoutSessionSheets", () => ({ WorkoutSessionSheets: "WorkoutSessionSheets" }));
vi.mock("../src/keepAwake", () => ({ setKeepAwake: vi.fn() }));
import { WorkoutScreen } from "../src/screens/WorkoutScreen";
function messages() { return texts(expand(React.createElement(WorkoutScreen))).filter(t => t === "workout.firstSetHelp"); }
beforeEach(() => {
  host.session = { phase: "ready", loaded: { dayName: "Upper", info: { bench: { last: null, personalHistory: [] } } },
    navigation: { goBack: vi.fn() }, status: { icon: "check" }, statusKind: "saved", statusShort: "saved", summary: { sets: 0 },
    busy: null, dock: {}, rows: { bench: [] }, shown: [{ id: "bench", exerciseId: "bench" }], sets: [], removedSlots: [], exerciseProps: () => null };
});
describe("beginner logging instruction", () => {
  it("shows one instruction before a first set, then removes it after a set is saved", () => {
    expect(messages()).toHaveLength(1);
    host.session.sets = [{ id: "saved" }];
    expect(messages()).toHaveLength(0);
  });
  it("stays out of a returning lifter's path and an empty exercise list", () => {
    host.session.loaded.info.bench.last = { performedAt: "2026-11-01", sets: [] };
    expect(messages()).toHaveLength(0);
    host.session.shown = [];
    expect(messages()).toHaveLength(0);
  });
});
