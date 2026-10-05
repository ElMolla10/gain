import { describe, expect, it } from "vitest";
import { directionFor, estimateMinutes, exerciseLabels, isolateLtr, LRI, matchesExercise, normalizeSearch, PDI, setShowSecondName, translate } from "../src/i18n/format";
import { ar, en } from "../src/i18n/strings";
import { SAMPLE_EXERCISES } from "../src/db/seedData";

describe("strings", () => {
  it("Arabic has every English key and no stray English-only placeholders", () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
    for (const k of Object.keys(en) as (keyof typeof en)[]) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
      expect(ph(ar[k]), k).toBe(ph(en[k]));
    }
  });
  it("slice screens have Arabic text (except brand and language names)", () => {
    const same = new Set(["app.name", "settings.language.en", "import.source.hevy", "import.source.strong"]);
    for (const k of Object.keys(en) as (keyof typeof en)[]) {
      if (same.has(k)) continue;
      expect(ar[k], k).toMatch(/[\u0600-\u06FF]/);
    }
  });
  it("has concise move actions and exercise-specific TalkBack copy in English and Arabic", () => {
    const english = en as Record<string, string>;
    const arabic = ar as Record<string, string>;
    for (const key of ["workout.menu.moveUp", "workout.menu.moveDown", "workout.move.upA11y", "workout.move.downA11y", "workout.move.failed"]) {
      expect(english[key], key).toBeTruthy();
      expect(arabic[key], key).toMatch(/[\u0600-\u06FF]/);
    }
    expect(translate("ar", "workout.menu.moveUp")).toBe("حرّكه لفوق");
    expect(translate("ar", "workout.menu.moveDown")).toBe("حرّكه لتحت");
    // The action stays in the Arabic sentence. Only the exercise name is isolated, so TalkBack does not read "حرّكه لفوق" as LTR.
    expect(translate("ar", "workout.move.upA11y", { exercise: "Bench Press" })).toBe(`تمرين ${LRI}Bench Press${PDI}: حرّكه لفوق`);
    expect(translate("ar", "workout.move.downA11y", { exercise: "سكوات" })).toBe(`تمرين ${LRI}سكوات${PDI}: حرّكه لتحت`);
    expect(translate("en", "workout.move.upA11y", { exercise: "Bench Press" })).toBe(`${LRI}Bench Press${PDI}: Move up`);
    expect(translate("en", "workout.move.downA11y", { exercise: "Squat" })).toBe(`${LRI}Squat${PDI}: Move down`);
  });
});

describe("direction", () => {
  it("follows language by default, override wins", () => {
    expect(directionFor("en", "auto")).toBe("ltr");
    expect(directionFor("ar", "auto")).toBe("rtl");
    expect(directionFor("en", "on")).toBe("rtl");
    expect(directionFor("ar", "off")).toBe("ltr");
  });
});

describe("numbers and names stay readable in RTL", () => {
  it("isolates numeric params inside Arabic sentences", () => {
    const s = translate("ar", "today.estimate", { min: 45 });
    expect(s).toContain(`${LRI}45${PDI}`);
  });
  it("English is the default and also isolates params harmlessly", () => {
    expect(translate("en", "today.sets", { n: 3 })).toBe(`${LRI}3${PDI} sets`);
  });
  it("an unknown param stays visible", () => {
    expect(translate("en", "today.sets")).toBe("{n} sets");
  });
  it("the other language's name is hidden by default and shown when asked for", () => {
    const ex = { nameEn: "Barbell Bench Press", nameAr: "بنش برس بالبار" };
    expect(exerciseLabels(ex, "en").secondary).toBe("");
    expect(exerciseLabels(ex, "ar").secondary).toBe("");
    expect(exerciseLabels(ex, "en", true).secondary).toBe("بنش برس بالبار");
    setShowSecondName(true);
    expect(exerciseLabels(ex, "ar").secondary).toBe(isolateLtr("Barbell Bench Press"));
    setShowSecondName(false);
  });
  it("Arabic leads with the Arabic name and isolates the English subtitle", () => {
    const l = exerciseLabels({ nameEn: "Barbell Bench Press", nameAr: "بنش برس بالبار" }, "ar", true);
    expect(l.primary).toBe("بنش برس بالبار");
    expect(l.secondary).toBe(isolateLtr("Barbell Bench Press"));
    expect(exerciseLabels({ nameEn: "Barbell Bench Press", nameAr: "x" }, "en", true).primary).toBe("Barbell Bench Press");
  });
});

describe("exercise search (Arabic aliases and English names)", () => {
  const ex = SAMPLE_EXERCISES.map((e) => ({ nameEn: e.en, nameAr: e.ar, aliasesAr: e.aliasesAr }));
  const find = (q: string) => ex.filter((e) => matchesExercise(q, e)).map((e) => e.nameEn);
  it("finds by an Arabic alias", () => expect(find("بنش")).toContain("Barbell Bench Press"));
  it("finds by English name, case-insensitive", () => expect(find("lat PULL")).toContain("Lat Pulldown"));
  it("ignores hamza and diacritics differences", () => {
    expect(normalizeSearch("إنكلاين")).toBe(normalizeSearch("انكلاين"));
    expect(find("انكلاين")).toContain("Incline Dumbbell Press");
    expect(find("إنكلاين")).toContain("Incline Dumbbell Press");
  });
  it("converts Arabic-Indic digits and empty query matches all", () => {
    expect(normalizeSearch("٣٢")).toBe("32");
    expect(find("")).toHaveLength(ex.length);
  });
  it("no match returns nothing", () => expect(find("zzzz")).toEqual([]));
});

describe("estimate", () => {
  it("is 3 minutes per set", () => expect(estimateMinutes(15)).toBe(45));
});
