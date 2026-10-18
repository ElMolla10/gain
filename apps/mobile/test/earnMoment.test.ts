import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../src/i18n/format";
import { EARN, earnSchedule, earnVariant, odometer, plateTierUp, runSchedule, settleAt, type EarnHaptic } from "../src/logic/earnMoment";
import { byType, expand, texts } from "./achievementRender";
import { BENCH, earned, pr, row } from "./achievementFixtures";

const settings = vi.hoisted(() => ({ lang: "en" as "en" | "ar", reduced: false }));
const fx = vi.hoisted(() => ({ haptics: [] as string[], announced: [] as string[] }));
vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig(), { useContext: () => null }));
vi.mock("react-native", () => {
  class Value {
    v: number;
    constructor(v: number) { this.v = v; }
    setValue(v: number) { this.v = v; }
    stopAnimation() {}
    addListener() { return "l"; }
    removeListener() {}
    interpolate(c: unknown) { return { interpolated: c }; }
  }
  const anim = () => ({ start: () => {} });
  return {
    View: "View",
    Pressable: "Pressable",
    Share: { share: vi.fn(async () => ({})) },
    AccessibilityInfo: { announceForAccessibility: (s: string) => fx.announced.push(s) },
    Easing: { inOut: (f: unknown) => f, out: (f: unknown) => f, cubic: () => 0 },
    Animated: { View: "AnimatedView", Value, timing: anim, parallel: anim, sequence: anim, delay: anim },
    useWindowDimensions: () => ({ fontScale: 1, width: 400, height: 800 }),
  };
});
vi.mock("react-native-svg", () => ({ default: "Svg", Circle: "Circle", ClipPath: "ClipPath", Defs: "Defs", Ellipse: "Ellipse", G: "G", LinearGradient: "LinearGradient", Path: "Path", RadialGradient: "RadialGradient", Rect: "Rect", Stop: "Stop", Text: "SvgText", TextPath: "TextPath" }));
vi.mock("../src/haptics", () => ({ haptics: { land: () => fx.haptics.push("land"), legacy: () => fx.haptics.push("legacy"), celebrate: () => fx.haptics.push("celebrate") } }));
vi.mock("../src/achievementTelemetry", () => ({ telemetry: { record: () => {} } }));
vi.mock("../src/diagnostics", () => ({ diagnostics: { record: () => {} } }));
vi.mock("../src/components/SettingsRows", () => ({ SwitchRow: "SwitchRow" }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ lang: settings.lang, unit: "kg", direction: settings.lang === "ar" ? "rtl" : "ltr", t: (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(settings.lang, k, p) }) }));
vi.mock("../src/theme", async () => {
  const pal = await import("../src/palettes");
  return {
    space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
    radius: { button: 12, card: 16 },
    type: { display: 48, load: 36, title: 28, section: 20, body: 16, label: 14, caption: 13 },
    usePalette: () => ({ muted: "muted", text: "text", border: "border", card: "card", raised: "raised", accent: "accent", tint: "tint" }),
    useAchievementArt: () => pal.achievementArtDark,
    useIsDark: () => true,
  };
});
vi.mock("../src/ui", () => ({ AppText: "AppText", Card: "Card", BigButton: "BigButton", QuietAction: "QuietAction", useReducedMotion: () => settings.reduced }));

import { EarnMoment } from "../src/components/achievements/EarnMoment";
import { HeroAchievement } from "../src/components/HeroAchievement";

const fakeTimer = () => {
  const q: { fn: () => void; ms: number; id: number }[] = [];
  let n = 0;
  return {
    timer: { set: (fn: () => void, ms: number) => (q.push({ fn, ms, id: ++n }), n), clear: (id: unknown) => { const i = q.findIndex((x) => x.id === id); if (i >= 0) q.splice(i, 1); } },
    flush: (until = Infinity) => { q.sort((a, b) => a.ms - b.ms); while (q.length && q[0]!.ms <= until) q.shift()!.fn(); },
  };
};

beforeEach(() => {
  settings.lang = "en";
  settings.reduced = false;
  fx.haptics = [];
  fx.announced = [];
});

describe("earn variant", () => {
  it("picks plate for hundred_club, pr for strength PRs, legacy for multi-year / dedicated 50+, standard otherwise", () => {
    expect(earnVariant(earned("hundred_club_100", 1, "2026-02-01", { kind: "hundred_club", tier: 100, days: 100 }))).toBe("plate");
    expect(earnVariant(pr("p1", BENCH, [80, 5], [82.5, 5]))).toBe("pr");
    expect(earnVariant(earned("multi_year_2", 1))).toBe("legacy");
    expect(earnVariant(earned("dedicated_100", 1))).toBe("legacy");
    expect(earnVariant(earned("first_session", 1))).toBe("standard");
    expect(earnVariant(earned("workhorse", 1))).toBe("standard");
    expect(earnVariant(row({ id: "x", badgeId: "strength_pr", evidence: null }))).toBe("standard");
  });
});

