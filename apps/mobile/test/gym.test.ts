import { isGymLoad, findSpec, roundToGymLoad, type GymLoadSpec } from "@gain/engine";
import { describe, expect, it } from "vitest";
import { cleanSpec, listJumps, parseNumber, parseNumberList, rangeLoads, validateGym } from "../src/logic/gymInput";
import { GymInvalid } from "../src/db/gymRepo";
import { freshDb } from "./helpers";

describe("typed numbers", () => {
  it("parses plain, decimal and Arabic-Indic numbers; refuses anything else", () => {
    expect(parseNumber("22.5")).toBe(22.5);
    expect(parseNumber("٢٢٫٥")).toBe(22.5);
    expect(parseNumber(" 20 ")).toBe(20);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("12abc")).toBeNull();
    expect(parseNumber("-5")).toBeNull();
    expect(parseNumber("1,5")).toBeNull();
  });
  it("splits a list on commas, Arabic commas, semicolons and spaces; sorts; de-duplicates; reports junk", () => {
    expect(parseNumberList("20, 22.5 25;27.5،30 20")).toEqual({ values: [20, 22.5, 25, 27.5, 30], invalid: [] });
    expect(parseNumberList("5 x 10 ١٢٫٥")).toEqual({ values: [5, 10, 12.5], invalid: ["x"] });
    expect(parseNumberList("")).toEqual({ values: [], invalid: [] });
  });
  it("range helper fills a rack as a starting point and is capped", () => {
    expect(rangeLoads(5, 10, 2.5)).toEqual([5, 7.5, 10]);
    expect(rangeLoads(10, 5, 2.5)).toEqual([]);
    expect(rangeLoads(1, 100, 0)).toEqual([]);
    expect(rangeLoads(0, 1_000_000, 0.001)).toHaveLength(300);
  });
  it("shows the jumps between neighbouring dumbbells", () => {
    expect(listJumps([20, 22.5, 25, 30])).toEqual([2.5, 2.5, 5]);
  });
});

describe("gym validation", () => {
  const ok = [{ equipment: "dumbbell" as const, loads: [10, 12.5] }, { equipment: "barbell" as const, increment: 2.5, min: 20, max: 200 }];
  it("accepts a real rack", () => expect(validateGym("Club", ok)).toEqual([]));
  it("needs a name and at least one equipment type", () => {
    expect(validateGym(" ", ok)).toEqual([{ code: "name_empty" }]);
    expect(validateGym("Club", [])).toEqual([{ code: "no_equipment" }]);
  });
  it("catches an empty list, bad increment, bad range and duplicates", () => {
    expect(validateGym("g", [{ equipment: "dumbbell", loads: [] }])).toContainEqual({ code: "list_empty", equipment: "dumbbell" });
    expect(validateGym("g", [{ equipment: "cable", increment: 0 }])).toContainEqual({ code: "increment_bad", equipment: "cable" });
    expect(validateGym("g", [{ equipment: "cable", increment: 5, min: 50, max: 10 }])).toContainEqual({ code: "range_bad", equipment: "cable" });
    expect(validateGym("g", [{ equipment: "cable", increment: 5 }, { equipment: "cable", increment: 2.5 }])).toContainEqual({ code: "duplicate_equipment", equipment: "cable" });
    expect(validateGym("g", [{ equipment: "dumbbell", loads: [-5, 10] }])).toContainEqual({ code: "negative_load", equipment: "dumbbell" });
    expect(validateGym("g", [{ equipment: "cable", increment: 0.001, min: 0, max: 100 }])).toContainEqual({ code: "too_many_rungs", equipment: "cable" });
  });
  it("cleans a spec for storage", () => {
    expect(cleanSpec({ equipment: "dumbbell", loads: [12.5, 10, 10] })).toEqual({ equipment: "dumbbell", loads: [10, 12.5] });
  });
});

const rack = [
  { equipment: "dumbbell" as const, loads: [10, 12.5, 15, 17.5, 20, 22.5, 25] },
  { equipment: "barbell" as const, increment: 1.25, min: 20, max: 200 },
  { equipment: "cable" as const, increment: 5, min: 5, max: 100 },
];

