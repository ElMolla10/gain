import { describe, expect, it } from "vitest";
import { DELOAD_SETTING } from "../src/db/deloadRepo";
import { reduceDraftSetsByOne } from "../src/logic/programmeDraft";
import { freshDb } from "./helpers";

describe("reduceDraftSetsByOne", () => {
  it("drops one set on every exercise and keeps a floor of 1", () => {
    const d = reduceDraftSetsByOne({
      name: "P",
      days: [{ name: "A", exercises: [{ exerciseId: "a", sets: 3, repMin: 6, repMax: 10, repCeiling: null, isGoalLift: false, trackEffort: false }, { exerciseId: "b", sets: 1, repMin: 8, repMax: 12, repCeiling: null, isGoalLift: false, trackEffort: false }] }],
    });
    expect(d.days[0]!.exercises.map((e) => e.sets)).toEqual([2, 1]);
  });
});

describe("deloadRepo", () => {
  it("does not suggest after one session, writes nothing until the lifter confirms, and load-apply is a setting", async () => {
    const { deload, repos } = await freshDb();
    expect(await deload.getState()).toEqual({ status: "none" });
    await deload.dismiss();
    const rec = JSON.parse((await repos.getSetting(DELOAD_SETTING))!);
    expect(rec.status).toBe("dismissed");
    await deload.undo();
    expect(await repos.getSetting(DELOAD_SETTING)).toBe("");
    const load = await deload.applyLoad();
    expect(load.status).toBe("load");
    expect(await deload.loadActive()).toBe(true);
  });
});
