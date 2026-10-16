import { describe, expect, it } from "vitest";
import { FocusTooMany, MAX_FOCUS_PINS } from "../src/db/achievementRepo";
import { freshDb } from "./helpers";

const DAY = 86_400_000;

async function setup() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const gymId = (await ctx.repos.getActiveGymId())!;
  const gym = await ctx.repos.loadGymFingerprint(gymId);
  const day = (await ctx.repos.getNextDay())!.day;
  const ex = (await ctx.repos.listDayExercises(day.id))[0]!;
  const train = async (opts: { load?: number; reps?: number; sets?: number } = {}) => {
    const { id } = await ctx.workout.startOrResumeSession(day.id, gymId);
    const setIds: string[] = [];
    const n = opts.sets ?? 3;
    for (let i = 0; i < n; i++) {
      const row = await ctx.workout.logSet(
        { sessionId: id, exerciseId: ex.exerciseId, load: opts.load ?? 60, reps: opts.reps ?? 8 },
        { gym, equipment: ex.equipment, setup: ex.setup },
      );
      setIds.push(row.id);
    }
    ctx.deps.tick();
    await ctx.workout.finishSession(id);
    ctx.deps.tick();
    return { sessionId: id, setIds };
  };
  return { ...ctx, gymId, gym, day, ex, train };
}

