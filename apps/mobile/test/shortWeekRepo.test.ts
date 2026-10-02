import { describe, expect, it } from "vitest";
import { SessionInProgress } from "../src/db/programmeRepo";
import { ShortWeekActive, ShortWeekInvalid } from "../src/db/shortWeekRepo";
import { instantiateTemplate, TEMPLATES } from "../src/logic/templates";
import { freshDb } from "./helpers";
import type { Profile } from "../src/logic/onboarding";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 2, 12); // Friday; week starts Monday 2026-09-28

/** Onboard onto the 4-day upper/lower template with a bench goal; Upper A, Lower A, Upper B, Lower B. */
async function setup() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const lib = await ctx.programmes.listExercises();
  const byKey = new Map(lib.filter((e) => e.seedKey).map((e) => [e.seedKey!, { exerciseId: e.id, equipment: e.equipment }]));
  const bench = byKey.get("bench_press")!.exerciseId;
  const draft = instantiateTemplate(TEMPLATES.find((t) => t.id === "upper_lower_4")!, { byKey }, { lang: "en", goalLiftKey: "bench_press", ceilingFor: () => 10 }).draft;
  const profile: Profile = {
    language: "en", units: "kg", daysPerWeek: 4, sessionMinutes: 60, equipment: ["barbell", "dumbbell", "cable", "machine"],
    goal: { kind: "lift", exerciseId: bench, targetLoad: 100, targetReps: 5, targetDate: null }, heightCm: null, bodyweightKg: null,
  };
  await ctx.onboarding.complete({ profile, programme: draft });
  const active = (await ctx.programmes.getActive())!;
  return { ...ctx, bench, draft, active };
}

describe("short week data layer", () => {
  it("preview writes nothing and shows the cut list and the exposure change", async () => {
    const { shortWeek, programmes, db, active } = await setup();
    const p = await shortWeek.preview(2, 35);
    expect(p.rebuild.draft.days).toHaveLength(2);
    expect(p.rebuild.cuts.length).toBeGreaterThan(0);
    expect(p.exposure.length).toBeGreaterThan(0);
    expect((await programmes.getActive())!.versionId).toBe(active.versionId);
    expect((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM short_week"))!.n).toBe(0);
    await expect(shortWeek.preview(9, null)).rejects.toBeInstanceOf(ShortWeekInvalid);
  });

  it("apply saves a new programme version and remembers the original; goal lifts are never cut", async () => {
    const { shortWeek, programmes, active, bench } = await setup();
    const a = await shortWeek.apply(3, null, NOW);
    expect(a.originalVersionId).toBe(active.versionId);
    expect(a.weekStart).toBe("2026-09-28");
    const now = (await programmes.getActive())!;
    expect(now.version).toBe(active.version + 1);
    expect(now.versionId).toBe(a.shortVersionId);
    const d = await programmes.loadDraft(now.versionId);
    expect(d.days).toHaveLength(3);
    expect(d.days.flatMap((x) => x.exercises).some((e) => e.exerciseId === bench && e.isGoalLift)).toBe(true);
    await expect(shortWeek.apply(2, null, NOW)).rejects.toBeInstanceOf(ShortWeekActive);
  });

  it("undo brings the original programme back as another new version", async () => {
    const { shortWeek, programmes, active, draft } = await setup();
    await shortWeek.apply(2, 30, NOW);
    expect((await shortWeek.undo()).restored).toBe(true);
    const now = (await programmes.getActive())!;
    expect(now.version).toBe(active.version + 2);
    expect(await programmes.loadDraft(now.versionId)).toEqual(draft);
    expect(await shortWeek.getActive()).toBeNull();
    expect((await shortWeek.undo()).restored).toBe(false);
  });

  it("the original returns by itself when a new training week starts, not before", async () => {
    const { shortWeek, programmes, draft } = await setup();
    await shortWeek.apply(2, null, NOW);
    expect(await shortWeek.endIfExpired(NOW + 2 * DAY)).toEqual({ ended: false, restored: false }); // Sunday, same week
    expect((await shortWeek.getActive())).not.toBeNull();
    expect(await shortWeek.endIfExpired(NOW + 3 * DAY + 1000)).toEqual({ ended: true, restored: true }); // Monday 2026-10-05 12:00
    expect(await programmes.loadDraft((await programmes.getActive())!.versionId)).toEqual(draft);
    expect(await shortWeek.getActive()).toBeNull();
  });

  it("if the lifter edited the programme during the short week, their edit is kept", async () => {
    const { shortWeek, programmes, active } = await setup();
    const a = await shortWeek.apply(3, null, NOW);
    const d = await programmes.loadDraft(a.shortVersionId);
    d.days[0]!.name = "My own name";
    await programmes.saveNewVersion(active.programmeId, d);
    expect(await shortWeek.undo()).toEqual({ restored: false });
    expect((await programmes.loadDraft((await programmes.getActive())!.versionId)).days[0]!.name).toBe("My own name");
    expect(await shortWeek.getActive()).toBeNull();
  });

  it("refuses while a workout is open and leaves nothing half-done", async () => {
    const { shortWeek, workout, repos, db, programmes, active } = await setup();
    const next = (await repos.getNextDay())!;
    await workout.startOrResumeSession(next.day.id, (await repos.getActiveGymId())!);
    await expect(shortWeek.apply(2, null, NOW)).rejects.toBeInstanceOf(SessionInProgress);
    expect((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM short_week"))!.n).toBe(0);
    expect((await programmes.getActive())!.versionId).toBe(active.versionId);
  });

  it("past sessions stay readable: a session logged on the original version still resolves after the rebuild", async () => {
    const { shortWeek, workout, repos, db } = await setup();
    const next = (await repos.getNextDay())!;
    const { id } = await workout.startOrResumeSession(next.day.id, (await repos.getActiveGymId())!);
    await workout.finishSession(id);
    await shortWeek.apply(2, null, NOW);
    const s = await db.get<{ programme_day_id: string }>("SELECT programme_day_id FROM session WHERE id = ?", [id]);
    expect(await db.get("SELECT id FROM programme_day WHERE id = ? AND deleted_at IS NULL", [s!.programme_day_id])).not.toBeNull();
  });
});
