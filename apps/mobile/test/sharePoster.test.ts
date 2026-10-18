import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LRI, PDI, translate } from "../src/i18n/format";
import { DEFAULT_SHARE_PRIVACY } from "../src/logic/achievementSurface";
import { POSTER_H, POSTER_W, posterCopy, posterKind, posterTexts } from "../src/logic/sharePoster";
import { byType, expand, texts } from "./achievementRender";
import { BENCH, earned, pr, row } from "./achievementFixtures";

const settings = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig(), { useContext: () => null }));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", Share: { share: vi.fn() }, useWindowDimensions: () => ({ fontScale: 1, width: 400, height: 800 }) }));
vi.mock("react-native-svg", () => ({ default: "Svg", Circle: "Circle", ClipPath: "ClipPath", Defs: "Defs", Ellipse: "Ellipse", G: "G", LinearGradient: "LinearGradient", Path: "Path", RadialGradient: "RadialGradient", Rect: "Rect", Stop: "Stop", Text: "SvgText", TextPath: "TextPath" }));
vi.mock("../src/diagnostics", () => ({ diagnostics: { record: () => {} } }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ lang: settings.lang, unit: "kg", direction: settings.lang === "ar" ? "rtl" : "ltr", t: (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(settings.lang, k, p) }) }));
vi.mock("../src/theme", async () => {
  const pal = await import("../src/palettes");
  return {
    space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
    radius: { button: 12, card: 16 },
    type: { display: 48, load: 36, title: 28, section: 20, body: 16, label: 14, caption: 13 },
    usePalette: () => ({ bg: "bg", muted: "muted", text: "text", border: "border", card: "card", raised: "raised", accent: "accent", tint: "tint" }),
    useAchievementArt: () => pal.achievementArtDark,
    useIsDark: () => true,
  };
});
vi.mock("../src/ui", () => ({ AppText: "AppText", Card: "Card", BigButton: "BigButton" }));

import { SharePoster } from "../src/components/achievements/SharePoster";