describe("gym repo", () => {
  it("creates a gym with real dumbbell pairs; the fingerprint round-trips and the engine respects it", async () => {
    const { gyms, repos } = await freshDb();
    const id = await gyms.createGym({ name: "Home", loads: rack });
    expect(await repos.getActiveGymId()).toBe(id);
    const fp = await repos.loadGymFingerprint(id);
    const db = findSpec(fp, "dumbbell")!;
    expect(db.loads).toEqual([10, 12.5, 15, 17.5, 20, 22.5, 25]);
    expect(isGymLoad(db, 21)).toBe(false);
    expect(roundToGymLoad(db, 21).load).toBe(20); // nearest real pair (ties and near-ties never invent a 21)
    expect(findSpec(fp, "barbell")!.increment).toBe(1.25);
  });
  it("refuses an invalid gym and writes nothing", async () => {
    const { gyms, db } = await freshDb();
    await expect(gyms.createGym({ name: "", loads: rack })).rejects.toBeInstanceOf(GymInvalid);
    expect(await db.get("SELECT id FROM gym")).toBeNull();
  });
  it("keeps several gyms apart; only one is active", async () => {
    const { gyms, repos, deps } = await freshDb();
    const home = await gyms.createGym({ name: "Home", loads: rack });
    deps.tick();
    const club = await gyms.createGym({ name: "Club", loads: [{ equipment: "dumbbell", loads: [5, 10, 40] }] });
    expect(await repos.getActiveGymId()).toBe(club);
    await gyms.setActiveGym(home);
    const list = await gyms.listGyms();
    expect(list.map((g) => [g.name, g.isActive])).toEqual([["Home", true], ["Club", false]]);
    await expect(gyms.setActiveGym("nope")).rejects.toThrow(/Unknown/);
  });
  it("update replaces loads and soft-deletes equipment that was removed", async () => {
    const { gyms, repos, db } = await freshDb();
    const id = await gyms.createGym({ name: "Home", loads: rack });
    await gyms.updateGym(id, { name: "Home gym", loads: [{ equipment: "dumbbell", loads: [10, 20] }, { equipment: "machine", increment: 10 }] });
    const g = (await gyms.getGym(id))!;
    expect(g.name).toBe("Home gym");
    expect(g.loads.map((l) => l.equipment).sort()).toEqual(["dumbbell", "machine"]);
    expect(g.loads.find((l) => l.equipment === "dumbbell")!.loads).toEqual([10, 20]);
    const removed = await db.all("SELECT deleted_at FROM gym_load WHERE gym_id = ? AND equipment = 'barbell'", [id]);
    expect(removed).toHaveLength(1);
    expect(removed[0]!.deleted_at).not.toBeNull();
    expect((await repos.loadGymFingerprint(id)).loads).toHaveLength(2);
  });
  it("editing the sample gym makes it the lifter's own", async () => {
    const { gyms, repos } = await freshDb();
    await repos.seedIfNeeded();
    const id = (await repos.getActiveGymId())!;
    expect((await gyms.getGym(id))!.isSample).toBe(true);
    await gyms.updateGym(id, { name: "My gym", loads: (await gyms.getGym(id))!.loads });
    expect((await gyms.getGym(id))!.isSample).toBe(false);
  });
  it("copies a rack under a new name without copying history", async () => {
    const { gyms, repos, db } = await freshDb();
    const a = await gyms.createGym({ name: "A", loads: rack });
    const b = await gyms.copyGym(a, "B");
    expect(b).not.toBe(a);
    expect((await gyms.getGym(b))!.loads).toEqual((await gyms.getGym(a))!.loads);
    expect(await repos.getActiveGymId()).toBe(a); // copy does not switch gyms unless asked
    expect(await db.get("SELECT id FROM exercise_line WHERE gym_id = ?", [b])).toBeNull();
  });
  it("cannot delete the active or the only gym; delete is a soft delete", async () => {
    const { gyms, db } = await freshDb();
    const a = await gyms.createGym({ name: "A", loads: rack });
    await expect(gyms.deleteGym(a)).rejects.toThrow(/only gym/);
    const b = await gyms.createGym({ name: "B", loads: rack });
    await expect(gyms.deleteGym(b)).rejects.toThrow(/Switch/);
    await gyms.deleteGym(a);
    expect((await gyms.listGyms()).map((g) => g.id)).toEqual([b]);
    expect((await db.get<{ deleted_at: number | null }>("SELECT deleted_at FROM gym WHERE id = ?", [a]))!.deleted_at).not.toBeNull();
  });
});

