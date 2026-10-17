import { weekStartOf, type WeeklyChange } from "@gain/engine";
import { draftFingerprint, reduceDraftSetsByOne, validateDraft, type ProgrammeDraft } from "../logic/programmeDraft";
import { substitutionCandidates } from "../logic/substitutions";
import type { Db, Deps } from "./driver";
import type { FinishRepo } from "./finishRepo";
import type { GoalRepo } from "./goalRepo";
import type { ProgrammeRepo } from "./programmeRepo";
import type { Repos } from "./repos";
import type { ShortWeekRepo } from "./shortWeekRepo";
import { DELOAD_SETTING } from "./deloadRepo";
import { ReviewAlreadyDecided } from "./weeklyRepo";

const DAY = 86_400_000;

/** The weekly proposals that can be applied to the program. */
export type PlanKind = Extract<WeeklyChange["kind"], "extra_exposure" | "variation" | "easier_week">;
export const isPlanKind = (k: WeeklyChange["kind"]): k is PlanKind => k === "extra_exposure" || k === "variation" || k === "easier_week";

/** One line of the preview / of the Undo chip. Names in both languages: the screen picks one. */
export type PlanLine =
  | { kind: "add"; dayName: string; nameEn: string; nameAr: string; sets: number; reps: number; load: number | null }
  | { kind: "swap"; fromEn: string; fromAr: string; toEn: string; toAr: string; weeks: 2 }
  | { kind: "fewer_sets"; setsBefore: number; setsAfter: number };

/** Why an accepted change is only recorded, not applied. */
export type RecordReason = "deload_active" | "short_week" | "no_goal_lift" | "no_free_day" | "no_variation" | "already_active" | "no_program" | "nothing_to_change";

export type PlanPreview =
  | { kind: "apply"; change: PlanKind; lines: PlanLine[]; weekStart: string; endsAt: number }
  | { kind: "record"; change: PlanKind; reason: RecordReason };

/** What applying wrote into weekly_review.applied_json. */
export interface AppliedPlan {
  kind: "plan";
  change: PlanKind;
  programmeId: string;
  lines: PlanLine[];
}

export interface ActivePlan {
  reviewId: string;
  change: PlanKind;
  lines: PlanLine[];
  endsAt: number;
  /** The lifter saved their own program edit after the change was applied: reverting asks first (keep my edits / restore original). */
  conflict: boolean;
  /** The period is over but the original could not come back on its own (a conflict, or a workout is open). */
  expired: boolean;
}

type Row = { id: string; review_json: string; applied_json: string | null; original_version_id: string; applied_version_id: string; ends_at: number };

/**
 * Applies an accepted weekly change to the program as a TEMPORARY program version (the deload "sets" pattern): the version the lifter
 * had is remembered (original_version_id) next to the one written (applied_version_id). At ends_at, or on undo, the original comes back as
 * a NEW version, so every version (and every session logged on it) stays readable. Nothing is written by `preview`; `apply` is the tap.
 * If the lifter edited the program in between, nothing is reverted until they choose (keep my edits / restore original).
 */
