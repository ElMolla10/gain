import { describe, expect, it } from "vitest";
import { parseBackup, type BackupFile } from "../src/logic/backup";
import { computeLifterMetrics, retention, sheetCsv } from "../src/logic/pilotMetrics";
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
