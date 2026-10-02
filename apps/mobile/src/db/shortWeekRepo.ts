import { weekStartOf } from "@gain/engine";
import { diffExposure, computeExposure, type ExposureChange, type MuscleGroup } from "../logic/exposure";
import type { ProgrammeDraft } from "../logic/programmeDraft";
import { rebuildShortWeek, type Cut, type Rebuild, type RebuildError } from "../logic/shortWeek";
import type { Db, Deps } from "./driver";
import type { GoalRepo } from "./goalRepo";
import { SessionInProgress, type ProgrammeRepo } from "./programmeRepo";
import type { Repos } from "./repos";

export class ShortWeekActive extends Error {
  constructor() {
    super("A short week is already active. Undo it first.");
  }
}
export class ShortWeekInvalid extends Error {
  constructor(public readonly code: RebuildError) {
    super(`Short week is not valid: ${code}`);
  }
}

export interface ShortWeekPreview {
  original: ProgrammeDraft;
  rebuild: Rebuild;
  /** What the week does to sets and sessions per muscle (normal week of the programme vs this week). */
  exposure: ExposureChange[];
  programmeId: string;
  originalVersionId: string;
}

export interface ActiveShortWeek {
  id: string;
  programmeId: string;
  originalVersionId: string;
  shortVersionId: string;
  weekStart: string;
  days: number;
  minutes: number | null;
  cuts: Cut[];
}

type Row = { id: string; programme_id: string; original_version_id: string; short_version_id: string; week_start: string; days: number; minutes: number | null; cuts_json: string; status: string };
const toActive = (r: Row): ActiveShortWeek => ({ id: r.id, programmeId: r.programme_id, originalVersionId: r.original_version_id, shortVersionId: r.short_version_id, weekStart: r.week_start, days: r.days, minutes: r.minutes, cuts: JSON.parse(r.cuts_json) as Cut[] });

/**
 * Short-week rebuild data layer. `preview` writes nothing. `apply` saves the rebuilt week as a NEW programme version of the active
 * programme (so history stays readable) and remembers the original version. The original comes back as another new version when the
 * week ends or on undo; if the lifter edited the programme in between, their edit is kept and nothing is overwritten.
 */
export function createShortWeekRepo(db: Db, deps: Deps, repos: Repos, programmes: ProgrammeRepo, goals: GoalRepo) {
  const { newId, now } = deps;

  async function priorityOf(): Promise<MuscleGroup[]> {
    const g = await goals.getGoal();
    return g && g.kind === "muscle" ? [g.muscle] : [];
  }
  async function patternMap(): Promise<Map<string, string>> {
    return new Map((await programmes.listExercises()).map((e) => [e.id, e.pattern]));
  }

  async function startsOn(): Promise<number> {
    const raw = await repos.getSetting("week_starts_on");
    const v = raw === null || raw === "" ? Number.NaN : Number(raw);
    return Number.isInteger(v) && v >= 0 && v <= 6 ? v : 1;
  }

  async function getActive(): Promise<ActiveShortWeek | null> {
    const r = await db.get<Row>("SELECT * FROM short_week WHERE status = 'active' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1");
    return r ? toActive(r) : null;
  }

  async function preview(days: number, minutes: number | null): Promise<ShortWeekPreview> {
    const v = await programmes.getActive();
    if (!v) throw new Error("No programme");
    const cur = await getActive();
    // Rebuild from the ORIGINAL programme, never from an earlier short week.
    const originalVersionId = cur ? cur.originalVersionId : v.versionId;
    const original = await programmes.loadDraft(originalVersionId);
    const pm = await patternMap();
    const patternOf = (id: string) => pm.get(id);
    const r = rebuildShortWeek(original, { days, minutes, patternOf, extraPriority: await priorityOf() });
    if (typeof r === "string") throw new ShortWeekInvalid(r);
    const before = computeExposure(original, patternOf, original.days.length);
    const after = computeExposure(r.draft, patternOf, r.draft.days.length);
    return { original, rebuild: r, exposure: diffExposure(before, after), programmeId: v.programmeId, originalVersionId };
  }

  /** Saves the preview as a new programme version. Throws SessionInProgress (from the programme repo) if a workout is open. */
  async function apply(days: number, minutes: number | null, nowMs: number = now(), tzOffsetMs = 0): Promise<ActiveShortWeek> {
    if (await getActive()) throw new ShortWeekActive();
    const p = await preview(days, minutes);
    const saved = await programmes.saveNewVersion(p.programmeId, p.rebuild.draft);
    const id = newId();
    const t = now();
    const weekStart = weekStartOf(nowMs + tzOffsetMs, await startsOn());
    await db.run(
      "INSERT INTO short_week (id, programme_id, original_version_id, short_version_id, week_start, days, minutes, cuts_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)",
      [id, p.programmeId, p.originalVersionId, saved.versionId, weekStart, days, minutes, JSON.stringify(p.rebuild.cuts), t, t],
    );
    return (await getActive())!;
  }

  async function restore(a: ActiveShortWeek, status: "ended" | "undone"): Promise<{ restored: boolean }> {
    const latest = await db.get<{ id: string }>("SELECT id FROM programme_version WHERE programme_id = ? AND deleted_at IS NULL ORDER BY version DESC LIMIT 1", [a.programmeId]);
    const t = now();
    // The lifter edited the programme after the short week started: keep their edit, do not overwrite it.
    if (!latest || latest.id !== a.shortVersionId) {
      await db.run("UPDATE short_week SET status = 'superseded', ended_at = ?, updated_at = ? WHERE id = ?", [t, t, a.id]);
      return { restored: false };
    }
    const original = await programmes.loadDraft(a.originalVersionId);
    const saved = await programmes.saveNewVersion(a.programmeId, original);
    await db.run("UPDATE short_week SET status = ?, restored_version_id = ?, ended_at = ?, updated_at = ? WHERE id = ?", [status, saved.versionId, t, t, a.id]);
    return { restored: true };
  }

  /** Put the normal programme back now. */
  async function undo(): Promise<{ restored: boolean }> {
    const a = await getActive();
    if (!a) return { restored: false };
    return restore(a, "undone");
  }

  /** Called when Today opens: a new training week has begun, so the normal programme returns. Returns whether anything was restored. */
  async function endIfExpired(nowMs: number = now(), tzOffsetMs = 0): Promise<{ ended: boolean; restored: boolean }> {
    const a = await getActive();
    if (!a) return { ended: false, restored: false };
    if (weekStartOf(nowMs + tzOffsetMs, await startsOn()) <= a.weekStart) return { ended: false, restored: false };
    try {
      return { ended: true, ...(await restore(a, "ended")) };
    } catch (e) {
      // A workout is open: try again the next time Today opens.
      if (e instanceof SessionInProgress) return { ended: false, restored: false };
      throw e;
    }
  }

  return { preview, apply, getActive, undo, endIfExpired };
}
export type ShortWeekRepo = ReturnType<typeof createShortWeekRepo>;
