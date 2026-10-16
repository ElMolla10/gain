import { describe, expect, it } from "vitest";
import { consistencyAchievementStats, strengthBreakthroughs } from "../src/logic/achievementProgress";

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();

describe("long-term achievements", () => {
  it("counts distinct training days and qualified weeks without a daily streak", () => {
    const now = day(2026, 2, 1);
    const dates = [day(2026, 1, 5), day(2026, 1, 5), day(2026, 1, 7), day(2026, 1, 12), day(2026, 1, 13), day(2026, 2, 2)];
    expect(consistencyAchievementStats(dates, now)).toMatchObject({ trainingDays: 4, qualifiedWeeks: 2, activeMonths: 0 });
  });
  it("only rewards a heavier later session on the same exercise line", () => {
    const row = (sessionId: string, at: number, load: number, lineId = "curl") => ({
      lineId, exerciseId: "curl", nameEn: "Curl", nameAr: "كيرل", setup: "free" as const, sessionId, at, load,
    });
    const events = strengthBreakthroughs([
      row("one", 1, 16), row("one", 1, 18), row("two", 2, 18), row("three", 3, 20), row("four", 4, 30, "other"),
    ], 4);
    expect(events).toMatchObject([{ lineId: "curl", previous: 18, load: 20 }]);
  });
});