export function createWeeklyPlanRepo(db: Db, deps: Deps, repos: Repos, goals: GoalRepo, programmes: ProgrammeRepo, finish: FinishRepo, shortWeek: ShortWeekRepo) {
  const { now } = deps;

  async function startsOn(): Promise<number> {
    const raw = await repos.getSetting("week_starts_on");
    const v = raw === null || raw === "" ? Number.NaN : Number(raw);
    return Number.isInteger(v) && v >= 0 && v <= 6 ? v : 1;
  }

  async function deloadActive(nowMs: number): Promise<"load" | "sets" | null> {
    const raw = await repos.getSetting(DELOAD_SETTING);
    if (!raw) return null;
    try {
      const v = JSON.parse(raw) as { status?: string; endsAt?: number };
      return (v.status === "load" || v.status === "sets") && typeof v.endsAt === "number" && nowMs < v.endsAt ? v.status : null;
    } catch {
      return null;
    }
  }

  async function openRow(): Promise<Row | null> {
    return (await db.get<Row>("SELECT id, review_json, applied_json, original_version_id, applied_version_id, ends_at FROM weekly_review WHERE applied_version_id IS NOT NULL AND ended_at IS NULL AND deleted_at IS NULL ORDER BY decided_at DESC LIMIT 1")) ?? null;
  }

  async function reviewChange(id: string): Promise<WeeklyChange> {
    const r = await db.get<{ status: string; review_json: string }>("SELECT status, review_json FROM weekly_review WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!r) throw new Error("Unknown review");
    if (r.status !== "open") throw new ReviewAlreadyDecided();
    return (JSON.parse(r.review_json) as { change: WeeklyChange }).change;
  }

  /** Builds the change on the current program. Pure read: writes nothing (the load forecast may create an exercise line, as Today's preview does). */
  async function plan(change: PlanKind, nowMs: number, tzOffsetMs: number): Promise<{ preview: PlanPreview; draft?: ProgrammeDraft; programmeId?: string; originalVersionId?: string }> {
    const record = (reason: RecordReason) => ({ preview: { kind: "record" as const, change, reason } });
    const v = await programmes.getActive();
    if (!v) return record("no_program");
    if (await openRow()) return record("already_active");
    if (await shortWeek.getActive()) return record("short_week");
    const deload = await deloadActive(nowMs);
    // A lighter week on top of a deload is never stacked; a deload "sets" version would also lose its own way back under another version.
    if (deload === "sets" || (deload === "load" && change === "easier_week")) return record("deload_active");
    const original = await programmes.loadDraft(v.versionId);
    const weekStart = weekStartOf(nowMs + tzOffsetMs, await startsOn());
    const endsAt = Date.parse(`${weekStart}T00:00:00.000Z`) - tzOffsetMs + (change === "variation" ? 14 : 7) * DAY;
    const done = (draft: ProgrammeDraft, lines: PlanLine[]) => {
      if (draftFingerprint(draft) === draftFingerprint(original)) return record("nothing_to_change");
      if (validateDraft(draft).length > 0) return record("nothing_to_change");
      return { preview: { kind: "apply" as const, change, lines, weekStart, endsAt }, draft, programmeId: v.programmeId, originalVersionId: v.versionId };
    };
    const count = (d: ProgrammeDraft) => d.days.reduce((n, day) => n + day.exercises.reduce((m, e) => m + e.sets, 0), 0);

    if (change === "easier_week") {
      const draft = reduceDraftSetsByOne(original);
      return done(draft, [{ kind: "fewer_sets", setsBefore: count(original), setsAfter: count(draft) }]);
    }

    const goal = await goals.getGoal();
    const goalId = goal?.kind === "lift" ? goal.exerciseId : null;
    const slot = goalId ? original.days.flatMap((d) => d.exercises).find((e) => e.exerciseId === goalId) : undefined;
    if (!goalId || !slot) return record("no_goal_lift");
    const lib = await programmes.listExercises();
    const goalEx = lib.find((e) => e.id === goalId);
    if (!goalEx) return record("no_goal_lift");

    if (change === "extra_exposure") {
      const next = await repos.getNextDay();
      const n = original.days.length;
      const start = next ? next.day.position % n : 0;
      let at = -1;
      for (let k = 0; k < n; k++) {
        const i = (start + k) % n;
        if (!original.days[i]!.exercises.some((e) => e.exerciseId === goalId)) {
          at = i;
          break;
        }
      }
      if (at < 0) return record("no_free_day");
      // The load the lift would get now (the same engine run as Today's preview), shown in the preview. Null = no history yet.
      let load: number | null = null;
      let reps = slot.repMin;
      const gymId = await repos.getActiveGymId();
      const days = await repos.listDays(v.versionId);
      const home = days[original.days.findIndex((d) => d.exercises.some((e) => e.exerciseId === goalId))];
      if (gymId && home) {
        const prop = (await finish.previewDayLoads(home.id, gymId)).find((x) => x.exerciseId === goalId)?.proposal;
        if (prop?.load != null) load = prop.load;
        if (prop?.reps != null) reps = prop.reps;
      }
      const draft: ProgrammeDraft = { ...original, days: original.days.map((d, i) => (i === at ? { ...d, exercises: [...d.exercises, { ...slot }] } : d)) };
      return done(draft, [{ kind: "add", dayName: original.days[at]!.name, nameEn: goalEx.nameEn, nameAr: goalEx.nameAr, sets: slot.sets, reps, load }]);
    }

    // Two-week variation: the highest-ranked substitution at this gym (one not in the program yet first), never one already on a day that
    // has the goal lift (a day cannot hold an exercise twice). It is another exercise, so it has its own line.
    const gymId = await repos.getActiveGymId();
    const gymEquipment = gymId ? (await repos.loadGymFingerprint(gymId)).loads.map((l) => l.equipment) : [];
    const inProgramme = new Set(original.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)));
    const onGoalDays = original.days.filter((d) => d.exercises.some((e) => e.exerciseId === goalId)).flatMap((d) => d.exercises.map((e) => e.exerciseId));
    const cands = substitutionCandidates({ current: goalEx, library: lib, gymEquipment, exclude: onGoalDays });
    const sub = cands.find((e) => !inProgramme.has(e.id)) ?? cands[0];
    if (!sub) return record("no_variation");
    const draft: ProgrammeDraft = { ...original, days: original.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => (e.exerciseId === goalId ? { ...e, exerciseId: sub.id } : e)) })) };
    return done(draft, [{ kind: "swap", fromEn: goalEx.nameEn, fromAr: goalEx.nameAr, toEn: sub.nameEn, toAr: sub.nameAr, weeks: 2 }]);
  }

  /** What tapping Apply would do, or why the decision would only be recorded. Writes nothing. */
  async function preview(reviewId: string, nowMs: number = now(), tzOffsetMs = 0): Promise<PlanPreview> {
    const change = await reviewChange(reviewId);
    if (!isPlanKind(change.kind)) throw new Error("This proposal does not change the program");
    return (await plan(change.kind, nowMs, tzOffsetMs)).preview;
  }

  /**
   * The Apply tap: writes the new program version and the record that brings the original back, in ONE transaction. When the change
   * cannot be applied (see RecordReason) the decision is recorded only, as before. Throws SessionInProgress if a workout is open.
   */
  async function apply(reviewId: string, nowMs: number = now(), tzOffsetMs = 0): Promise<PlanPreview> {
    const change = await reviewChange(reviewId);
    if (!isPlanKind(change.kind)) throw new Error("This proposal does not change the program");
    const p = await plan(change.kind, nowMs, tzOffsetMs);
    const t = now();
    if (p.preview.kind === "record" || !p.draft || !p.programmeId || !p.originalVersionId) {
      await db.run("UPDATE weekly_review SET status = 'accepted', applied_json = NULL, decided_at = ?, updated_at = ? WHERE id = ?", [t, t, reviewId]);
      return p.preview;
    }
    const pv = p.preview;
    const originalVersionId = p.originalVersionId;
    const applied: AppliedPlan = { kind: "plan", change: change.kind, programmeId: p.programmeId, lines: pv.lines };
    await programmes.saveNewVersion(p.programmeId, p.draft, {
      alsoInTransaction: async (versionId) =>
        void (await db.run(
          "UPDATE weekly_review SET status = 'accepted', applied_json = ?, original_version_id = ?, applied_version_id = ?, ends_at = ?, decided_at = ?, updated_at = ? WHERE id = ?",
          [JSON.stringify(applied), originalVersionId, versionId, pv.endsAt, t, t, reviewId],
        )),
    });
    return pv;
  }

  async function latestOf(programmeId: string): Promise<string | null> {
    return (await db.get<{ id: string }>("SELECT id FROM programme_version WHERE programme_id = ? AND deleted_at IS NULL ORDER BY version DESC LIMIT 1", [programmeId]))?.id ?? null;
  }

  async function getActive(nowMs: number = now()): Promise<ActivePlan | null> {
    const r = await openRow();
    if (!r?.applied_json) return null;
    const a = JSON.parse(r.applied_json) as AppliedPlan;
    return { reviewId: r.id, change: a.change, lines: a.lines, endsAt: r.ends_at, conflict: (await latestOf(a.programmeId)) !== r.applied_version_id, expired: nowMs >= r.ends_at };
  }

  async function finishRow(r: Row, how: "ended" | "undone" | "kept_edits" | "restored", restore: boolean): Promise<void> {
    const a = JSON.parse(r.applied_json!) as AppliedPlan;
    if (restore) {
      const onActive = (await programmes.getActive())?.programmeId === a.programmeId;
      // "Re-activate" the original: its days and exercises come back as a NEW version. No version is ever deleted.
      await programmes.saveNewVersion(a.programmeId, await programmes.loadDraft(r.original_version_id), { background: !onActive });
    }
    const t = now();
    await db.run("UPDATE weekly_review SET ended_at = ?, ended_how = ?, updated_at = ? WHERE id = ?", [t, how, t, r.id]);
  }

  /**
   * One-tap undo. The original comes back unless the lifter edited the program since: then nothing changes and `{ conflict: true }`
   * asks the screen to offer keep my edits / restore original (see resolve). Throws SessionInProgress if a workout is open.
   */
  async function undo(): Promise<{ conflict: boolean }> {
    const r = await openRow();
    if (!r?.applied_json) return { conflict: false };
    const a = JSON.parse(r.applied_json) as AppliedPlan;
    if ((await latestOf(a.programmeId)) !== r.applied_version_id) return { conflict: true };
    await finishRow(r, "undone", true);
    return { conflict: false };
  }

  /** The lifter's answer to the conflict sheet: keep the program as they edited it, or put the original back over their edit. */
  async function resolve(choice: "keep" | "restore"): Promise<void> {
    const r = await openRow();
    if (!r?.applied_json) return;
    await finishRow(r, choice === "keep" ? "kept_edits" : "restored", choice === "restore");
  }

  /** Called when Today opens: a change whose period is over is reverted, unless the lifter edited the program (then Today asks). */
  async function endIfExpired(nowMs: number = now()): Promise<{ ended: boolean; conflict: boolean }> {
    const r = await openRow();
    if (!r?.applied_json || nowMs < r.ends_at) return { ended: false, conflict: false };
    const a = JSON.parse(r.applied_json) as AppliedPlan;
    if ((await latestOf(a.programmeId)) !== r.applied_version_id) return { ended: false, conflict: true };
    await finishRow(r, "ended", true);
    return { ended: true, conflict: false };
  }

  return { preview, apply, getActive, undo, resolve, endIfExpired };
}
export type WeeklyPlanRepo = ReturnType<typeof createWeeklyPlanRepo>;
