import React, { type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freshDb } from "./helpers";
import { createMlEvaluationRepo } from "../src/db/mlEvaluationRepo";
import { translate } from "../src/i18n/format";
import { useWorkoutSession, type WorkoutSession } from "../src/hooks/useWorkoutSession";
import { WorkoutSetRow } from "../src/components/WorkoutSetRow";
import { REST_KEYS } from "../src/logic/restAlert";
import { elapsedMs } from "../src/logic/workoutClock";
import { sessionMinutes } from "../src/logic/historyRows";

// Run the session hook against the real SQLite repositories. Only React's host and
// native delivery are substituted; no logging, prescription, or rest logic is mocked.
const host = vi.hoisted(() => ({ values: [] as any[], index: 0, effects: [] as (() => void)[], services: null as any, dayId: "" }));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  const same = (a: unknown[] | undefined, b: unknown[] | undefined) => !!a && !!b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const useMemo = (fn: () => unknown, deps?: unknown[]) => {
    const index = host.index++;
    const prev = host.values[index];
    if (!prev || !same(prev.deps, deps)) host.values[index] = { value: fn(), deps };
    return host.values[index].value;
  };
  return { ...actual,
    useState: (initial: unknown) => {
      const index = host.index++;
      if (!(index in host.values)) host.values[index] = typeof initial === "function" ? initial() : initial;
      return [host.values[index], (update: any) => { host.values[index] = typeof update === "function" ? update(host.values[index]) : update; }];
    },
    useRef: (initial: unknown) => { const index = host.index++; return host.values[index] ??= { current: initial }; },
    useMemo,
    useCallback: (fn: unknown, deps: unknown[]) => useMemo(() => fn, deps),
    useEffect: (effect: () => void | (() => void), deps?: unknown[]) => {
      const index = host.index++;
      const prev = host.values[index];
      if (prev && same(prev.deps, deps)) return;
      host.values[index] = { deps, cleanup: prev?.cleanup };
      host.effects.push(() => { prev?.cleanup?.(); host.values[index].cleanup = effect(); });
    },
  };
});
const native = vi.hoisted(() => ({ alert: vi.fn(), sync: vi.fn(async () => {}), stop: vi.fn(async () => {}) }));
vi.mock("react-native", () => ({ Alert: { alert: native.alert }, Vibration: { vibrate: vi.fn() }, TextInput: "TextInput", Pressable: "Pressable", View: "View" }));
vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock("@react-navigation/native", () => ({ useRoute: () => ({ params: { dayId: host.dayId } }), useNavigation: () => ({ dispatch: vi.fn(), goBack: vi.fn() }), StackActions: { push: vi.fn(), replace: vi.fn() } }));
vi.mock("../src/AppContext", () => ({ useServices: () => host.services }));
vi.mock("../src/i18n", () => {
  const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate("en", key, params);
  return { useI18n: () => ({ t, lang: "en", unit: "kg", unitText: "kg", fmt: (kg: number) => String(kg) }) };
});
vi.mock("../src/diagnostics", () => ({ diagnostics: { record: vi.fn() } }));
vi.mock("../src/native/restLiveActivity", () => ({ restLiveActivity: { sync: native.sync, stop: native.stop } }));
vi.mock("../src/theme", () => ({ radius: { button: 8 }, space: { xs: 4, sm: 8, md: 12 }, useLogPalette: () => ({}) }));
vi.mock("../src/ui", () => ({ AppText: "AppText" }));
vi.mock("../src/components/Icon", () => ({ Icon: "Icon" }));
vi.mock("../src/components/LogParts", () => ({ CellInput: "CellInput", SwipeRow: "SwipeRow" }));

type Node = ReactElement<Record<string, any>>;
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement(value)) return [];
  const n = value as Node;
  return [n, ...nodes(n.props.children)];
}
function render() {
  host.index = 0;
  const result = useWorkoutSession();
  host.effects.splice(0).forEach(effect => effect());
  return result;
}
function ready(): WorkoutSession {
  const result = render();
  expect(result.phase).toBe("ready");
  if (result.phase !== "ready") throw new Error("session is not ready");
  return result;
}
async function fixture(opts: { restOn?: boolean } = {}) {
  const c = await freshDb();
  await c.repos.seedIfNeeded();
  const day = (await c.repos.getNextDay())!.day;
  const gymId = (await c.repos.getActiveGymId())!;
  const gym = await c.repos.loadGymFingerprint(gymId);
  const ex = (await c.repos.listDayExercises(day.id))[0]!;
  const baseline = await c.workout.startOrResumeSession(day.id, gymId);
  await c.workout.logSet({ sessionId: baseline.id, exerciseId: ex.exerciseId, load: 60, reps: 8 }, { gym, equipment: ex.equipment, setup: ex.setup });
  c.deps.tick();
  await c.workout.finishSession(baseline.id);
  c.deps.tick();
  if (opts.restOn) await c.repos.setSetting(REST_KEYS.auto, "1");
  host.dayId = day.id;
  host.services = { ...c, mlEvaluation: createMlEvaluationRepo(c.db, c.deps), restAlerts: { cancel: vi.fn(async () => {}), schedule: vi.fn(async () => {}) } };
  render();
  await vi.waitFor(() => { ready(); });
  if (opts.restOn) await vi.waitFor(() => { const s = ready(); expect(s.exerciseProps(s.shown[0]!, 0)!.st.restOff).toBe(false); });
  return c;
}
beforeEach(() => { host.values = []; host.effects = []; host.index = 0; vi.clearAllMocks(); vi.useFakeTimers(); });
afterEach(() => { host.values.forEach(v => v?.cleanup?.()); vi.useRealTimers(); });

