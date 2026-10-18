import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkoutActivityProps } from "../src/logic/workoutActivityModel";

// A tiny effect host: enough to run the hook's two effects and its unmount cleanup.
const host = vi.hoisted(() => ({ values: [] as any[], index: 0, cleanups: [] as (() => void)[] }));
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>();
  return { ...actual,
    useRef: (v: unknown) => { const i = host.index++; return host.values[i] ??= { current: v }; },
    useEffect: (fn: () => void | (() => void), deps?: unknown[]) => {
      const i = host.index++; const prev = host.values[i];
      if (prev && deps && prev.deps.length === deps.length && prev.deps.every((d: unknown, k: number) => Object.is(d, deps[k]))) return;
      prev?.cleanup?.();
      host.values[i] = { deps: deps ?? [], cleanup: fn() || undefined };
    },
  };
});
const native = vi.hoisted(() => ({ sync: vi.fn(async () => {}), reconcile: vi.fn(async () => {}), stop: vi.fn(async () => {}) }));
vi.mock("../src/native/workoutLiveActivity", () => ({ workoutLiveActivity: native }));
import { useWorkoutLiveActivity, flushNow } from "../src/hooks/useWorkoutLiveActivity";

const base: WorkoutActivityProps = { v: 2, title: "Workout", timerStart: 0, pausedAt: null, pausedLabel: null, exercise: "Bench", setLine: "Set 2 of 3", detail: "80 kg × 8", rest: null, rtl: false, plates: [], change: null };
const render = (p: WorkoutActivityProps | null) => { host.index = 0; useWorkoutLiveActivity(p, async () => true); };
const unmount = () => host.values.forEach((v) => v?.cleanup?.());

beforeEach(() => { host.values = []; vi.clearAllMocks(); vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

describe("useWorkoutLiveActivity", () => {
  it("three keystroke changes within 400 ms give one sync with the last value", async () => {
    render(base);
    expect(native.sync).toHaveBeenCalledTimes(1);
    render({ ...base, detail: "8 kg × 8" });
    vi.advanceTimersByTime(100);
    render({ ...base, detail: "82 kg × 8" });
    vi.advanceTimersByTime(100);
    render({ ...base, detail: "82.5 kg × 8" });
    expect(native.sync).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(400);
    expect(native.sync).toHaveBeenCalledTimes(2);
    expect(native.sync).toHaveBeenLastCalledWith(expect.objectContaining({ detail: "82.5 kg × 8" }));
  });
  it("an exercise, set, rest or pause change flushes at once", () => {
    expect(flushNow(base, { ...base, exercise: "Row" })).toBe(true);
    expect(flushNow(base, { ...base, setLine: "Set 3 of 3" })).toBe(true);
    expect(flushNow(base, { ...base, rest: { startedAt: 0, endsAt: 1, label: "Rest" } })).toBe(true);
    expect(flushNow(base, { ...base, pausedAt: 5 })).toBe(true);
    expect(flushNow(base, { ...base, detail: "x" })).toBe(false);
    render(base);
    render({ ...base, setLine: "Set 3 of 3", rest: { startedAt: 0, endsAt: 90_000, label: "Rest" } });
    expect(native.sync).toHaveBeenCalledTimes(2);
  });
  it("unmount reconciles (never stops) and sends a pending debounced edit first", () => {
    render(base);
    render({ ...base, detail: "90 kg × 8" });
    unmount();
    expect(native.sync).toHaveBeenLastCalledWith(expect.objectContaining({ detail: "90 kg × 8" }));
    expect(native.reconcile).toHaveBeenCalledTimes(1);
    expect(native.stop).not.toHaveBeenCalled();
  });
});
