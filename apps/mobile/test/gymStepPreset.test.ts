import { describe, expect, it } from "vitest";
import { nextLoadAbove } from "@gain/engine";
import { defaultGymLoads } from "../src/logic/defaultGym";
import { gridFor } from "../src/db/exerciseGrid";
import { dumbbellPairs, presetForExercise } from "../src/logic/gymStepPreset";
import { freshDb } from "./helpers";

describe("gym weight setup", () => {
  it("uses two-kilo dumbbells, skips 26, and distinguishes plate machines from pin stacks and weighted pull-ups", () => {
    expect(dumbbellPairs.slice(10, 15)).toEqual([22, 24, 28, 30, 32]);
    expect(presetForExercise("Bench Press (Barbell)", "barbell")?.increment).toBe(10);
    expect(presetForExercise("Barbell Bench Press", "barbell")?.increment).toBe(10);
    expect(presetForExercise("Shoulder Press (Machine Plates)", "machine")?.increment).toBe(10);
    expect(presetForExercise("Leg Press (Plate Loaded)", "machine")?.increment).toBe(10);
    expect(presetForExercise("Leg Extension (Machine)", "machine")).toBeNull();
    expect(presetForExercise("Pull-Up (Weighted)", "plate")).toBeNull();
  });

  it("applies the rack once, preserves individual choices, and leaves other gym grids alone", async () => {
    const s = await freshDb();
    await s.repos.seedIfNeeded();
    await s.repos.topUpLibrary();
    const id = await s.gyms.createGym({ name: "My gym", loads: defaultGymLoads("kg"), activate: true });
    const bench = (await s.db.get<{ id: string }>("SELECT id FROM exercise WHERE name_en = 'Barbell Bench Press'"))!;
    const plate = (await s.db.get<{ id: string }>("SELECT id FROM exercise WHERE name_en = 'Shoulder Press (Machine Plates)'"))!;
    const pin = (await s.db.get<{ id: string }>("SELECT id FROM exercise WHERE name_en = 'Machine Chest Press'"))!;
    const curl = (await s.db.get<{ id: string }>("SELECT id FROM exercise WHERE name_en = 'Preacher Curl (Dumbbell)'"))!;
    await s.programmes.setExerciseLoads(curl.id, { equipment: "dumbbell", loads: [12, 14, 16] });
    const result = await s.gyms.applyLoadStepPreset();
    expect(result.exercises).toBeGreaterThan(1);
    const gym = (await s.gyms.getGym(id))!;
    const db = gym.loads.find((x) => x.equipment === "dumbbell")!;
    expect(nextLoadAbove(db, 14)).toBe(16);
    expect(nextLoadAbove(db, 24)).toBe(28);
    expect(gym.loads.find((x) => x.equipment === "machine")?.increment).toBe(5);
    expect(gym.loads.find((x) => x.equipment === "plate")?.increment).toBe(2.5);
    const benchSpec = (await s.repos.getExerciseLoads(bench.id))!.spec!;
    expect(benchSpec).toMatchObject({ increment: 10, min: 20 });
    expect(nextLoadAbove(benchSpec, 70)).toBe(80);
    expect((await s.repos.getExerciseLoads(plate.id))!.spec).toMatchObject({ increment: 10, min: 10 });
    expect((await s.repos.getExerciseLoads(pin.id))!.spec).toBeNull();
    expect((await s.repos.getExerciseLoads(curl.id))!.spec?.loads).toEqual([12, 14, 16]);
    expect((await s.gyms.applyLoadStepPreset()).exercises).toBe(0);
  });

  it("lets a machine be declared plate-loaded or pin-loaded regardless of its name", async () => {
    const s = await freshDb();
    await s.repos.seedIfNeeded();
    await s.repos.topUpLibrary();
    const gymId = await s.gyms.createGym({ name: "My gym", loads: defaultGymLoads("kg"), activate: true });
    const gym = { ...(await s.gyms.getGym(gymId))!, gymId };
    const generic = (await s.db.get<{ id: string }>("SELECT id FROM exercise WHERE name_en = 'Machine Chest Press'"))!;
    const namedPlate = (await s.db.get<{ id: string }>("SELECT id FROM exercise WHERE name_en = 'Shoulder Press (Machine Plates)'"))!;
    await s.programmes.setMachineLoadKind(generic.id, "plate");
    expect((await s.programmes.listExercises()).find(e => e.id === generic.id)?.machineLoadKind).toBe("plate");
    expect(nextLoadAbove((await gridFor(s.db, gym, generic.id, "machine"))!, 50)).toBe(60);
    await s.programmes.setMachineLoadKind(generic.id, "pin");
    expect(nextLoadAbove((await gridFor(s.db, gym, generic.id, "machine"))!, 50)).toBe(55);
    expect((await s.repos.getExerciseLoads(generic.id))?.spec?.increment).toBe(5);
    await s.db.run("UPDATE gym_load SET increment = 7.5 WHERE gym_id = ? AND equipment = 'machine'", [gymId]);
    const customGym = { ...(await s.gyms.getGym(gymId))!, gymId };
    expect(nextLoadAbove((await gridFor(s.db, customGym, generic.id, "machine"))!, 50)).toBe(55);
    await s.programmes.setMachineLoadKind(namedPlate.id, "pin");
    await s.gyms.applyLoadStepPreset();
    expect((await s.programmes.listExercises()).find(e => e.id === namedPlate.id)?.machineLoadKind).toBe("pin");
    expect(nextLoadAbove((await gridFor(s.db, gym, namedPlate.id, "machine"))!, 50)).toBe(55);
    await s.programmes.setMachineLoadKind(generic.id, "plate");
    await s.programmes.setExerciseLoads(generic.id, { equipment: "machine", loads: [20, 30, 45] });
    expect((await s.programmes.listExercises()).find(e => e.id === generic.id)?.machineLoadKind).toBe("plate");
    expect((await s.repos.getExerciseLoads(generic.id))?.spec?.loads).toEqual([20, 30, 45]);
  });
});
