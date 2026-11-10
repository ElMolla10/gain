import { beforeEach, describe, expect, it, vi } from "vitest";
import { nodes, texts } from "./achievementRender";
import { isolateLtr, translate } from "../src/i18n/format";

const runtime = vi.hoisted(() => ({
  lang: "en" as "en" | "ar",
  started: false,
  preview: null as unknown,
  fontScale: 1,
  answers: {
    days: null as number | null,
    environment: null as "gym" | "dumbbell" | null,
    goal: "general" as const,
    experience: "beginner" as const,
    minutes: 45,
    avoidText: "",
    skipLegs: false,
  },
  showOptions: false,
}));

let stateCall = 0;

vi.mock("react", async (original) => {
  const mod = await import("./achievementRender");
  return mod.mockReactHooks(await original(), {
    useState: <T,>(initial: T | (() => T)) => {
      const idx = stateCall++;
      const val = typeof initial === "function" ? (initial as () => T)() : initial;
      if (idx === 1 && runtime.showOptions) {
        return [true, () => {}] as const;
      }
      return [val, () => {}] as const;
    },
  });
});

vi.mock("react-native", () => ({
  View: "View",
  StyleSheet: { hairlineWidth: 1 },
  useWindowDimensions: () => ({ width: 320, height: 568, fontScale: runtime.fontScale }),
}));