describe("haptic schedule", () => {
  it("exactly one Success per variant; Medium at land; Heavy only for Legacy", () => {
    for (const v of ["standard", "pr", "legacy", "plate"] as const) {
      const s = earnSchedule(v, false);
      expect(s.filter((x) => x.haptic === "celebrate")).toHaveLength(1);
      expect(s[0]!.haptic).toBe("land");
      expect(s.some((x) => x.haptic === "legacy")).toBe(v === "legacy");
      expect(s.map((x) => x.at)).toEqual([...s.map((x) => x.at)].sort((a, b) => a - b));
    }
    expect(earnSchedule("standard", false)[0]!.at).toBe(380);
    expect(earnSchedule("plate", false)[0]!.at).toBe(250);
    expect(settleAt(false)).toBe(EARN.settle);
  });
  it("Reduce Motion: a single Success at the end of the 200 ms crossfade, nothing else", () => {
    for (const v of ["standard", "pr", "legacy", "plate"] as const) expect(earnSchedule(v, true)).toEqual([{ at: 200, haptic: "celebrate" }]);
    const fired: EarnHaptic[] = [];
    const { timer, flush } = fakeTimer();
    runSchedule(earnSchedule("legacy", true), (h) => fired.push(h), timer);
    flush();
    expect(fired).toEqual(["celebrate"]);
  });
  it("plays in order; skip mid-way fires the pending Success once and nothing after", () => {
    const fired: EarnHaptic[] = [];
    const { timer, flush } = fakeTimer();
    const p = runSchedule(earnSchedule("legacy", false), (h) => fired.push(h), timer);
    flush(500);
    p.skip();
    p.skip();
    flush();
    expect(fired).toEqual(["land", "celebrate"]);
  });
  it("skip after settle adds nothing; cancel fires nothing", () => {
    const fired: EarnHaptic[] = [];
    const a = fakeTimer();
    const p = runSchedule(earnSchedule("standard", false), (h) => fired.push(h), a.timer);
    a.flush();
    p.skip();
    expect(fired).toEqual(["land", "celebrate"]);
    const b = fakeTimer();
    const fired2: EarnHaptic[] = [];
    runSchedule(earnSchedule("standard", false), (h) => fired2.push(h), b.timer).cancel();
    b.flush();
    expect(fired2).toEqual([]);
  });
});

describe("odometer and plate tier-up", () => {
  it("rolls from the previous best to the new best on the 0.5 grid, ending exactly", () => {
    expect(odometer(80, 82.5, 0)).toBe(80);
    expect(odometer(80, 82.5, 1)).toBe(82.5);
    for (let k = 0; k <= 1; k += 0.1) expect((odometer(80, 82.5, k) * 2) % 1).toBe(0);
    expect(odometer(30, 20, 1)).toBe(20);
  });
  it("the plate completes the previous colour and becomes the new one", () => {
    expect(plateTierUp({ badgeId: "hundred_club_100", evidence: { kind: "hundred_club", tier: 100, days: 100 } })).toEqual({ days: 100, from: "steel", to: "green" });
    expect(plateTierUp({ badgeId: "hundred_club_1000", evidence: { kind: "hundred_club", tier: 1000, days: 1000 } }).to).toBe("red");
  });
});

describe("EarnMoment render", () => {
  const render = (hero: Parameters<typeof EarnMoment>[0]["hero"]) => expand(React.createElement(EarnMoment, { hero, title: "First rep", line: "12 working sets" }));
  it("standard: the medal, the name and the evidence; tapping the stage skips and announces once", () => {
    const tree = render(earned("first_session", 1));
    expect(byType(tree, "Svg").length).toBeGreaterThan(0);
    expect(texts(tree)).toEqual(["First rep", "12 working sets"]);
    const stage = byType(tree, "Pressable")[0]!;
    stage.props.onPress();
    stage.props.onPress();
    expect(fx.announced).toEqual(["\u2066First rep\u2069 earned"]);
  });
  it("PR: the odometer shows the load × reps and the delta chip", () => {
    const tree = render(pr("p1", BENCH, [80, 5], [82.5, 5]));
    const all = texts(tree);
    expect(all.some((s) => s.includes("×"))).toBe(true);
    expect(all.length).toBe(4);
  });
  it("legacy draws the ring; plate draws two plates (old tier on top)", () => {
    const legacy = byType(render(earned("multi_year_2", 1)), "AnimatedView");
    expect(legacy.some((n) => n.props.style?.borderWidth === 3)).toBe(true);
    const plate = render(earned("hundred_club_100", 1, "2026-02-01", { kind: "hundred_club", tier: 100, days: 100 }));
    expect(byType(plate, "Svg").length).toBe(2);
  });
  it("AR announcement", () => {
    settings.lang = "ar";
    byType(render(earned("first_session", 1)), "Pressable")[0]!.props.onPress();
    expect(fx.announced[0]).toContain("اتكسبت");
  });
});

