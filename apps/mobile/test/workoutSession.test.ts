import React, { type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freshDb } from "./helpers";
import { createMlEvaluationRepo } from "../src/db/mlEvaluationRepo";
import { translate } from "../src/i18n/format";
import { useWorkoutSession, type WorkoutSession } from "../src/hooks/useWorkoutSession";
import { MemoWorkoutSetRow, sameRowProps, WorkoutSetRow, type WorkoutSetRowProps } from "../src/components/WorkoutSetRow";
import { dockKey } from "../src/logic/dockModel";
import { WorkoutExerciseSection } from "../src/components/WorkoutExerciseSection";
import { REST_KEYS } from "../src/logic/restAlert";
import { elapsedMs } from "../src/logic/workoutClock";
import { sessionMinutes } from "../src/logic/historyRows";

// Run the session hook against the real SQLite repositories. Only React's host and
// native delivery are substituted; no logging, prescription, or rest logic is mocked.
const host = vi.hoisted(() => ({ values: [] as any[], writes: [] as number[], index: 0, effects: [] as (() => void)[], services: null as any, dayId: "" }));
vi.mock("../src/haptics", () => ({ haptics: { tick: () => {}, untick: () => {}, restOver: () => {}, celebrate: () => {} } }));
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
      return [host.values[index], (update: any) => { host.writes.push(index); host.values[index] = typeof update === "function" ? update(host.values[index]) : update; }];
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
const native = vi.hoisted(() => ({ appState: [] as ((s: string) => void)[], alert: vi.fn(), sync: vi.fn(async (_p?: any) => {}), stop: vi.fn(async () => {}), reconcile: vi.fn(async (_open?: () => Promise<boolean>) => {}) }));
vi.mock("react-native", () => ({ AppState: { addEventListener: (_e: string, fn: (s: string) => void) => { native.appState.push(fn); return { remove: () => { native.appState.splice(native.appState.indexOf(fn), 1); } }; } }, Alert: { alert: native.alert }, Vibration: { vibrate: vi.fn() }, TextInput: "TextInput", Pressable: "Pressable", View: "View", useWindowDimensions: () => ({ fontScale: 1 }) }));
vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock("expo-keep-awake", () => ({ activateKeepAwakeAsync: async () => undefined, deactivateKeepAwake: () => undefined }));
vi.mock("@react-navigation/native", () => ({ useRoute: () => ({ params: { dayId: host.dayId } }), useNavigation: () => ({ dispatch: vi.fn(), goBack: vi.fn() }), StackActions: { push: vi.fn(), replace: vi.fn() } }));
vi.mock("../src/AppContext", () => ({ useServices: () => host.services }));
vi.mock("../src/i18n", () => {
  const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate("en", key, params);
  return { useI18n: () => ({ t, lang: "en", unit: "kg", unitText: "kg", fmt: (kg: number) => String(kg) }) };
});
const recs = vi.hoisted(() => ({ n: 0 }));
vi.mock("../src/logic/liveAdaptation", async (orig) => {
  const actual = await orig<typeof import("../src/logic/liveAdaptation")>();
  return { ...actual, tryLiveRecommendation: (...args: Parameters<typeof actual.tryLiveRecommendation>) => { recs.n++; return actual.tryLiveRecommendation(...args); } };
});
vi.mock("../src/diagnostics", () => ({ diagnostics: { record: vi.fn() } }));
vi.mock("../src/native/workoutLiveActivity", () => ({ workoutLiveActivity: { sync: native.sync, stop: native.stop, reconcile: native.reconcile } }));
vi.mock("../src/theme", () => ({ radius: { button: 8 }, space: { xs: 4, sm: 8, md: 12 }, type: { section: 20, label: 13 }, useLogPalette: () => ({}) }));
vi.mock("../src/ui", () => ({ AppText: "AppText", BigButton: "BigButton", IconButton: "IconButton", InlineStatus: "InlineStatus", Notice: "Notice", QuietAction: "QuietAction" }));
vi.mock("../src/components/Icon", () => ({ Icon: "Icon" }));
vi.mock("../src/components/LogParts", () => ({ CellInput: "CellInput", SwipeRow: "SwipeRow", RestToggle: "RestToggle", UnitToggle: "UnitToggle", TargetLine: "TargetLine" }));

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
    expect(native.sync).toHaveBeenLastCalledWith(expect.objectContaining({ setLine: expect.stringMatching(/^Set \W*2\W* of/), rest: expect.objectContaining({ endsAt: ready().timer.endsAt }) }));
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

  it("ends the rest presentation at the deadline; leaving the logger keeps the alert and Live Activity", async () => {
    await fixture({ restOn: true });
    const s = ready(); const ex = s.shown[0]!;
    await s.logRow(ex, s.rows[ex.exerciseId]![0]!);
    const running = ready();
    await vi.advanceTimersByTimeAsync(running.timer.durationMs);
    const ended = ready();
    expect(ended.restOver).toBe(true);
    expect(ended.timer.endsAt).toBeNull();
    expect(native.sync).toHaveBeenLastCalledWith(expect.objectContaining({ rest: null }));
    host.values.forEach(v => v?.cleanup?.());
    expect(native.stop).not.toHaveBeenCalled();
    expect(native.reconcile).toHaveBeenCalled();
  });

  it("persists a running rest, restores it after the logger is reopened, and finishing ends it (iOS audit 3)", async () => {
    const c = await fixture({ restOn: true });
    const s = ready(); const ex = s.shown[0]!;
    await s.logRow(ex, s.rows[ex.exerciseId]![0]!);
    const endsAt = ready().timer.endsAt!;
    const label = ready().restFor;
    expect(label).toBeTruthy();
    await vi.waitFor(async () => expect(JSON.parse((await c.repos.getSetting("rest_running"))!)).toMatchObject({ sessionId: s.loaded.sessionId, endsAt }));
    const cancel = host.services.restAlerts.cancel as ReturnType<typeof vi.fn>;
    cancel.mockClear();
    // collapse: unmount and mount a fresh logger
    host.values.forEach(v => v?.cleanup?.());
    host.values = []; host.effects = [];
    expect(cancel).not.toHaveBeenCalled();
    render();
    await vi.waitFor(() => { expect(ready().timer.endsAt).toBe(endsAt); });
    const again = ready();
    expect(again.restFor).toBe(label);
    await again.doFinish(again.loaded);
    await vi.waitFor(async () => expect(await c.repos.getSetting("rest_running")).toBe(""));
    expect(cancel).toHaveBeenCalled();
    expect(native.stop).toHaveBeenCalled();
  });

});

