import {
  isGymLoad,
  REJECTION_THRESHOLD,
  findSpec,
  type GymFingerprint,
  type LineIdentity,
  type LoggedSet,
  type Measure,
  type Proposal,
  type ReasonText,
  type SetupType,
} from "@gain/engine";
import type { Db, Deps } from "./driver";
import type { Repos } from "./repos";
import type { WorkoutRepo } from "./workoutRepo";
import { summarizeExercise, type ExerciseSummary } from "../logic/summary";
import type { DecisionPayload } from "../logic/why";

export type TargetStatus = "proposed" | "accepted" | "edited" | "rejected";

export interface TargetRow {
  id: string;
  sessionId: string;
  exerciseId: string;
  lineId: string;
  nameEn: string;
  nameAr: string;
  load: number | null;
  reps: number | null;
  /** How the exercise is counted; for time / distance the target is `durationS` / `distanceM` and `reps` is null. */
  measure: Measure;
  durationS: number | null;
  distanceM: number | null;
  targetRir: number | null;
  quality: string | null;
  plannedSets: number | null;
  currency: "reps" | "effort" | "quality" | "load" | "none";
  jumpKind: string | null;
  ruleVersion: string;
  path: "rule" | "model";
  status: TargetStatus;
  reason: ReasonText;
  confidence: string;
  editedLoad: number | null;
  /** What the lifter should load: the edited load if they edited, else the proposed load. Null when rejected or nothing proposed. */
  effectiveLoad: number | null;
}

interface RawTarget {
  id: string;
  session_id: string;
  exercise_id: string;
  line_id: string;
  name_en: string;
  name_ar: string;
  load: number | null;
  reps: number | null;
  measure: Measure;
  duration_s: number | null;
  distance_m: number | null;
  target_rir: number | null;
  quality: string | null;
  planned_sets: number | null;
  currency: TargetRow["currency"];
  jump_kind: string | null;
  rule_version: string;
  path: "rule" | "model";
  status: TargetStatus;
  reason_key: ReasonText["key"];
  reason_params_json: string;
  confidence: string;
  edited_load: number | null;
}

const toTarget = (r: RawTarget): TargetRow => ({
  id: r.id,
  sessionId: r.session_id,
  exerciseId: r.exercise_id,
  lineId: r.line_id,
  nameEn: r.name_en,
  nameAr: r.name_ar,
  load: r.load,
  reps: r.reps,
  measure: r.measure,
  durationS: r.duration_s,
  distanceM: r.distance_m,
  targetRir: r.target_rir,
  quality: r.quality,
  plannedSets: r.planned_sets,
  currency: r.currency,
  jumpKind: r.jump_kind,
  ruleVersion: r.rule_version,
  path: r.path,
  status: r.status,
  reason: { key: r.reason_key, params: JSON.parse(r.reason_params_json) as ReasonText["params"] },
  confidence: r.confidence,
  editedLoad: r.edited_load,
  effectiveLoad: r.status === "rejected" ? null : r.status === "edited" ? r.edited_load : r.load,
});

/** Only jumps are remembered (load / effort / quality). Plain "one more rep" or "repeat" is not a jump the lifter can refuse. */
export const isRememberedKind = (kind: string | null): kind is string => !!kind && /^(load|effort|quality):/.test(kind);

/** What rejecting a target did to the rejection memory, so the screen can say it plainly. Null when the target was not a jump. */
export interface RejectionOutcome {
  jumpKind: string;
  count: number;
  max: number;
  blocked: boolean;
}

export interface SessionSummary {
  sessionId: string;
  exercises: (ExerciseSummary & { exerciseId: string; nameEn: string; nameAr: string })[];
  totals: { exercises: number; counted: number; warmups: number; unconfirmed: number; records: number };
}

