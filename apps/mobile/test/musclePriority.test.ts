import { describe, expect, it } from "vitest";
import { parseMusclePriorities, rankOf, scaleSets, serializeMusclePriorities } from "../src/logic/musclePriority";
import { muscleVolumeRows } from "../src/logic/muscleVolume";
import type { LoggedSet } from "@gain/engine";

const w = (load: number, reps: number): LoggedSet => ({ load, reps });

describe("muscle priorities", () => {
  it("persist as a setting JSON and default to normal", () => {
    expect(rankOf({}, "biceps")).toBe("normal");
    const raw = serializeMusclePriorities({ biceps: "priority", forearms: "priority", hamstrings: "reduced" });
    const p = parseMusclePriorities(raw);
    expect(p.biceps).toBe("priority");
    expect(p.forearms).toBe("priority");
    expect(p.hamstrings).toBe("reduced");
    expect(parseMusclePriorities("not json")).toEqual({});
  });
  it("priority raises weekly sets; reduced lowers them", () => {
    expect(scaleSets(8, "priority")).toBeGreaterThan(scaleSets(8, "normal"));
    expect(scaleSets(8, "reduced")).toBeLessThan(scaleSets(8, "normal"));
  });
  it("volume view uses the generator's planned sets, so a priority boost is visible", () => {
    const rows = muscleVolumeRows(
      [{ seedKey: "db_curl", pattern: "elbow_flexion", equipment: "dumbbell", sets: [w(10, 10), w(10, 10)] }],
      [
        { group: "biceps", setsPerRotation: 12, daysPerRotation: 2, setsPerWeek: 12, sessionsPerWeek: 2 },
        { group: "chest", setsPerRotation: 8, daysPerRotation: 2, setsPerWeek: 8, sessionsPerWeek: 2 },
      ],
    );
    const biceps = rows.find((r) => r.group === "biceps")!;
    const chest = rows.find((r) => r.group === "chest")!;
    expect(biceps.min).toBeGreaterThan(chest.min);
    expect(biceps.max).toBeGreaterThan(chest.max);
  });
});
