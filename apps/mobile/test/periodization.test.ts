import { describe, expect, it } from "vitest";
import {
  countProgressWeeks,
  DEFAULT_PERIODIZATION,
  parsePeriodization,
  periodizationDue,
  serializePeriodization,
  weekStartsOf,
} from "../src/logic/periodization";

describe("periodization reminder", () => {
  it("is off by default and never due until enabled", () => {
    expect(parsePeriodization(null)).toEqual(DEFAULT_PERIODIZATION);
    expect(DEFAULT_PERIODIZATION.enabled).toBe(false);
    expect(periodizationDue(DEFAULT_PERIODIZATION, "2026-01-05", 12, false)).toBe(false);
  });
  it("fires after the chosen number of training weeks and not before", () => {
    const on = { enabled: true, weeks: 4 as const, startedWeek: "2026-01-05", lastPromptWeek: null };
    const weeks = ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26"];
    expect(countProgressWeeks(weeks.slice(0, 3), on.startedWeek)).toBe(3);
    expect(periodizationDue(on, "2026-01-26", 3, false)).toBe(false);
    expect(periodizationDue(on, "2026-01-26", 4, false)).toBe(true);
  });
  it("does not fire while a deload card is already showing, and not twice in the same week", () => {
    const on = { enabled: true, weeks: 4 as const, startedWeek: "2026-01-05", lastPromptWeek: null };
    expect(periodizationDue(on, "2026-01-26", 4, true)).toBe(false);
    expect(periodizationDue({ ...on, lastPromptWeek: "2026-01-26" }, "2026-01-26", 4, false)).toBe(false);
  });
  it("maps finished session timestamps onto week starts", () => {
    const monday = Date.parse("2026-01-05T12:00:00.000Z");
    expect(weekStartsOf([monday], 1, 0)[0]).toBe("2026-01-05");
  });
  it("round-trips through settings JSON", () => {
    const s = { enabled: true, weeks: 6 as const, startedWeek: "2026-02-02", lastPromptWeek: null };
    expect(parsePeriodization(serializePeriodization(s))).toEqual(s);
  });
});
