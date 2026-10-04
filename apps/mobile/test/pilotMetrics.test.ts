import { describe, expect, it } from "vitest";
import { parseBackup, type BackupFile } from "../src/logic/backup";
import { agreementTotals, computeLifterMetrics, retention, sheetCsv } from "../src/logic/pilotMetrics";
import { freshDb } from "./helpers";

const DAY = 86_400_000;
const T0 = 1_700_000_000_000; // 2023-11-14 22:13:20 UTC

function backup(tables: BackupFile["tables"], exportedAt: number): BackupFile {
  return { app: "gain", format: 1, schemaVersion: 20, exportedAt: new Date(exportedAt).toISOString(), tables };
}
const session = (id: string, finishedAt: number | null, extra: Record<string, string | number | null> = {}) => ({ id, status: finishedAt === null ? "planned" : "finished", finished_at: finishedAt, import_key: null, deleted_at: null, ...extra });

describe("pilot metrics from a backup", () => {
  it("weeks start at local midnight of the first real finished session; imported and deleted sessions never count", () => {
    const b = backup(
      {
        session: [
          session("imp", T0 - 40 * DAY, { import_key: "h|1" }), // imported history does not start week 0
          session("a", T0), // 22:13 UTC
          session("b", T0 + 6 * DAY), // still week 0
          session("c", T0 + 7 * DAY), // week 1
          session("d", T0 + 20 * DAY, { deleted_at: 5 }), // deleted: ignored
          session("e", null), // planned: ignored
        ],
      },
      T0 + 15 * DAY,
    );
    const m = computeLifterMetrics(b, { tzMinutes: 0 });
    expect(m.week0Start).toBe(Math.floor(T0 / DAY) * DAY);
    expect(m.reachedWeek).toBe(2);
    expect(m.weeks.map((w) => w.sessions)).toEqual([2, 1, 0]);
    expect(m.weeks.map((w) => w.active)).toEqual([true, true, false]);
  });

  it("the phone's time zone moves the day a late-evening session belongs to", () => {
    const b = backup({ session: [session("a", T0), session("b", T0 + 2 * DAY - 3 * 3600_000)] }, T0 + 30 * DAY);
    // The first session is at 22:13 UTC on Nov 14: that day starts at 00:00 UTC; at +3h it is already Nov 15 and the local day starts at 21:00 UTC on Nov 14.
    expect(computeLifterMetrics(b, { tzMinutes: 0 }).week0Start).toBe(Date.UTC(2023, 10, 14));
    expect(computeLifterMetrics(b, { tzMinutes: 180 }).week0Start).toBe(Date.UTC(2023, 10, 14, 21));
  });

  it("no finished real session means no weeks and nobody counted", () => {
    const m = computeLifterMetrics(backup({ session: [session("e", null)] }, T0), {});
    expect(m).toMatchObject({ week0Start: null, reachedWeek: -1, weeks: [] });
    expect(retention([m])).toEqual([{ week: 1, reached: 0, retained: 0 }, { week: 2, reached: 0, retained: 0 }, { week: 6, reached: 0, retained: 0 }]);
  });

  it("retention counts a lifter only once their calendar reached that week, and a gap is not averaged away", () => {
    const steady = computeLifterMetrics(backup({ session: [0, 1, 2, 3].map((w) => session(`s${w}`, T0 + w * 7 * DAY + 3600_000)) }, T0 + 25 * DAY), {});
    const gap = computeLifterMetrics(backup({ session: [session("g0", T0), session("g3", T0 + 22 * DAY)] }, T0 + 25 * DAY), {});
    const young = computeLifterMetrics(backup({ session: [session("y0", T0 + 20 * DAY)] }, T0 + 22 * DAY), {});
    expect(steady.reachedWeek).toBe(3);
    expect(retention([steady, gap, young], [1, 2, 3])).toEqual([
      { week: 1, reached: 2, retained: 1 }, // steady active, gap not; young has not reached week 1
      { week: 2, reached: 2, retained: 1 },
      { week: 3, reached: 2, retained: 2 }, // gap came back in week 3
    ]);
  });

  it("targets are counted by status in the week their session finished, and compared with the heaviest counted working set", () => {
    const set = (id: string, load: number, extra: Record<string, string | number | null> = {}) => ({ id, session_id: "s2", line_id: "L1", load, is_warmup: 0, outlier_status: "none", tags_json: "[]", deleted_at: null, ...extra });
    const target = (id: string, status: string, load: number | null, line = "L1", extra: Record<string, string | number | null> = {}) => ({ id, session_id: "s2", line_id: line, load, status, deleted_at: null, ...extra });
    const b = backup(
      {
        session: [session("s1", T0), session("s2", T0 + DAY)],
        workout_set: [set("a", 40, { is_warmup: 1 }), set("b", 60), set("c", 62.5), set("d", 100, { outlier_status: "rejected" }), set("e", 90, { tags_json: '["drop"]' }), set("f", 70, { deleted_at: 9 })],
        target: [target("t1", "accepted", 60), target("t2", "edited", 62.5, "L2"), target("t3", "rejected", null, "L3"), target("t4", "proposed", 60, "L1", { deleted_at: 3 }), target("t5", "proposed", 60, "L4")],
      },
      T0 + 3 * DAY,
    );
    const w = computeLifterMetrics(b, {}).weeks[0]!;
    expect(w).toMatchObject({ sessions: 2, accepted: 1, edited: 1, rejected: 1, proposed: 1 });
    // only t1 has a number AND a logged working set (L1: warm-up, rejected outlier, drop and deleted sets ignored -> 62.5)
    expect(w).toMatchObject({ comparable: 1, same: 0, more: 1, less: 0 });
  });

  it("compares the app's number with 'repeat the last load' on the same targets (imported history counts for the baseline, not for retention)", () => {
    const set = (id: string, sessionId: string, ex: string, load: number, extra: Record<string, string | number | null> = {}) => ({ id, session_id: sessionId, exercise_id: ex, line_id: `L-${ex}`, load, is_warmup: 0, outlier_status: "none", tags_json: "[]", deleted_at: null, ...extra });
    const target = (id: string, ex: string, load: number) => ({ id, session_id: "s2", exercise_id: ex, line_id: `L-${ex}`, load, status: "accepted", deleted_at: null });
    const b = backup(
      {
        // h0 is imported (older), s1 and s2 are real; s3 is a later session that must not be used as "previous" for s2's targets.
        session: [session("h0", T0 - 5 * DAY, { import_key: "x" }), session("s1", T0), session("s2", T0 + DAY), session("s3", T0 + 2 * DAY)],
        workout_set: [
          set("a", "h0", "bench", 50), // only history for bench
          set("b", "s1", "squat", 100), set("c", "s1", "squat", 90, { is_warmup: 1 }), // squat previous = 100
          set("d", "s2", "bench", 55), set("e", "s2", "squat", 100), set("f", "s2", "row", 40), // row has no earlier session: not in the like-for-like count
          set("g", "s3", "bench", 99),
        ],
        target: [target("t1", "bench", 55), target("t2", "squat", 105), target("t3", "row", 40)],
      },
      T0 + 3 * DAY,
    );
    const w = computeLifterMetrics(b, {}).weeks[0]!;
    expect(w).toMatchObject({ sessions: 3, comparable: 3, same: 2, less: 1 });
    // bench: previous 50, target 55, did 55 -> app same, repeat not. squat: previous 100, target 105, did 100 -> repeat same, app not. row: no previous.
    expect(w).toMatchObject({ both: 2, bothAppSame: 1, bothRepeatSame: 1 });
    expect(agreementTotals([computeLifterMetrics(b, {}), computeLifterMetrics(b, {})])).toEqual({ comparable: 6, same: 4, more: 0, less: 2, both: 4, bothAppSame: 2, bothRepeatSame: 2 });
  });

  describe("the repeat-last baseline only uses the same line (exercise + gym + setup) and effective load", () => {
    type R = Record<string, string | number | null>;
    const line = (id: string, ex: string, gym: string, setup: string): R => ({ id, exercise_id: ex, gym_id: gym, setup, deleted_at: null });
    const set = (id: string, sessionId: string, lineId: string, ex: string, load: number, extra: R = {}): R => ({ id, session_id: sessionId, exercise_id: ex, line_id: lineId, load, is_warmup: 0, outlier_status: "none", tags_json: "[]", deleted_at: null, ...extra });
    const target = (id: string, sessionId: string, lineId: string, ex: string, load: number): R => ({ id, session_id: sessionId, exercise_id: ex, line_id: lineId, load, status: "accepted", deleted_at: null });
    const week0 = (b: BackupFile) => computeLifterMetrics(b, {}).weeks[0]!;

    it("a previous session of the same exercise at ANOTHER gym is not the baseline", () => {
      const b = backup(
        {
          session: [session("s1", T0), session("s2", T0 + DAY)],
          exercise_line: [line("LA", "bench", "gymA", "free"), line("LB", "bench", "gymB", "free")],
          workout_set: [set("a", "s1", "LA", "bench", 100), set("b", "s2", "LB", "bench", 60)],
          target: [target("t", "s2", "LB", "bench", 60)],
        },
        T0 + 3 * DAY,
      );
      // The only earlier bench was at gym A (100). It must not count: same exercise, different gym.
      expect(week0(b)).toMatchObject({ comparable: 1, same: 1, both: 0, bothAppSame: 0, bothRepeatSame: 0 });
    });

    it("the previous session of the same gym is used even when a newer session of the same exercise happened elsewhere", () => {
      const b = backup(
        {
          session: [session("s1", T0), session("s2", T0 + DAY), session("s3", T0 + 2 * DAY)],
          exercise_line: [line("LA", "bench", "gymA", "free"), line("LB", "bench", "gymB", "free")],
          workout_set: [set("a", "s1", "LA", "bench", 60), set("b", "s2", "LB", "bench", 100), set("c", "s3", "LA", "bench", 60)],
          target: [target("t", "s3", "LA", "bench", 62.5)],
        },
        T0 + 4 * DAY,
      );
      // Baseline = gym A's 60 (not gym B's 100): the lifter repeated it, the app's 62.5 was not loaded.
      expect(week0(b)).toMatchObject({ comparable: 1, less: 1, both: 1, bothAppSame: 0, bothRepeatSame: 1 });
    });

    it("a different setup of the same exercise at the same gym is a different line", () => {
      const b = backup(
        {
          session: [session("s1", T0), session("s2", T0 + DAY)],
          exercise_line: [line("LF", "pullup", "g", "free"), line("LP", "pullup", "g", "bodyweight_plus_added")],
          workout_set: [set("a", "s1", "LF", "pullup", 0), set("b", "s2", "LP", "pullup", 10)],
          target: [target("t", "s2", "LP", "pullup", 10)],
        },
        T0 + 3 * DAY,
      );
      expect(week0(b)).toMatchObject({ comparable: 1, same: 1, both: 0 });
    });

    it("assisted: the heaviest set is the one with the LEAST assistance, and less assistance counts as 'more'", () => {
      const b = backup(
        {
          session: [session("s1", T0), session("s2", T0 + DAY)],
          exercise_line: [line("LA", "assistedpull", "g", "assisted")],
          // s1: 30 kg assistance then a harder 20 kg set. s2: target 20, lifter did 15 kg assistance (harder than target).
          workout_set: [set("a", "s1", "LA", "assistedpull", 30), set("b", "s1", "LA", "assistedpull", 20), set("c", "s2", "LA", "assistedpull", 15), set("d", "s2", "LA", "assistedpull", 25)],
          target: [target("t", "s2", "LA", "assistedpull", 20)],
        },
        T0 + 3 * DAY,
      );
      // did (least assistance) = 15 < target 20 assistance = MORE effective load; baseline previous = 20 (not 30), so repeating 20 would have matched the target.
      expect(week0(b)).toMatchObject({ comparable: 1, more: 1, less: 0, same: 0, both: 1, bothAppSame: 0, bothRepeatSame: 0 });
    });

    it("assisted: more assistance than the target is 'less'; an equal assistance is the same", () => {
      const b = backup(
        {
          session: [session("s1", T0), session("s2", T0 + DAY), session("s3", T0 + 2 * DAY)],
          exercise_line: [line("LA", "assistedpull", "g", "assisted")],
          workout_set: [set("a", "s1", "LA", "assistedpull", 20), set("b", "s2", "LA", "assistedpull", 25), set("c", "s3", "LA", "assistedpull", 25)],
          target: [target("t2", "s2", "LA", "assistedpull", 20), target("t3", "s3", "LA", "assistedpull", 25)],
        },
        T0 + 4 * DAY,
      );
      const w = week0(b);
      expect(w).toMatchObject({ comparable: 2, less: 1, same: 1, more: 0, both: 2 });
      // t2: previous 20, did 25 (easier), target 20: app not same, repeat not same. t3: previous 25 = did 25 = target 25: both same.
      expect(w).toMatchObject({ bothAppSame: 1, bothRepeatSame: 1 });
    });

    it("assisted with bodyweight entries: the same assistance at a different bodyweight is a different effective load", () => {
      const b = backup(
        {
          session: [session("s1", T0), session("s2", T0 + 20 * DAY)],
          bodyweight_entry: [{ id: "w1", weight_kg: 90, measured_at: T0 - DAY, deleted_at: null }, { id: "w2", weight_kg: 84, measured_at: T0 + 10 * DAY, deleted_at: null }],
          exercise_line: [line("LA", "assistedpull", "g", "assisted")],
          workout_set: [set("a", "s1", "LA", "assistedpull", 20), set("b", "s2", "LA", "assistedpull", 20)],
          target: [target("t", "s2", "LA", "assistedpull", 20)],
        },
        T0 + 25 * DAY,
      );
      // Same 20 kg assistance, but 90-20 = 70 kg effective before and 84-20 = 64 kg now: repeating the last EFFECTIVE load (70) did not happen.
      expect(computeLifterMetrics(b, {}).weeks[2]).toMatchObject({ comparable: 1, same: 1, both: 1, bothAppSame: 1, bothRepeatSame: 0 });
    });

    it("added weight on a bodyweight exercise compares like a normal load (heavier added = more)", () => {
      const b = backup(
        {
          session: [session("s1", T0), session("s2", T0 + DAY)],
          exercise_line: [line("LD", "dip", "g", "bodyweight_plus_added")],
          workout_set: [set("a", "s1", "LD", "dip", 10), set("b", "s2", "LD", "dip", 12.5)],
          target: [target("t", "s2", "LD", "dip", 10)],
        },
        T0 + 3 * DAY,
      );
      expect(week0(b)).toMatchObject({ comparable: 1, more: 1, both: 1, bothAppSame: 0, bothRepeatSame: 0 });
    });

    it("deleted lines and sets in other gyms never leak into the baseline", () => {
      const b = backup(
        {
          session: [session("s1", T0), session("s2", T0 + DAY)],
          exercise_line: [line("LA", "row", "g", "free")],
          workout_set: [set("a", "s1", "LA", "row", 50, { deleted_at: 1 }), set("b", "s2", "LA", "row", 55)],
          target: [target("t", "s2", "LA", "row", 55)],
        },
        T0 + 3 * DAY,
      );
      expect(week0(b)).toMatchObject({ comparable: 1, same: 1, both: 0 });
    });
  });

  it("the sheet has one row per reached week and the hand-filled columns empty", () => {
    const m = computeLifterMetrics(backup({ session: [session("a", T0)] }, T0 + 8 * DAY), {});
    const lines = sheetCsv([{ code: 'P,01"', metrics: m }]).trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("pilot_code,week,sessions_done");
    expect(lines[1]!.startsWith('"P,01""",0,1,1,')).toBe(true);
    expect(lines[2]!.endsWith(",,,,")).toBe(true);
  });

  it("runs on a real exported backup (targets accepted before the session, heavier load logged)", async () => {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    const gymId = (await ctx.repos.getActiveGymId())!;
    const gym = await ctx.repos.loadGymFingerprint(gymId);
    let last: { id: string; plannedId: string | null } = { id: "", plannedId: null };
    const train = async (load: number, reps: number) => {
      const next = (await ctx.repos.getNextDay())!;
      const exs = await ctx.repos.listDayExercises(next.day.id);
      const { id } = await ctx.workout.startOrResumeSession(next.day.id, gymId);
      for (let i = 0; i < 3; i++) await ctx.workout.logSet({ sessionId: id, exerciseId: exs[0]!.exerciseId, load, reps }, { gym, equipment: exs[0]!.equipment, setup: exs[0]!.setup });
      ctx.deps.tick(1000);
      await ctx.workout.finishSession(id);
      const written = await ctx.finish.writeNextSessionTargets(id);
      ctx.deps.tick(DAY);
      last = { id, plannedId: written?.sessionId ?? null };
    };
    for (let d = 0; d < 4; d++) await train(60, 8); // one rotation; day 5 (Upper A) now has a bench target of 60 x 8
    const targets = await ctx.finish.getTargets(last.plannedId!);
    const withNumber = targets.filter((t) => t.load !== null);
    expect(withNumber.length).toBeGreaterThan(0);
    await ctx.finish.acceptTarget(withNumber[0]!.id);
    await train(65, 8); // heavier than the 60 target
    const text = await ctx.data.exportJson(ctx.deps.now());
    const m = computeLifterMetrics(parseBackup(text, 1000), { tzMinutes: 0 });
    const w0 = m.weeks[0]!;
    expect(w0.sessions).toBe(5);
    expect(w0.accepted).toBe(1);
    expect(w0.comparable).toBe(1);
    expect(w0.more).toBe(1);
  });
});
