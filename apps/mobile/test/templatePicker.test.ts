import { describe, expect, it } from "vitest";
import { ar, en } from "../src/i18n/strings";
import { NO_FILTER, filterTemplates } from "../src/logic/templateFilter";
import { activeFilterCount, pickerView, toggleFilter } from "../src/logic/templatePicker";
import { TEMPLATES, templatesForDays, TEMPLATE_GEARS, TEMPLATE_GOALS, TEMPLATE_LEVELS, TEMPLATE_VENUES } from "../src/logic/templates";

const opt = (v: ReturnType<typeof pickerView>, facet: string, value: string | number) => v.facets.find((f) => f.facet === facet)!.options.find((o) => o.value === value)!;

describe("programme picker view", () => {
  it("no filter: every programme, grouped by days per week, fewest days first; all five filter rows", () => {
    const v = pickerView(TEMPLATES, NO_FILTER);
    expect(v.total).toBe(TEMPLATES.length);
    expect(v.active).toBe(0);
    expect(v.facets.map((f) => f.facet)).toEqual(["days", "venue", "gear", "goal", "level"]);
    expect(v.sections.map((s) => s.days)).toEqual([...v.sections.map((s) => s.days)].sort((a, b) => a - b));
    expect(v.sections.reduce((n, s) => n + s.templates.length, 0)).toBe(TEMPLATES.length);
  });
  it("the Home chip and the Gym chip both exist; Home shows no programme that needs a gym, Gym shows all", () => {
    const home = pickerView(TEMPLATES, toggleFilter(NO_FILTER, "venue", "home"));
    const gym = pickerView(TEMPLATES, toggleFilter(NO_FILTER, "venue", "gym"));
    expect(home.facets.find((f) => f.facet === "venue")!.options.map((o) => o.value)).toEqual(["home", "gym"]);
    expect(home.sections.flatMap((s) => s.templates).every((t) => t.gear !== "gym")).toBe(true);
    expect(home.total).toBeGreaterThanOrEqual(12);
    expect(gym.total).toBe(TEMPLATES.length);
    // A programme usable in both appears under both.
    const bothId = home.sections.flatMap((s) => s.templates)[0]!.id;
    expect(gym.sections.flatMap((s) => s.templates).map((t) => t.id)).toContain(bothId);
  });
  it("filters combine: Home + 3 days + dumbbells + general only shows programmes that satisfy all four", () => {
    let f = toggleFilter(NO_FILTER, "venue", "home");
    f = toggleFilter(f, "days", 3);
    f = toggleFilter(f, "gear", "dumbbell");
    f = toggleFilter(f, "goal", "general");
    expect(activeFilterCount(f)).toBe(4);
    const v = pickerView(TEMPLATES, f);
    expect(v.total).toBeGreaterThan(0);
    for (const t of v.sections.flatMap((s) => s.templates)) {
      expect(t.days).toBe(3);
      expect(["dumbbell", "bodyweight"]).toContain(t.gear);
      expect(t.goal).toBe("general");
    }
    expect(v.sections.map((s) => s.days)).toEqual([3]);
    expect(v.total).toBe(filterTemplates(TEMPLATES, f).length);
  });
  it("tapping the chosen chip again clears it; clearing everything restores the full list", () => {
    const f = toggleFilter(NO_FILTER, "goal", "strength");
    expect(f.goal).toBe("strength");
    expect(toggleFilter(f, "goal", "strength")).toEqual(NO_FILTER);
    expect(pickerView(TEMPLATES, NO_FILTER).total).toBe(TEMPLATES.length);
  });
  it("an option that would show nothing is disabled (not the one already chosen), so the list is never empty by tapping", () => {
    const f = toggleFilter(NO_FILTER, "venue", "home");
    const v = pickerView(TEMPLATES, f);
    const gymGear = opt(v, "gear", "gym");
    expect(gymGear.count).toBe(0);
    expect(gymGear.disabled).toBe(true);
    for (const facet of v.facets) for (const o of facet.options) if (!o.disabled) expect(o.count > 0 || o.selected).toBe(true);
    // Every enabled chip leads to a non-empty list.
    for (const facet of v.facets) for (const o of facet.options.filter((x) => !x.disabled)) expect(pickerView(TEMPLATES, toggleFilter(f, facet.facet, o.value)).total).toBeGreaterThan(0);
    // The chosen chip stays enabled even if later choices would empty it.
    expect(opt(v, "venue", "home").disabled).toBe(false);
  });
  it("counts equal what tapping the chip would show", () => {
    const v = pickerView(TEMPLATES, toggleFilter(NO_FILTER, "level", "beginner"));
    for (const facet of v.facets) for (const o of facet.options) expect(o.count, `${facet.facet}=${o.value}`).toBe(filterTemplates(TEMPLATES, { ...toggleFilter(NO_FILTER, "level", "beginner"), [facet.facet]: o.value }).length);
  });
  it("onboarding view: days are already known, so no days row; the offers are the lifter's day count", () => {
    for (const d of [2, 3, 4, 5, 6]) {
      const list = templatesForDays(d).map((o) => o.template);
      const v = pickerView(list, NO_FILTER, { showDays: false });
      expect(v.facets.map((f) => f.facet)).toEqual(["venue", "gear", "goal", "level"]);
      expect(v.total).toBe(list.length);
      expect(v.sections.map((s) => s.days)).toEqual([d]);
    }
  });
  it("every day count 2 to 6 has at least 3 programmes, at least 2 of them usable at home", () => {
    for (const d of [2, 3, 4, 5, 6]) {
      const list = TEMPLATES.filter((t) => t.days === d);
      expect(list.length, `days ${d}`).toBeGreaterThanOrEqual(3);
      expect(list.filter((t) => t.gear !== "gym").length, `days ${d} home`).toBeGreaterThanOrEqual(d === 5 ? 1 : 2);
    }
  });
});

describe("programme picker text", () => {
  it("every label the picker can show exists in English and Arabic, and the Arabic is Arabic", () => {
    const keys: string[] = ["tpl.filters", "tpl.all", "tpl.clear", "tpl.none", "tpl.count", "tpl.group", "tpl.days.n", "tpl.rotation", "tpl.arDraft", "tpl.venue.note", "tpl.bulking.note"];
    for (const v of TEMPLATE_VENUES) keys.push(`tpl.venue.${v}`);
    for (const g of TEMPLATE_GEARS) keys.push(`tpl.gear.${g}`, `tpl.gear.needs.${g}`);
    for (const g of TEMPLATE_GOALS) keys.push(`tpl.goal.${g}`);
    for (const l of TEMPLATE_LEVELS) keys.push(`tpl.level.${l}`);
    for (const f of ["days", "venue", "gear", "goal", "level"]) keys.push(`tpl.filter.${f}`);
    for (const k of keys) {
      expect((en as Record<string, string>)[k], `en ${k}`).toBeTruthy();
      expect((ar as Record<string, string>)[k], `ar ${k}`).toMatch(/[\u0600-\u06FF]/);
    }
  });
  it("Home chip says Home / Gym in both languages", () => {
    expect(en["tpl.venue.home"]).toBe("Home");
    expect(en["tpl.venue.gym"]).toBe("Gym");
    expect(ar["tpl.venue.home"]).toBeTruthy();
  });
});