describe("HeroAchievement keeps its share block", () => {
  it("privacy SwitchRows, the note and one Share button remain", () => {
    const tree = expand(React.createElement(HeroAchievement, { hero: pr("p1", BENCH, [80, 5], [82.5, 5]), rest: [] }));
    expect(byType(tree, "SwitchRow")).toHaveLength(4);
    expect(byType(tree, "BigButton")).toHaveLength(1);
    expect(texts(tree)).toContain("Sharing stays on this device. Nothing is uploaded.");
  });
});

describe("audits", () => {
  const src = join(__dirname, "..", "src");
  const read = (f: string) => readFileSync(join(src, f), "utf8");
  it("the Finish achievements step and the hero mount are unchanged", () => {
    const finish = read("screens/FinishScreen.tsx");
    expect(finish).toContain(`          await achievements.sync();
          const fresh = await achievements.listForSession(sessionId);
          const picked = pickHero(fresh);
          setHero(picked.hero);
          setHeroRest(picked.rest);
          if (picked.hero) await achievements.markCelebrated(fresh.map((r) => r.id));`);
    expect(finish).toMatch(/<HeroAchievement hero=\{hero\} rest=\{heroRest\} \/>/);
  });
  it("no earn-moment file touches finishChoice", () => {
    for (const f of ["components/achievements/EarnMoment.tsx", "logic/earnMoment.ts", "components/HeroAchievement.tsx"]) expect(read(f)).not.toMatch(/finishChoice/);
  });
  it("animations use the native driver except the specular sweep and odometer (JS-read values)", () => {
    const s = read("components/achievements/EarnMoment.tsx");
    expect((s.match(/useNativeDriver: false/g) ?? []).length).toBe(2);
  });
});

describe("achievements screen order", () => {
  it("the Trophy Cabinet shelves come first, above the plate, stats, PR spotlight, Almost there, month seal and ledger", () => {
    const screen = readFileSync(join(__dirname, "..", "src", "screens", "AchievementsScreen.tsx"), "utf8");
    const at = screen.indexOf("<CabinetUnveil");
    expect(at).toBeGreaterThan(screen.indexOf("<Screen scrollRef={scroll}>"));
    for (const later of ["<LifetimePlate", "<WeekSleeve", "<StatTileRow", "<PrSpotlight", "<AlmostThere", "<MonthSeal", "<LedgerTeaser"]) expect(at, later).toBeLessThan(screen.indexOf(later));
  });
});

describe("cabinet unveil", () => {
  it("earned medals unveil in reading order across shelves, 40 ms apart, 300 ms each", async () => {
    const { unveilOrder, unveilDuration, unveilWindow } = await import("../src/logic/earnMoment");
    const order = unveilOrder([
      { items: [{ slot: "a", state: "earned" }, { slot: "b", state: "locked" }, { slot: "c", state: "earned" }] },
      { items: [{ slot: "d", state: "in_progress" }, { slot: "e", state: "earned" }] },
    ]);
    expect([...order.entries()]).toEqual([["a", 0], ["c", 1], ["e", 2]]);
    expect(unveilDuration(3)).toBe(380);
    expect(unveilDuration(0)).toBe(0);
    expect(unveilWindow(2)).toEqual([80, 380]);
  });
  it("wraps only the earned medals while active; passes through otherwise and under Reduce Motion", async () => {
    const { CabinetUnveil } = await import("../src/components/achievements/CabinetUnveil");
    const { UnveilMedal } = await import("../src/components/achievements/UnveilMedal");
    const order = new Map([["a", 0]]);
    // The context provider is a host element here; read its value to check what the shelf would see.
    const provided = (active: boolean) => (expand(React.createElement(CabinetUnveil, { active, count: 3, order, onDone: () => {} }, "x")) as { props: { value: unknown } }).props.value;
    expect(provided(true)).not.toBeNull();
    expect(provided(false)).toBeNull();
    settings.reduced = true;
    expect(provided(true)).toBeNull();
    expect(byType(expand(React.createElement(UnveilMedal, { slot: "a" }, React.createElement("View"))), "AnimatedView")).toHaveLength(0);
  });
  it("the screen runs it once from bannerCount, then dismisses the banner; one Success and an announcement", () => {
    const screen = readFileSync(join(__dirname, "..", "src", "screens", "AchievementsScreen.tsx"), "utf8");
    expect(screen).toMatch(/\(home\.bannerCount \?\? 0\) > 0 && !unveiled\.current/);
    expect(screen).toMatch(/achievements\s*\.dismissBanner\(\)/);
    const unveil = readFileSync(join(__dirname, "..", "src", "components", "achievements", "CabinetUnveil.tsx"), "utf8");
    expect(unveil.match(/haptics\.\w+\(/g)).toEqual(["haptics.celebrate("]);
    expect(unveil).toMatch(/announceForAccessibility\(t\("achv\.banner"/);
  });
});