vi.mock("../src/BrandLogo", () => ({ BrandLogo: "BrandLogo" }));
vi.mock("../src/AppContext", () => ({ useServices: () => ({ onboarding: { skip: vi.fn() } }) }));
vi.mock("../src/i18n", () => ({
  useI18n: () => ({
    lang: runtime.lang,
    unit: "kg",
    setLang: vi.fn(),
    setUnit: vi.fn(),
    fmt: String,
    t: (k: any, p: any) => translate(runtime.lang, k, p),
  }),
}));
vi.mock("../src/theme", () => ({
  radius: { pill: 999, sm: 4, md: 8 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  type: { load: 32, title: 24, caption: 13 },
  usePalette: () => ({ muted: "muted", card: "card", border: "border", text: "text" }),
}));
vi.mock("../src/ui", () =>
  Object.fromEntries(
    ["AppText", "BigButton", "Chip", "Field", "Notice", "QuietAction", "RadioGroup", "RadioRow", "Screen", "SectionTitle"].map(
      (k) => [k, k],
    ),
  ),
);
vi.mock("../src/components/SettingsRows", () => ({ SwitchRow: "SwitchRow" }));
vi.mock("../src/screens/OnboardingScreen", () => ({ OnboardingScreen: "OnboardingScreen" }));
vi.mock("../src/components/coach/GeneratedProgrammeHero", () => ({ GeneratedProgrammeHero: "GeneratedProgrammeHero" }));
vi.mock("../src/logic/firstProgramSetup", async (original) => ({
  ...((await original()) as object),
  createFirstProgramSetup: () => ({
    get state() {
      return {
        started: runtime.started,
        loading: false,
        busy: false,
        error: null,
        answers: runtime.answers,
        preview: runtime.preview,
        library: [],
      };
    },
    load: vi.fn(),
    start: vi.fn(),
    update: vi.fn(),
    build: vi.fn(),
    activate: vi.fn(),
  }),
}));

import { FirstInstallScreen } from "../src/screens/FirstInstallScreen";

beforeEach(() => {
  stateCall = 0;
  runtime.lang = "en";
  runtime.started = false;
  runtime.preview = null;
  runtime.fontScale = 1;
  runtime.showOptions = false;
  runtime.answers = {
    days: null,
    environment: null,
    goal: "general",
    experience: "beginner",
    minutes: 45,
    avoidText: "",
    skipLegs: false,
  };
});

describe("beginner welcome and preview", () => {
  it.each(["en", "ar"] as const)("%s welcome has exactly one action and only the headline/review sentence", (lang) => {
    runtime.lang = lang;
    const tree = FirstInstallScreen({ onDone: vi.fn() });
    const all = nodes([tree, (tree as any).props.footer]);
    const actions = all.filter((n) => ["BigButton", "Chip", "QuietAction", "RadioRow", "Field", "SwitchRow"].includes(n.type as string));
    expect(actions).toHaveLength(1);
    expect(actions[0]!.props.label).toBe(translate(lang, "first.build"));
    expect(texts(tree)).toEqual([translate(lang, "ob.welcome"), translate(lang, "first.welcomeBody")]);
  });

  it.each([1, 1.5, 2])("%sx text uses scrollable content and a footer that joins the scroll above 1.3x", (fontScale) => {
    runtime.fontScale = fontScale;
    const screen = nodes(FirstInstallScreen({ onDone: vi.fn() })).find((n) => n.type === "Screen")!;
    expect(screen.props.footerInline).toBe(fontScale > 1.3);
  });

  it("two-question builder screen offers days 2-6 and environments gym/dumbbell, neither preselected", () => {
    runtime.started = true;
    const tree = FirstInstallScreen({ onDone: vi.fn() });
    const all = nodes([tree, (tree as any).props.footer]);

    const chips = all.filter((n) => n.type === "Chip");
    // 5 days chips (2, 3, 4, 5, 6) + 2 environment chips (Gym, Dumbbells at home)
    expect(chips).toHaveLength(7);
    expect(chips.map((c) => c.props.label)).toEqual([
      isolateLtr("2"), isolateLtr("3"), isolateLtr("4"), isolateLtr("5"), isolateLtr("6"),
      translate("en", "first.env.gym"),
      translate("en", "first.env.dumbbell"),
    ]);
    expect(chips.every((c) => c.props.selected === false)).toBe(true);

    const quiet = all.filter((n) => n.type === "QuietAction");
    expect(quiet.map((q) => q.props.label)).toContain(translate("en", "first.preferences"));

    // Shows defaults note when preferences are collapsed
    expect(texts(tree)).toContain(translate("en", "first.preferences.defaults"));

    const footerButton = all.find((n) => n.type === "BigButton" && n.props.hero);
    expect(footerButton?.props.label).toBe(translate("en", "first.preview"));
  });

  it("change preferences reveals editable starting defaults, skip-legs, exclusions, language, and units", () => {
    runtime.started = true;
    runtime.showOptions = true;
    const tree = FirstInstallScreen({ onDone: vi.fn() });
    const all = nodes([tree, (tree as any).props.footer]);

    const chips = all.filter((n) => n.type === "Chip");
    // 5 days + 2 env + 2 experience (beginner, intermediate) + 3 goal (general, hypertrophy, strength) + 3 minutes (30, 45, 60)
    expect(chips.map((c) => c.props.label)).toContain(translate("en", "coach.experience.beginner"));
    expect(chips.map((c) => c.props.label)).toContain(translate("en", "coach.goal.general"));

    // Verify starting defaults are selected
    const beginnerChip = chips.find((c) => c.props.label === translate("en", "coach.experience.beginner"));
    expect(beginnerChip?.props.selected).toBe(true);

    const generalChip = chips.find((c) => c.props.label === translate("en", "coach.goal.general"));
    expect(generalChip?.props.selected).toBe(true);

    const switchRow = all.find((n) => n.type === "SwitchRow");
    expect(switchRow?.props.label).toBe(translate("en", "coach.skipLegs"));

    const field = all.find((n) => n.type === "Field");
    expect(field?.props.label).toBe(translate("en", "first.avoid"));

    const quietActions = all.filter((n) => n.type === "QuietAction");
    expect(quietActions.map((q) => q.props.label)).toContain(translate("en", "ob.importFirst"));
    expect(quietActions.map((q) => q.props.label)).toContain(translate("en", "ob.programme.own"));
  });

  it.each(["en", "ar"] as const)("%s shows the exact generated preview with answer badges and Use this program as its only activation action", (lang) => {
    runtime.lang = lang;
    runtime.started = true;
    runtime.answers = {
      days: 3,
      environment: "gym",
      goal: "general",
      experience: "beginner",
      minutes: 45,
      avoidText: "",
      skipLegs: false,
    };
    runtime.preview = { draft: { name: "Reviewed", days: [] }, dropped: [] };
    const tree = FirstInstallScreen({ onDone: vi.fn() });
    const all = nodes(tree);
    const hero = all.find((n) => n.type === "GeneratedProgrammeHero")!;
    expect(hero.props.preview).toBe(runtime.preview);
    expect(hero.props.saveLabel).toBe(translate(lang, "first.use"));

    // Check badges displayed
    const screenTexts = texts(tree);
    expect(screenTexts).toContain(`${isolateLtr("3")} ${translate(lang, "coach.days")}`);
    expect(screenTexts).toContain(translate(lang, "first.env.gym"));
    expect(screenTexts).toContain(`${translate(lang, "coach.experience.beginner")} · ${translate(lang, "coach.goal.general")}`);

    // Verify edit button is available to return to questions
    const editBtn = all.find((n) => n.type === "BigButton" && n.props.label === translate(lang, "first.edit"));
    expect(editBtn).toBeDefined();
  });
});
