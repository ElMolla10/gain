import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APPEARANCES, parseAppearance } from "../src/palettes";
import { ar, en } from "../src/i18n/strings";

const src = readFileSync(join(__dirname, "..", "src", "screens", "SettingsScreen.tsx"), "utf8");

describe("Settings layout", () => {
  it("is grouped Display → Workout → Program & gyms → Advanced → Data → About (plan 2.8)", () => {
    const order = ["display", "workout", "programGyms", "advanced", "data", "about"].map((g) => {
      expect((en as Record<string, string>)[`settings.group.${g}`]).toBeTruthy();
      expect((ar as Record<string, string>)[`settings.group.${g}`]).toBeTruthy();
      return src.indexOf(`<Group title={t("settings.group.${g}")}>`);
    });
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Language is the first row of the screen.
    expect(src.indexOf('label={t("settings.language")}')).toBeGreaterThan(order[0]!);
    expect(src.indexOf('label={t("settings.language")}')).toBeLessThan(src.indexOf("<SelectRow", order[0]!) + 200);
  });
  it("every block and row still renders, in its new group", () => {
    const between = (a: string, b: string) => src.slice(src.indexOf(`settings.group.${a}")}>`), src.indexOf(`settings.group.${b}")}>`));
    const display = between("display", "workout"), workout = between("workout", "programGyms"), program = between("programGyms", "advanced"), advanced = between("advanced", "data");
    for (const s of ['t("settings.language")', 't("settings.units")', 't("settings.appearance")', 't("settings.textSizeNote")']) expect(display).toContain(s);
    for (const s of ["<RestCard />", "<ReminderCard />", "<WeekStartCard />"]) expect(workout).toContain(s);
    for (const s of ['t("gyms.entry")', "<GymStepsCard />", 't("coach.priority.entry")', 't("goals.entry")', 't("settings.setupAgain")']) expect(program).toContain(s);
    for (const s of ["<CeilingsCard />", 't("settings.direction")', 't("settings.secondName")', "<PeriodizationSettings />"]) expect(advanced).toContain(s);
    for (const s of ['t("data.entry")', 't("sync.entry")', 't("import.entry")', 't("privacy.entry")', 't("pilot.entry")', "<HealthNote />", "<DeveloperTools"]) expect(src).toContain(s);
  });
  it("rest default is five segments on one line; layout direction is three radio rows", () => {
    expect(src).toMatch(/<SelectRow\s+label=\{t\("rest\.default"\)\}/);
    expect(src).toContain('t("rest.defaultValue", { n: isolateLtr(String(n)) })');
    expect(src).toMatch(/<RadioGroup label=\{t\("settings\.direction"\)\}>/);
    expect(src).toContain("<RadioRow key={o.value} label={o.label} selected={rtlOverride === o.value}");
  });
  it("language and units are compact selectors, not full-width buttons", () => {
    expect(src).not.toContain("BigButton");
    expect(src).toContain("<SelectRow");
  });
  it("offers appearance and the both-names switch, and every appearance has a label", () => {
    expect(src).toContain('"appearance"');
    expect(src).toContain("setShowSecond");
    for (const a of APPEARANCES) expect(en[`settings.appearance.${a}` as keyof typeof en]).toBeTruthy();
    expect(parseAppearance("light")).toBe("light");
    expect(parseAppearance("nonsense")).toBe("dark");
  });
});