describe("one tap on the real session checkmark", () => {
  it.each([false, true])("logs ghost or edited values (edited: %s), starts rest, and refreshes the next card", async edited => {
    const c = await fixture({ restOn: true });
    let s = ready();
    const ex = s.shown[0]!;
    const row = s.rows[ex.exerciseId]![0]!;
    expect(row.ghostLoad).toBe(60);
    const expectedReps = row.ghostReps;
    if (edited) s.patch(ex.exerciseId, row.key, { load: 62.5, reps: 9 });
    s = ready();
    const section = s.exerciseProps(ex, 0)!;
    const checkedRow = s.rows[ex.exerciseId]![0]!;
    const tree = nodes(WorkoutSetRow({ ...section, row: checkedRow, label: 1, workingIndex: 0, lastSets: null, current: true, stacked: false }));
    tree.find(n => n.props.accessibilityRole === "checkbox")!.props.onPress();
    await vi.waitFor(async () => {
      const sets = await c.workout.listSessionSets(s.loaded.sessionId);
      expect(sets).toHaveLength(1);
      expect(sets[0]).toMatchObject({ load: edited ? 62.5 : 60, reps: edited ? 9 : expectedReps });
      const latest = ready();
      expect(latest.rows[ex.exerciseId]![0]!.saved).toBe(true);
      expect(latest.timer.endsAt).toBeGreaterThan(Date.now());
    });
    await vi.advanceTimersByTimeAsync(1);
    const next = ready().exerciseProps(ex, 0)!;
    expect(next.list[0]!.saved).toBe(true);
    expect(next.card?.key).toBe(next.list[1]!.key);
    expect(native.alert).not.toHaveBeenCalled();
    expect(native.sync).toHaveBeenLastCalledWith(expect.objectContaining({ endsAt: ready().timer.endsAt }));
  });

  it("preserves an explicit rest-off choice", async () => {
    await fixture({ restOn: true });
    let s = ready(); const ex = s.shown[0]!; const row = s.rows[ex.exerciseId]![0]!;
    // The public toggle persists the session's off choice.
    await s.exerciseProps(ex, 0)!.onToggleRest();
    s = ready();
    await s.logRow(ex, s.rows[ex.exerciseId]![0]!);
    expect(ready().timer.endsAt).toBeNull();
  });

  it.each(["warmup", "drop"] as const)("does not auto-start rest for a %s set", async kind => {
    await fixture();
    let s = ready(); const ex = s.shown[0]!; const row = s.rows[ex.exerciseId]![0]!;
    s.patch(ex.exerciseId, row.key, kind === "warmup" ? { warmup: true } : { tags: ["drop"] });
    s = ready();
    await s.logRow(ex, s.rows[ex.exerciseId]![0]!);
    expect(ready().timer.endsAt).toBeNull();
    expect(ready().rows[ex.exerciseId]![0]!.saved).toBe(true);
  });

  it("keeps a failed save unchecked and leaves rest stopped", async () => {
    const c = await fixture();
    const s = ready(); const ex = s.shown[0]!;
    vi.spyOn(c.workout, "logSet").mockRejectedValueOnce(new Error("SQLITE_FULL"));
    await s.logRow(ex, s.rows[ex.exerciseId]![0]!);
    const result = ready();
    expect(result.rows[ex.exerciseId]![0]!.saved).toBe(false);
    expect(result.timer.endsAt).toBeNull();
    expect(native.alert).toHaveBeenCalled();
  });

  it("ends the rest presentation at the deadline and on leaving the logger", async () => {
    await fixture({ restOn: true });
    const s = ready(); const ex = s.shown[0]!;
    await s.logRow(ex, s.rows[ex.exerciseId]![0]!);
    const running = ready();
    await vi.advanceTimersByTimeAsync(running.timer.durationMs);
    const ended = ready();
    expect(ended.restOver).toBe(true);
    expect(ended.timer.endsAt).toBeNull();
    expect(native.sync).toHaveBeenLastCalledWith(expect.objectContaining({ endsAt: null }));
    host.values.forEach(v => v?.cleanup?.());
    expect(native.stop).toHaveBeenCalled();
  });

});

