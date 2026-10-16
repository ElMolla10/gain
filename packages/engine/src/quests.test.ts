import { describe, expect, it } from "vitest";
import { shiftLocalDate, type AchievementSession, type AchievementSet } from "./achievements";
import { canSwapQuest, historySpanDays, offerMonthlyQuests, questProgress } from "./quests";
import type { EquipmentType, SetupType } from "./types";

const day = (n: number) => shiftLocalDate("2026-01-05", n);

function working(id: string, exerciseId: string, load: number, reps: number, extra: Partial<AchievementSet> = {}): AchievementSet {
  return {
    id,
    exerciseId,
    equipment: (extra.equipment ?? "barbell") as EquipmentType,
    setup: (extra.setup ?? "free") as SetupType,
    load,
    reps,
    warmup: extra.warmup ?? false,
    tags: extra.tags ?? [],
    outlierStatus: extra.outlierStatus ?? "none",
    pattern: extra.pattern ?? "horizontal_push",
  };
}

function three(id: string, exerciseId: string, load: number, reps: number, extra: Partial<AchievementSet> = {}): AchievementSet[] {
  return [0, 1, 2].map((i) => working(`${id}-${i}`, exerciseId, load, reps, extra));
}

function workout(id: string, localDate: string, sets: AchievementSet[]): AchievementSession {
  return { id, finishedAtUtc: Date.parse(`${localDate}T12:00:00Z`), localCalendarDate: localDate, sets };
}

function qualifiedWeeks(n: number, start = 0): AchievementSession[] {
  const out: AchievementSession[] = [];
  for (let w = 0; w < n; w++) {
    for (let d = 0; d < 2; d++) {
      const date = day(start + w * 7 + d);
      const id = `w${w}${d}`;
      out.push(workout(id, date, three(`${id}-s`, "bench", 60, 8)));
    }
  }
  return out;
}

describe("monthly quest offers", () => {
  it("offers three foundation cards with under 14 days of history", () => {
    const sessions = [workout("a", day(0), three("a", "bench", 60, 8)), workout("b", day(2), three("b", "bench", 60, 8))];
    const cards = offerMonthlyQuests(sessions, { nowLocalDate: day(5), programPrimaryIds: ["bench", "squat", "deadlift", "row", "ohp"] });
    expect(cards).toHaveLength(3);
    expect(cards.every((c) => c.kind === "foundation")).toBe(true);
  });

  it("offers rhythm, craft and balance after enough history", () => {
    const sessions = [
      ...qualifiedWeeks(6),
      workout("c1", day(1), three("c1", "bench", 60, 8)),
      workout("c2", day(8), three("c2", "bench", 62.5, 8)),
    ];
    const cards = offerMonthlyQuests(sessions, {
      nowLocalDate: day(40),
      programPatterns: ["horizontal_push", "squat"],
      programPrimaryIds: ["bench"],
    });
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.kind).sort()).toEqual(["balance", "craft", "rhythm"]);
  });

  it("allows a swap through day 14 of the month", () => {
    expect(canSwapQuest("2026-03-01")).toBe(true);
    expect(canSwapQuest("2026-03-14")).toBe(true);
    expect(canSwapQuest("2026-03-15")).toBe(false);
  });
});

describe("quest progress from sessions", () => {
  it("counts qualified weeks in the current month for a rhythm quest", () => {
    const sessions = qualifiedWeeks(3, 0);
    const card = offerMonthlyQuests(sessions, { nowLocalDate: day(20), programPrimaryIds: ["bench"] }).find((c) => c.kind === "rhythm")
      ?? { kind: "rhythm" as const, titleKey: "quest.rhythm.title", target: 3, payload: { targetWeeks: 3 } };
    const p = questProgress(card, sessions, { nowLocalDate: day(20) });
    expect(p.current).toBeGreaterThanOrEqual(2);
    expect(p.target).toBe(3);
  });

  it("completes a craft quest when the pinned baseline is beaten", () => {
    const card = {
      kind: "craft" as const,
      titleKey: "quest.craft.title",
      target: 1,
      payload: { identity: { exerciseId: "bench", equipment: "barbell" as const, setup: "free" as const }, baselineLoad: 60, baselineReps: 8 },
    };
    const miss = workout("a", "2026-01-06", three("a", "bench", 60, 8));
    const hit = workout("b", "2026-01-08", three("b", "bench", 62.5, 8));
    expect(questProgress(card, [miss], { nowLocalDate: "2026-01-10" }).complete).toBe(false);
    expect(questProgress(card, [miss, hit], { nowLocalDate: "2026-01-10" }).complete).toBe(true);
  });
});

describe("cold start span", () => {
  it("treats empty history as zero days", () => {
    expect(historySpanDays([], "2026-01-10")).toBe(0);
  });
});