describe("typed drafts survive iOS terminating the app (iOS audit 10)", () => {
  it("backgrounding saves one draft snapshot; reopening restores it unticked; ticking logs exactly that; finishing clears it", async () => {
    const c = await fixture();
    let s = ready(); const ex = s.shown[0]!;
    const sid = s.loaded.sessionId;
    s.patch(ex.exerciseId, s.rows[ex.exerciseId]![1]!.key, { load: 62.5, reps: 8 });
    ready();
    native.appState.forEach(fn => fn("background"));
    await vi.waitFor(async () => expect(await c.repos.getSetting(`workout_drafts:${sid}`)).toContain("62.5"));
    // iOS killed the app: a fresh logger opens and resumes the same session.
    host.values.forEach(v => v?.cleanup?.());
    host.values = []; host.effects = [];
    render();
    await vi.waitFor(() => { expect(ready().rows[ex.exerciseId]![1]!).toMatchObject({ load: 62.5, reps: 8, saved: false }); });
    s = ready();
    expect(s.rows[ex.exerciseId]![0]!.load).toBeNull();
    await s.logRow(ex, s.rows[ex.exerciseId]![1]!);
    const sets = await c.workout.listSessionSets(sid);
    expect(sets.at(-1)).toMatchObject({ load: 62.5, reps: 8 });
    s = ready();
    await s.doFinish(s.loaded);
    await vi.waitFor(async () => expect(await c.repos.getSetting(`workout_drafts:${sid}`)).toBe(""));
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

describe("typing into set 2 after set 1 is ticked (Android scroll twitch)", () => {
  // The exercise section as the lifter sees it: every node's type in order, plus the Suggested weight / Next set details line.
  const layout = (s: WorkoutSession, i: number) => {
    const props = s.exerciseProps(s.shown[i]!, i)!;
    const tree = nodes(WorkoutExerciseSection(props));
    const target = tree.find(n => n.type as unknown === "TargetLine")!;
    return {
      types: tree.map(n => typeof n.type === "string" ? n.type : (n.type as { name?: string }).name ?? "?"),
      suggested: [target.props.suggestedLabel, target.props.suggestedValue, target.props.moreLabel],
      props,
    };
  };
  // Render (which schedules the suggestion effect) and let it run, a few rounds so follow-up row updates settle too.
  const settleAll = async () => { for (let n = 0; n < 3; n++) { ready(); await vi.advanceTimersByTimeAsync(1); } };
  async function setOneTicked(i: number) {
    await fixture();
    let s = ready(); const ex = s.shown[i]!;
    await s.logRow(ex, s.rows[ex.exerciseId]![0]!);
    await settleAll();
    s = ready();
    const before = layout(s, i);
    expect(before.props.card?.key).toBe(before.props.list[1]!.key);
    expect(before.props.suggestionOpen).toBe(false);
    // Logger 10x §4: no "Suggested weight" line any more (the dock carries the number); the details toggle stays.
    expect(before.suggested[0]).toBeUndefined();
    expect(before.suggested[2]).toBe("Next set details");
    return { ex, before };
  }

  it.each([0, 1])("exercise %i: the suggestion line stays mounted with the same value on every keystroke, and never copies the draft", async i => {
    const { ex, before } = await setOneTicked(i);
    const kg = before.props.card!.decision.suggestedWeightKg;
    const key = before.props.list[1]!.key;
    // "6", "65", "6.", "6.5", delete back to "6", clear, then reps "1", "12", delete.
    const keystrokes = [{ load: 6 }, { load: 65 }, { load: 6 }, { load: 6.5 }, { load: 6 }, { load: null }, { reps: 1 }, { reps: 12 }, { reps: 1 }, { reps: null }];
    for (const change of keystrokes) {
      ready().patch(ex.exerciseId, key, change);
      // The render straight after the keystroke (before the suggestion effect runs) and the one after it.
      for (const settle of [false, true]) {
        if (settle) await settleAll();
        const now = layout(ready(), i);
        expect(now.props.card, JSON.stringify({ change, settle })).toBeDefined();
        expect(now.props.card!.decision.suggestedWeightKg).toBe(kg);
        expect(now.types).toEqual(before.types);
        expect(now.suggested).toEqual(before.suggested);
      }
    }
    expect(ready().rows[ex.exerciseId]![1]!).toMatchObject({ load: null, reps: null, saved: false });
    expect(ready().status.kind).toBe("info");
  });

  it("logging set 2, changing readiness, or unticking set 1 still recalculates the suggestion", async () => {
    const { ex, before } = await setOneTicked(0);
    let s = ready();
    s.patch(ex.exerciseId, before.props.list[1]!.key, { load: 6 });
    s = ready();
    s.setReadiness("fatigued");
    await settleAll();
    const fatigued = layout(ready(), 0).props.candidate as unknown as { fatigueKey: string };
    expect(fatigued.fatigueKey).toContain("fatigued");
    s = ready();
    s.patch(ex.exerciseId, before.props.list[1]!.key, { load: null });
    s = ready();
    await s.logRow(ex, s.rows[ex.exerciseId]![1]!);
    await settleAll();
    const two = layout(ready(), 0).props;
    expect(two.card?.key).toBe(two.list[2]!.key);
    expect(two.card!.performance).not.toBe(before.props.card!.performance);
    s = ready();
    s.exerciseProps(ex, 0)!.onUntick(s.rows[ex.exerciseId]![1]!);
    await vi.waitFor(() => expect(ready().rows[ex.exerciseId]![1]!.saved).toBe(false));
    await settleAll();
    const back = layout(ready(), 0).props;
    expect(back.card?.key).toBe(back.list[1]!.key);
    expect(back.card!.performance).toBe(before.props.card!.performance);
  });

  it("typing into set 2 runs no recommendation, records no ML prediction and keeps the liveCards object (iOS audit 4); a tick does", async () => {
    const { ex, before } = await setOneTicked(1);
    const key = before.props.list[1]!.key;
    const record = vi.spyOn(host.services.mlEvaluation, "record");
    recs.n = 0;
    const cards = ready().exerciseProps(ex, 1)!.card;
    for (const change of [{ load: 6 }, { load: 65 }, { load: 6.5 }, { load: null }, { reps: 9 }, { reps: null }]) {
      ready().patch(ex.exerciseId, key, change);
      await settleAll();
      expect(ready().exerciseProps(ex, 1)!.card).toBe(cards);
    }
    expect(recs.n).toBe(0);
    expect(record).not.toHaveBeenCalled();
    const s = ready();
    await s.logRow(ex, s.rows[ex.exerciseId]![1]!);
    await settleAll();
    expect(recs.n).toBeGreaterThanOrEqual(1);
    expect(ready().exerciseProps(ex, 1)!.card).not.toBe(cards);
  });

  it("patch() for the same exercise only sets the rows after the first keystroke (no setPreferredExercise / clearStrengthPr)", async () => {
    const { ex, before } = await setOneTicked(0);
    const key = before.props.list[1]!.key;
    ready().patch(ex.exerciseId, key, { load: 6 });
    const after1 = ready();
    host.writes = [];
    after1.patch(ex.exerciseId, key, { load: 65 });
    // Only setRows: the preferred exercise is already this one and there is no PR note to clear.
    expect(host.writes).toHaveLength(1);
    expect(ready().rows[ex.exerciseId]![1]!.load).toBe(65);
  });
});

describe("Finish with typed but unticked rows (data-loss item 5)", () => {
  type Button = { text: string; style?: string; onPress?: () => void };
  const plain = (s: string) => s.replace(/[\u2066-\u2069]/g, "");
  const statusOf = async (c: Awaited<ReturnType<typeof fixture>>, id: string) => (await c.db.get<{ status: string }>("SELECT status FROM session WHERE id = ?", [id]))!.status;
  // Nothing ticked: row 1 typed in full, row 2 a typed weight (reps from the ghost), row 3 invalid.
  async function typedNothingTicked() {
    const c = await fixture();
    let s = ready(); const ex = s.shown[0]!;
    const [r1, r2, r3] = s.rows[ex.exerciseId]!;
    s.patch(ex.exerciseId, r1!.key, { load: 62.5, reps: 9 });
    ready().patch(ex.exerciseId, r2!.key, { load: 61 });
    ready().patch(ex.exerciseId, r3!.key, { invalidLoad: true });
    s = ready();
    expect(s.sets).toHaveLength(0);
    s.askFinish(s.loaded);
    expect(native.alert).toHaveBeenCalledOnce();
    const [title, body, buttons] = native.alert.mock.calls[0]! as [string, string, Button[]];
    return { c, s, ex, r1: r1!, r2: r2!, title, body, buttons, ghostReps: r2!.ghostReps };
  }

  it("is never routed into 'Discard empty workout': three choices, the count only includes rows that will be saved", async () => {
    const { title, body, buttons } = await typedNothingTicked();
    expect(title).toBe(translate("en", "workout.finish.title"));
    expect(plain(body)).toBe("You have 2 sets with numbers that aren't ticked. Log them before you finish?\n\n1 can't be logged (missing or invalid numbers) and will be left out.");
    expect(buttons.map(b => [plain(b.text), b.style])).toEqual([["Cancel", "cancel"], ["Don't log them", "destructive"], ["Log 2 and finish", undefined]]);
    expect(buttons.some(b => b.text === translate("en", "workout.discard.go"))).toBe(false);
  });

  it("'Log N and finish' logs each loggable row once with the typed/ghost values, then finishes", async () => {
    const { c, s, ghostReps, buttons } = await typedNothingTicked();
    const logSet = vi.spyOn(c.workout, "logSet");
    buttons.at(-1)!.onPress!();
    await vi.waitFor(async () => expect(await statusOf(c, s.loaded.sessionId)).toBe("finished"));
    expect(logSet).toHaveBeenCalledTimes(2);
    const sets = await c.workout.listSessionSets(s.loaded.sessionId);
    expect(sets.map(x => [x.load, x.reps])).toEqual([[62.5, 9], [61, ghostReps]]);
    expect(await c.repos.getSetting(`workout_drafts:${s.loaded.sessionId}`)).toBe("");
  });

  it("a failed save keeps the workout open: rows already saved stay saved, nothing is finished", async () => {
    const { c, s, ex, r1, r2, buttons } = await typedNothingTicked();
    const finish = vi.spyOn(c.workout, "finishSession");
    const real = c.workout.logSet;
    vi.spyOn(c.workout, "logSet").mockImplementationOnce(real).mockRejectedValueOnce(new Error("SQLITE_FULL"));
    buttons.at(-1)!.onPress!();
    await vi.waitFor(() => expect(native.alert).toHaveBeenCalledTimes(2));
    expect(native.alert.mock.calls[1]![0]).toBe(translate("en", "workout.saveFailed.title"));
    expect(finish).not.toHaveBeenCalled();
    expect(await statusOf(c, s.loaded.sessionId)).toBe("in_progress");
    const after = ready();
    expect(after.finishing).toBe(false);
    expect(after.status.kind).toBe("error");
    expect(after.rows[ex.exerciseId]!.find(r => r.key === r1.key)!.saved).toBe(true);
    expect(after.rows[ex.exerciseId]!.find(r => r.key === r2.key)).toMatchObject({ saved: false, load: 61 });
    expect(await c.workout.listSessionSets(s.loaded.sessionId)).toHaveLength(1);
  });

  it("'Don't log them' with no set logged falls through to the existing 'Nothing logged' dialog", async () => {
    const { c, s, buttons } = await typedNothingTicked();
    buttons.find(b => b.style === "destructive")!.onPress!();
    expect(native.alert).toHaveBeenCalledTimes(2);
    const [title, , discard] = native.alert.mock.calls[1]! as [string, string, Button[]];
    expect(title).toBe(translate("en", "workout.discard.title"));
    expect(discard.at(-1)!.text).toBe(translate("en", "workout.discard.go"));
    expect(await statusOf(c, s.loaded.sessionId)).toBe("in_progress");
  });

  it("with sets logged, 'Don't log them' finishes without saving the typed rows; nothing typed just finishes", async () => {
    const c = await fixture();
    let s = ready(); const ex = s.shown[0]!;
    await s.logRow(ex, s.rows[ex.exerciseId]![0]!);
    s = ready();
    s.patch(ex.exerciseId, s.rows[ex.exerciseId]![1]!.key, { load: 70, reps: 5 });
    s = ready();
    native.alert.mockClear();
    s.askFinish(s.loaded);
    const buttons = native.alert.mock.calls[0]![2] as Button[];
    expect(plain(buttons.at(-1)!.text)).toBe("Log 1 and finish");
    buttons.find(b => b.style === "destructive")!.onPress!();
    await vi.waitFor(async () => expect(await statusOf(c, s.loaded.sessionId)).toBe("finished"));
    expect(await c.workout.listSessionSets(s.loaded.sessionId)).toHaveLength(1);
  });
});

describe("a keystroke re-renders only one row (logger 10x render count)", () => {
  // Every memoised set row on screen, with the props React.memo compares; and the dock's memo inputs.
  const rowProps = (s: WorkoutSession) => s.shown.flatMap((ex, i) => {
    const props = s.exerciseProps(ex, i);
    return props ? nodes(WorkoutExerciseSection(props)).filter(n => n.type === MemoWorkoutSetRow).map(n => n.props as unknown as WorkoutSetRowProps) : [];
  });
  const dockInputs = (s: WorkoutSession) => [dockKey(s.dock), s.dockName, s.sets.length, s.timer.endsAt, s.timer.durationMs, s.restFor, s.busy].join("|");
  const rerendered = (a: WorkoutSetRowProps[], b: WorkoutSetRowProps[]) => a.filter((p, i) => !b[i] || !sameRowProps(p, b[i]!)).length;

  it.each([0, 1])("typing into row %i of the first exercise: one row re-renders, the dock does not", async (rowIndex) => {
    await fixture();
    ready().setKeyboardUp(true);
    let s = ready();
    const ex = s.shown[0]!;
    const key = s.rows[ex.exerciseId]![rowIndex]!.key;
    // The first keystroke can flip the row's "pending" look; count from there, the way a lifter types "6", "62", "62.", "62.5".
    s.patch(ex.exerciseId, key, { load: 6 });
    s = ready();
    for (const load of [62, 62, 62.5]) {
      const rowsBefore = rowProps(s);
      const dockBefore = dockInputs(s);
      s.patch(ex.exerciseId, key, { load });
      s = ready();
      const rowsAfter = rowProps(s);
      expect(rowsAfter.length).toBe(rowsBefore.length);
      expect(rowsBefore.length).toBeGreaterThan(2);
      expect(rerendered(rowsBefore, rowsAfter)).toBe(1);
      expect(dockInputs(s)).toBe(dockBefore);
    }
  });
});
