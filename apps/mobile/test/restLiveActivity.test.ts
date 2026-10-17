import { describe, expect, it } from "vitest";
import { createRestLiveActivityController, type RestActivityProps, type RestActivityInstance } from "../src/logic/restLiveActivityController";

function harness(existing: RestActivityInstance[] = []) {
  const events: unknown[] = [];
  const instance: RestActivityInstance = {
    async update(props, staleDate) { events.push(["update", props, staleDate?.getTime()]); },
    async end(policy) { events.push(["end", policy]); },
  };
  const controller = createRestLiveActivityController(() => ({
    getInstances: () => existing,
    start(props, _url, staleDate) { events.push(["start", props, staleDate?.getTime()]); existing = [instance]; return instance; },
  }), () => 1000);
  return { controller, events };
}
const rest = { endsAt: 61000, durationMs: 60000, label: "Bench press", restLabel: "Rest" };

describe("rest Live Activity lifecycle", () => {
  it("starts once, avoids redundant updates, updates extensions and ends immediately", async () => {
    const { controller, events } = harness();
    await controller.sync(rest);
    await controller.sync(rest);
    await controller.sync({ ...rest, endsAt: 91000, durationMs: 90000 });
    await controller.stop();
    expect(events).toEqual([
      ["start", { endsAt: 61000, startedAt: 1000, label: "Bench press", restLabel: "Rest" }, 61000],
      ["update", { endsAt: 91000, startedAt: 1000, label: "Bench press", restLabel: "Rest" }, 91000],
      ["end", "immediate"],
    ]);
  });
  it("recovers an existing activity and removes duplicate activities after app relaunch", async () => {
    const events: string[] = [];
    const active = { update: async (_: RestActivityProps) => { events.push("update"); }, end: async () => { events.push("end-active"); } };
    const instances: RestActivityInstance[] = [active];
    const duplicate = { update: async () => {}, end: async () => { events.push("end-duplicate"); instances.splice(instances.indexOf(duplicate), 1); } };
    instances.push(duplicate);
    const { controller } = harness(instances);
    await controller.sync(rest);
    await controller.sync({ ...rest, endsAt: null });
    expect(events).toEqual(["end-duplicate", "update", "end-active"]);
  });
  it("treats elapsed timers as stopped and never starts invalid timers", async () => {
    const { controller, events } = harness();
    await controller.sync({ ...rest, endsAt: 900 });
    await controller.sync({ ...rest, durationMs: NaN });
    expect(events).toEqual([]);
  });
  it("silently handles unsupported native modules and native permission failures", async () => {
    for (const load of [() => null, () => { throw Error("module unavailable"); }, () => ({ getInstances: () => [], start: () => { throw Error("not authorized"); } })]) {
      const controller = createRestLiveActivityController(load, () => 1000);
      await expect(controller.sync(rest)).resolves.toBeUndefined();
      await expect(controller.stop()).resolves.toBeUndefined();
    }
  });
  it("serializes native updates so a late update cannot resurrect a stopped rest", async () => {
    const { controller, events } = harness();
    await Promise.all([controller.sync(rest), controller.sync({ ...rest, endsAt: 91000 }), controller.stop()]);
    expect(events.map((e) => (e as string[])[0])).toEqual(["start", "update", "end"]);
  });
  it("contains update and end rejection without poisoning subsequent operations", async () => {
    let ends = 0;
    const controller = createRestLiveActivityController(() => ({
      getInstances: () => [{ update: async () => { throw Error("unavailable"); }, end: async () => { ends++; throw Error("unavailable"); } }],
      start: () => { throw Error("unexpected start"); },
    }), () => 1000);
    await expect(controller.sync(rest)).resolves.toBeUndefined();
    await expect(controller.stop()).resolves.toBeUndefined();
    expect(ends).toBeGreaterThan(0);
  });
});
