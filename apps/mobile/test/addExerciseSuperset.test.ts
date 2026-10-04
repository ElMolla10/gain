import { describe, expect, it } from "vitest";
import { joinSuperset, leaveSuperset, orderSlots, restAfterSet, supersetLabels, type StateMap } from "../src/logic/superset";
import { ExerciseAlreadyInWorkout } from "../src/db/workoutRepo";
import { LATEST_VERSION } from "../src/db/migrations";
import { freshDb } from "./helpers";

const prog = ["a", "b", "c", "d"];
const st = (o: StateMap): StateMap => o;

describe("order, superset labels and rest (pure)", () => {
  it("program order, then added exercises in the order they were added; removed ones are left out", () => {
    const s = st({ x: { slot: "x", added: true, position: 2 }, y: { slot: "y", added: true, position: 1 }, b: { slot: "b", removed: true } });
    expect(orderSlots(prog, s)).toEqual(["a", "c", "d", "y", "x"]);
  });
  it("superset members are shown together at the place of the first member", () => {
    const s = st({ a: { slot: "a", superset: "g" }, d: { slot: "d", superset: "g" } });
    expect(orderSlots(prog, s)).toEqual(["a", "d", "b", "c"]);
    expect(supersetLabels(orderSlots(prog, s), s)).toEqual({ a: "A", d: "A" });
  });
  it("a group with only one shown member is not a superset (removing the partner dissolves it)", () => {
    const s = st({ a: { slot: "a", superset: "g" }, d: { slot: "d", superset: "g", removed: true } });
    expect(orderSlots(prog, s)).toEqual(["a", "b", "c"]);
    expect(supersetLabels(orderSlots(prog, s), s)).toEqual({});
    expect(restAfterSet(orderSlots(prog, s), s, "a")).toBe(true);
  });
  it("two supersets get letters A and B; a tri-set works", () => {
    const s = st({ a: { slot: "a", superset: "g1" }, b: { slot: "b", superset: "g1" }, c: { slot: "c", superset: "g2" }, d: { slot: "d", superset: "g2" } });
    expect(supersetLabels(orderSlots(prog, s), s)).toEqual({ a: "A", b: "A", c: "B", d: "B" });
    const tri = st({ a: { slot: "a", superset: "g" }, b: { slot: "b", superset: "g" }, d: { slot: "d", superset: "g" } });
    expect(orderSlots(prog, tri)).toEqual(["a", "b", "d", "c"]);
  });
  it("joinSuperset creates a group or extends the first one; leaving takes one out", () => {
    expect(joinSuperset({}, "a", "c")).toEqual({ a: "ss-a", c: "ss-a" });
    const s = st({ a: { slot: "a", superset: "ss-a" }, c: { slot: "c", superset: "ss-a" } });
    expect(joinSuperset(s, "a", "d")).toEqual({ d: "ss-a" }); // a tri-set: only d changes
    expect(joinSuperset(s, "c", "c")).toEqual({});
    expect(leaveSuperset("c")).toEqual({ c: null });
  });
  it("rest only starts after the last exercise of a round; plain exercises always rest", () => {
    const s = st({ a: { slot: "a", superset: "g" }, d: { slot: "d", superset: "g" } });
    const o = orderSlots(prog, s);
    expect(restAfterSet(o, s, "a")).toBe(false);
    expect(restAfterSet(o, s, "d")).toBe(true);
    expect(restAfterSet(o, s, "b")).toBe(true);
  });
});

async function open() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const gymId = (await ctx.repos.getActiveGymId())!;
  const gym = await ctx.repos.loadGymFingerprint(gymId);
  const next = (await ctx.repos.getNextDay())!;
  const exs = await ctx.repos.listDayExercises(next.day.id);
  const { id } = await ctx.workout.startOrResumeSession(next.day.id, gymId);
  const lib = await ctx.programmes.listExercises();
  const inDay = new Set(exs.map((e) => e.exerciseId));
  const outside = lib.filter((l) => !inDay.has(l.id));
  return { ...ctx, gymId, gym, next, exs, id, outside };
}