const t = (lang: "en" | "ar") => (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(lang, k, p);
const iso = (s: string) => `${LRI}${s}${PDI}`;
const ctx = (lang: "en" | "ar", absoluteWeight = false) => ({ privacy: { ...DEFAULT_SHARE_PRIVACY, absoluteWeight }, lang, unit: "kg" as const, t: t(lang) });
const PR = () => pr("p1", BENCH, [80, 5], [82.5, 5], { date: "2026-10-15" });
const plate = () => earned("hundred_club_250", 1, "2026-09-01", { kind: "hundred_club", tier: 250, days: 412 });
const first = () => earned("first_session", 1, "2024-03-09");

beforeEach(() => {
  settings.lang = "en";
});

describe("poster copy", () => {
  it("chooses plate for hundred_club, PR for strength PRs, medal otherwise", () => {
    expect(posterKind(plate())).toBe("plate");
    expect(posterKind(PR())).toBe("pr");
    expect(posterKind(earned("dedicated_25", 1))).toBe("medal");
    expect(posterKind(row({ id: "x", badgeId: "strength_pr", evidence: null }))).toBe("medal");
    expect(POSTER_H.medal / POSTER_W).toBe(1.25);
    expect(POSTER_H.plate / POSTER_W).toBeCloseTo(16 / 9, 1);
  });
  it("PR, weights hidden (default): the qualitative line, 'Weights hidden', and no load or unit anywhere", () => {
    for (const lang of ["en", "ar"] as const) {
      const c = posterCopy(PR(), ctx(lang));
      if (c.kind !== "pr") throw new Error("kind");
      const all = posterTexts(c).join(" | ");
      expect(c.headline).toBe(translate(lang, "achv.share.heavier"));
      expect(c.sub).toBe(translate(lang, "achv.r2.poster.hidden"));
      expect(c.before).toBeNull();
      expect(c.chip).toBeNull();
      for (const bad of ["80", "82.5", "82,5", "kg", "كجم", "+2.5"]) expect(all).not.toContain(bad);
      // The staircase keeps its shape (one step at least) but prints nothing.
      expect(c.steps.length).toBeGreaterThan(0);
    }
  });
  it("PR, weights on: before, the new set and the delta chip; AR keeps the '16 كجم × 6' order", () => {
    const en = posterCopy(PR(), ctx("en", true));
    if (en.kind !== "pr") throw new Error("kind");
    expect(en.headline).toBe(`${iso("82.5")}\u00A0kg\u00A0×\u00A0${iso("5")}`);
    expect(en.before).toBe(`Before ${iso(`${iso("80")}\u00A0kg\u00A0×\u00A0${iso("5")}`)}`);
    expect(en.chip).toContain("2.5");
    const ar = posterCopy(PR(), ctx("ar", true));
    if (ar.kind !== "pr") throw new Error("kind");
    expect(ar.headline).toBe(`${iso("82.5")}\u00A0كجم\u00A0×\u00A0${iso("5")}`);
    expect(ar.exercise).toBe("بنش");
  });
  it("plate: training days, the plate name, 'Training since' from first_session and qualified weeks (AR plural)", () => {
    const en = posterCopy(plate(), { ...ctx("en"), cabinet: [first(), plate()], qualifiedWeeks: 96 });
    if (en.kind !== "plate") throw new Error("kind");
    expect([en.days, en.tier, en.tierName]).toEqual([412, "yellow", "Yellow plate"]);
    expect(en.since).toBe(`Training since ${iso("9 Mar 2024")}`);
    expect(en.weeks).toBe(`${iso("96")} qualified weeks`);
    const ar = posterCopy(plate(), { ...ctx("ar"), cabinet: [first(), plate()], qualifiedWeeks: 5 });
    if (ar.kind !== "plate") throw new Error("kind");
    expect(ar.tierName).toBe("طارة صفرا");
    expect(ar.weeks).toBe(`${iso("5")} أسابيع مؤهلة`);
    expect(ar.since).toContain("2024");
    // Without the cabinet (Finish) there is no "since" line and the evidence gives the days.
    const bare = posterCopy(plate(), ctx("en"));
    expect(bare.kind === "plate" && [bare.days, bare.since, bare.weeks]).toEqual([412, null, null]);
    // The tab's count wins over the evidence.
    const tab = posterCopy(plate(), { ...ctx("en"), days: { days: 1043, floor: false } });
    expect(tab.kind === "plate" && tab.tier).toBe("red");
  });
  it("medal: '{prestige} medal', the name, the evidence line and the full date", () => {
    const c = posterCopy(earned("dedicated_25", 1, "2026-09-21"), ctx("en"));
    if (c.kind !== "medal") throw new Error("kind");
    expect(c.eyebrow).toBe(`${iso("Masterwork")} medal`);
    expect(c.date).toBe("21 Sep 2026");
    const ar = posterCopy(earned("dedicated_25", 1, "2026-09-21"), ctx("ar"));
    expect(ar.kind === "medal" && ar.eyebrow).toBe("ميدالية \u2068تحفة\u2069");
  });
  it("no username, gym or QR on any poster; the footer is the training-log line", () => {
    for (const r of [PR(), plate(), earned("dedicated_25", 1)]) {
      const all = posterTexts(posterCopy(r, { ...ctx("en", true), cabinet: [first(), r] })).join(" ");
      expect(all).not.toMatch(/gym|@|QR|user/i);
      expect(all).toContain("From my training log");
    }
  });
});

describe("SharePoster render", () => {
  const render = (c: ReturnType<typeof posterCopy>) => expand(React.createElement(SharePoster, { copy: c }));
  it("EN trees: 360 dp wide at the template's height; wordmark LTR; PR hidden draws the staircase with no text", () => {
    const tree = render(posterCopy(PR(), ctx("en"))) as { props: { style: { width: number; height: number } } };
    expect([tree.props.style.width, tree.props.style.height]).toEqual([360, 450]);
    const all = texts(tree);
    expect(all).toContain("GAIN");
    expect(all).toContain("Heavier than last verified best");
    expect(all.join(" ")).not.toMatch(/kg|82/);
    expect(byType(tree, "SvgText")).toHaveLength(0);
    expect(byType(tree, "AppText").find((n) => n.props.children === "GAIN")!.props.ltr).toBe(true);
    const tall = render(posterCopy(plate(), ctx("en"))) as { props: { style: { height: number } } };
    expect(tall.props.style.height).toBe(640);
  });
  it("AR trees: Arabic copy, no LTR on Arabic, no tracking on Arabic eyebrows", () => {
    settings.lang = "ar";
    for (const r of [PR(), plate(), earned("dedicated_25", 1)]) {
      const tree = render(posterCopy(r, { ...ctx("ar", true), cabinet: [first(), r] }));
      const nodes = byType(tree, "AppText");
      expect(texts(tree)).toContain("من سجل تمريني");
      for (const n of nodes) {
        const s = JSON.stringify(n.props.children ?? "");
        if (/[\u0600-\u06FF]/.test(s)) {
          expect(n.props.ltr).toBeFalsy();
          expect(n.props.style?.letterSpacing ?? 0).toBe(0);
        }
      }
    }
  });
});

describe("audits", () => {
  const read = (f: string) => readFileSync(join(__dirname, "..", "src", f), "utf8");
  it("one Share entry per sheet; Finish keeps its single MenuSheet; the share note stays", () => {
    expect(read("components/achievements/MedalDetailSheet.tsx").match(/icon="export"/g)).toHaveLength(1);
    const hero = read("components/HeroAchievement.tsx");
    expect(hero.match(/icon="export"/g)).toHaveLength(1);
    expect(hero).toContain('t("achv.share.note")');
    expect(read("screens/FinishScreen.tsx").match(/<MenuSheet/g)).toHaveLength(1);
  });
  it("captures through react-native-view-shot at 1080 px and releases the file; falls back to the text share", () => {
    const s = read("components/achievements/SharePoster.tsx");
    expect(s).toMatch(/await import\("react-native-view-shot"\)/);
    expect(s).toMatch(/release\?\.\(uri\)/);
    expect(s).toMatch(/Share\.share\(\{ message: fallbackText \}\)/);
    expect(s).not.toMatch(/fetch\(|https?:\/\//);
  });
});
