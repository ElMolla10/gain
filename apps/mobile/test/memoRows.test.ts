import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/haptics", () => ({ haptics: { tick: () => {}, untick: () => {}, restOver: () => {}, celebrate: () => {} } }));
vi.mock("react-native", () => ({ Pressable: "Pressable", View: "View", useWindowDimensions: () => ({ fontScale: 1 }) }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ t: (k: string) => k, lang: "en", unit: "kg" }) }));
vi.mock("../src/theme", () => ({ radius: {}, space: {}, useLogPalette: () => ({}) }));
vi.mock("../src/ui", () => ({ AppText: "AppText" }));
vi.mock("../src/components/Icon", () => ({ Icon: "Icon" }));
vi.mock("../src/components/LogParts", () => ({ CellInput: "CellInput", SwipeRow: "SwipeRow" }));
import { sameRowProps, type WorkoutSetRowProps } from "../src/components/WorkoutSetRow";
import { createHandlerMap } from "../src/logic/stableHandlers";

const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");
const fn = () => {};
const base = {
  ex: { exerciseId: "bench", nameEn: "Bench", nameAr: "بنش", measure: "reps", trackEffort: true } as unknown as WorkoutSetRowProps["ex"],
  row: { key: "r1" } as WorkoutSetRowProps["row"], label: 2, workingIndex: 1, lastSets: null, current: false, stacked: false, busy: null,
  onPatch: fn, onKind: fn, onAskDelete: fn, onDelete: fn, onLog: fn, onUntick: fn,
} as unknown as WorkoutSetRowProps;

describe("memoised set rows (iOS audit 5)", () => {
  it("a rebuilt ex with the same fields is the same row; any other prop change re-renders", () => {
    expect(sameRowProps(base, { ...base, ex: { ...base.ex } })).toBe(true);
    expect(sameRowProps(base, { ...base, ex: { ...base.ex, nameEn: "Incline" } })).toBe(false);
    expect(sameRowProps(base, { ...base, row: { ...base.row } })).toBe(false);
    expect(sameRowProps(base, { ...base, current: true })).toBe(false);
    expect(sameRowProps(base, { ...base, onLog: () => {} })).toBe(false);
  });
  it("WorkoutSetRow is memoised in the section and the session passes stable per-exercise handlers", () => {
    expect(read("src/components/WorkoutSetRow.tsx")).toMatch(/export const MemoWorkoutSetRow = React\.memo\(WorkoutSetRow, sameRowProps\)/);
    expect(read("src/components/WorkoutExerciseSection.tsx")).toMatch(/<MemoWorkoutSetRow /);
    expect(read("src/hooks/useWorkoutSession.ts")).toMatch(/\.\.\.rowHandlers\.current\(ex\.exerciseId, \{/);
  });
  it("the handler map returns the same wrappers per key and they call the latest implementation", () => {
    const map = createHandlerMap<{ onLog: (n: number) => number }>();
    const a = map("bench", { onLog: (n) => n + 1 });
    const b = map("bench", { onLog: (n) => n + 100 });
    expect(b).toBe(a);
    expect(a.onLog(1)).toBe(101);
    expect(map("row", { onLog: (n) => n })).not.toBe(a);
  });
});
