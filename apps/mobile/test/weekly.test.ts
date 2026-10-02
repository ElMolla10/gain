import { describe, expect, it } from "vitest";
import { ReviewAlreadyDecided, ReviewDateInvalid } from "../src/db/weeklyRepo";
import { freshDb } from "./helpers";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 2, 12); // Friday 2026-10-02 12:00 UTC; this week starts Monday 2026-09-28, the reviewed week is 2026-09-21 .. 2026-09-27

async function setup() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const gymId = (await ctx.repos.getActiveGymId())!;
  const lib = await ctx.programmes.listExercises();
  const bench = lib.find((e) => e.seedKey === "bench_press")!;
  const day = (await ctx.db.get<{ id: string; programme_version_id: string }>("SELECT id, programme_version_id FROM programme_day LIMIT 1"))!;
  await ctx.db.run("INSERT OR IGNORE INTO exercise_line (id, exercise_id, gym_id, setup, created_at, updated_at) VALUES ('line-bench', ?, ?, 'free', 1, 1)", [bench.id, gymId]);
  const lineId = (await ctx.db.get<{ id: string }>("SELECT id FROM exercise_line WHERE exercise_id = ? AND gym_id = ? AND setup = 'free'", [bench.id, gymId]))!.id;
  let n = 0;
  /** A finished session at `at` with one working set of `load` x 1 (so its estimated 1RM is exactly the load). */
  async function session(at: number, load = 100) {
    const sid = `s${++n}`;
    await ctx.db.run("INSERT INTO session (id, programme_version_id, programme_day_id, gym_id, status, started_at, finished_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'finished', ?, ?, 1, 1)", [sid, day.programme_version_id, day.id, gymId, at, at]);
    await ctx.db.run("INSERT INTO workout_set (id, session_id, exercise_id, line_id, position, load, reps, is_warmup, outlier_status, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, 1, 0, 'none', 1, 1)", [`${sid}-0`, sid, bench.id, lineId, load]);
  }
  return { ...ctx, bench, session };
}
const monday = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 12);

