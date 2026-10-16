import { describe, expect, it } from "vitest";
import type { SessionSummary } from "../src/db/finishRepo";
import type { SessionDetail } from "../src/db/historyRepo";
import { formatWorkoutShareText, personalBestLines, workoutRecapStats } from "../src/logic/workoutRecap";

const finishedAt = Date.UTC(2026, 9, 13, 20, 0);
const detail: SessionDetail = {
  id: "s1", dayName: "Push", gymName: "Gym", startedAt: finishedAt - 45 * 60_000, finishedAt, pausedMs: 0, imported: false,
  exercises: [
    { exerciseId: "bench", nameEn: "Bench Press", nameAr: "بنش", setup: "free", measure: "reps", sets: [
      { id: "1", load: 20, reps: 12, durationS: null, distanceM: null, rir: null, warmup: true, tags: [], outlierStatus: "none" },
      { id: "2", load: 60, reps: 8, durationS: null, distanceM: null, rir: 0, warmup: false, tags: ["failure"], outlierStatus: "none" },
      { id: "3", load: 60, reps: 7, durationS: null, distanceM: null, rir: null, warmup: false, tags: [], outlierStatus: "none" },
      { id: "4", load: 40, reps: 15, durationS: null, distanceM: null, rir: null, warmup: false, tags: ["drop"], outlierStatus: "none" },
      { id: "5", load: 100, reps: 10, durationS: null, distanceM: null, rir: null, warmup: false, tags: [], outlierStatus: "unconfirmed" },
    ] },
    { exerciseId: "plank", nameEn: "Weighted Plank", nameAr: "بلانك", setup: "free", measure: "time", sets: [
      { id: "6", load: 10, reps: 1, durationS: 45, distanceM: null, rir: null, warmup: false, tags: [], outlierStatus: "none" },
    ] },
  ],
};
const summary: SessionSummary = {
  sessionId: "s1",
  totals: { exercises: 2, counted: 3, warmups: 1, unconfirmed: 1, records: 2 },
  exercises: [
    { exerciseId: "bench", nameEn: "Bench Press", nameAr: "بنش", counted: 2, warmups: 1, dropSets: 1, unconfirmed: 1, top: { load: 60, reps: 8 }, records: ["load", "e1rm"], estimated1rm: 76, firstTime: false },
    { exerciseId: "plank", nameEn: "Weighted Plank", nameAr: "بلانك", counted: 1, warmups: 0, dropSets: 0, unconfirmed: 0, measure: "time", top: { load: 10, reps: 1, quantity: 45 }, records: [], firstTime: true },
  ],
};

describe("offline workout recap and text sharing", () => {
  it("counts only eligible rep-based volume and records realistic duration", () => {
    expect(workoutRecapStats(detail, summary)).toEqual({ exercises: 2, sets: 3, volumeKg: 900, durationMinutes: 45, personalBests: 2 });
    expect(workoutRecapStats({ ...detail, startedAt: null, imported: true }, summary).durationMinutes).toBeNull();
    expect(workoutRecapStats({ ...detail, startedAt: finishedAt - 9 * 60 * 60_000 }, summary).durationMinutes).toBeNull();
    expect(workoutRecapStats({ ...detail, startedAt: finishedAt - 45 * 60_000, pausedMs: 15 * 60_000 }, summary).durationMinutes).toBe(30);
  });
  it("shares actual exercise sets, special types, numbers and records as plain text", () => {
    const msg = formatWorkoutShareText(detail, summary, "en", "kg");
    expect(msg).toContain("GAIN · Push");
    expect(msg).toContain("Volume: 900 kg");
    expect(msg).toContain("Duration: 45 m");
    expect(msg).toContain("🏆 Personal bests (2)");
    expect(msg).toContain("Estimated strength PR");
    expect(msg).toContain("Bench Press");
    expect(msg).toContain("1. 20 kg × 12 Reps (Warm-up)");
    expect(msg).toContain("2. 60 kg × 8 Reps");
    expect(msg).toContain("4. 40 kg × 15 Reps (Drop set)");
    expect(msg).toContain("Not counted: waiting for a confirm");
    expect(msg).toContain("45 s");
    expect(msg).not.toMatch(/https?:\/\//);
    expect(msg).not.toContain("\u2066");
  });
  it("supports lb without mutating kg, and Arabic descriptions", () => {
    const lbs = formatWorkoutShareText(detail, summary, "en", "lb");
    expect(lbs).toContain("132.3 lb");
    expect(lbs).toContain("Volume: 1984 lb");
    expect(workoutRecapStats(detail, summary).volumeKg).toBe(900);
    const ar = formatWorkoutShareText(detail, summary, "ar", "kg");
    expect(ar).toContain("بنش");
    expect(ar).toContain("أرقام قياسية شخصية");
  });
  it("never claims a first-ever workout is a PB", () => {
    const noPb: SessionSummary = { ...summary, totals: { ...summary.totals, records: 0 }, exercises: summary.exercises.map(x => ({ ...x, firstTime: true, records: [] })) };
    expect(personalBestLines(noPb, "en", "kg")).toEqual([]);
    expect(formatWorkoutShareText(detail, noPb, "en", "kg")).not.toContain("🏆");
  });
});
