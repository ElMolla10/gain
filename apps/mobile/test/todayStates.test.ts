import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GymLoadSpec } from "@gain/engine";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../src/i18n/format";
import { defaultGymLoads } from "../src/logic/defaultGym";
import { welcomeBackGap, WELCOME_BACK_DAYS } from "../src/logic/todayCopy";
import { todayHero, type HeroExercise, type TodayHero } from "../src/logic/todayHero";
import { clockText, lighterUntil, showEaseIn, todayMode } from "../src/logic/todayState";
import { byType, expand, nodes, texts } from "./achievementRender";

const settings = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig(), { useContext: () => null }));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", useWindowDimensions: () => ({ fontScale: 1, width: 400, height: 800 }) }));
vi.mock("react-native-svg", () => ({ default: "Svg", Circle: "Circle", Defs: "Defs", Ellipse: "Ellipse", G: "G", Line: "Line", LinearGradient: "LinearGradient", Path: "Path", Polygon: "Polygon", Rect: "Rect", Stop: "Stop", Text: "SvgText" }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ lang: settings.lang, unit: "kg", t: (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(settings.lang, k, p) }) }));
vi.mock("../src/theme", () => ({
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  type: { display: 48, load: 36, title: 28, section: 20, body: 16, label: 14, caption: 13 },
  usePalette: () => ({ muted: "muted", text: "text", edge: "edge", accent: "accent" }),
  useIsDark: () => true,
}));
vi.mock("../src/ui", () => ({ AppText: "AppText", QuietAction: "QuietAction", BigButton: "BigButton" }));

import { TodayBar } from "../src/components/today/TodayBar";
import { ResumeFooter } from "../src/components/today/ResumeFooter";

const gym = { gymId: "g", loads: defaultGymLoads("kg") as GymLoadSpec[] };
const ex: HeroExercise = { exerciseId: "bench", nameEn: "Bench", nameAr: "بنش", equipment: "barbell", setup: "free", measure: "reps", pattern: "horizontal_push", loadSpec: null, isGoalLift: true };
const bar = todayHero({ target: { exerciseId: "bench", load: 102.5, reps: 6, measure: "reps" }, exercise: ex, gym })!;
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const strip = (s: string) => s.replace(/[\u2066-\u2069]/g, "");
const render = (h: TodayHero, props: Record<string, unknown> = {}) => expand(React.createElement(TodayBar, { hero: h, name: "Bench", onOpenPath: () => {}, ...props }));

beforeEach(() => {
  settings.lang = "en";
});

describe("state detection precedence (spec §4)", () => {
  const now = at(2026, 10, 18, 9);
  it("open workout (this day > other day) > done for today > normal", () => {
    expect(todayMode({ openDayId: "a", chosenId: "a", lastFinishedAt: at(2026, 10, 18, 7), now })).toBe("open");
    expect(todayMode({ openDayId: "b", chosenId: "a", lastFinishedAt: at(2026, 10, 18, 7), now })).toBe("openElsewhere");
    expect(todayMode({ openDayId: null, chosenId: "a", lastFinishedAt: at(2026, 10, 18, 7), now })).toBe("done");
    expect(todayMode({ openDayId: null, chosenId: "a", lastFinishedAt: at(2026, 10, 17, 19), now })).toBe("normal");
    expect(todayMode({ openDayId: null, chosenId: "a", lastFinishedAt: null, now })).toBe("normal");
  });
  it("the logical day rolls over at 04:00: a 01:30 finish still counts for the evening before", () => {
    expect(todayMode({ openDayId: null, chosenId: "a", lastFinishedAt: at(2026, 10, 18, 1, 30), now: at(2026, 10, 17, 22) })).toBe("done");
    expect(todayMode({ openDayId: null, chosenId: "a", lastFinishedAt: at(2026, 10, 18, 1, 30), now: at(2026, 10, 18, 9) })).toBe("normal");
  });
  it("welcome back: 13 days → none, 14 → shown; the Ease-in chip needs the pass-through", () => {
    const now2 = at(2026, 10, 18, 9);
    expect(welcomeBackGap([now2 - 13 * 86_400_000], now2)).toBeNull();
    expect(welcomeBackGap([now2 - 14 * 86_400_000], now2)).toBe(WELCOME_BACK_DAYS);
    expect(showEaseIn(14, true)).toBe(true);
    expect(showEaseIn(14, false)).toBe(false);
    expect(showEaseIn(null, true)).toBe(false);
  });
  it("lighter week only for load/sets still in force", () => {
    expect(lighterUntil({ status: "load", endsAt: now + 1000 }, now)).toBe(now + 1000);
    expect(lighterUntil({ status: "sets", endsAt: now - 1 }, now)).toBeNull();
    expect(lighterUntil({ status: "dismissed", endsAt: now + 1000 }, now)).toBeNull();
    expect(lighterUntil(null, now)).toBeNull();
  });
  it("resume clock text", () => {
    expect(clockText(521_000)).toBe("08:41");
    expect(clockText(3_729_000)).toBe("1:02:09");
  });
});