describe("weekly review data layer", () => {
  it("with no history it proposes nothing, says it is thin, and is created once per week", async () => {
    const { weekly } = await setup();
    const a = (await weekly.getDue(NOW))!;
    expect(a.weekStart).toBe("2026-09-21");
    expect(a.review).toMatchObject({ thin: true, reason: "thin_history", change: { kind: "keep" } });
    const b = (await weekly.getDue(NOW + HOUR))!;
    expect(b.id).toBe(a.id); // the same review until it is decided
    await weekly.skip(a.id);
    expect(await weekly.getDue(NOW)).toBeNull(); // decided: not shown again this week
    expect((await weekly.getDue(NOW + 7 * DAY))!.weekStart).toBe("2026-09-28"); // next week gets its own
  });

  it("counts finished sessions inside the reviewed week and the two before it", async () => {
    const { weekly, session } = await setup();
    // reviewed week 21-27 Sep: 3 sessions; week 14-20: 2; week 7-13: 1; this week (28 Sep on): 1 (must not count)
    for (const d of [21, 23, 26]) await session(Date.UTC(2026, 8, d, 12));
    for (const d of [15, 18]) await session(Date.UTC(2026, 8, d, 12));
    await session(Date.UTC(2026, 8, 8, 12));
    await session(Date.UTC(2026, 8, 29, 12));
    const input = await weekly.buildInput(NOW, 0);
    expect(input).toMatchObject({ weekStart: "2026-09-21", sessionsDone: 3, priorWeeks: [1, 2], historyDays: 19 });
  });

  it("uses the lifter's local week: a session late Sunday UTC is Monday in Cairo (+3 h)", async () => {
    const { weekly, session } = await setup();
    await session(Date.UTC(2026, 8, 27, 22, 30));
    expect((await weekly.buildInput(NOW, 0)).sessionsDone).toBe(1);
    expect((await weekly.buildInput(NOW, 3 * HOUR)).sessionsDone).toBe(0);
  });

  it("the week can start on another day (setting), validated", async () => {
    const { weekly } = await setup();
    expect(await weekly.weekStartsOn()).toBe(1);
    await weekly.setWeekStartsOn(6); // Saturday
    expect((await weekly.buildInput(NOW, 0)).weekStart).toBe("2026-09-19"); // Fri 2 Oct belongs to the week from Sat 26 Sep; reviewed = from Sat 19 Sep
    await expect(weekly.setWeekStartsOn(7)).rejects.toThrow();
  });

  it("a slipping goal date proposes the projected date; accepting moves it and records what changed", async () => {
    const { weekly, session, goals, bench } = await setup();
    await goals.setGoal({ kind: "lift", exerciseId: bench.id, targetLoad: 100, targetReps: 5, targetDate: "2026-11-01" });
    for (const [i, load] of [100, 100.5, 101, 101.5].entries()) await session(monday(2026, 8, 31) + i * 7 * DAY, load);
    const due = (await weekly.getDue(NOW))!;
    expect(due.review.reason).toBe("date_slipping");
    expect(due.review.change.kind).toBe("move_date");
    expect(due.review.observed.goalStatus).toBe("behind");
    // nothing changed yet
    expect((await goals.getGoal())).toMatchObject({ targetDate: "2026-11-01" });
    const newDate = (due.review.change as { newDate: string }).newDate;
    await weekly.accept(due.id);
    expect(await goals.getGoal()).toMatchObject({ kind: "lift", targetLoad: 100, targetReps: 5, targetDate: newDate });
    const [past] = await weekly.listDecided();
    expect(past).toMatchObject({ status: "accepted", applied: { kind: "move_date", newDate } });
    await expect(weekly.accept(due.id)).rejects.toBeInstanceOf(ReviewAlreadyDecided);
    await expect(weekly.skip(due.id)).rejects.toBeInstanceOf(ReviewAlreadyDecided);
  });

  it("the lifter can use their own date instead; a bad date is refused and nothing changes", async () => {
    const { weekly, session, goals, bench } = await setup();
    await goals.setGoal({ kind: "lift", exerciseId: bench.id, targetLoad: 100, targetReps: 5, targetDate: "2026-11-01" });
    for (const [i, load] of [100, 100.5, 101, 101.5].entries()) await session(monday(2026, 8, 31) + i * 7 * DAY, load);
    const due = (await weekly.getDue(NOW))!;
    await expect(weekly.editDate(due.id, "2020-01-01")).rejects.toBeInstanceOf(ReviewDateInvalid);
    await expect(weekly.editDate(due.id, "nonsense")).rejects.toBeInstanceOf(ReviewDateInvalid);
    expect(await goals.getGoal()).toMatchObject({ targetDate: "2026-11-01" });
    await weekly.editDate(due.id, "2027-09-01");
    expect(await goals.getGoal()).toMatchObject({ targetDate: "2027-09-01" });
    expect((await weekly.listDecided())[0]).toMatchObject({ status: "edited", applied: { kind: "move_date", newDate: "2027-09-01" } });
  });

  it("accepting a proposal that is not a date move changes nothing; skipping changes nothing", async () => {
    const { weekly, goals, bench, session } = await setup();
    await goals.setGoal({ kind: "lift", exerciseId: bench.id, targetLoad: 100, targetReps: 5, targetDate: null });
    for (const [i, load] of [100, 101, 102, 103].entries()) await session(monday(2026, 8, 31) + i * 7 * DAY, load);
    const due = (await weekly.getDue(NOW))!;
    expect(due.review.change.kind).toBe("keep"); // rising, no date: on pace
    await weekly.accept(due.id);
    expect((await weekly.listDecided())[0]).toMatchObject({ status: "accepted", applied: null });
    expect(await goals.getGoal()).toMatchObject({ targetDate: null });
    await expect(weekly.editDate(due.id, "2027-01-01")).rejects.toBeInstanceOf(ReviewAlreadyDecided);
  });

  it("only a move-the-date proposal can be edited", async () => {
    const { weekly } = await setup();
    const due = (await weekly.getDue(NOW))!;
    await expect(weekly.editDate(due.id, "2027-01-01")).rejects.toThrow(/Only a move-the-date/);
  });
});
