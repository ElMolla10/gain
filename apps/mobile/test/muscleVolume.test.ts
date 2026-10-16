import { describe, expect, it } from "vitest";
import { muscleGroupOf, muscleVolumeRows } from "../src/logic/muscleVolume";
import type { LoggedSet } from "@gain/engine";

const w = (load: number, reps: number, extra: Partial<LoggedSet> = {}): LoggedSet => ({ load, reps, ...extra });

describe("muscleGroupOf", () => {
  it("maps a catalogue bench to chest and a custom hinge to hamstrings", () => {
    expect(muscleGroupOf({ seedKey: "bench_press_barbell", pattern: "horizontal_push", equipment: "barbell" })).toBe("chest");
    expect(muscleGroupOf({ seedKey: null, pattern: "hinge", equipment: "barbell" })).toBe("hamstrings");
  });
});

describe("muscleVolumeRows", () => {
  it("aggregates trusted sets against program weekly targets", () => {
    const rows = muscleVolumeRows(
      [
        { seedKey: null, pattern: "horizontal_push", equipment: "barbell", sets: [w(20, 10, { warmup: true }), w(60, 8), w(60, 8)] },
        { seedKey: null, pattern: "horizontal_pull", equipment: "barbell", sets: [w(70, 8), w(70, 8), w(70, 8)] },
      ],
      [
        { group: "chest", setsPerRotation: 10, daysPerRotation: 2, setsPerWeek: 10, sessionsPerWeek: 2 },
        { group: "back", setsPerRotation: 12, daysPerRotation: 2, setsPerWeek: 12, sessionsPerWeek: 2 },
      ],
    );
    expect(rows.find((r) => r.group === "chest")).toMatchObject({ completed: 2, min: 8, max: 12 });
    expect(rows.find((r) => r.group === "back")).toMatchObject({ completed: 3, min: 10, max: 14 });
  });
});