describe("planned session follows the gym", () => {
  async function planned() {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    const gymId = (await ctx.repos.getActiveGymId())!;
    const gym = await ctx.repos.loadGymFingerprint(gymId);
    const first = (await ctx.repos.getNextDay())!;
    const exs = await ctx.repos.listDayExercises(first.day.id);
    const { id } = await ctx.workout.startOrResumeSession(first.day.id, gymId);
    const incline = exs.find((e) => e.nameEn === "Incline Dumbbell Press")!;
    for (let i = 0; i < 3; i++) await ctx.workout.logSet({ sessionId: id, exerciseId: incline.exerciseId, load: 20, reps: 8 }, { gym, equipment: incline.equipment, setup: incline.setup });
    ctx.deps.tick();
    await ctx.workout.finishSession(id);
    const next = (await ctx.finish.writeNextSessionTargets(id))!;
    return { ...ctx, gymId, next, incline, first };
  }

  it("editing the rack rewrites proposed targets onto loads that exist", async () => {
    const { gyms, finish, gymId, next, db } = await planned();
    // Lower A has no dumbbell lift; change the cable rack and check the stale proposed targets are replaced, not duplicated.
    const before = await finish.getTargets(next.sessionId);
    expect(before.length).toBeGreaterThan(0);
    const g = (await gyms.getGym(gymId))!;
    await gyms.updateGym(gymId, { name: g.name, loads: g.loads.map((l) => (l.equipment === "machine" ? { equipment: "machine" as const, increment: 10, min: 10, max: 200 } : l)) });
    const after = await finish.getTargets(next.sessionId);
    expect(after).toHaveLength(before.length);
    const live = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM target WHERE session_id = ? AND deleted_at IS NULL", [next.sessionId]);
    expect(live!.n).toBe(before.length);
    const old = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM target WHERE session_id = ? AND deleted_at IS NOT NULL", [next.sessionId]);
    expect(old!.n).toBe(before.length);
  });

  it("an accepted load that no longer exists on the rack is dropped, one that still exists is kept", async () => {
    const ctx = await planned();
    const { gyms, finish, gymId, next } = ctx;
    // Accept a machine target (leg press) after making sure it has a load, then remove that load from the rack.
    const t0 = (await finish.getTargets(next.sessionId)).find((t) => t.nameEn === "Leg Press")!;
    await finish.editTargetLoad(t0.id, 55, await ctx.repos.loadGymFingerprint(gymId), "machine", "free");
    const g = (await gyms.getGym(gymId))!;
    await gyms.updateGym(gymId, { name: g.name, loads: g.loads }); // same rack: edited 55 stays
    expect((await finish.getTargets(next.sessionId)).find((t) => t.nameEn === "Leg Press")!.status).toBe("edited");
    await gyms.updateGym(gymId, { name: g.name, loads: g.loads.map((l) => (l.equipment === "machine" ? { equipment: "machine" as const, increment: 10, min: 10, max: 200 } : l)) });
    const t1 = (await finish.getTargets(next.sessionId)).find((t) => t.nameEn === "Leg Press")!;
    expect(t1.status).toBe("proposed"); // 55 is not a multiple of 10, so the edit was dropped and rewritten
  });

  it("switching gym moves the planned session to the new gym with its own lines", async () => {
    const { gyms, finish, next, db, gymId } = await planned();
    const club = await gyms.createGym({ name: "Club", loads: rack, activate: false });
    await gyms.setActiveGym(club);
    const s = await db.get<{ gym_id: string }>("SELECT gym_id FROM session WHERE id = ?", [next.sessionId]);
    expect(s!.gym_id).toBe(club);
    const targets = await finish.getTargets(next.sessionId);
    expect(targets.length).toBeGreaterThan(0);
    const lines = await db.all<{ gym_id: string }>("SELECT l.gym_id FROM target t JOIN exercise_line l ON l.id = t.line_id WHERE t.session_id = ? AND t.deleted_at IS NULL", [next.sessionId]);
    expect(lines.every((l) => l.gym_id === club)).toBe(true);
    expect(club).not.toBe(gymId);
  });
});

import { emptyForm, formFromLoads, loadsFromForm } from "../src/logic/gymForm";

