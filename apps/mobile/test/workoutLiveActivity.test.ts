import { describe, expect, it } from "vitest";
import { createWorkoutLiveActivityController, type WorkoutActivityInstance } from "../src/logic/workoutLiveActivityController";
import type { WorkoutActivityProps } from "../src/logic/workoutActivityModel";

const base: WorkoutActivityProps = { v: 1, title: "Workout", timerStart: 1000, pausedAt: null, pausedLabel: null, exercise: "Bench press", setLine: "Set 1 of 3", detail: "80 kg × 8", rest: null, rtl: false };
const resting = { ...base, setLine: "Set 2 of 3", rest: { startedAt: 1000, endsAt: 61000, label: "Rest timer" } };

function harness(existing: WorkoutActivityInstance[] = [], legacy: { end(p: "immediate"): Promise<void> }[] = []) {
  const events: unknown[] = [];
  const instance: WorkoutActivityInstance = {
    async update(props, staleDate) { events.push(["update", props.setLine, staleDate?.getTime()]); },
    async end(policy) { events.push(["end", policy]); existing = existing.filter((i) => i !== instance); },
  };
  const controller = createWorkoutLiveActivityController(() => ({
    getInstances: () => existing,
    start(props, _url, staleDate) { events.push(["start", props.setLine, staleDate?.getTime()]); existing = [instance]; return instance; },
    legacy: { getInstances: () => legacy },
  }));
  return { controller, events };
}

describe("workout Live Activity lifecycle", () => {
  it("starts once, dedupes identical content, updates on change; staleDate is the rest end only while resting", async () => {
    const { controller, events } = harness();
    await controller.sync(base);
    await controller.sync(base);
    await controller.sync(resting);
    await controller.sync({ ...resting, rest: null });
    expect(events).toEqual([["start", "Set 1 of 3", undefined], ["update", "Set 2 of 3", 61000], ["update", "Set 2 of 3", undefined]]);
  });
  it("stop ends workout and legacy rest cards; sync(null) ends the card", async () => {
    const ended: string[] = [];
    const { controller, events } = harness([], [{ end: async () => { ended.push("legacy"); } }]);
    await controller.sync(base);
    await controller.stop();
    expect(events.at(-1)).toEqual(["end", "immediate"]);
    expect(ended).toContain("legacy");
    const h = harness();
    await h.controller.sync(base);
    await h.controller.sync(null);
    expect(h.events.at(-1)).toEqual(["end", "immediate"]);
  });
  it("reconcile ends everything without an open session and keeps the card with one", async () => {
    const a = harness();
    await a.controller.sync(base);
    await a.controller.reconcile(async () => true);
    expect(a.events.map((e) => (e as string[])[0])).toEqual(["start"]);
    await a.controller.reconcile(async () => false);
    expect(a.events.at(-1)).toEqual(["end", "immediate"]);
  });
  it("removes duplicate cards after relaunch", async () => {
    const events: string[] = [];
    const first: WorkoutActivityInstance = { update: async () => { events.push("update"); }, end: async () => { events.push("end-first"); } };
    const dup: WorkoutActivityInstance = { update: async () => {}, end: async () => { events.push("end-dup"); } };
    const { controller } = harness([first, dup]);
    await controller.sync(base);
    expect(events).toEqual(["end-dup", "update"]);
  });
  it("serializes native calls so a late sync cannot resurrect a stopped card", async () => {
    const { controller, events } = harness();
    await Promise.all([controller.sync(base), controller.sync(resting), controller.stop()]);
    expect(events.map((e) => (e as string[])[0])).toEqual(["start", "update", "end"]);
  });
  it("contains unavailable modules, permission failures and native rejections", async () => {
    for (const load of [() => null, () => { throw Error("module unavailable"); }, () => ({ getInstances: () => [], start: () => { throw Error("not authorized"); } })]) {
      const c = createWorkoutLiveActivityController(load);
      await expect(c.sync(base)).resolves.toBeUndefined();
      await expect(c.reconcile(async () => { throw Error("db"); })).resolves.toBeUndefined();
      await expect(c.stop()).resolves.toBeUndefined();
    }
    let ends = 0;
    const c = createWorkoutLiveActivityController(() => ({
      getInstances: () => [{ update: async () => { throw Error("x"); }, end: async () => { ends++; throw Error("x"); } }],
      start: () => { throw Error("unexpected start"); },
    }));
    await expect(c.sync(base)).resolves.toBeUndefined();
    await expect(c.stop()).resolves.toBeUndefined();
    expect(ends).toBeGreaterThan(0);
  });
});