describe("rest timer default and workout pause", () => {
  it("the rest timer starts off; turning it on in the logger saves the preference for the next workout", async () => {
    const c = await fixture();
    let s = ready(); const ex = s.shown[0]!;
    expect(s.exerciseProps(ex, 0)!.st.restOff).toBe(true);
    await s.logRow(ex, s.rows[ex.exerciseId]![0]!);
    s = ready();
    expect(s.rows[ex.exerciseId]![0]!.saved).toBe(true);
    expect(s.timer.endsAt).toBeNull();
    expect(await c.repos.getSetting(REST_KEYS.auto)).toBeNull();
    await s.exerciseProps(ex, 0)!.onToggleRest();
    s = ready();
    expect(s.exerciseProps(ex, 0)!.st.restOff).toBe(false);
    expect(await c.repos.getSetting(REST_KEYS.auto)).toBe("1");
    await s.logRow(ex, s.rows[ex.exerciseId]![1]!);
    expect(ready().timer.endsAt).toBeGreaterThan(Date.now());
  });

  it("pause freezes the duration, resume continues, and Finish excludes the paused time", async () => {
    const c = await fixture();
    let s = ready();
    const sessionId = s.loaded.sessionId;
    await s.toggleDurationPause();
    s = ready();
    expect(s.loaded.pausedAt).not.toBeNull();
    expect((await c.workout.getSession(sessionId))!.paused_at).not.toBeNull();
    const frozen = elapsedMs(s.loaded.startedAt, s.loaded.pausedMs, s.loaded.pausedAt, Date.now());
    vi.advanceTimersByTime(3 * 60_000);
    c.deps.tick(3 * 60_000);
    expect(elapsedMs(s.loaded.startedAt, s.loaded.pausedMs, s.loaded.pausedAt, Date.now())).toBe(frozen);
    await s.toggleDurationPause();
    s = ready();
    expect(s.loaded.pausedAt).toBeNull();
    expect(s.loaded.pausedMs).toBeGreaterThanOrEqual(3 * 60_000);
    c.deps.tick(60_000);
    await c.workout.finishSession(sessionId);
    const done = (await c.workout.getSession(sessionId))!;
    expect(done.paused_ms).toBe(3 * 60_000);
    expect(sessionMinutes(done.started_at, done.finished_at!, false, done.paused_ms)).toBe(1);
  });
});

describe("untick and delete failures", () => {
  async function loggedRow() {
    const c = await fixture();
    const s = ready(); const ex = s.shown[0]!;
    await s.logRow(ex, s.rows[ex.exerciseId]![0]!);
    const after = ready();
    const row = after.rows[ex.exerciseId]![0]!;
    expect(row.saved).toBe(true);
    native.alert.mockClear();
    return { c, ex, row };
  }

  it.each(["onUntick", "onDelete"] as const)("%s: a failed delete alerts and keeps the set visible and ticked", async action => {
    const { c, ex, row } = await loggedRow();
    vi.spyOn(c.workout, "deleteSet").mockRejectedValueOnce(new Error("SQLITE_BUSY"));
    ready().exerciseProps(ex, 0)![action](row);
    await vi.waitFor(() => { expect(native.alert).toHaveBeenCalledTimes(1); expect(ready().busy).toBeNull(); });
    const result = ready();
    expect(result.rows[ex.exerciseId]!.find(r => r.key === row.key)?.saved).toBe(true);
    expect(result.status.kind).toBe("error");
    expect(await c.workout.listSessionSets(result.loaded.sessionId)).toHaveLength(1);
  });

  it("untick: a failed reload after a successful delete alerts and leaves the row un-ticked", async () => {
    const { c, ex, row } = await loggedRow();
    const sessionId = ready().loaded.sessionId;
    vi.spyOn(c.workout, "listSessionSets").mockRejectedValue(new Error("SQLITE_BUSY"));
    ready().exerciseProps(ex, 0)!.onUntick(row);
    await vi.waitFor(() => { expect(native.alert).toHaveBeenCalledTimes(1); expect(ready().busy).toBeNull(); });
    vi.mocked(c.workout.listSessionSets).mockRestore();
    expect(ready().rows[ex.exerciseId]![0]!.saved).toBe(false);
    expect(ready().status.kind).toBe("error");
    expect(await c.workout.listSessionSets(sessionId)).toHaveLength(0);
  });

  it("a failing evaluation skip still removes an unsaved row", async () => {
    await fixture();
    const s = ready(); const ex = s.shown[0]!;
    const row = s.rows[ex.exerciseId]![0]!;
    vi.spyOn(host.services.mlEvaluation, "skip").mockRejectedValueOnce(new Error("SQLITE_FULL"));
    s.exerciseProps(ex, 0)!.onDelete(row);
    await vi.waitFor(() => { expect(ready().rows[ex.exerciseId]!.some(r => r.key === row.key)).toBe(false); });
    expect(native.alert).not.toHaveBeenCalled();
    expect(ready().status.kind).not.toBe("error");
  });
});