describe("gym form", () => {
  it("round-trips a saved rack through the form", () => {
    const form = formFromLoads(rack);
    const r = loadsFromForm("Home", form);
    expect(r.problems).toEqual([]);
    expect(r.loads).toEqual(rack);
  });
  it("reads typed text, including Arabic digits", () => {
    const f = emptyForm(["dumbbell", "cable"]);
    f.dumbbell.listText = "٢٠ ٢٢٫٥ 25";
    f.cable.incrementText = "٥";
    const r = loadsFromForm("نادي", f);
    expect(r.problems).toEqual([]);
    expect(r.loads).toEqual([{ equipment: "dumbbell", loads: [20, 22.5, 25] }, { equipment: "cable", increment: 5 }]);
  });
  it("never fills in a default: empty fields are problems", () => {
    const f = emptyForm(["dumbbell", "barbell", "cable"]);
    const r = loadsFromForm("Club", f);
    expect(r.problems).toEqual(
      expect.arrayContaining([{ code: "list_empty", equipment: "dumbbell" }, { code: "increment_bad", equipment: "barbell" }, { code: "min_required", equipment: "barbell" }, { code: "increment_bad", equipment: "cable" }]),
    );
  });
  it("reports junk in a list instead of dropping it", () => {
    const f = emptyForm(["dumbbell"]);
    f.dumbbell.listText = "10 abc 20";
    const r = loadsFromForm("Club", f);
    expect(r.problems).toContainEqual({ code: "number_invalid", equipment: "dumbbell", detail: ["abc"] });
  });
  it("a disabled section is not saved; no equipment at all is a problem", () => {
    const r = loadsFromForm("Club", emptyForm());
    expect(r.problems).toEqual([{ code: "no_equipment" }]);
  });
  it("engine rules still apply (max below min)", () => {
    const f = emptyForm(["cable"]);
    f.cable.incrementText = "5";
    f.cable.minText = "50";
    f.cable.maxText = "10";
    expect(loadsFromForm("Club", f).problems).toContainEqual({ code: "range_bad", equipment: "cable" });
  });
});

import { defaultGymLoads } from "../src/logic/defaultGym";
import { kgToUnit } from "../src/logic/units";

describe("gym editor in pounds (loads stay kg)", () => {
  const kgRack = defaultGymLoads("kg");
  it("shows a kg gym in lb and saves it back to the exact same kilograms when nothing was changed", () => {
    const form = formFromLoads(kgRack, "lb");
    expect(form.barbell.minText).toBe("44.1");
    expect(form.barbell.incrementText).toBe("5.5");
    const r = loadsFromForm("Home", form, "lb", kgRack);
    expect(r.problems).toEqual([]);
    expect(r.loads).toEqual(cleanAll(kgRack));
  });
  it("without the original, lb numbers convert (45 lb bar, 5 lb steps)", () => {
    const f = formFromLoads(defaultGymLoads("lb"), "lb");
    expect(f.barbell).toMatchObject({ minText: "45", incrementText: "5", maxText: "600" });
    const r = loadsFromForm("Home", f, "lb");
    expect(r.problems).toEqual([]);
    const bar = r.loads.find((l) => l.equipment === "barbell")!;
    expect(bar.min).toBe(20.412);
    expect(bar.increment).toBe(2.268);
  });
  it("an edited lb number converts, the others keep their exact kg", () => {
    const f = formFromLoads(kgRack, "lb");
    f.barbell.incrementText = "5";
    const r = loadsFromForm("Home", f, "lb", kgRack);
    const bar = r.loads.find((l) => l.equipment === "barbell")!;
    expect(bar.increment).toBe(2.268);
    expect(bar.min).toBe(20);
  });
  it("dumbbell lists round trip in either unit", () => {
    const lbForm = formFromLoads(defaultGymLoads("lb"), "lb");
    expect(lbForm.dumbbell.listText.startsWith("5, 10, 15")).toBe(true);
    const saved = loadsFromForm("Home", lbForm, "lb").loads.find((l) => l.equipment === "dumbbell")!.loads!;
    expect(saved.map((x) => kgToUnit(x, "lb")).slice(0, 3)).toEqual([5, 10, 15]);
  });
  it("the kg path is unchanged", () => {
    const r = loadsFromForm("Home", formFromLoads(kgRack));
    expect(r.loads).toEqual(cleanAll(kgRack));
  });
});

function cleanAll(specs: GymLoadSpec[]): GymLoadSpec[] {
  return specs.map(cleanSpec);
}