describe("achievement persistence", () => {
  it("backfills existing finished history once and shows a single banner count", async () => {
    const c = await setup();
    await c.train();
    c.deps.tick(DAY);
    await c.train();
    const first = await c.achievements.ensureBackfill();
    expect(first.inserted).toBeGreaterThan(0);
    const home = await c.achievements.getHome();
    expect(home.bannerCount).toBe(first.inserted);
    expect(home.earned.some((r) => r.badgeId === "first_session")).toBe(true);
    expect(home.earned.every((r) => r.isBackfilled)).toBe(true);
    const again = await c.achievements.ensureBackfill();
    expect(again.inserted).toBe(0);
    expect(await c.achievements.getHome().then((h) => h.bannerCount)).toBe(first.inserted);
    await c.achievements.dismissBanner();
    expect(await c.achievements.getHome().then((h) => h.bannerCount)).toBeNull();
  });

  it("awards live after a qualifying finish without marking the row as backfilled", async () => {
    const c = await setup();
    await c.achievements.ensureBackfill();
    await c.train();
    await c.achievements.sync();
    const first = (await c.achievements.listEarned()).find((r) => r.badgeId === "first_session");
    expect(first?.isBackfilled).toBe(false);
    expect(first?.status).toBe("earned");
  });

  it("re-anchors a first-session badge onto the next valid workout, and revokes only when none remains", async () => {
    const c = await setup();
    const a = await c.train();
    c.deps.tick(DAY);
    const b = await c.train();
    await c.achievements.sync();
    const before = (await c.achievements.listEarned()).find((r) => r.badgeId === "first_session")!;
    expect(before.primarySessionId).toBe(a.sessionId);
    await c.history.deleteWorkout(a.sessionId);
    const reanchored = (await c.achievements.listEarned()).find((r) => r.badgeId === "first_session")!;
    expect(reanchored.id).toBe(before.id);
    expect(reanchored.status).toBe("earned");
    expect(reanchored.primarySessionId).toBe(b.sessionId);
    const audits = await c.db.all<{ action: string }>("SELECT action FROM achievement_audit_log WHERE achievement_id = ? ORDER BY created_at", [before.id]);
    expect(audits.map((r) => r.action)).toContain("reanchored");
    await c.history.deleteWorkout(b.sessionId);
    const gone = (await c.achievements.listEarned()).find((r) => r.badgeId === "first_session")!;
    expect(gone.status).toBe("revoked_by_edit");
    expect(await c.db.get<{ action: string }>("SELECT action FROM achievement_audit_log WHERE achievement_id = ? AND action = 'revoked_by_edit'", [before.id])).not.toBeNull();
  });

  it("surfaces recent badges, next-up, live session heroes, and celebrates once", async () => {
    const c = await setup();
    await c.achievements.ensureBackfill();
    const { sessionId } = await c.train();
    await c.achievements.sync();
    const home = await c.achievements.getHome();
    expect(home.recent.length).toBeGreaterThan(0);
    expect(home.recent.length).toBeLessThanOrEqual(2);
    expect(home.nextUp.every((n) => n.target > n.current)).toBe(true);
    const live = await c.achievements.listForSession(sessionId);
    expect(live.every((r) => r.isBackfilled === false && r.primarySessionId === sessionId)).toBe(true);
    expect(live.some((r) => r.badgeId === "first_session")).toBe(true);
    await c.achievements.markCelebrated(live.map((r) => r.id));
    expect(await c.achievements.listForSession(sessionId)).toEqual([]);
    const cabinet = await c.achievements.listCabinet();
    expect(cabinet.some((r) => r.badgeId === "first_session" && r.status === "earned")).toBe(true);
    expect(cabinet.some((r) => r.badgeId === "qualified_weeks_4" && r.status === "in_progress")).toBe(true);
  });

  it("stamps an immutable local calendar date at finish time", async () => {
    const c = await setup();
    const { sessionId } = await c.train();
    const row = await c.db.get<{ local_calendar_date: string; finished_at: number }>("SELECT local_calendar_date, finished_at FROM session WHERE id = ?", [sessionId]);
    expect(row?.local_calendar_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const first = row!.local_calendar_date;
    c.deps.tick(3 * DAY);
    await c.db.run("UPDATE session SET updated_at = ? WHERE id = ?", [c.deps.now(), sessionId]);
    expect((await c.db.get<{ local_calendar_date: string }>("SELECT local_calendar_date FROM session WHERE id = ?", [sessionId]))!.local_calendar_date).toBe(first);
  });

  it("offers three monthly quests, pick and swap in the first two weeks, and tracks progress from sessions", async () => {
    const c = await setup();
    const home = await c.achievements.getHome();
    expect(home.quest?.offers).toHaveLength(3);
    const first = home.quest!.offers[0]!;
    const second = home.quest!.offers[1]!;
    await c.achievements.pickQuest(first.kind);
    const picked = await c.achievements.getHome();
    expect(picked.quest?.picked?.kind).toBe(first.kind);
    expect(picked.quest?.status).toBe("picked");
    if (picked.quest?.canSwap) {
      await c.achievements.pickQuest(second.kind);
      expect((await c.achievements.getHome()).quest?.picked?.kind).toBe(second.kind);
    }
    await c.train();
    const after = await c.achievements.getHome();
    expect(after.quest?.progress.target).toBeGreaterThan(0);
    expect(after.nextUp.some((n) => n.badgeId.startsWith("quest_") || n.badgeId === after.quest?.picked?.kind)).toBe(true);
  });

  it("pins a lift, shows progress in Next up, and awards Target reached from a trusted set", async () => {
    const c = await setup();
    await c.achievements.setPin({ exerciseId: c.ex.exerciseId, equipment: c.ex.equipment, setup: c.ex.setup, load: 70, reps: 5 });
    await c.train({ load: 60, reps: 5 });
    await c.achievements.sync();
    const home = await c.achievements.getHome();
    expect(home.nextUp.some((n) => n.badgeId.startsWith("pin_target"))).toBe(true);
    const toward = home.nextUp.find((n) => n.badgeId.startsWith("pin_target"))!;
    expect(toward.current).toBeGreaterThan(0);
    expect(toward.current).toBeLessThan(100);
    expect((await c.achievements.listEarned()).some((r) => r.badgeId === "pin_target" && r.status === "earned")).toBe(false);
    c.deps.tick(DAY);
    await c.train({ load: 70, reps: 5 });
    await c.achievements.sync();
    const earned = (await c.achievements.listEarned()).find((r) => r.badgeId === "pin_target");
    expect(earned?.status).toBe("earned");
    expect(earned?.evidence?.kind).toBe("pin_target");
    expect(await c.achievements.getPin(c.ex.exerciseId)).toBeNull();
    expect((await c.db.get<{ n: number }>("SELECT reached_at_utc AS n FROM lift_pin WHERE exercise_id = ? AND deleted_at IS NULL", [c.ex.exerciseId]))!.n).toBeGreaterThan(0);
  });

  it("pins up to 3 focus lifts with a 4–6 week block and refuses a fourth", async () => {
    const c = await setup();
    const lib = await c.programmes.listExercises();
    const ids = lib.slice(0, 4).map((e) => e.id);
    expect(ids).toHaveLength(4);
    expect(MAX_FOCUS_PINS).toBe(3);
    await c.achievements.setPin({ exerciseId: ids[0]!, load: 70, reps: 5, weeks: 6 });
    await c.achievements.setPin({ exerciseId: ids[1]!, load: 80, reps: 5, weeks: 4 });
    await c.achievements.setPin({ exerciseId: ids[2]!, load: 90, reps: 5, weeks: 5 });
    await expect(c.achievements.setPin({ exerciseId: ids[3]!, load: 100, reps: 5 })).rejects.toBeInstanceOf(FocusTooMany);
    const pins = await c.achievements.listPins();
    expect(pins).toHaveLength(3);
    const first = pins.find((p) => p.exerciseId === ids[0]);
    expect(first).toMatchObject({ exerciseId: ids[0], weeks: 6 });
    expect(first!.startedWeek).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await c.achievements.setPin({ exerciseId: ids[0]!, load: 72.5, reps: 5, weeks: 6 });
    expect(await c.achievements.listPins()).toHaveLength(3);
    expect((await c.achievements.getPin(ids[0]!))!.load).toBe(72.5);
    await c.train({ load: 60, reps: 5 });
    await c.achievements.sync();
    const home = await c.achievements.getHome();
    expect(home.nextUp.filter((n) => n.badgeId.startsWith("pin_target")).length).toBeGreaterThanOrEqual(1);
    expect(home.nextUp.filter((n) => n.badgeId.startsWith("pin_target")).length).toBeLessThanOrEqual(3);
  });
});
