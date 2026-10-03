import { describe, expect, it } from "vitest";
import { buildProfile, emptyOnboardingForm } from "../src/logic/onboardingForm";
import { clampDay, dayOptions, daysInMonth, joinIso, setPart, splitIso, yearOptions } from "../src/logic/datePick";
import { parseDate, validateProfile, type Profile } from "../src/logic/onboarding";
import { freshDb } from "./helpers";

const NOW = Date.UTC(2026, 9, 3);

describe("date selectors", () => {
  it("knows month lengths and leap years", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(null, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
  it("joins only a complete real date, and splits back", () => {
    expect(joinIso({ y: 1998, m: 3, d: 7 })).toBe("1998-03-07");
    expect(joinIso({ y: 1998, m: 3, d: null })).toBe("");
    expect(joinIso({ y: 2026, m: 2, d: 30 })).toBe("");
    expect(splitIso("1998-03-07")).toEqual({ y: 1998, m: 3, d: 7 });
    expect(splitIso("2026-02-30")).toEqual({ y: null, m: null, d: null });
    expect(splitIso("junk")).toEqual({ y: null, m: null, d: null });
    expect(splitIso("")).toEqual({ y: null, m: null, d: null });
  });
  it("a day that stops existing moves to the last day of the month", () => {
    expect(setPart({ y: 2026, m: 1, d: 31 }, "m", 2)).toEqual({ y: 2026, m: 2, d: 28 });
    expect(setPart({ y: 2024, m: 2, d: 29 }, "y", 2025)).toEqual({ y: 2025, m: 2, d: 28 });
    expect(clampDay({ y: 2026, m: 4, d: 31 })).toEqual({ y: 2026, m: 4, d: 30 });
    expect(setPart({ y: null, m: null, d: 15 }, "m", 6)).toEqual({ y: null, m: 6, d: 15 });
  });
  it("offers only valid days and sensible years", () => {
    expect(dayOptions({ y: 2026, m: 2, d: null })).toHaveLength(28);
    expect(dayOptions({ y: null, m: null, d: null })).toHaveLength(31);
    const past = yearOptions("past", NOW, 100, 10);
    expect(past[0]).toBe(2016);
    expect(past[past.length - 1]).toBe(1926);
    expect(yearOptions("future", NOW, 10)[0]).toBe(2026);
    expect(yearOptions("future", NOW, 10)).toHaveLength(11);
  });
  it("every date the selectors can produce is accepted by the same parser the profile uses", () => {
    for (const y of [1999, 2000, 2024, 2026, 2027]) for (const m of [1, 2, 3, 4, 12]) for (let d = 1; d <= daysInMonth(y, m); d++) expect(parseDate(joinIso({ y, m, d }))).not.toBeNull();
  });
});

describe("birthday in onboarding", () => {
  const base: Profile = { language: "en", units: "kg", daysPerWeek: 4, sessionMinutes: 60, equipment: ["barbell"], goal: { kind: "muscle", muscle: "back" }, heightCm: null, bodyweightKg: null };
  const codes = (p: Profile) => validateProfile(p, NOW).map((x) => x.code);
  it("is optional; a real past date passes; future or absurd dates do not", () => {
    expect(codes(base)).toEqual([]);
    expect(codes({ ...base, birthDate: null })).toEqual([]);
    expect(codes({ ...base, birthDate: "1998-03-07" })).toEqual([]);
    expect(codes({ ...base, birthDate: "2027-01-01" })).toEqual(["birth_bad"]);
    expect(codes({ ...base, birthDate: "1800-01-01" })).toEqual(["birth_bad"]);
    expect(codes({ ...base, birthDate: "1998-02-30" })).toEqual(["birth_bad"]);
  });
  it("goes from the form into the profile and is stored", async () => {
    const f = { ...emptyOnboardingForm("en"), days: 4, minutes: 60, goalKind: "muscle" as const, goalMuscle: "back" as const, birthDateText: "1998-03-07" };
    const r = buildProfile(f, NOW);
    expect(r.problems).toEqual([]);
    expect(r.profile!.birthDate).toBe("1998-03-07");
    expect(buildProfile({ ...f, birthDateText: "" }, NOW).profile!.birthDate).toBeNull();
    const { repos, onboarding, programmes } = await freshDb();
    await repos.seedIfNeeded();
    const lib = await programmes.listExercises();
    await onboarding.complete({ profile: r.profile!, programme: { name: "P", days: [{ name: "D", exercises: [{ exerciseId: lib[0]!.id, sets: 3, repMin: 8, repMax: 12, repCeiling: null, isGoalLift: false, trackEffort: false }] }] } });
    expect((await onboarding.getProfile()).birthDate).toBe("1998-03-07");
  });
});
