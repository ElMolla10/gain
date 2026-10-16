import { describe, expect, it } from "vitest";
import { volumeTargetRange, weekMuscleVolume } from "./muscleVolume";
import type { LoggedSet } from "./types";

const w = (load: number, reps: number, extra: Partial<LoggedSet> = {}): LoggedSet => ({ load, reps, ...extra });

describe("volumeTargetRange", () => {
  it("uses an 80–120% window around a planned weekly set count", () => {
    expect(volumeTargetRange(10, "chest")).toEqual([8, 12]);
    expect(volumeTargetRange(12, "back")).toEqual([10, 14]);
  });
  it("falls back to the default window", () => {
    expect(volumeTargetRange(null, "biceps")).toEqual([8, 12]);
    expect(volumeTargetRange(null, "back")).toEqual([10, 14]);
  });
});

describe("weekMuscleVolume", () => {
  it("counts trusted working sets per muscle and skips warm-ups, drops and unconfirmed", () => {
    const rows = weekMuscleVolume(
      [
        { group: "chest", sets: [w(20, 10, { warmup: true }), w(60, 8), w(60, 8), w(40, 12, { tags: ["drop"] }), w(100, 5, { outlierStatus: "unconfirmed" })] },
        { group: "chest", sets: [w(50, 10)] },
        { group: "back", sets: [w(70, 8), w(70, 8), w(70, 8)] },
      ],
      [{ group: "chest", planned: 10 }, { group: "back", planned: 12 }],
    );
    expect(rows).toEqual([
      { group: "back", completed: 3, min: 10, max: 14 },
      { group: "chest", completed: 3, min: 8, max: 12 },
    ]);
  });
  it("counts each exercise once so a superset pair is not doubled onto one muscle", () => {
    const rows = weekMuscleVolume(
      [
        { group: "chest", sets: [w(60, 8), w(60, 8)] },
        { group: "back", sets: [w(70, 8), w(70, 8)] },
      ],
      [{ group: "chest", planned: 8 }, { group: "back", planned: 8 }],
    );
    expect(rows.find((r) => r.group === "chest")?.completed).toBe(2);
    expect(rows.find((r) => r.group === "back")?.completed).toBe(2);
  });
});
