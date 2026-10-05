import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Db } from "../src/db/driver";
import { LATEST_VERSION, migrate } from "../src/db/migrations";
import { createRepos } from "../src/db/repos";
import { createWorkoutRepo, ExerciseAlreadyInWorkout } from "../src/db/workoutRepo";
import { applyMovePositions, buildMoveActions, completedWorkoutSlots, joinSuperset, leaveSuperset, moveWorkoutSlot, orderSlots, restAfterSet, supersetLabels, type SlotState, type StateMap } from "../src/logic/superset";
import { freshDb, testDeps } from "./helpers";
import { openNodeDb } from "./nodeDriver";

const prog = ["a", "b", "c", "d"];
const st = (o: StateMap): StateMap => o;

describe("order, superset labels and rest (pure)", () => {
  it("program order, then added exercises in the order they were added; removed ones are left out", () => {
    const s = st({ x: { slot: "x", added: true, position: 2 }, y: { slot: "y", added: true, position: 1 }, b: { slot: "b", removed: true } });
    expect(orderSlots(prog, s)).toEqual(["a", "c", "d", "y", "x"]);
  });
  it("uses a saved session order for programme and added exercises", () => {
    const s = st({
      a: { slot: "a", position: 2 },
      b: { slot: "b", position: 3 },
      c: { slot: "c", position: 1 },
      x: { slot: "x", added: true, position: 4 },
    });
    expect(orderSlots(["a", "b", "c"], s)).toEqual(["c", "a", "b", "x"]);
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

  it("moves an uncompleted exercise one place up or down", () => {
    expect(moveWorkoutSlot(["a", "b", "c"], {}, new Set(), "b", "up")).toEqual({ order: ["b", "a", "c"], outcome: "moved" });
    expect(moveWorkoutSlot(["a", "b", "c"], {}, new Set(), "b", "down")).toEqual({ order: ["a", "c", "b"], outcome: "moved" });
  });

  it("does not move a slot classified as completed", () => {
    expect(moveWorkoutSlot(["a", "b", "c"], {}, new Set(["b"]), "b", "up")).toEqual({ order: ["a", "b", "c"], outcome: "completed" });
  });

  it("moves an uncompleted superset as one block and locks it when either member is completed", () => {
    const states = st({ b: { slot: "b", superset: "g" }, c: { slot: "c", superset: "g" } });
    expect(moveWorkoutSlot(["a", "b", "c", "d"], states, new Set(), "c", "down")).toEqual({ order: ["a", "d", "b", "c"], outcome: "moved" });
    expect(moveWorkoutSlot(["a", "b", "c", "d"], states, new Set(["b"]), "c", "down")).toEqual({ order: ["a", "b", "c", "d"], outcome: "completed" });
  });

  it("builds only valid one-hand move actions with exercise-specific TalkBack labels", () => {
    const copy = {
      up: "Move up",
      down: "Move down",
      accessibilityLabel: (direction: "up" | "down") => `Move Bench Press ${direction}`,
    };
    expect(buildMoveActions(["a", "b", "c"], {}, new Set(), "b", copy)).toEqual([
      { direction: "up", label: "Move up", accessibilityLabel: "Move Bench Press up" },
      { direction: "down", label: "Move down", accessibilityLabel: "Move Bench Press down" },
    ]);
    expect(buildMoveActions(["a", "b", "c"], {}, new Set(), "a", copy).map((action) => action.direction)).toEqual(["down"]);
    expect(buildMoveActions(["a", "b", "c"], {}, new Set(), "c", copy).map((action) => action.direction)).toEqual(["up"]);
    expect(buildMoveActions(["a", "b", "c"], {}, new Set(["c"]), "c", copy)).toEqual([]);
  });

  it("keeps the displayed order equal to the saved order, including after a superset block moves", () => {
    const blank = (slot: string): SlotState => ({ slot, removed: false, added: false, position: null, superset: null });
    const programme = ["a", "b", "c", "d"];
    const states: Record<string, SlotState | undefined> = {
      b: { slot: "b", removed: false, added: false, position: null, superset: "g" },
      c: { slot: "c", removed: false, added: false, position: null, superset: "g" },
    };
    const moved = moveWorkoutSlot(orderSlots(programme, states), states, new Set(), "c", "down");
    expect(moved).toEqual({ order: ["a", "d", "b", "c"], outcome: "moved" });
    const shown = orderSlots(programme, applyMovePositions(states, moved.order, blank));
    expect(shown).toEqual(moved.order);
    expect(orderSlots(programme, states)).toEqual(["a", "b", "c", "d"]);
  });

  it("classifies completion from prescribed working sets, not a partial set, warm-up, drop set, or rejected typo", () => {
    const result = completedWorkoutSlots(
      [{ slot: "a", exerciseId: "ea", sets: 3 }, { slot: "b", exerciseId: "eb", sets: 2 }],
      [
        { exerciseId: "ea", warmup: false, tags: [], outlierStatus: "none" },
        { exerciseId: "ea", warmup: true, tags: [], outlierStatus: "none" },
        { exerciseId: "ea", warmup: false, tags: ["drop"], outlierStatus: "none" },
        { exerciseId: "ea", warmup: false, tags: [], outlierStatus: "rejected" },
        { exerciseId: "eb", warmup: false, tags: [], outlierStatus: "none" },
        { exerciseId: "eb", warmup: false, tags: ["failure"], outlierStatus: "none" },
      ],
    );
    expect([...result]).toEqual(["b"]);
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

describe("mid-workout exercise order", () => {
  it("persists the session order across resume without changing sets, progression ownership, or programme order", async () => {
    const { workout, repos, id, exs, gym, gymId, next } = await open();
    const original = exs.map((e) => e.exerciseId);
    const preceding = exs[0]!;
    const moving = exs[1]!;
    const logged = await workout.logSet(
      { sessionId: id, exerciseId: moving.exerciseId, load: 60, reps: 8 },
      { gym, equipment: moving.equipment, setup: moving.setup },
    );
    const before = (await workout.listSessionSets(id)).find((set) => set.id === logged.id)!;

    expect(await workout.moveExercise(id, moving.exerciseId, "up")).toEqual({ order: [moving.exerciseId, preceding.exerciseId, ...original.slice(2)], outcome: "moved" });

    const states = Object.fromEntries((await workout.listExerciseState(id)).map((state) => [state.slot, state]));
    expect(orderSlots(original, states)).toEqual([moving.exerciseId, preceding.exerciseId, ...original.slice(2)]);
    expect(await workout.startOrResumeSession(next.day.id, gymId)).toEqual({ id, resumed: true });
    expect(orderSlots(original, Object.fromEntries((await workout.listExerciseState(id)).map((state) => [state.slot, state])))).toEqual([moving.exerciseId, preceding.exerciseId, ...original.slice(2)]);

    const after = (await workout.listSessionSets(id)).find((set) => set.id === logged.id)!;
    expect({ exerciseId: after.exerciseId, lineId: after.lineId, load: after.load, reps: after.reps }).toEqual({ exerciseId: before.exerciseId, lineId: before.lineId, load: 60, reps: 8 });
    expect((await repos.listDayExercises(next.day.id)).map((e) => e.exerciseId)).toEqual(original);
  });

  it("refuses to move a completed exercise", async () => {
    const { workout, id, exs, gym } = await open();
    const completed = exs[1]!;
    for (let i = 0; i < completed.sets; i++) {
      await workout.logSet(
        { sessionId: id, exerciseId: completed.exerciseId, load: 40, reps: 10 },
        { gym, equipment: completed.equipment, setup: completed.setup },
      );
    }
    expect(await workout.moveExercise(id, completed.exerciseId, "up")).toEqual({ order: exs.map((e) => e.exerciseId), outcome: "completed" });
    expect(await workout.listExerciseState(id)).toEqual([]);
  });

  it("persists a superset move as one block without changing the group", async () => {
    const { workout, id, exs } = await open();
    const [a, b, c, ...rest] = exs.map((e) => e.exerciseId);
    await workout.setSuperset(id, joinSuperset({}, b!, c!));
    expect(await workout.moveExercise(id, c!, "up")).toEqual({ order: [b, c, a, ...rest], outcome: "moved" });
    const states = await workout.listExerciseState(id);
    expect(states.find((state) => state.slot === b)!.superset).toBe(`ss-${b}`);
    expect(states.find((state) => state.slot === c)!.superset).toBe(`ss-${b}`);
  });

  it("moves an uncompleted exercise past a completed one without moving sets, lines, or the program", async () => {
    const { workout, db, id, exs, gym, gymId, next } = await open();
    const original = exs.map((e) => e.exerciseId);
    const done = exs[0]!;
    const moving = exs[1]!;
    expect(done.sets).toBeGreaterThan(0);
    expect(moving.sets).toBeGreaterThan(1);
    const programPositions = await db.all<{ exercise_id: string; position: number }>(
      "SELECT exercise_id, position FROM programme_day_exercise WHERE programme_day_id = ? AND deleted_at IS NULL ORDER BY position",
      [next.day.id],
    );
    for (let i = 0; i < done.sets; i++) {
      await workout.logSet({ sessionId: id, exerciseId: done.exerciseId, load: 50, reps: 8 }, { gym, equipment: done.equipment, setup: done.setup });
    }
    await workout.logSet({ sessionId: id, exerciseId: moving.exerciseId, load: 30, reps: 10 }, { gym, equipment: moving.equipment, setup: moving.setup });
    const before = (await workout.listSessionSets(id)).map((set) => ({ id: set.id, exerciseId: set.exerciseId, lineId: set.lineId, position: set.position, load: set.load, reps: set.reps }));

    expect(await workout.moveExercise(id, moving.exerciseId, "up")).toEqual({ order: [moving.exerciseId, done.exerciseId, ...original.slice(2)], outcome: "moved" });

    expect((await workout.listSessionSets(id)).map((set) => ({ id: set.id, exerciseId: set.exerciseId, lineId: set.lineId, position: set.position, load: set.load, reps: set.reps }))).toEqual(before);
    expect(await db.all("SELECT exercise_id, position FROM programme_day_exercise WHERE programme_day_id = ? AND deleted_at IS NULL ORDER BY position", [next.day.id])).toEqual(programPositions);
    expect(await workout.startOrResumeSession(next.day.id, gymId)).toEqual({ id, resumed: true });
    const states = Object.fromEntries((await workout.listExerciseState(id)).map((state) => [state.slot, state]));
    expect(orderSlots(original, states)).toEqual([moving.exerciseId, done.exerciseId, ...original.slice(2)]);
  });

  it("still moves a superset when only a partial working set is logged", async () => {
    const { workout, id, exs, gym } = await open();
    const [a, b, c, ...rest] = exs.map((e) => e.exerciseId);
    const member = exs[1]!;
    expect(member.sets).toBeGreaterThan(1);
    await workout.setSuperset(id, joinSuperset({}, b!, c!));
    await workout.logSet({ sessionId: id, exerciseId: b!, load: 20, reps: 8 }, { gym, equipment: member.equipment, setup: member.setup });
    expect(await workout.moveExercise(id, c!, "up")).toEqual({ order: [b, c, a, ...rest], outcome: "moved" });
    const states = await workout.listExerciseState(id);
    expect(states.find((state) => state.slot === b)!.superset).toBe(`ss-${b}`);
    expect(states.find((state) => state.slot === c)!.superset).toBe(`ss-${b}`);
  });

  it("refuses to reorder a finished session and leaves no order behind", async () => {
    const { workout, id, exs } = await open();
    await workout.finishSession(id);
    await expect(workout.moveExercise(id, exs[1]!.exerciseId, "down")).rejects.toThrow(/not in progress/);
    expect(await workout.listExerciseState(id)).toEqual([]);
  });

  it("moves the first exercise only downward and the last only upward, then stops at the ends", async () => {
    const { workout, id, exs } = await open();
    const ids = exs.map((e) => e.exerciseId);
    const saved = async () => orderSlots(ids, Object.fromEntries((await workout.listExerciseState(id)).map((state) => [state.slot, state])));
    expect(await workout.moveExercise(id, ids[0]!, "up")).toEqual({ order: ids, outcome: "boundary" });
    expect(await workout.listExerciseState(id)).toEqual([]);
    expect(await workout.moveExercise(id, ids.at(-1)!, "down")).toEqual({ order: ids, outcome: "boundary" });
    expect(await workout.listExerciseState(id)).toEqual([]);

    const moving = ids[0]!;
    let order = [...ids];
    for (let i = 0; i < ids.length - 1; i++) {
      const from = order.indexOf(moving);
      order = [...order.slice(0, from), order[from + 1]!, moving, ...order.slice(from + 2)];
      expect(await workout.moveExercise(id, moving, "down")).toEqual({ order, outcome: "moved" });
      expect(await saved()).toEqual(order);
    }
    expect(order.at(-1)).toBe(moving);
    expect(await workout.moveExercise(id, moving, "down")).toMatchObject({ outcome: "boundary" });
    expect(await saved()).toEqual(order);
    for (let i = 0; i < ids.length - 1; i++) {
      const from = order.indexOf(moving);
      order = [...order.slice(0, from - 1), moving, order[from - 1]!, ...order.slice(from + 1)];
      expect(await workout.moveExercise(id, moving, "up")).toEqual({ order, outcome: "moved" });
      expect(await saved()).toEqual(order);
    }
    expect(await workout.moveExercise(id, moving, "up")).toMatchObject({ outcome: "boundary" });
    expect(await saved()).toEqual(ids);
  });

  it("moves a superset as one block past both ends without splitting it or its logged sets", async () => {
    const { workout, id, exs, gym } = await open();
    const ids = exs.map((e) => e.exerciseId);
    expect(ids.length).toBeGreaterThanOrEqual(4);
    const [b, c] = [exs[1]!, exs[2]!];
    await workout.setSuperset(id, joinSuperset({}, b.exerciseId, c.exerciseId));
    const logged = await workout.logSet({ sessionId: id, exerciseId: b.exerciseId, load: 42.5, reps: 6 }, { gym, equipment: b.equipment, setup: b.setup });
    const before = (await workout.listSessionSets(id)).find((set) => set.id === logged.id)!;
    let order = orderSlots(ids, Object.fromEntries((await workout.listExerciseState(id)).map((state) => [state.slot, state])));
    const blockAt = () => order.indexOf(b.exerciseId);
    while (blockAt() > 0) {
      const next = await workout.moveExercise(id, c.exerciseId, "up");
      expect(next.outcome).toBe("moved");
      order = next.order;
      expect(order.indexOf(c.exerciseId)).toBe(order.indexOf(b.exerciseId) + 1);
    }
    expect(await workout.moveExercise(id, b.exerciseId, "up")).toMatchObject({ outcome: "boundary" });
    while (blockAt() < order.length - 2) {
      const next = await workout.moveExercise(id, b.exerciseId, "down");
      expect(next.outcome).toBe("moved");
      order = next.order;
      expect(order.indexOf(c.exerciseId)).toBe(order.indexOf(b.exerciseId) + 1);
    }
    expect(await workout.moveExercise(id, c.exerciseId, "down")).toMatchObject({ outcome: "boundary" });
    const after = (await workout.listSessionSets(id)).find((set) => set.id === logged.id)!;
    expect({ exerciseId: after.exerciseId, lineId: after.lineId, position: after.position, load: after.load, reps: after.reps }).toEqual({
      exerciseId: before.exerciseId,
      lineId: before.lineId,
      position: before.position,
      load: 42.5,
      reps: 6,
    });
    const again = await workout.logSet({ sessionId: id, exerciseId: b.exerciseId, load: 42.5, reps: 7 }, { gym, equipment: b.equipment, setup: b.setup });
    const second = (await workout.listSessionSets(id)).find((set) => set.id === again.id)!;
    expect(second.exerciseId).toBe(b.exerciseId);
    expect(second.lineId).toBe(before.lineId);
    expect(second.position).toBe(before.position + 1);
    expect(orderSlots(ids, Object.fromEntries((await workout.listExerciseState(id)).map((state) => [state.slot, state])))).toEqual(order);
  });

  it("keeps the previous order when a later position write fails, and a new connection sees a committed order", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gain-reorder-"));
    const path = join(dir, "gain.db");
    try {
      const db = openNodeDb(path);
      const first = await sessionOn(db);
      const ids = first.exs.map((e) => e.exerciseId);
      const moved = await first.workout.moveExercise(first.id, ids[1]!, "up");
      expect(moved.order).toEqual([ids[1], ids[0], ...ids.slice(2)]);

      let updates = 0;
      const failing: Db = {
        exec: (sql) => db.exec(sql),
        all: (sql, params) => db.all(sql, params),
        get: (sql, params) => db.get(sql, params),
        run: async (sql, params) => {
          if (sql.startsWith("UPDATE session_exercise SET position")) {
            updates += 1;
            if (updates === 2) throw new Error("injected sqlite failure");
          }
          return db.run(sql, params);
        },
        transaction: (fn) => db.transaction(fn),
      };
      const retry = createWorkoutRepo(failing, testDeps());
      await expect(retry.moveExercise(first.id, ids[1]!, "down")).rejects.toThrow(/injected sqlite failure/);
      expect(orderSlots(ids, Object.fromEntries((await first.workout.listExerciseState(first.id)).map((state) => [state.slot, state])))).toEqual(moved.order);

      const reloaded = createWorkoutRepo(openNodeDb(path), testDeps());
      expect(orderSlots(ids, Object.fromEntries((await reloaded.listExerciseState(first.id)).map((state) => [state.slot, state])))).toEqual(moved.order);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

async function sessionOn(db: Db) {
  await migrate(db);
  const deps = testDeps();
  const repos = createRepos(db, deps);
  const workout = createWorkoutRepo(db, deps);
  await repos.seedIfNeeded();
  const gymId = (await repos.getActiveGymId())!;
  const next = (await repos.getNextDay())!;
  const exs = await repos.listDayExercises(next.day.id);
  const { id } = await workout.startOrResumeSession(next.day.id, gymId);
  return { workout, id, exs };
}

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
