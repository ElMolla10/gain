import { describe, expect, it } from "vitest";
import { liveCardsEqual, rowsSignature } from "../src/logic/liveSignature";
import type { SetRowDraft } from "../src/logic/workoutRows";

const row = (o: Partial<SetRowDraft>): SetRowDraft => ({ key: "a", load: null, reps: null, rir: null, warmup: false, tags: [], saved: false, dirty: false, ghostLoad: 60, ghostReps: 8, ...o });
const rows = (next: Partial<SetRowDraft>) => ({ bench: [row({ key: "s1", saved: true, load: 60, reps: 8 }), row({ key: "s2", ...next })] });

describe("live suggestion signature (iOS audit 4)", () => {
  it("ignores draft loads typed into the next row, but not an emptied/filled reps box, ghosts, or logged values", () => {
    const base = rowsSignature(rows({}));
    expect(rowsSignature(rows({ load: 6 }))).toBe(base);
    expect(rowsSignature(rows({ load: 62.5, rir: 2 }))).toBe(base);
    expect(rowsSignature(rows({ reps: 9 }))).not.toBe(base);
    expect(rowsSignature(rows({ ghostLoad: 62.5 }))).not.toBe(base);
    expect(rowsSignature(rows({ saved: true, load: 60, reps: 8 }))).not.toBe(base);
    expect(rowsSignature({ bench: [row({ key: "s1", saved: true, load: 65, reps: 8 }), row({ key: "s2" })] })).not.toBe(base);
  });
  it("cards compare by key, performance and decision", () => {
    const d = { action: "maintain", suggestedWeightKg: 60, suggestedReps: 8, predictedReps: 8, reason: "within_range", predictionAvailable: true } as never;
    const c = { decision: d, key: "s2", performance: "p", fatigueKey: "", specKey: "x" };
    expect(liveCardsEqual({ bench: c }, { bench: { ...c } })).toBe(true);
    expect(liveCardsEqual({ bench: c }, { bench: { ...c, key: "s3" } })).toBe(false);
    expect(liveCardsEqual({ bench: c }, {})).toBe(false);
    expect(liveCardsEqual({ bench: c }, { bench: { ...c, decision: { ...(d as object), suggestedWeightKg: 62.5 } as never } })).toBe(false);
  });
});