export function createFinishRepo(db: Db, deps: Deps, repos: Repos, workout: WorkoutRepo) {
  const { newId, now } = deps;

  /** What counted, and what was a record, against each line's earlier FINISHED sessions. */
  async function summarizeSession(sessionId: string): Promise<SessionSummary> {
    const session = await workout.getSession(sessionId);
    if (!session) throw new Error("Unknown session");
    const rows = await workout.listSessionSets(sessionId);
    const byEx = new Map<string, typeof rows>();
    for (const r of rows) byEx.set(r.exerciseId, [...(byEx.get(r.exerciseId) ?? []), r]);
    const exercises: SessionSummary["exercises"] = [];
    for (const [exerciseId, sets] of byEx) {
      const meta = await db.get<{ name_en: string; name_ar: string; setup: SetupType; measure: Measure }>("SELECT name_en, name_ar, setup, measure FROM exercise WHERE id = ?", [exerciseId]);
      if (!meta) continue;
      const lineId = sets[0]!.lineId;
      const line: LineIdentity = { exerciseId, gymId: session.gym_id, setup: meta.setup };
      const prior = (await workout.getHistory(line, lineId)).filter((h) => h.performedAt < new Date(session.finished_at ?? now()).toISOString());
      const priorSets: LoggedSet[] = prior.flatMap((h) => h.sets);
      const today: LoggedSet[] = sets.map((s) => ({ load: s.load, reps: s.reps, durationS: s.durationS, distanceM: s.distanceM, rir: s.rir, warmup: s.warmup, tags: s.tags, outlierStatus: s.outlierStatus }));
      exercises.push({ exerciseId, nameEn: meta.name_en, nameAr: meta.name_ar, ...summarizeExercise(meta.setup, today, priorSets, meta.measure) });
    }
    return {
      sessionId,
      exercises,
      totals: {
        exercises: exercises.filter((e) => e.counted > 0).length,
        counted: exercises.reduce((n, e) => n + e.counted, 0),
        warmups: exercises.reduce((n, e) => n + e.warmups, 0),
        unconfirmed: exercises.reduce((n, e) => n + e.unconfirmed, 0),
        records: exercises.reduce((n, e) => n + e.records.length, 0),
      },
    };
  }

  const TARGET_SELECT = `SELECT t.id, t.session_id, t.exercise_id, t.line_id, e.name_en, e.name_ar, e.measure, t.load, t.reps, t.duration_s, t.distance_m, t.target_rir, t.quality,
      t.planned_sets, t.currency, t.jump_kind, t.rule_version, t.path, t.status, t.reason_key, t.reason_params_json, t.confidence, t.edited_load
    FROM target t JOIN exercise e ON e.id = t.exercise_id WHERE t.deleted_at IS NULL`;

  async function getTargets(sessionId: string): Promise<TargetRow[]> {
    // Programme order (the exercise's position in that day), not insertion order.
    const rows = await db.all<RawTarget>(
      `${TARGET_SELECT.replace("FROM target t JOIN exercise e ON e.id = t.exercise_id", "FROM target t JOIN exercise e ON e.id = t.exercise_id JOIN session s ON s.id = t.session_id LEFT JOIN programme_day_exercise pde ON pde.programme_day_id = s.programme_day_id AND pde.exercise_id = t.exercise_id AND pde.deleted_at IS NULL")}
       AND t.session_id = ? ORDER BY pde.position, e.name_en`,
      [sessionId],
    );
    return rows.map(toTarget);
  }

  async function getTarget(targetId: string): Promise<TargetRow | null> {
    const r = await db.get<RawTarget>(`${TARGET_SELECT} AND t.id = ?`, [targetId]);
    return r ? toTarget(r) : null;
  }

  async function getTargetForExercise(sessionId: string, exerciseId: string): Promise<TargetRow | null> {
    const r = await db.get<RawTarget>(`${TARGET_SELECT} AND t.session_id = ? AND t.exercise_id = ?`, [sessionId, exerciseId]);
    return r ? toTarget(r) : null;
  }

  /**
   * The next session is written at the door: when a workout finishes, the next programme day gets a planned session
   * and one target per exercise, each with its reason and logged inputs. Idempotent: existing targets are kept
   * (so accepted / edited / rejected choices are never overwritten); calling it again changes nothing.
   * Returns null when there is no next day or that day is already in progress.
   */
  async function writeNextSessionTargets(finishedSessionId: string): Promise<{ sessionId: string; dayName: string; created: number } | null> {
    const finished = await workout.getSession(finishedSessionId);
    if (!finished) throw new Error("Unknown session");
    return planNextSession(finished.gym_id);
  }

  /** Plans the next (suggested) programme day at this gym: a planned session plus a target per exercise. Same rules as writeNextSessionTargets. */
  async function planNextSession(gymId: string): Promise<{ sessionId: string; dayName: string; created: number } | null> {
    const next = await repos.getNextDay();
    if (!next) return null;
    return planDay(next.day.id, gymId);
  }

  /**
   * Plans ONE day of the active programme (the suggested one, or the one the lifter chose on Today): a planned session with a target per
   * exercise. Only one planned session exists at a time, so planned sessions for other days (a suggestion the lifter skipped, a day that
   * was missed) are voided: missed workouts never stack up. Finished and in-progress sessions are never touched. Null when that day's
   * workout is already in progress, or the day is not part of the active programme.
   */
  async function planDay(dayId: string, gymId: string): Promise<{ sessionId: string; dayName: string; created: number } | null> {
    const active = await repos.getLatestProgrammeVersion();
    if (!active) return null;
    const day = await db.get<{ id: string; name: string; programme_version_id: string }>("SELECT id, name, programme_version_id FROM programme_day WHERE id = ? AND deleted_at IS NULL", [dayId]);
    if (!day || day.programme_version_id !== active.versionId) return null;
    const open = await db.get<{ id: string; status: string }>(
      "SELECT id, status FROM session WHERE programme_day_id = ? AND status IN ('planned','in_progress') AND deleted_at IS NULL",
      [dayId],
    );
    if (open?.status === "in_progress") return null;
    return db.transaction(async () => {
      const t = now();
      const others = await db.all<{ id: string }>("SELECT id FROM session WHERE status = 'planned' AND deleted_at IS NULL AND programme_day_id <> ?", [dayId]);
      for (const o of others) {
        await db.run("UPDATE decision_log SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL AND target_id IN (SELECT id FROM target WHERE session_id = ?)", [t, t, o.id]);
        await db.run("UPDATE target SET deleted_at = ?, updated_at = ? WHERE session_id = ? AND deleted_at IS NULL", [t, t, o.id]);
        await db.run("UPDATE session SET deleted_at = ?, updated_at = ? WHERE id = ?", [t, t, o.id]);
      }
      let sessionId = open?.id;
      if (!sessionId) {
        sessionId = newId();
        await db.run(
          `INSERT INTO session (id, programme_version_id, programme_day_id, gym_id, status, planned_for, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'planned', ?, ?, ?)`,
          [sessionId, day.programme_version_id, dayId, gymId, new Date(t).toISOString().slice(0, 10), t, t],
        );
      }
      const created = await fillTargets(sessionId, dayId, gymId);
      return { sessionId, dayName: day.name, created };
    });
  }

  /**
   * Writes the missing targets of one planned session (one per exercise of its day) at the given gym.
   * Existing live targets are kept, so accepted / edited / rejected choices are never overwritten.
   * Reads first (the engine may create lines), then writes; call it inside or outside a transaction.
   */
  async function fillTargets(sessionId: string, dayId: string, gymId: string): Promise<number> {
    const gym: GymFingerprint = await repos.loadGymFingerprint(gymId);
    const exercises = await repos.listDayExercises(dayId);
    const decided: { ex: (typeof exercises)[number]; proposal: Proposal; lineId: string }[] = [];
    for (const ex of exercises) {
      const { proposal, lineId } = await workout.liveProposal(
        { exerciseId: ex.exerciseId, name: ex.nameEn, equipment: ex.equipment, setup: ex.setup, measure: ex.measure, repMin: ex.repMin, repMax: ex.repMax, repCeiling: ex.repCeiling, isGoalLift: ex.isGoalLift, trackEffort: ex.trackEffort, sets: ex.sets },
        gym,
      );
      decided.push({ ex, proposal, lineId });
    }
    {
      const t = now();
      let created = 0;
      for (const { ex, proposal, lineId } of decided) {
        const exists = await db.get("SELECT id FROM target WHERE session_id = ? AND exercise_id = ? AND deleted_at IS NULL", [sessionId, ex.exerciseId]);
        if (exists) continue;
        const targetId = newId();
        await db.run(
          `INSERT INTO target (id, session_id, exercise_id, line_id, load, reps, duration_s, distance_m, target_rir, quality, planned_sets, currency, jump_kind,
             rule_version, path, status, reason_key, reason_params_json, confidence, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'rule', 'proposed', ?, ?, ?, ?, ?)`,
          [targetId, sessionId, ex.exerciseId, lineId, proposal.load, proposal.reps, proposal.durationS ?? null, proposal.distanceM ?? null, proposal.targetRir, proposal.quality, proposal.sets, proposal.currency, proposal.jumpKind,
            proposal.ruleVersion, proposal.reason.key, JSON.stringify(proposal.reason.params), proposal.confidence, t, t],
        );
        const payload: DecisionPayload = {
          proposal: {
            load: proposal.load,
            reps: proposal.reps,
            durationS: proposal.durationS ?? null,
            distanceM: proposal.distanceM ?? null,
            currency: proposal.currency,
            jumpKind: proposal.jumpKind,
            confidence: proposal.confidence,
            reason: proposal.reason,
            warnings: proposal.warnings,
            needsModel: proposal.needsModel,
            targetRir: proposal.targetRir,
            quality: proposal.quality,
          },
          inputs: proposal.inputs,
        };
        await db.run(
          "INSERT INTO decision_log (id, target_id, rule_version, path, inputs_json, created_at, updated_at) VALUES (?, ?, ?, 'rule', ?, ?, ?)",
          [newId(), targetId, proposal.ruleVersion, JSON.stringify(payload), t, t],
        );
        created++;
      }
      return created;
    }
  }

  /**
   * After the active gym changes or its rack is edited, planned (not started) sessions must not keep targets that were
   * written for another rack. Same gym: proposed targets and any accepted / edited load that no longer exists are
   * dropped and rewritten; kept choices stay. Different gym: the session moves to the active gym and every target is rewritten.
   * Targets are soft-deleted, never physically removed.
   */
  async function refreshPlannedSessions(activeGymId: string): Promise<{ sessions: number; rewritten: number }> {
    const planned = await db.all<{ id: string; programme_day_id: string; gym_id: string }>(
      "SELECT id, programme_day_id, gym_id FROM session WHERE status = 'planned' AND deleted_at IS NULL",
    );
    const gym = await repos.loadGymFingerprint(activeGymId);
    let rewritten = 0;
    for (const s of planned) {
      const t = now();
      const targets = await getTargets(s.id);
      const gymChanged = s.gym_id !== activeGymId;
      // Proposed targets are always rewritten (cheap, and they follow the current rack). A kept choice (accepted / edited)
      // is dropped only if the gym changed or its load no longer exists on this rack. A rejected target has no load to check.
      const stale: typeof targets = [];
      for (const tg of targets) {
        if (gymChanged || tg.status === "proposed") {
          stale.push(tg);
          continue;
        }
        if (tg.effectiveLoad === null) continue;
        const meta = await db.get<{ equipment: Parameters<typeof findSpec>[1]; setup: SetupType }>("SELECT equipment, setup FROM exercise WHERE id = ?", [tg.exerciseId]);
        const spec = meta ? findSpec(gym, meta.equipment) : null;
        if (meta && spec && !isGymLoad(spec, tg.effectiveLoad, meta.setup !== "free")) stale.push(tg);
      }
      await db.transaction(async () => {
        if (gymChanged) await db.run("UPDATE session SET gym_id = ?, updated_at = ? WHERE id = ?", [activeGymId, t, s.id]);
        for (const tg of stale) {
          await db.run("UPDATE target SET deleted_at = ?, updated_at = ? WHERE id = ?", [t, t, tg.id]);
          await db.run("UPDATE decision_log SET deleted_at = ?, updated_at = ? WHERE target_id = ? AND deleted_at IS NULL", [t, t, tg.id]);
        }
      });
      rewritten += stale.length;
      await db.transaction(async () => {
        await fillTargets(s.id, s.programme_day_id, activeGymId);
      });
    }
    return { sessions: planned.length, rewritten };
  }

  // ---- rejection memory writes ------------------------------------------------------------------------------
  async function bumpRejection(lineId: string, jumpKind: string): Promise<void> {
    const t = now();
    const row = await db.get<{ id: string; count: number }>("SELECT id, count FROM rejection_memory WHERE line_id = ? AND jump_kind = ? AND deleted_at IS NULL", [lineId, jumpKind]);
    if (row) await db.run("UPDATE rejection_memory SET count = ?, last_rejected_at = ?, updated_at = ? WHERE id = ?", [row.count + 1, t, t, row.id]);
    else await db.run("INSERT INTO rejection_memory (id, line_id, jump_kind, count, last_rejected_at, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)", [newId(), lineId, jumpKind, t, t, t]);
  }
  async function clearRejection(lineId: string, jumpKind: string): Promise<void> {
    const t = now();
    await db.run("UPDATE rejection_memory SET deleted_at = ?, updated_at = ? WHERE line_id = ? AND jump_kind = ? AND deleted_at IS NULL", [t, t, lineId, jumpKind]);
  }

  async function mustGet(targetId: string): Promise<TargetRow> {
    const tr = await getTarget(targetId);
    if (!tr) throw new Error("Unknown target");
    return tr;
  }

  /** Accept the target as written. Accepting a jump clears its rejection count (the lifter changed their mind). */
  async function acceptTarget(targetId: string): Promise<void> {
    const tr = await mustGet(targetId);
    if (tr.currency === "none") throw new Error("Nothing was proposed, so there is nothing to accept");
    const t = now();
    await db.transaction(async () => {
      await db.run("UPDATE target SET status = 'accepted', edited_load = NULL, updated_at = ? WHERE id = ?", [t, targetId]);
      if (tr.status !== "accepted" && isRememberedKind(tr.jumpKind)) await clearRejection(tr.lineId, tr.jumpKind);
    });
  }

  /** Edit the load. It must be a load that exists in this gym. Editing is neither a rejection nor an acceptance of the jump. */
  async function editTargetLoad(targetId: string, load: number, gym: GymFingerprint, equipment: Parameters<typeof findSpec>[1], setup: SetupType): Promise<void> {
    const tr = await mustGet(targetId);
    const spec = findSpec(gym, equipment);
    if (spec && !isGymLoad(spec, load, setup !== "free")) throw new Error("That load does not exist in this gym");
    if (!(load >= 0)) throw new Error("Invalid load");
    const t = now();
    await db.run("UPDATE target SET status = 'edited', edited_load = ?, updated_at = ? WHERE id = ?", [load, t, tr.id]);
  }

  /** Reject: the lifter will set their own number. Remembered per line + jump kind; 3 rejections stop that jump. */
  async function rejectTarget(targetId: string): Promise<RejectionOutcome | null> {
    const tr = await mustGet(targetId);
    const t = now();
    await db.transaction(async () => {
      await db.run("UPDATE target SET status = 'rejected', edited_load = NULL, updated_at = ? WHERE id = ?", [t, targetId]);
      if (tr.status !== "rejected" && isRememberedKind(tr.jumpKind)) await bumpRejection(tr.lineId, tr.jumpKind);
    });
    if (!isRememberedKind(tr.jumpKind)) return null;
    const row = await db.get<{ count: number }>("SELECT count FROM rejection_memory WHERE line_id = ? AND jump_kind = ? AND deleted_at IS NULL", [tr.lineId, tr.jumpKind]);
    const count = row?.count ?? 0;
    return { jumpKind: tr.jumpKind, count, max: REJECTION_THRESHOLD, blocked: count >= REJECTION_THRESHOLD };
  }

  async function getDecision(targetId: string): Promise<{ ruleVersion: string; path: string; createdAt: number; payload: DecisionPayload } | null> {
    const r = await db.get<{ rule_version: string; path: string; inputs_json: string; created_at: number }>(
      "SELECT rule_version, path, inputs_json, created_at FROM decision_log WHERE target_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1",
      [targetId],
    );
    return r ? { ruleVersion: r.rule_version, path: r.path, createdAt: r.created_at, payload: JSON.parse(r.inputs_json) as DecisionPayload } : null;
  }

  async function getPlannedSession(dayId: string): Promise<{ id: string } | null> {
    return db.get<{ id: string }>("SELECT id FROM session WHERE programme_day_id = ? AND status IN ('planned','in_progress') AND deleted_at IS NULL", [dayId]);
  }

  return { summarizeSession, getTargets, getTarget, getTargetForExercise, writeNextSessionTargets, planNextSession, planDay, refreshPlannedSessions, acceptTarget, editTargetLoad, rejectTarget, getDecision, getPlannedSession };
}
export type FinishRepo = ReturnType<typeof createFinishRepo>;
