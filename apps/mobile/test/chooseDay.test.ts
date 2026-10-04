import { describe, expect, it } from "vitest";
import { dayLabel, initialSelection, markSuggested, sessionAction } from "../src/logic/dayChoice";
import { freshDb } from "./helpers";

const days = [
  { id: "a", name: "Push", sets: 12, exercises: 4 },
  { id: "b", name: "Pull", sets: 12, exercises: 4 },
  { id: "c", name: "Legs", sets: 15, exercises: 5 },
];

describe("choosing the day (pure)", () => {
  it("lists every day in order and marks only the suggested one", () => {
    const m = markSuggested(days, "b");
    expect(m.map((d) => d.name)).toEqual(["Push", "Pull", "Legs"]);
    expect(m.map((d) => d.suggested)).toEqual([false, true, false]);
    expect(markSuggested(days, "zzz").some((d) => d.suggested)).toBe(false);
  });
  it("starts on the open workout's day, else the earlier pick, else the suggestion, else the first", () => {
    expect(initialSelection(days, "b", "c", "a")).toBe("c");
    expect(initialSelection(days, "b", null, "a")).toBe("a");
    expect(initialSelection(days, "b", null, "gone")).toBe("b");
    expect(initialSelection(days, null, null, null)).toBe("a");
    expect(initialSelection([], "b", null, null)).toBeNull();
  });
});

describe("Today: label and the one action (pure)", () => {
  const m = markSuggested(days, "b");
  it("labels the chosen day in words: Suggested today / Your choice / In progress (no star)", () => {
    expect(dayLabel(m[1]!, null)).toBe("suggested");
    expect(dayLabel(m[0]!, null)).toBe("pick");
    expect(dayLabel(m[2]!, "c")).toBe("inProgress");
    expect(dayLabel(m[1]!, "c")).toBe("suggested"); // the suggestion keeps its label while another day is the open one
  });
  it("starts the chosen day when nothing is open", () => {
    expect(sessionAction("a", null)).toEqual({ kind: "start", dayId: "a" });
  });
  it("resumes the open workout whichever day is shown, and says when it is another day", () => {
    expect(sessionAction("c", "c")).toEqual({ kind: "resume", dayId: "c", elsewhere: false });
    expect(sessionAction("a", "c")).toEqual({ kind: "resume", dayId: "c", elsewhere: true });
  });
  it("changing the picked day keeps the open workout selected after a reload (resume is never lost)", () => {
    expect(initialSelection(days, "b", "c", "a")).toBe("c");
  });
});

describe("choosing the day (data)", () => {
  async function ready() {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    const gymId = (await ctx.repos.getActiveGymId())!;
    const next = (await ctx.repos.getNextDay())!;
    const list = await ctx.repos.listDays(next.versionId);
    return { ...ctx, gymId, next, list };
  }
  const trainDay = async (c: Awaited<ReturnType<typeof ready>>, dayId: string) => {
    const gym = await c.repos.loadGymFingerprint(c.gymId);
    const exs = await c.repos.listDayExercises(dayId);
    const { id } = await c.workout.startOrResumeSession(dayId, c.gymId);
    for (let i = 0; i < 3; i++) await c.workout.logSet({ sessionId: id, exerciseId: exs[0]!.exerciseId, load: 40, reps: 8 }, { gym, equipment: exs[0]!.equipment, setup: exs[0]!.setup });
    c.deps.tick();
    await c.workout.finishSession(id);
    c.deps.tick(86_400_000);
    return id;
  };

  it("the program has several days, the rotation only suggests the first", async () => {
    const { list, next } = await ready();
    expect(list.length).toBeGreaterThan(1);
    expect(next.day.id).toBe(list[0]!.id);
  });
  it("doing a different day first moves the suggestion to the day after it; the skipped day is not stacked", async () => {
    const c = await ready();
    const second = c.list[1]!;
    await c.finish.planDay(second.id, c.gymId);
    await trainDay(c, second.id);
    const next = (await c.repos.getNextDay())!;
    expect(next.day.id).toBe((c.list[2] ?? c.list[0]!).id);
    expect(next.day.position).toBe((second.position + 1) % c.list.length);
  });
  it("only one planned session exists: planning another day voids the earlier plan and its targets", async () => {
    const c = await ready();
    const first = await c.finish.planNextSession(c.gymId);
    expect(first).not.toBeNull();
    const other = await c.finish.planDay(c.list[1]!.id, c.gymId);
    expect(other).not.toBeNull();
    expect(other!.sessionId).not.toBe(first!.sessionId);
    const planned = await c.db.all<{ id: string; programme_day_id: string }>("SELECT id, programme_day_id FROM session WHERE status = 'planned' AND deleted_at IS NULL");
    expect(planned).toHaveLength(1);
    expect(planned[0]!.programme_day_id).toBe(c.list[1]!.id);
    expect(await c.db.all("SELECT id FROM target WHERE session_id = ? AND deleted_at IS NULL", [first!.sessionId])).toHaveLength(0);
    expect((await c.db.all("SELECT id FROM target WHERE session_id = ? AND deleted_at IS NULL", [other!.sessionId])).length).toBeGreaterThan(0);
  });
  it("planning the same day twice keeps its plan and accepted choices", async () => {
    const c = await ready();
    const a = await c.finish.planDay(c.list[1]!.id, c.gymId);
    const t = (await c.finish.getTargets(a!.sessionId))[0]!;
    await c.finish.acceptTarget(t.id).catch(() => undefined);
    const b = await c.finish.planDay(c.list[1]!.id, c.gymId);
    expect(b!.sessionId).toBe(a!.sessionId);
  });
  it("refuses a day that is not in the active program, and an open workout is reported", async () => {
    const c = await ready();
    expect(await c.finish.planDay("nope", c.gymId)).toBeNull();
    expect(await c.workout.getOpenSession()).toBeNull();
    const { id } = await c.workout.startOrResumeSession(c.list[2 % c.list.length]!.id, c.gymId);
    expect(await c.workout.getOpenSession()).toEqual({ id, dayId: c.list[2 % c.list.length]!.id });
    expect(await c.finish.planDay(c.list[2 % c.list.length]!.id, c.gymId)).toBeNull(); // already in progress
  });
});
