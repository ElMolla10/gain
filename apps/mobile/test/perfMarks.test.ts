import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPerfMarks, percentile, PERF_RING, summarize } from "../src/logic/perfMarks";
import { ar, en } from "../src/i18n/strings";

const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");
afterEach(() => vi.useRealTimers());

describe("Developer Mode timings (iOS audit 13)", () => {
  it("median and p90 by nearest rank", () => {
    const s = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(s, 50)).toBe(5);
    expect(percentile(s, 90)).toBe(9);
    expect(percentile([], 50)).toBe(0);
    expect(summarize({ a: [30, 10, 20], b: [] })).toEqual([{ name: "a", n: 3, median: 20, p90: 30 }]);
  });
  it("keeps the last 50 per name", () => {
    const p = createPerfMarks();
    p.setEnabled(true);
    for (let i = 1; i <= 70; i++) p.mark("tickSaved", i);
    const [r] = p.summary();
    expect(r).toMatchObject({ name: "tickSaved", n: PERF_RING, median: 45 });
  });
  it("is a no-op with Developer Mode off; samples before it loads are kept only if it is on", () => {
    const off = createPerfMarks();
    off.mark("boot", 100);
    off.setEnabled(false);
    off.mark("tickSaved", 5);
    expect(off.summary()).toEqual([]);
    const on = createPerfMarks();
    on.mark("boot", 100);
    on.setEnabled(true);
    expect(on.summary()).toEqual([{ name: "boot", n: 1, median: 100, p90: 100 }]);
  });
  it("persists through the store, restores, ignores a corrupt file, and clears", () => {
    vi.useFakeTimers();
    let file: string | null = null;
    const store = { read: () => file, write: (t: string) => { file = t; }, remove: () => { file = null; } };
    const p = createPerfMarks(10);
    p.attachStore(store);
    p.setEnabled(true);
    p.mark("boot", 12);
    vi.advanceTimersByTime(20);
    const q = createPerfMarks();
    q.attachStore(store);
    expect(q.summary()[0]).toMatchObject({ name: "boot", n: 1 });
    q.clear();
    expect(file).toBeNull();
    expect(q.summary()).toEqual([]);
    file = "{";
    const r = createPerfMarks();
    r.attachStore(store);
    expect(r.summary()).toEqual([]);
  });
  it("instrumentation points and the Diagnostics card are wired; strings exist in both languages", () => {
    expect(read("App.tsx")).toMatch(/perfMark\("boot"/);
    expect(read("src/screens/WorkoutScreen.tsx")).toMatch(/perfMark\("workoutOpen"/);
    expect(read("src/screens/WorkoutScreen.tsx")).toMatch(/<Profiler id="logger" onRender=\{onLoggerRender\}>/);
    expect(read("src/screens/WorkoutScreen.tsx")).toMatch(/if \(!perfMarks\.isOn\(\)\) return;/);
    expect(read("src/hooks/useWorkoutSession.ts")).toMatch(/perfMark\("tickSaved"/);
    expect(read("src/DeveloperMode.tsx")).toMatch(/perfMarks\.setEnabled\(s\.enabled\)/);
    expect(read("src/screens/DiagnosticsScreen.tsx")).toMatch(/t\("diag\.perf\.title"\)/);
    for (const k of ["diag.perf.title", "diag.perf.note", "diag.perf.row", "diag.perf.empty", "diag.perf.clear"] as const) {
      expect(en[k]).toBeTruthy();
      expect(ar[k]).toBeTruthy();
    }
  });
});
