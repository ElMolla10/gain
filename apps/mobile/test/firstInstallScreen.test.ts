import { beforeEach, describe, expect, it, vi } from "vitest";
import { nodes, texts } from "./achievementRender";
import { translate } from "../src/i18n/format";
const runtime = vi.hoisted(() => ({ lang: "en" as "en" | "ar", started: false, preview: null as unknown, fontScale: 1 }));
vi.mock("react", async original => (await import("./achievementRender")).mockReactHooks(await original()));
vi.mock("react-native", () => ({ View: "View", useWindowDimensions: () => ({ width: 320, height: 568, fontScale: runtime.fontScale }) }));
vi.mock("../src/BrandLogo", () => ({ BrandLogo: "BrandLogo" }));
vi.mock("../src/AppContext", () => ({ useServices: () => ({}) }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ lang: runtime.lang, unit: "kg", setLang: vi.fn(), setUnit: vi.fn(), fmt: String, t: (k: any, p: any) => translate(runtime.lang, k, p) }) }));
vi.mock("../src/theme", () => ({ space: { sm: 8, md: 12, lg: 16, xl: 24 }, type: { load: 32, title: 24 }, usePalette: () => ({ muted: "muted" }) }));
vi.mock("../src/ui", () => Object.fromEntries(["AppText", "BigButton", "Chip", "Field", "Notice", "QuietAction", "RadioGroup", "RadioRow", "Screen", "SectionTitle"].map(k => [k, k])));
vi.mock("../src/components/SettingsRows", () => ({ SwitchRow: "SwitchRow" }));
vi.mock("../src/screens/OnboardingScreen", () => ({ OnboardingScreen: "OnboardingScreen" }));
vi.mock("../src/components/coach/GeneratedProgrammeHero", () => ({ GeneratedProgrammeHero: "GeneratedProgrammeHero" }));
vi.mock("../src/logic/firstProgramSetup", async original => ({ ...await original() as object, createFirstProgramSetup: () => ({ state: { started: runtime.started, loading: false, busy: false, error: null, answers: { goal: null, experience: null, days: null, minutes: null, equipment: [], avoidText: "", skipLegs: false }, preview: runtime.preview, library: [] }, load: vi.fn(), start: vi.fn(), update: vi.fn(), build: vi.fn(), activate: vi.fn() }) }));
import { FirstInstallScreen } from "../src/screens/FirstInstallScreen";
beforeEach(() => { runtime.started = false; runtime.preview = null; runtime.fontScale = 1; });
describe("beginner welcome and preview", () => {
  it.each(["en", "ar"] as const)("%s welcome has exactly one action and only the headline/review sentence", lang => {
    runtime.lang = lang; const tree = FirstInstallScreen({ onDone: vi.fn() }); const all = nodes([tree, (tree as any).props.footer]); const actions = all.filter(n => ["BigButton", "Chip", "QuietAction", "RadioRow", "Field", "SwitchRow"].includes(n.type as string));
    expect(actions).toHaveLength(1); expect(actions[0]!.props.label).toBe(translate(lang, "first.build"));
    expect(texts(tree)).toEqual([translate(lang, "ob.welcome"), translate(lang, "first.welcomeBody")]);
  });
  it.each([1, 1.5, 2])("%sx text uses scrollable content and a footer that joins the scroll above 1.3x", fontScale => {
    runtime.fontScale = fontScale; const screen = nodes(FirstInstallScreen({ onDone: vi.fn() })).find(n => n.type === "Screen")!; expect(screen.props.footerInline).toBe(fontScale > 1.3);
  });
  it("shows the exact generated preview with Use this program as its only activation action", () => {
    runtime.started = true; runtime.preview = { draft: { name: "Reviewed", days: [] }, dropped: [] }; const all = nodes(FirstInstallScreen({ onDone: vi.fn() })); const hero = all.find(n => n.type === "GeneratedProgrammeHero")!;
    expect(hero.props.preview).toBe(runtime.preview); expect(hero.props.saveLabel).toBe(translate(runtime.lang, "first.use"));
  });
});