describe("add an exercise that is not in today's day", () => {
  it("migration 7 exists and the new columns have safe defaults", async () => {
    const { db } = await open();
    expect(LATEST_VERSION).toBeGreaterThanOrEqual(7);
    const cols = (await db.all<{ name: string }>("PRAGMA table_info(session_exercise)")).map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(["added", "position", "superset_group"]));
  });

  it("adds it with plain defaults, logs sets for it, keeps the program unchanged, shows it in the finish summary", async () => {
    const { workout, repos, finish, id, outside, next, exs, gym, db } = await open();
    const x = outside[0]!;
    expect(await workout.addExercise(id, x.id)).toEqual({ restored: false });
    expect(await workout.listExerciseState(id)).toEqual([{ slot: x.id, removed: false, replacedBy: null, note: "", restOff: false, added: true, position: 1, superset: null }]);
    const ad = (await repos.adHocDayExercise(x.id))!;
    expect(ad).toMatchObject({ exerciseId: x.id, sets: 3, isGoalLift: false, trackEffort: false });
    expect(ad.repMin).toBeLessThanOrEqual(ad.repMax);
    const r = await workout.logSet({ sessionId: id, exerciseId: x.id, load: 20, reps: 12 }, { gym, equipment: ad.equipment, setup: ad.setup });
    expect(r.created).toBe(true);
    // the program day is untouched
    expect((await repos.listDayExercises(next.day.id)).map((e) => e.exerciseId)).toEqual(exs.map((e) => e.exerciseId));
    // finish: the summary lists it, and no next-session target is invented for it
    await workout.finishSession(id);
    const sum = await finish.summarizeSession(id);
    expect(sum.exercises.map((e) => e.exerciseId)).toContain(x.id);
    const targets = await db.all<{ exercise_id: string }>("SELECT t.exercise_id FROM target t WHERE t.deleted_at IS NULL");
    expect(targets.map((t) => t.exercise_id)).not.toContain(x.id);
  });

  it("refuses an exercise already in the workout; a removed added exercise comes back with its position", async () => {
    const { workout, id, outside, exs } = await open();
    await expect(workout.addExercise(id, exs[0]!.exerciseId)).rejects.toBeInstanceOf(ExerciseAlreadyInWorkout);
    const [x, y] = outside;
    await workout.addExercise(id, x!.id);
    await expect(workout.addExercise(id, x!.id)).rejects.toBeInstanceOf(ExerciseAlreadyInWorkout);
    await workout.addExercise(id, y!.id);
    await workout.removeExercise(id, x!.id, x!.id);
    expect(await workout.addExercise(id, x!.id)).toEqual({ restored: true });
    const states = await workout.listExerciseState(id);
    expect(states.map((s) => [s.slot, s.position, s.removed])).toEqual([[x!.id, 1, false], [y!.id, 2, false]]);
  });

  it("an exercise swapped in for a slot cannot also be added, and an added one cannot be swapped in", async () => {
    const { workout, id, outside, exs } = await open();
    const [x, y] = outside;
    await workout.replaceExercise(id, exs[0]!.exerciseId, exs[0]!.exerciseId, x!.id);
    await expect(workout.addExercise(id, x!.id)).rejects.toBeInstanceOf(ExerciseAlreadyInWorkout);
    await workout.addExercise(id, y!.id);
    await expect(workout.replaceExercise(id, exs[1]!.exerciseId, exs[1]!.exerciseId, y!.id)).rejects.toBeInstanceOf(ExerciseAlreadyInWorkout);
  });

  it("only an open workout accepts an added exercise", async () => {
    const { workout, id, outside } = await open();
    await workout.finishSession(id);
    await expect(workout.addExercise(id, outside[0]!.id)).rejects.toThrow();
  });

  it("an added exercise keeps its history as its own line, so a later session of any day can use it", async () => {
    const { workout, repos, id, outside, gym } = await open();
    const x = outside[0]!;
    await workout.addExercise(id, x.id);
    const ad = (await repos.adHocDayExercise(x.id))!;
    await workout.logSet({ sessionId: id, exerciseId: x.id, load: 30, reps: 10 }, { gym, equipment: ad.equipment, setup: ad.setup });
    await workout.finishSession(id);
    const { proposal } = await workout.liveProposal({ exerciseId: x.id, equipment: ad.equipment, setup: ad.setup, repMin: ad.repMin, repMax: ad.repMax, repCeiling: ad.repCeiling, isGoalLift: false, trackEffort: false, sets: 3 }, gym);
    expect(proposal.status).not.toBe("no_history");
  });
});

describe("supersets are saved per workout", () => {
  it("setSuperset stores the group for both exercises and clears it; the program is untouched", async () => {
    const { workout, id, exs } = await open();
    const [a, b] = [exs[0]!.exerciseId, exs[1]!.exerciseId];
    await workout.setSuperset(id, joinSuperset({}, a, b));
    const s = await workout.listExerciseState(id);
    expect(s.map((x) => [x.slot, x.superset]).sort()).toEqual([[a, "ss-" + a], [b, "ss-" + a]].sort());
    await workout.setSuperset(id, leaveSuperset(b));
    expect((await workout.listExerciseState(id)).find((x) => x.slot === b)!.superset).toBeNull();
  });
});

describe("CSV export carries failure sets and supersets", () => {
  it("writes set_type failure/dropset and one superset_id per superset, and the Hevy parser reads them back", async () => {
    const { workout, repos, data, id, exs, gym, next, deps } = await open();
    const [a, b, c] = exs;
    const ctxOf = (e: typeof a) => ({ gym, equipment: e!.equipment, setup: e!.setup });
    await workout.setSuperset(id, joinSuperset({}, a!.exerciseId, b!.exerciseId));
    await workout.logSet({ sessionId: id, exerciseId: a!.exerciseId, load: 60, reps: 8, tags: ["failure"] }, ctxOf(a));
    deps.tick(10);
    await workout.logSet({ sessionId: id, exerciseId: a!.exerciseId, load: 40, reps: 10, tags: ["drop"] }, ctxOf(a));
    deps.tick(10);
    await workout.logSet({ sessionId: id, exerciseId: b!.exerciseId, load: 30, reps: 12 }, ctxOf(b));
    deps.tick(10);
    await workout.logSet({ sessionId: id, exerciseId: c!.exerciseId, load: 20, reps: 12 }, ctxOf(c));
    deps.tick(1000);
    await workout.finishSession(id);
    void repos; void next;
    const csv = await data.exportCsv();
    const lines = csv.trim().split("\n").slice(1).map((l) => l.match(/"(?:[^"]|"")*"|[^,]+|(?<=,)(?=,)/g)!);
    const types = lines.map((l) => l[8]);
    expect(types).toEqual(['"failure"', '"dropset"', '"normal"', '"normal"']);
    const ssCol = lines.map((l) => l[5]);
    expect(ssCol[0]).toBe(ssCol[2]); // a and b are one superset
    expect(ssCol[0]).not.toBe("");
    expect(ssCol[3]).toBe(""); // c is not in one
    const { parseImport } = await import("@gain/engine");
    const parsed = parseImport(csv);
    const exercises = parsed.workouts[0]!.exercises;
    expect(exercises.find((e) => e.sets.some((s) => s.tags?.includes("failure")))).toBeTruthy();
  });
});
