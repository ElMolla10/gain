import { describe, expect, it } from "vitest";
import type { WeeklyChange } from "@gain/engine";
import { DELOAD_SETTING } from "../src/db/deloadRepo";
import { SessionInProgress } from "../src/db/programmeRepo";
import { ReviewAlreadyDecided } from "../src/db/weeklyRepo";
import { loadTableInfo } from "../src/sync/schema";
import { freshDb } from "./helpers";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 2, 12); // Friday 2 Oct 2026; this week starts Monday 28 Sep
const WEEK_END = Date.UTC(2026, 9, 5); // Monday 5 Oct 00:00 UTC

async function setup() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const lib = await ctx.programmes.listExercises();
  const bench = lib.find((e) => e.seedKey === "bench_press")!;
  const name = (id: string) => lib.find((e) => e.id === id)?.seedKey;
  await ctx.goals.setGoal({ kind: "lift", exerciseId: bench.id, targetLoad: 100, targetReps: 5, targetDate: null });
  let n = 0;
  /** An open weekly review proposing `change` (the rule itself is tested in weekly.test.ts). */
  async function review(change: WeeklyChange): Promise<string> {
    const id = `r${++n}`;
    const rv = { ruleVersion: "weekly-v1", weekStart: `2026-09-${String(10 + n).padStart(2, "0")}`, thin: false, observed: { sessionsDone: 4, plannedSessions: 4, attendance: 1, goalStatus: "behind" }, change, reason: "behind_add_exposure" };
    await ctx.db.run("INSERT INTO weekly_review (id, week_start, rule_version, inputs_json, review_json, status, created_at, updated_at) VALUES (?, ?, 'weekly-v1', '{}', ?, 'open', 1, 1)", [id, rv.weekStart, JSON.stringify(rv)]);
    return id;
  }
  const active = async () => (await ctx.programmes.getActive())!;
  const draft = async () => ctx.programmes.loadDraft((await active()).versionId);
  const versions = async () => Number((await ctx.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM programme_version WHERE deleted_at IS NULL"))!.n);
  const row = async (id: string) => (await ctx.db.get<{ status: string; original_version_id: string | null; applied_version_id: string | null; ends_at: number | null; ended_at: number | null; ended_how: string | null }>("SELECT status, original_version_id, applied_version_id, ends_at, ended_at, ended_how FROM weekly_review WHERE id = ?", [id]))!;
  return { ...ctx, bench, name, review, active, draft, versions, row };
}

describe("weekly review applies to the program (versioned, undoable)", () => {
  it("easier week: the preview writes nothing; Apply saves a version with one set fewer, and it reverts after endsAt", async () => {
    const c = await setup();
    const before = await c.active();
    const sets = (await c.draft()).days.flatMap((d) => d.exercises.map((e) => e.sets));
    const id = await c.review({ kind: "easier_week" });
    const v0 = await c.versions();
    const pv = await c.weeklyPlan.preview(id, NOW);
    expect(pv).toMatchObject({ kind: "apply", change: "easier_week", endsAt: WEEK_END, lines: [{ kind: "fewer_sets", setsBefore: sets.reduce((a, b) => a + b, 0) }] });
    expect(await c.versions()).toBe(v0); // nothing written by the preview
    expect((await c.row(id)).status).toBe("open");

    await c.weeklyPlan.apply(id, NOW);
    const after = await c.active();
    expect(after.versionId).not.toBe(before.versionId);
    expect((await c.draft()).days.flatMap((d) => d.exercises.map((e) => e.sets))).toEqual(sets.map((s) => Math.max(1, s - 1)));
    expect(await c.row(id)).toMatchObject({ status: "accepted", original_version_id: before.versionId, applied_version_id: after.versionId, ends_at: WEEK_END, ended_at: null });
    expect(await c.weeklyPlan.getActive(NOW)).toMatchObject({ reviewId: id, change: "easier_week", conflict: false, expired: false });
    await expect(c.weeklyPlan.apply(id, NOW)).rejects.toBeInstanceOf(ReviewAlreadyDecided);

    expect(await c.weeklyPlan.endIfExpired(WEEK_END - 1)).toEqual({ ended: false, conflict: false });
    expect(await c.weeklyPlan.endIfExpired(WEEK_END)).toEqual({ ended: true, conflict: false });
    expect((await c.draft()).days.flatMap((d) => d.exercises.map((e) => e.sets))).toEqual(sets);
    expect(await c.versions()).toBe(v0 + 2); // the original came back as a NEW version; none deleted
    expect(await c.row(id)).toMatchObject({ ended_how: "ended" });
    expect(await c.weeklyPlan.getActive(WEEK_END)).toBeNull();
  });

  it("easier week is not stacked on an active deload: the decision is only recorded", async () => {
    const c = await setup();
    await c.repos.setSetting(DELOAD_SETTING, JSON.stringify({ status: "load", weekStart: "2026-09-28", endsAt: WEEK_END }));
    const id = await c.review({ kind: "easier_week" });
    const v0 = await c.versions();
    expect(await c.weeklyPlan.preview(id, NOW)).toEqual({ kind: "record", change: "easier_week", reason: "deload_active" });
    expect(await c.weeklyPlan.apply(id, NOW)).toMatchObject({ kind: "record", reason: "deload_active" });
    expect(await c.versions()).toBe(v0);
    expect(await c.row(id)).toMatchObject({ status: "accepted", applied_version_id: null });
  });

  it("a deload is not suggested on top of an active easier week", async () => {
    const c = await setup();
    await c.weeklyPlan.apply(await c.review({ kind: "easier_week" }), NOW);
    expect(await c.deload.getState(NOW)).toEqual({ status: "none" });
  });

  it("one more exposure: the goal lift (its planned sets) is added to the next planned day that does not have it, for 7 days", async () => {
    const c = await setup();
    const slot = (await c.draft()).days[0]!.exercises.find((e) => e.exerciseId === c.bench.id)!;
    const id = await c.review({ kind: "extra_exposure" });
    const pv = await c.weeklyPlan.preview(id, NOW);
    // Rotation starts at Upper A (it already has bench), so the next day without it is Lower A.
    expect(pv).toMatchObject({ kind: "apply", endsAt: WEEK_END, lines: [{ kind: "add", dayName: "Lower A", nameEn: c.bench.nameEn, sets: slot.sets }] });
    await c.weeklyPlan.apply(id, NOW);
    const d = await c.draft();
    expect(d.days[1]!.exercises.at(-1)).toMatchObject({ exerciseId: c.bench.id, sets: slot.sets, repMin: slot.repMin, repMax: slot.repMax });
    expect(d.days.filter((x) => x.exercises.some((e) => e.exerciseId === c.bench.id)).map((x) => x.name)).toEqual(["Upper A", "Lower A"]);
    await c.weeklyPlan.endIfExpired(WEEK_END);
    expect((await c.draft()).days[1]!.exercises.some((e) => e.exerciseId === c.bench.id)).toBe(false);
  });

  it("one more exposure is only recorded during a short week, and when the goal lift is not in the program", async () => {
    const c = await setup();
    await c.shortWeek.apply(3, null, NOW);
    const a = await c.review({ kind: "extra_exposure" });
    expect(await c.weeklyPlan.apply(a, NOW)).toMatchObject({ kind: "record", reason: "short_week" });
    await c.shortWeek.undo();
    const own = await c.programmes.createExercise({ nameEn: "Floor press", pattern: "horizontal_push", equipment: "barbell", setup: "free" });
    await c.goals.setGoal({ kind: "lift", exerciseId: own, targetLoad: 100, targetReps: 5, targetDate: null });
    const b = await c.review({ kind: "extra_exposure" });
    const v0 = await c.versions();
    expect(await c.weeklyPlan.apply(b, NOW)).toMatchObject({ kind: "record", reason: "no_goal_lift" });
    expect(await c.row(b)).toMatchObject({ status: "accepted", applied_version_id: null });
    expect(await c.versions()).toBe(v0);
  });

  it("two-week variation: the goal lift is swapped for its top substitution (its own exercise, so its own line) and swapped back after 14 days", async () => {
    const c = await setup();
    const before = await c.draft();
    const id = await c.review({ kind: "variation", weeks: 2 });
    const pv = await c.weeklyPlan.preview(id, NOW);
    expect(pv).toMatchObject({ kind: "apply", change: "variation", endsAt: WEEK_END + 7 * DAY, lines: [{ kind: "swap", fromEn: c.bench.nameEn }] });
    const to = pv.kind === "apply" && pv.lines[0]!.kind === "swap" ? pv.lines[0]!.toEn : "";
    await c.weeklyPlan.apply(id, NOW);
    const ids = (await c.draft()).days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    expect(ids).not.toContain(c.bench.id);
    const sub = (await c.programmes.listExercises()).find((e) => e.nameEn === to)!;
    expect(ids).toContain(sub.id);
    expect((await c.weeklyPlan.endIfExpired(WEEK_END)).ended).toBe(false); // still inside the 2 weeks
    expect((await c.weeklyPlan.endIfExpired(WEEK_END + 7 * DAY)).ended).toBe(true);
    expect(await c.draft()).toEqual(before);
  });

  it("an edit by the lifter during the period is never clobbered: revert asks (keep my edits / restore original)", async () => {
    const c = await setup();
    const original = await c.draft();
    const id = await c.review({ kind: "easier_week" });
    await c.weeklyPlan.apply(id, NOW);
    const edited = await c.draft();
    edited.days[0]!.name = "My upper";
    await c.programmes.saveNewVersion((await c.active()).programmeId, edited);
    expect(await c.weeklyPlan.getActive(NOW)).toMatchObject({ conflict: true });
    expect(await c.weeklyPlan.undo()).toEqual({ conflict: true });
    expect(await c.weeklyPlan.endIfExpired(WEEK_END)).toEqual({ ended: false, conflict: true });
    expect((await c.draft()).days[0]!.name).toBe("My upper"); // untouched until the lifter chooses
    expect(await c.weeklyPlan.getActive(WEEK_END)).toMatchObject({ conflict: true, expired: true });

    await c.weeklyPlan.resolve("keep");
    expect((await c.draft()).days[0]!.name).toBe("My upper");
    expect(await c.row(id)).toMatchObject({ ended_how: "kept_edits" });
    expect(await c.weeklyPlan.getActive(WEEK_END)).toBeNull();

    // The other answer puts the original back over the edit.
    const id2 = await c.review({ kind: "easier_week" });
    const base2 = await c.draft();
    await c.weeklyPlan.apply(id2, NOW);
    const e2 = await c.draft();
    e2.days[1]!.name = "My lower";
    await c.programmes.saveNewVersion((await c.active()).programmeId, e2);
    await c.weeklyPlan.resolve("restore");
    expect(await c.draft()).toEqual(base2);
    expect(await c.row(id2)).toMatchObject({ ended_how: "restored" });
    expect(original.days[0]!.name).toBe("Upper A");
  });

  it("undo puts the original back at once; old sessions keep their version; a workout in progress blocks it", async () => {
    const c = await setup();
    const before = await c.draft();
    const id = await c.review({ kind: "extra_exposure" });
    await c.weeklyPlan.apply(id, NOW);
    const appliedVersion = (await c.active()).versionId;
    await c.db.run("INSERT INTO session (id, programme_version_id, programme_day_id, gym_id, status, started_at, created_at, updated_at) SELECT 'open1', pv.id, pd.id, ?, 'in_progress', 1, 1, 1 FROM programme_version pv JOIN programme_day pd ON pd.programme_version_id = pv.id WHERE pv.id = ? AND pd.id NOT IN (SELECT programme_day_id FROM session WHERE deleted_at IS NULL) LIMIT 1", [await c.repos.getActiveGymId(), appliedVersion]);
    await expect(c.weeklyPlan.undo()).rejects.toBeInstanceOf(SessionInProgress);
    expect(await c.weeklyPlan.getActive(NOW)).not.toBeNull();
    await c.db.run("UPDATE session SET status = 'finished', finished_at = 2, updated_at = 2 WHERE id = 'open1'");
    expect(await c.weeklyPlan.undo()).toEqual({ conflict: false });
    expect(await c.draft()).toEqual(before);
    expect(await c.row(id)).toMatchObject({ ended_how: "undone" });
    expect(await c.weeklyPlan.getActive(NOW)).toBeNull();
    // The session logged on the applied version still reads its own days.
    expect((await c.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM programme_day WHERE programme_version_id = ? AND deleted_at IS NULL", [appliedVersion]))!.n).toBeGreaterThan(0);
  });

  it("a second change is not stacked while one is active", async () => {
    const c = await setup();
    await c.weeklyPlan.apply(await c.review({ kind: "variation", weeks: 2 }), NOW);
    expect(await c.weeklyPlan.preview(await c.review({ kind: "easier_week" }), NOW + 7 * DAY)).toMatchObject({ kind: "record", reason: "already_active" });
  });

  it("the new columns are nullable and synced (sync reads every column of weekly_review; backups copy whole rows)", async () => {
    const c = await setup();
    const cols = await c.db.all<{ name: string; notnull: number }>("PRAGMA table_info(weekly_review)");
    for (const n of ["original_version_id", "applied_version_id", "ends_at", "ended_at", "ended_how"]) expect(cols.find((x) => x.name === n), n).toMatchObject({ notnull: 0 });
    expect((await loadTableInfo(c.db)).get("weekly_review")!.cols).toEqual(expect.arrayContaining(["original_version_id", "applied_version_id", "ends_at"]));
  });
});
