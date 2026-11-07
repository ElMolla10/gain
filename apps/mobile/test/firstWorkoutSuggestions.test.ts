import React, { type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freshDb } from "./helpers";
import { createMlEvaluationRepo } from "../src/db/mlEvaluationRepo";
import { translate } from "../src/i18n/format";
import { useWorkoutSession, type WorkoutSession } from "../src/hooks/useWorkoutSession";
import { MemoWorkoutSetRow, type WorkoutSetRowProps } from "../src/components/WorkoutSetRow";
import { WorkoutExerciseSection } from "../src/components/WorkoutExerciseSection";
import { REST_KEYS } from "../src/logic/restAlert";

// Run the session hook against the real SQLite repositories on a clean, first-ever workout (no prior session).
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
vi.mock("../src/native/appleHealth", () => ({ appleHealth: { isAvailable: () => false, saveWorkout: async () => "", requestWrite: async () => false, deleteWorkout: async () => undefined } }));
vi.mock("@react-navigation/native", () => ({ useRoute: () => ({ params: { dayId: host.dayId } }), useNavigation: () => ({ dispatch: vi.fn(), goBack: vi.fn() }), StackActions: { push: vi.fn(), replace: vi.fn() } }));
vi.mock("../src/AppContext", () => ({ useServices: () => host.services }));
vi.mock("../src/i18n", () => {
  const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate("en", key, params);
  return { useI18n: () => ({ t, lang: "en", unit: "kg", unitText: "kg", fmt: (kg: number) => String(kg) }) };
});
const recs = vi.hoisted(() => ({ n: 0, unavailable: false }));
vi.mock("../src/logic/liveAdaptation", async (orig) => {
  const actual = await orig<typeof import("../src/logic/liveAdaptation")>();
  return { ...actual, tryLiveRecommendation: (...args: Parameters<typeof actual.tryLiveRecommendation>) => {
    recs.n++;
    if (recs.unavailable) return actual.tryLiveRecommendation(args[0], args[1], args[2], args[3], () => { throw new Error("model unavailable"); }, args[5]);
    return actual.tryLiveRecommendation(...args);
  } };
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

const settleAll = async () => {
  for (let n = 0; n < 3; n++) {
    ready();
    await vi.advanceTimersByTimeAsync(1);
  }
};

/** Set up a fresh database on the first workout: NO completed or prior sessions exist. */
async function firstWorkoutFixture(opts: { restOn?: boolean } = {}) {
  const c = await freshDb();
  await c.repos.seedIfNeeded();
  const day = (await c.repos.getNextDay())!.day;
  if (opts.restOn) await c.repos.setSetting(REST_KEYS.auto, "1");
  host.dayId = day.id;
  host.services = { ...c, mlEvaluation: createMlEvaluationRepo(c.db, c.deps), restAlerts: { cancel: vi.fn(async () => {}), schedule: vi.fn(async () => {}) } };
  render();
  await vi.waitFor(() => { ready(); });
  return c;
}

beforeEach(() => { host.values = []; host.effects = []; host.index = 0; recs.unavailable = false; vi.clearAllMocks(); vi.useFakeTimers(); });
afterEach(() => { host.values.forEach(v => v?.cleanup?.()); vi.useRealTimers(); });

describe("next-set weight suggestions during the very first workout", () => {
  it("log set 1 -> immediately suggests set 2 with ghost values without prior history", async () => {
    const c = await firstWorkoutFixture();
    let s = ready();
    const ex = s.shown[0]!;
    // Exercise has no prior history: info.last is null, info.stored is null
    expect(s.loaded.info[ex.exerciseId]!.last).toBeNull();
    expect(s.loaded.info[ex.exerciseId]!.stored).toBeNull();

    // Lifter chooses and enters weight for set 1: 60 kg x 10 reps
    const row0 = s.rows[ex.exerciseId]![0]!;
    s.patch(ex.exerciseId, row0.key, { load: 60, reps: 10 });
    s = ready();
    await s.logRow(ex, s.rows[ex.exerciseId]![0]!);
    await settleAll();

    s = ready();
    const rows = s.rows[ex.exerciseId]!;
    // Set 1 is saved
    expect(rows[0]!.saved).toBe(true);
    expect(rows[0]!.load).toBe(60);
    expect(rows[0]!.reps).toBe(10);

    // Set 2 immediately receives suggestion:
    const row1 = rows[1]!;
    expect(row1.saved).toBe(false); // A suggestion must not silently count as a logged set!
    expect(row1.load).toBeNull(); // Lifter hasn't typed a load into set 2 yet
    expect(row1.ghostLoad).toBe(60); // Baseline suggested load is 60 kg (from set 1)
    expect(Number.isInteger(row1.ghostReps)).toBe(true);

    // Live suggestion card exists for set 2
    const props = s.exerciseProps(ex, 0)!;
    expect(props.card).toBeDefined();
    expect(props.card!.key).toBe(row1.key);
    expect(props.card!.decision.action).toBe("maintain");
    expect(props.card!.decision.suggestedWeightKg).toBe(60);
    expect(props.card!.decision.reason).toBe("within_range");
    expect(await c.workout.listSessionSets(s.loaded.sessionId)).toHaveLength(1);
    expect((await c.workout.getSession(s.loaded.sessionId))!.status).toBe("in_progress");
    expect(await c.history.listSessions()).toHaveLength(0);

    // "Next set details" is present on TargetLine
    const tree = nodes(WorkoutExerciseSection(props));
    const target = tree.find(n => n.type as unknown === "TargetLine")!;
    expect(target.props.moreLabel).toBe("Next set details");
  });

  it("editing set 1 re-evaluates set 2 suggestion immediately", async () => {
    await firstWorkoutFixture();
    let s = ready();
    const ex = s.shown[0]!;
    const row0 = s.rows[ex.exerciseId]![0]!;
    s.patch(ex.exerciseId, row0.key, { load: 60, reps: 10 });
    s = ready();
    await s.logRow(ex, s.rows[ex.exerciseId]![0]!);
    await settleAll();

    s = ready();
    expect(s.rows[ex.exerciseId]![1]!.ghostLoad).toBe(60);

    // Lifter edits set 1: missed reps (e.g. 4 reps when range is 8-12)
    s.patch(ex.exerciseId, row0.key, { reps: 4 });
    s = ready();
    await s.logRow(ex, s.rows[ex.exerciseId]![0]!); // re-save set 1
    await settleAll();

    s = ready();
    const props = s.exerciseProps(ex, 0)!;
    // Set 2 suggestion re-evaluates to a decrease or maintain lower rung
    expect(props.card).toBeDefined();
    expect(props.card!.key).toBe(s.rows[ex.exerciseId]![1]!.key);
    expect(props.card!.decision.action).toBe("decrease");
    expect(props.card!.decision.suggestedWeightKg).toBeLessThan(60);
    expect(props.card!.decision.reason).toBe("below_range");
    expect(s.rows[ex.exerciseId]![1]!.ghostLoad).toBe(props.card!.decision.suggestedWeightKg);
  });

  it("manually overriding set 2 preserves the lifter's entered load and never overwrites it", async () => {
    await firstWorkoutFixture();
    let s = ready();
    const ex = s.shown[0]!;
    s.patch(ex.exerciseId, s.rows[ex.exerciseId]![0]!.key, { load: 60, reps: 10 });
    s = ready();
    await s.logRow(ex, s.rows[ex.exerciseId]![0]!);
    await settleAll();

    s = ready();
    const row1Key = s.rows[ex.exerciseId]![1]!.key;
    // Lifter overrides set 2 with 65 kg
    s.patch(ex.exerciseId, row1Key, { load: 65, reps: 8 });
    await settleAll();

    s = ready();
    const row1 = s.rows[ex.exerciseId]![1]!;
    expect(row1.load).toBe(65);
    expect(row1.reps).toBe(8);
    expect(row1.saved).toBe(false);
  });

  it("background and resume preserves saved sets and suggestion state", async () => {
    await firstWorkoutFixture();
    let s = ready();
    const ex = s.shown[0]!;
    s.patch(ex.exerciseId, s.rows[ex.exerciseId]![0]!.key, { load: 60, reps: 10 });
    s = ready();
    await s.logRow(ex, s.rows[ex.exerciseId]![0]!);
    await settleAll();

    s = ready();
    // Simulate backgrounding
    native.appState.forEach(fn => fn("background"));
    await settleAll();

    // Simulate resuming
    native.appState.forEach(fn => fn("active"));
    await settleAll();

    s = ready();
    const rows = s.rows[ex.exerciseId]!;
    expect(rows[0]!.saved).toBe(true);
    expect(rows[0]!.load).toBe(60);
    expect(rows[1]!.saved).toBe(false);
    expect(rows[1]!.ghostLoad).toBe(60);
    const props = s.exerciseProps(ex, 0)!;
    expect(props.card?.key).toBe(rows[1]!.key);
  });

  it("logging remaining sets progresses through all planned working sets", async () => {
    await firstWorkoutFixture();
    let s = ready();
    const ex = s.shown[0]!;
    // Set 1
    s.patch(ex.exerciseId, s.rows[ex.exerciseId]![0]!.key, { load: 60, reps: 10 });
    s = ready();
    await s.logRow(ex, s.rows[ex.exerciseId]![0]!);
    await settleAll();

    // Set 2
    s = ready();
    expect(s.rows[ex.exerciseId]![1]!.ghostLoad).toBe(60);
    await s.logRow(ex, s.rows[ex.exerciseId]![1]!);
    await settleAll();

    // Set 3
    s = ready();
    expect(s.rows[ex.exerciseId]![1]!.saved).toBe(true);
    expect(s.rows[ex.exerciseId]![2]!.saved).toBe(false);
    expect(s.rows[ex.exerciseId]![2]!.ghostLoad).toBe(60);
    await s.logRow(ex, s.rows[ex.exerciseId]![2]!);
    await settleAll();

    // All working sets logged
    s = ready();
    expect(s.rows[ex.exerciseId]!.every(r => r.saved)).toBe(true);
    const props = s.exerciseProps(ex, 0)!;
    expect(props.card).toBeUndefined(); // No more adaptive rows
  });

  it("logging a warm-up set does not trigger a working set suggestion", async () => {
    await firstWorkoutFixture();
    let s = ready();
    const ex = s.shown[0]!;
    // Change row 0 to warmup with 30 kg
    s.patch(ex.exerciseId, s.rows[ex.exerciseId]![0]!.key, { warmup: true, load: 30, reps: 10 });
    s = ready();
    await s.logRow(ex, s.rows[ex.exerciseId]![0]!);
    await settleAll();

    s = ready();
    const props = s.exerciseProps(ex, 0)!;
    // Warm-up is not a trusted working set: performance key has no working sets ("[]"),
    // and the warm-up's 30 kg does NOT become the next working set's ghostLoad.
    expect(props.card?.performance).toBe("[]");
    expect(props.card?.starting).toBe(true);
    const nextWorkingRow = s.rows[ex.exerciseId]!.find(r => !r.warmup && !r.saved)!;
    expect(nextWorkingRow.ghostLoad).not.toBe(30);
  });

  it("top set + back-off on first workout leaves back-off set for the lifter to choose", async () => {
    const c = await firstWorkoutFixture();
    // Configure exercise 0 with topSets = 1
    const day = (await c.repos.getNextDay())!.day;
    const exList = await c.repos.listDayExercises(day.id);
    const ex0 = exList[0]!;
    await c.db.run("UPDATE programme_day_exercise SET top_sets = 1 WHERE programme_day_id = ? AND exercise_id = ?", [day.id, ex0.exerciseId]);

    // Re-render
    host.values = [];
    render();
    await vi.waitFor(() => { ready(); });

    let s = ready();
    const ex = s.shown[0]!;
    expect(ex.topSets).toBe(1);

    // Lifter logs set 1 (top set: 100 kg x 8)
    s.patch(ex.exerciseId, s.rows[ex.exerciseId]![0]!.key, { load: 100, reps: 8 });
    s = ready();
    await s.logRow(ex, s.rows[ex.exerciseId]![0]!);
    await settleAll();

    s = ready();
    const rows = s.rows[ex.exerciseId]!;
    expect(rows[0]!.saved).toBe(true);
    // Set 2 is a back-off set. Without prior back-off history, data is insufficient to invent a back-off weight.
    const row1 = rows[1]!;
    expect(row1.saved).toBe(false);
    const props = s.exerciseProps(ex, 0)!;
    // No suggestion card on back-off set without history, leaving the weight for the lifter to choose
    expect(props.card).toBeUndefined();
    expect(row1.ghostLoad).toBeNull();
    expect(row1.load).toBeNull();
  });

  it("bodyweight+added exercise on first workout suggests maintaining added load", async () => {
    const c = await firstWorkoutFixture();
    const day = (await c.repos.getNextDay())!.day;
    // Add a bodyweight+added exercise (Pull-Up) to the day
    await c.db.run(
      "INSERT INTO exercise (id, seed_key, name_en, name_ar, aliases_ar_json, pattern, equipment, setup, is_sample, created_at, updated_at) VALUES ('pullup-test', 'pullup', 'Pull-Up', 'عقلة', '[]', 'vertical_pull', 'plate', 'bodyweight_plus_added', 0, 1, 1)"
    );
    await c.db.run(
      "INSERT INTO programme_day_exercise (id, programme_day_id, exercise_id, position, sets, rep_min, rep_max, rep_ceiling, is_goal_lift, track_effort, created_at, updated_at) VALUES ('pde-pullup', ?, 'pullup-test', 99, 3, 6, 10, 10, 0, 0, 1, 1)",
      [day.id]
    );

    host.values = [];
    render();
    await vi.waitFor(() => { ready(); });

    let s = ready();
    const pullup = s.shown.find(e => e.exerciseId === "pullup-test")!;
    expect(pullup.setup).toBe("bodyweight_plus_added");

    // Lifter logs 0 kg added x 8 reps
    s.patch(pullup.exerciseId, s.rows[pullup.exerciseId]![0]!.key, { load: 0, reps: 8 });
    s = ready();
    await s.logRow(pullup, s.rows[pullup.exerciseId]![0]!);
    await settleAll();

    s = ready();
    const rows = s.rows[pullup.exerciseId]!;
    expect(rows[0]!.saved).toBe(true);
    // Set 2 gets suggestion of 0 kg x 8 reps
    expect(rows[1]!.ghostLoad).toBe(0);
    expect(rows[1]!.ghostReps).toBe(8);
    const props = s.exerciseProps(pullup, s.shown.indexOf(pullup))!;
    expect(props.card).toBeDefined();
    expect(props.card!.decision.action).toBe("maintain");
    expect(props.card!.decision.suggestedWeightKg).toBe(0);
    expect(props.card!.decision.reason).toBe("within_range");
  });

  it("assisted exercise on first workout suggests maintaining assistance load", async () => {
    const c = await firstWorkoutFixture();
    const day = (await c.repos.getNextDay())!.day;
    // Add an assisted exercise
    await c.db.run(
      "INSERT INTO exercise (id, seed_key, name_en, name_ar, aliases_ar_json, pattern, equipment, setup, is_sample, created_at, updated_at) VALUES ('assisted-test', 'pullup', 'Assisted Pull-Up', 'عقلة بمساعدة', '[]', 'vertical_pull', 'assisted', 'assisted', 0, 1, 1)"
    );
    await c.db.run(
      "INSERT INTO programme_day_exercise (id, programme_day_id, exercise_id, position, sets, rep_min, rep_max, rep_ceiling, is_goal_lift, track_effort, created_at, updated_at) VALUES ('pde-assisted', ?, 'assisted-test', 98, 3, 6, 10, 10, 0, 0, 1, 1)",
      [day.id]
    );

    host.values = [];
    render();
    await vi.waitFor(() => { ready(); });

    let s = ready();
    const assisted = s.shown.find(e => e.exerciseId === "assisted-test")!;
    expect(assisted.setup).toBe("assisted");

    // Lifter logs 25 kg assistance x 8 reps
    s.patch(assisted.exerciseId, s.rows[assisted.exerciseId]![0]!.key, { load: 25, reps: 8 });
    s = ready();
    await s.logRow(assisted, s.rows[assisted.exerciseId]![0]!);
    await settleAll();

    s = ready();
    const rows = s.rows[assisted.exerciseId]!;
    expect(rows[0]!.saved).toBe(true);
    // Set 2 gets suggestion of 25 kg assistance
    expect(rows[1]!.ghostLoad).toBe(25);
    expect(rows[1]!.ghostReps).toBe(8);
    const props = s.exerciseProps(assisted, s.shown.indexOf(assisted))!;
    expect(props.card).toBeDefined();
    expect(props.card!.decision.action).toBe("maintain");
    expect(props.card!.decision.suggestedWeightKg).toBe(25);
    expect(props.card!.decision.reason).toBe("within_range");
  });
});

// The direct lifecycle suite isolates recommendation scheduling from Finish and
// historical planning. The production hook and real adapter/policy still run.
import { useWorkoutSuggestions } from "../src/hooks/useWorkoutSuggestions";
import { initialRows, editRow, type SetRowDraft } from "../src/logic/workoutRows";
import type { DayEx, Disp, LoadedWorkout } from "../src/logic/workoutTypes";
import type { SetRow } from "../src/db/workoutRepo";
import type { EquipmentType, GymLoadSpec, SetupType } from "@gain/engine";

function suggestionFixture(options: { equipment?: EquipmentType; setup?: SetupType; load?: number; reps?: number; topSets?: number; saved?: Partial<SetRow>; count?: number; noSaved?: boolean } = {}) {
  const equipment = options.equipment ?? "dumbbell";
  const setup = options.setup ?? "free";
  const load = options.load ?? 24;
  const reps = options.reps ?? 8;
  const spec: GymLoadSpec = { equipment, loads: equipment === "assisted" ? [20, 25, 30, 35] : setup === "bodyweight_plus_added" ? [0, 2.5, 5] : equipment === "barbell" ? [20, 22.5, 25, 27.5, 30] : [20, 22, 24, 26, 28] };
  const ex = { exerciseId: "first-exercise", slot: "first-exercise", nameEn: "First lift", nameAr: "تمرين", seedKey: null, pattern: "horizontal_push", equipment, setup, measure: "reps", sets: options.count ?? 3, repMin: 6, repMax: 10, topSets: options.topSets, loadSpec: spec } as Disp;
  const saved: SetRow = { id: "manual-first", sessionId: "first-workout", exerciseId: ex.exerciseId, lineId: "line", position: 0, load, reps, rir: 2, warmup: false, tags: [], outlierStatus: "none", durationS: null, distanceM: null, createdAt: 1, ...options.saved };
  let nextKey = 0;
  const list = initialRows(options.noSaved ? [] : [saved], options.count ?? 3, { load: null, reps: null }, () => `next-${++nextKey}`);
  const input = {
    loaded: { sessionId: saved.sessionId, resumed: false, startedAt: 1, pausedMs: 0, pausedAt: null, gym: { id: "gym", loads: [spec] }, slots: [ex], info: { [ex.exerciseId]: { last: null, stored: null, prefill: { load: null, reps: null }, proposal: { currency: "none" } } } } as unknown as LoadedWorkout,
    rows: { [ex.exerciseId]: list }, sets: options.noSaved ? [] : [saved], exState: {}, readiness: null,
    makeDisp: (slot: DayEx): Disp => ({ ...slot, slot: slot.exerciseId }),
    setRows: (update: React.SetStateAction<Record<string, SetRowDraft[]>>) => { input.rows = typeof update === "function" ? update(input.rows) : update; },
  };
  const evaluation = { record: vi.fn(async (_prediction: unknown) => {}) };
  const writes = { logSet: vi.fn(), updateLiveSet: vi.fn(), finishSession: vi.fn(), writeNextSessionTargets: vi.fn() };
  host.services = { mlEvaluation: evaluation, workout: writes, finish: writes };
  function draw() {
    host.index = 0;
    const result = useWorkoutSuggestions(input);
    host.effects.splice(0).forEach(effect => effect());
    return result;
  }
  async function settle() {
    draw();
    await vi.advanceTimersByTimeAsync(1);
    const result = draw();
    await vi.advanceTimersByTimeAsync(1);
    return draw();
  }
  return { input, ex, saved, evaluation, writes, draw, settle, next: () => input.rows[ex.exerciseId]!.find(r => !r.saved)! };
}

describe("first-workout suggestion hook scheduling and draft safety", () => {
  it("a just-persisted manual first set supplies the next unsaved ghost without Finish or history", async () => {
    const f = suggestionFixture();
    const before = JSON.stringify(f.input.sets);
    const result = await f.settle();
    const next = f.next();
    expect(result.liveCards[f.ex.exerciseId]).toMatchObject({ key: next.key, decision: { suggestedWeightKg: next.ghostLoad } });
    expect(next).toMatchObject({ saved: false, load: null, reps: null });
    expect(next.ghostLoad).toBeGreaterThan(0);
    expect(Number.isInteger(next.ghostReps)).toBe(true);
    expect(JSON.stringify(f.input.sets)).toBe(before);
    expect(f.input.rows[f.ex.exerciseId]!.filter(r => r.saved)).toHaveLength(1);
    Object.values(f.writes).forEach(write => expect(write).not.toHaveBeenCalled());
  });

  it("uses the current equipment's selectable load steps", async () => {
    for (const equipment of ["dumbbell", "barbell"] as const) {
      host.values.forEach(v => v?.cleanup?.()); host.values = []; host.effects = [];
      const f = suggestionFixture({ equipment, load: equipment === "barbell" ? 25 : 24 });
      const result = await f.settle();
      const decision = result.liveCards[f.ex.exerciseId]!.decision;
      expect(f.ex.loadSpec!.loads).toContain(decision.suggestedWeightKg);
      expect(f.next().ghostLoad).toBe(decision.suggestedWeightKg);
      expect(f.next().saved).toBe(false);
    }
  });

  it("preserves values already typed in the next row", async () => {
    const f = suggestionFixture();
    const key = f.next().key;
    f.input.rows = { [f.ex.exerciseId]: editRow(f.input.rows[f.ex.exerciseId]!, key, { load: 28, reps: 7 }) };
    await f.settle();
    expect(f.next()).toMatchObject({ load: 28, reps: 7, saved: false });
  });

  it("does not overwrite edits made while evaluation capture is pending", async () => {
    const f = suggestionFixture();
    let release!: () => void;
    f.evaluation.record.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    f.draw();
    // Execute the scheduled callback without awaiting its pending async capture.
    vi.advanceTimersByTime(1);
    expect(f.evaluation.record).toHaveBeenCalledOnce();
    const key = f.next().key;
    f.input.rows = { [f.ex.exerciseId]: editRow(f.input.rows[f.ex.exerciseId]!, key, { load: 26, reps: 9 }) };
    f.draw();
    release();
    await Promise.resolve(); await Promise.resolve();
    await f.settle();
    expect(f.next()).toMatchObject({ load: 26, reps: 9, saved: false });
    expect(f.input.sets).toHaveLength(1);
  });

  it.each([
    ["warm-up", { warmup: true }], ["drop", { tags: ["drop"] }],
    ["unconfirmed", { outlierStatus: "unconfirmed" }],
  ] as const)("does not turn a saved %s into the first working-weight recommendation", async (_label, patch) => {
    const f = suggestionFixture({ saved: patch as Partial<SetRow> });
    const result = await f.settle();
    expect(result.liveCards[f.ex.exerciseId]).toBeUndefined();
    expect(f.next().ghostLoad).toBeNull();
    expect(f.evaluation.record).not.toHaveBeenCalled();
  });

  it("does not invent the first weight when no set has been persisted", async () => {
    const f = suggestionFixture({ noSaved: true });
    const result = await f.settle();
    expect(result.liveCards[f.ex.exerciseId]).toBeUndefined();
    expect(f.next()).toMatchObject({ load: null, ghostLoad: null, saved: false });
    expect(f.evaluation.record).not.toHaveBeenCalled();
  });

  it("does not advise another set after the last planned set is saved", async () => {
    const f = suggestionFixture({ count: 1 });
    const result = await f.settle();
    expect(result.liveCards[f.ex.exerciseId]).toBeUndefined();
    expect(f.input.rows[f.ex.exerciseId]).toHaveLength(1);
    expect(f.evaluation.record).not.toHaveBeenCalled();
  });

  it("keeps the observed load as a conservative hold when the model is unavailable", async () => {
    recs.unavailable = true;
    const f = suggestionFixture({ load: 24, reps: 8 });
    const result = await f.settle();
    expect(result.liveCards[f.ex.exerciseId]).toMatchObject({ decision: { action: "maintain", suggestedWeightKg: 24, predictionAvailable: false } });
    expect(f.next()).toMatchObject({ ghostLoad: 24, ghostReps: 8, load: null, reps: null, saved: false });
    Object.values(f.writes).forEach(write => expect(write).not.toHaveBeenCalled());
  });

  it("does not advise a back-off set without previous back-off history", async () => {
    const f = suggestionFixture({ topSets: 1 });
    const result = await f.settle();
    expect(result.liveCards[f.ex.exerciseId]).toBeUndefined();
    expect(f.next().ghostLoad).toBeNull();
    expect(f.next().saved).toBe(false);
  });

  it.each([
    ["assisted", "assisted", 25], ["plate", "bodyweight_plus_added", 0],
  ] as const)("supports %s / %s without historical targets", async (equipment, setup, load) => {
    const f = suggestionFixture({ equipment, setup, load });
    const result = await f.settle();
    expect(result.liveCards[f.ex.exerciseId]).toMatchObject({ decision: { action: "maintain", suggestedWeightKg: load, predictionAvailable: false } });
    expect(f.next()).toMatchObject({ ghostLoad: load, ghostReps: 8, load: null, reps: null, saved: false });
  });
});