describe("state render trees (EN / AR)", () => {
  it("done for today: racked bar (uprights, plates on the floor), no Warm-ups", () => {
    const tree = render(bar, { racked: true });
    expect(byType(tree, "QuietAction")).toHaveLength(0);
    expect(byType(tree, "Circle").length).toBeGreaterThan(0);
  });
  it("another day open: the bar at 50%, no Warm-ups", () => {
    const tree = render(bar, { dim: true }) as { props: { style: { opacity: number } } };
    expect(tree.props.style.opacity).toBe(0.5);
    expect(byType(tree, "QuietAction")).toHaveLength(0);
  });
  it("first run: the copy replaces the number, over an empty bar with dashed ghosts", () => {
    for (const lang of ["en", "ar"] as const) {
      settings.lang = lang;
      const tree = render({ kind: "firstRun" });
      expect(texts(tree)[0]).toBe(translate(lang, "today.first.number"));
      expect(nodes(tree).filter((n) => n.props.strokeDasharray === "4 3").length).toBeGreaterThan(0);
    }
  });
  it("resume footer: clock and saved sets in both languages; paused stays frozen", () => {
    const f = (lang: "en" | "ar") => {
      settings.lang = lang;
      const el = expand(React.createElement(ResumeFooter, { startedAt: 1_000, pausedMs: 0, pausedAt: 522_000, saved: 2, total: 18, onPress: () => {} })) as { props: { label: string } };
      return strip(el.props.label);
    };
    expect(f("en")).toBe("Resume · 08:41 · 2 of 18 sets");
    expect(f("ar")).toBe("كمّل · 08:41 · 2 من 18");
  });
});

describe("TodayScreen wiring (source)", () => {
  const today = readFileSync(join(__dirname, "..", "src", "screens", "TodayScreen.tsx"), "utf8");
  it("done for today: the title is 'Done for today' with the next session under it, and a quiet See-today's-workout footer", () => {
    expect(today).toContain('dayName={mode === "done" ? t("today.done.title") : chosen.name}');
    expect(today).toContain('t("today.done.next", { day: chosen.name })');
    expect(today).toContain('navigation.navigate("SessionDetail", { sessionId: data.lastFinished!.id })');
    expect(translate("en", "today.done.title")).toBe("Done for today");
    expect(translate("ar", "today.done.title")).toBe("خلصت النهارده");
  });
  it("another day open hides the rack and the week; Ease in marks the session returning after navigate; no 'missed' anywhere", () => {
    expect(today).toContain('{mode !== "openElsewhere" ? (\n      <View style={{ gap: space.sm }}>');
    expect(today).toContain('workout.setSessionReadiness(ps.id, "returning")');
    expect(today).toContain('accessibilityRole="checkbox"');
    expect(today.toLowerCase()).not.toContain("missed\")");
    const strings = readFileSync(join(__dirname, "..", "src", "i18n", "strings.today.ts"), "utf8").toLowerCase();
    for (const w of ["missed", "streak", "best"]) expect(strings).not.toContain(w);
  });
});
