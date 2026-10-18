import {
  ACHIEVEMENT_CATALOG,
  ACHIEVEMENT_RULE_VERSION,
  evaluateAchievements,
  logicalTrainingDateFromMs,
  monthKey,
  pinProgress,
  weekStartOf,
  reconcileAchievements,
  canSwapQuest,
  offerMonthlyQuests,
  questProgress,
  type AchievementEvidence,
  type AchievementEvent,
  type AchievementFamily,
  type AchievementSession,
  type AchievementSet,
  type AchievementStatus,
  type EvaluateAchievementsResult,
  type ActiveQuestEval,
  type EquipmentType,
  type LiftPin,
  type OutlierStatus,
  type QuestCard,
  type SetupType,
  type StoredAchievement,
  type WeekPulse,
} from "@gain/engine";
import { buildCabinet, ledgerItems, pickNextUp, type NextUpBadge, type SurfaceBadge } from "../logic/achievementSurface";
import type { Db, Deps } from "./driver";
import type { Repos } from "./repos";

const BACKFILL_DONE = "achievements_backfill_done";
const BACKFILL_COUNT = "achievements_backfill_count";
const BANNER_SEEN = "achievements_banner_seen";
export const MAX_FOCUS_PINS = 3;

export class FocusTooMany extends Error {
  constructor() {
    super("Pin up to 3 focus lifts");
  }
}

export interface EarnedAchievementRow extends SurfaceBadge {
  primarySetId: string | null;
  celebratedAtUtc: number | null;
}

export interface AchievementHome {
  pulse: WeekPulse;
  earned: EarnedAchievementRow[];
  recent: EarnedAchievementRow[];
  nextUp: NextUpBadge[];
  bannerCount: number | null;
  stats: EvaluateAchievementsResult["stats"];
  quest: MonthQuest | null;
}

export interface MonthQuest {
  month: string;
  status: "offered" | "picked" | "completed" | "abandoned";
  offers: QuestCard[];
  picked: QuestCard | null;
  canSwap: boolean;
  progress: { current: number; target: number; complete: boolean };
}

interface StoredRow {
  id: string;
  badge_id: string;
  status: AchievementStatus;
  earned_at_utc: number | null;
  earned_local_date: string | null;
  primary_session_id: string | null;
  primary_set_id: string | null;
  evidence_payload_json: string | null;
  is_backfilled: number;
  progress_current: number | null;
  progress_target: number | null;
  celebrated_at_utc: number | null;
}

interface SetRow {
  id: string;
  session_id: string;
  exercise_id: string;
  equipment: EquipmentType;
  setup: SetupType;
  load: number;
  reps: number;
  is_warmup: number;
  tags_json: string;
  outlier_status: OutlierStatus;
  duration_s: number | null;
  distance_m: number | null;
  pattern: string;
  measure: "reps" | "time" | "distance";
}

function parseEvidence(json: string | null): AchievementEvidence | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as AchievementEvidence;
  } catch {
    return null;
  }
}

function tagsOf(json: string): string[] {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const ROW_SELECT = `id, badge_id, status, earned_at_utc, earned_local_date, primary_session_id, primary_set_id, evidence_payload_json, is_backfilled, progress_current, progress_target, celebrated_at_utc`;

async function hydrateRows(db: Db, rows: StoredRow[]): Promise<EarnedAchievementRow[]> {
  const catalog = new Map(ACHIEVEMENT_CATALOG.map((b) => [b.id, b]));
  const parsed = rows.map((r) => ({ row: r, evidence: parseEvidence(r.evidence_payload_json) }));
  const exerciseIds = new Set<string>();
  for (const p of parsed) {
    const ev = p.evidence;
    if (
      ev &&
      (ev.kind === "strength_pr" ||
        ev.kind === "dedicated" ||
        ev.kind === "block_builder" ||
        ev.kind === "iron_hold" ||
        ev.kind === "iron_carry" ||
        ev.kind === "workhorse" ||
        ev.kind === "pin_target")
    ) {
      exerciseIds.add(ev.identity.exerciseId);
    }
  }
  const names = new Map<string, { nameEn: string; nameAr: string }>();
  if (exerciseIds.size > 0) {
    const list = [...exerciseIds];
    const found = await db.all<{ id: string; name_en: string; name_ar: string }>(
      `SELECT id, name_en, name_ar FROM exercise WHERE id IN (${list.map(() => "?").join(",")})`,
      list,
    );
    for (const e of found) names.set(e.id, { nameEn: e.name_en, nameAr: e.name_ar });
  }
  return parsed.map(({ row, evidence }) => {
    const def = catalog.get(row.badge_id);
    const exId =
      evidence &&
      (evidence.kind === "strength_pr" ||
        evidence.kind === "dedicated" ||
        evidence.kind === "block_builder" ||
        evidence.kind === "iron_hold" ||
        evidence.kind === "iron_carry" ||
        evidence.kind === "workhorse" ||
        evidence.kind === "pin_target")
        ? evidence.identity.exerciseId
        : null;
    const name = exId ? names.get(exId) : undefined;
    return {
      id: row.id,
      badgeId: row.badge_id,
      i18nKey: def?.i18nKey ?? "achv.strengthPr",
      family: (def?.family ?? "strength_pr") as AchievementFamily,
      status: row.status,
      earnedAtUtc: row.earned_at_utc,
      earnedLocalDate: row.earned_local_date,
      primarySessionId: row.primary_session_id,
      primarySetId: row.primary_set_id,
      evidence,
      progressCurrent: row.progress_current,
      progressTarget: row.progress_target,
      isBackfilled: row.is_backfilled === 1,
      celebratedAtUtc: row.celebrated_at_utc,
      exerciseNameEn: name?.nameEn ?? null,
      exerciseNameAr: name?.nameAr ?? null,
    };
  });
}

async function weekStartsOn(repos: Repos): Promise<number> {
  const raw = await repos.getSetting("week_starts_on");
  const v = raw === null || raw === "" ? Number.NaN : Number(raw);
  return Number.isInteger(v) && v >= 0 && v <= 6 ? v : 1;
}

async function stampMissingDates(db: Db, now: number): Promise<void> {
  const rows = await db.all<{ id: string; finished_at: number }>(
    "SELECT id, finished_at FROM session WHERE status = 'finished' AND deleted_at IS NULL AND finished_at IS NOT NULL AND local_calendar_date IS NULL",
  );
  for (const r of rows) {
    await db.run("UPDATE session SET local_calendar_date = ?, updated_at = ? WHERE id = ? AND local_calendar_date IS NULL", [
      logicalTrainingDateFromMs(r.finished_at),
      now,
      r.id,
    ]);
  }
}

async function loadSessions(db: Db, preview?: { sessionId: string; setId: string; now: number }): Promise<AchievementSession[]> {
  const sessions = await db.all<{ id: string; finished_at: number; local_calendar_date: string | null }>(
    `SELECT id, ${preview ? "COALESCE(finished_at, ?)" : "finished_at"} AS finished_at, local_calendar_date FROM session
     WHERE deleted_at IS NULL AND ((status = 'finished' AND finished_at IS NOT NULL)
       ${preview ? "OR (id = ? AND status = 'in_progress')" : ""}) ORDER BY finished_at, id`,
    preview ? [preview.now, preview.sessionId] : [],
  );
  const sets = await db.all<SetRow>(
    `SELECT ws.id, ws.session_id, ws.exercise_id, e.equipment, e.setup, ws.load, ws.reps, ws.is_warmup, ws.tags_json, ws.outlier_status,
            ws.duration_s, ws.distance_m, e.pattern, e.measure
       FROM workout_set ws JOIN exercise e ON e.id = ws.exercise_id
      WHERE ws.deleted_at IS NULL AND e.deleted_at IS NULL
      ${preview ? `AND ws.exercise_id = (SELECT exercise_id FROM workout_set WHERE id = ? AND session_id = ? AND deleted_at IS NULL)
        AND (ws.session_id != ? OR ws.id = ?)` : ""}`,
    preview ? [preview.setId, preview.sessionId, preview.sessionId, preview.setId] : [],
  );
  const bySession = new Map<string, AchievementSet[]>();
  for (const s of sets) {
    const list = bySession.get(s.session_id) ?? [];
    list.push({
      id: s.id,
      exerciseId: s.exercise_id,
      equipment: s.equipment,
      setup: s.setup,
      load: s.load,
      reps: s.reps,
      warmup: s.is_warmup === 1,
      tags: tagsOf(s.tags_json),
      outlierStatus: s.outlier_status,
      durationS: s.duration_s,
      distanceM: s.distance_m,
      pattern: s.pattern,
      measure: s.measure,
    });
    bySession.set(s.session_id, list);
  }
  return sessions.map((s) => ({
    id: s.id,
    finishedAtUtc: s.finished_at,
    localCalendarDate: s.local_calendar_date ?? logicalTrainingDateFromMs(s.finished_at),
    sets: bySession.get(s.id) ?? [],
  }));
}

async function loadStored(db: Db): Promise<(StoredAchievement & { progressCurrent: number | null; progressTarget: number | null })[]> {
  const rows = await db.all<{
    id: string;
    badge_id: string;
    status: AchievementStatus;
    primary_session_id: string | null;
    primary_set_id: string | null;
    evidence_payload_json: string | null;
    earned_local_date: string | null;
    progress_current: number | null;
    progress_target: number | null;
  }>("SELECT id, badge_id, status, primary_session_id, primary_set_id, evidence_payload_json, earned_local_date, progress_current, progress_target FROM user_achievements WHERE deleted_at IS NULL");
  return rows.map((r) => ({
    id: r.id,
    badgeId: r.badge_id,
    status: r.status,
    primarySessionId: r.primary_session_id,
    primarySetId: r.primary_set_id,
    evidence: parseEvidence(r.evidence_payload_json),
    earnedLocalDate: r.earned_local_date,
    progressCurrent: r.progress_current,
    progressTarget: r.progress_target,
  }));
}

async function audit(db: Db, deps: Deps, achievementId: string, action: string, detail: Record<string, unknown>): Promise<void> {
  await db.run("INSERT INTO achievement_audit_log (id, achievement_id, action, detail_json, created_at) VALUES (?, ?, ?, ?, ?)", [
    deps.newId(),
    achievementId,
    action,
    JSON.stringify(detail),
    deps.now(),
  ]);
}

function rowFromEvent(id: string, event: AchievementEvent, backfill: boolean, now: number): unknown[] {
  return [
    id,
    event.badgeId,
    event.ruleVersion,
    "earned",
    event.progressCurrent,
    event.progressTarget,
    event.earnedAtUtc,
    event.earnedLocalDate,
    event.primarySessionId,
    event.primarySetId,
    JSON.stringify(event.evidence),
    backfill ? 1 : 0,
    now,
    now,
  ];
}

async function applyEvent(db: Db, id: string, event: AchievementEvent, t: number): Promise<void> {
  await db.run(
    `UPDATE user_achievements SET badge_id = ?, rule_version = ?, status = 'earned', progress_current = ?, progress_target = ?,
            earned_at_utc = ?, earned_local_date = ?, primary_session_id = ?, primary_set_id = ?, evidence_payload_json = ?, updated_at = ?
      WHERE id = ?`,
    [
      event.badgeId,
      event.ruleVersion,
      event.progressCurrent,
      event.progressTarget,
      event.earnedAtUtc,
      event.earnedLocalDate,
      event.primarySessionId,
      event.primarySetId,
      JSON.stringify(event.evidence),
      t,
      id,
    ],
  );
}

async function loadProgramContext(db: Db, repos: Repos): Promise<{ patterns: string[]; primaryIds: string[] }> {
  const active = await repos.getLatestProgrammeVersion();
  if (!active) return { patterns: [], primaryIds: [] };
  const rows = await db.all<{ exercise_id: string; pattern: string; is_goal_lift: number }>(
    `SELECT pde.exercise_id, e.pattern, pde.is_goal_lift
       FROM programme_day_exercise pde
       JOIN programme_day pd ON pd.id = pde.programme_day_id
       JOIN exercise e ON e.id = pde.exercise_id
      WHERE pd.programme_version_id = ? AND pde.deleted_at IS NULL AND pd.deleted_at IS NULL`,
    [active.versionId],
  );
  return {
    patterns: [...new Set(rows.map((r) => r.pattern).filter(Boolean))],
    primaryIds: [...new Set(rows.filter((r) => r.is_goal_lift === 1).map((r) => r.exercise_id))],
  };
}

function pinWeeks(raw: number | null | undefined): 4 | 5 | 6 | undefined {
  return raw === 5 || raw === 6 ? raw : raw === 4 ? 4 : undefined;
}

function pinFromRow(r: { id: string; exercise_id: string; equipment: EquipmentType | null; setup: SetupType | null; load: number; reps: number; weeks: number | null; started_week: string | null }): LiftPin {
  return {
    id: r.id,
    exerciseId: r.exercise_id,
    equipment: r.equipment ?? undefined,
    setup: r.setup ?? undefined,
    load: r.load,
    reps: r.reps,
    weeks: pinWeeks(r.weeks),
    startedWeek: r.started_week ?? undefined,
  };
}

async function loadPins(db: Db): Promise<LiftPin[]> {
  const rows = await db.all<{ id: string; exercise_id: string; equipment: EquipmentType | null; setup: SetupType | null; load: number; reps: number; weeks: number | null; started_week: string | null }>(
    "SELECT id, exercise_id, equipment, setup, load, reps, weeks, started_week FROM lift_pin WHERE deleted_at IS NULL",
  );
  return rows.map(pinFromRow);
}

function parseOffers(json: string): QuestCard[] {
  try {
    const v = JSON.parse(json) as QuestCard[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

async function loadQuestEval(db: Db, sessions: AchievementSession[], nowLocalDate: string, weekStartsOn: number): Promise<{ active?: ActiveQuestEval | null; completed: ActiveQuestEval[] }> {
  const rows = await db.all<{
    month: string;
    picked_kind: string | null;
    picked_payload_json: string | null;
    offer_json: string;
    status: string;
    completed_session_id: string | null;
    completed_at_utc: number | null;
    progress_current: number | null;
    progress_target: number | null;
  }>("SELECT month, picked_kind, picked_payload_json, offer_json, status, completed_session_id, completed_at_utc, progress_current, progress_target FROM user_quest WHERE deleted_at IS NULL");
  const completed: ActiveQuestEval[] = [];
  let active: ActiveQuestEval | null | undefined;
  const thisMonth = monthKey(nowLocalDate);
  for (const r of rows) {
    if (!r.picked_kind) continue;
    const offers = parseOffers(r.offer_json);
    const picked = offers.find((c) => c.kind === r.picked_kind) ?? (r.picked_payload_json ? { kind: r.picked_kind as QuestCard["kind"], titleKey: `quest.${r.picked_kind}.title`, target: r.progress_target ?? 1, payload: JSON.parse(r.picked_payload_json) as QuestCard["payload"] } : null);
    if (!picked) continue;
    const progress = questProgress(picked, sessions, { nowLocalDate: r.month === thisMonth ? nowLocalDate : `${r.month}-28`, weekStartsOn });
    const evalRow: ActiveQuestEval = {
      kind: picked.kind,
      month: r.month,
      target: picked.target,
      payload: picked.payload as unknown as Record<string, unknown>,
      titleKey: picked.titleKey,
      complete: progress.complete,
      current: progress.current,
      primarySessionId: progress.primarySessionId,
    };
    if (r.status === "completed") {
      completed.push({ ...evalRow, complete: true, earnedAtUtc: r.completed_at_utc ?? undefined, primarySessionId: r.completed_session_id });
    } else if (r.month === thisMonth && r.status === "picked") {
      active = evalRow;
    }
  }
  return { active, completed };
}

export async function syncAchievements(db: Db, deps: Deps, opts: { weekStartsOn: number; backfill: boolean; nowLocalDate?: string; repos?: Repos }): Promise<{ inserted: number; reanchored: number; revoked: number }> {
  const { newId, now } = deps;
  return db.transaction(async () => {
    await stampMissingDates(db, now());
    const sessions = await loadSessions(db);
    const program = opts.repos ? await loadProgramContext(db, opts.repos) : { patterns: [] as string[], primaryIds: [] as string[] };
    const pins = await loadPins(db);
    const nowLocal = opts.nowLocalDate ?? sessions.at(-1)?.localCalendarDate ?? logicalTrainingDateFromMs(now());
    const quests = await loadQuestEval(db, sessions, nowLocal, opts.weekStartsOn);
    const result = evaluateAchievements(sessions, {
      weekStartsOn: opts.weekStartsOn,
      nowLocalDate: nowLocal,
      programPatterns: program.patterns,
      programPrimaryIds: program.primaryIds,
      pins,
      quests,
    });
    if (quests.active?.complete) {
      const t = now();
      await db.run(
        "UPDATE user_quest SET status = 'completed', progress_current = ?, progress_target = ?, completed_session_id = ?, completed_at_utc = ?, updated_at = ? WHERE month = ? AND deleted_at IS NULL AND status = 'picked'",
        [quests.active.current ?? quests.active.target, quests.active.target, quests.active.primarySessionId ?? null, t, t, quests.active.month],
      );
    }
    for (const e of result.earned) {
      if (e.badgeId !== "pin_target" || e.evidence.kind !== "pin_target") continue;
      const t = now();
      await db.run(
        "UPDATE lift_pin SET reached_at_utc = ?, reached_session_id = ?, reached_set_id = ?, updated_at = ? WHERE exercise_id = ? AND load = ? AND reps = ? AND deleted_at IS NULL AND reached_at_utc IS NULL",
        [e.earnedAtUtc, e.primarySessionId, e.primarySetId, t, e.evidence.identity.exerciseId, e.evidence.target.load, e.evidence.target.reps],
      );
    }
    const stored = await loadStored(db);
    const ops = reconcileAchievements(stored, result.earned);
    const t = now();
    let inserted = 0;
    let reanchored = 0;
    let revoked = 0;
    for (const op of ops) {
      if (op.kind === "insert") {
        const id = newId();
        await db.run(
          `INSERT INTO user_achievements (id, badge_id, rule_version, status, progress_current, progress_target, earned_at_utc, earned_local_date, primary_session_id, primary_set_id, evidence_payload_json, is_backfilled, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          rowFromEvent(id, op.event, opts.backfill, t) as (string | number | null)[],
        );
        await audit(db, deps, id, opts.backfill ? "backfilled" : "earned", { badgeId: op.event.badgeId, sessionId: op.event.primarySessionId });
        inserted++;
      } else if (op.kind === "update") {
        await applyEvent(db, op.id, op.event, t);
        await audit(db, deps, op.id, op.action === "restore" ? "restored" : op.action === "reanchor" ? "reanchored" : "earned", {
          badgeId: op.event.badgeId,
          sessionId: op.event.primarySessionId,
          setId: op.event.primarySetId,
        });
        if (op.action === "reanchor" || op.action === "restore") reanchored++;
      } else {
        await db.run("UPDATE user_achievements SET status = 'revoked_by_edit', updated_at = ? WHERE id = ?", [t, op.id]);
        await audit(db, deps, op.id, "revoked_by_edit", op.detail);
        revoked++;
      }
    }
    const earnedIds = new Set(result.earned.map((e) => e.badgeId));
    for (const p of result.inProgress) {
      if (earnedIds.has(p.badgeId)) continue;
      const row = stored.find((r) => r.badgeId === p.badgeId && r.status !== "revoked_by_edit");
      if (row?.status === "earned") continue;
      if (row) {
        await db.run("UPDATE user_achievements SET progress_current = ?, progress_target = ?, status = 'in_progress', updated_at = ? WHERE id = ?", [
          p.current,
          p.target,
          t,
          row.id,
        ]);
      } else {
        await db.run(
          `INSERT INTO user_achievements (id, badge_id, rule_version, status, progress_current, progress_target, is_backfilled, created_at, updated_at)
           VALUES (?, ?, 1, 'in_progress', ?, ?, 0, ?, ?)`,
          [newId(), p.badgeId, p.current, p.target, t, t],
        );
      }
    }
    return { inserted, reanchored, revoked };
  });
}

/** Stored after every successful sync; launch skips the full re-evaluation while it still matches. */
export const ACHV_FINGERPRINT = "achv_fingerprint";
/** Bump to force one re-evaluation after an app update (with the engine's rule version and badge catalogue, also part of the print). */
export const ACHIEVEMENT_FINGERPRINT_VERSION = 1;

/**
 * A cheap print of everything the evaluation reads: per table the row count, deleted count, last update and last rowid, plus content
 * totals for sets, sessions, pins and quests (so an edit within the same millisecond still changes it), the week start, the active
 * programme version and the rule/catalogue version. One SELECT plus a few setting reads; no transaction.
 */
export async function achievementFingerprint(db: Db, repos: Repos): Promise<string> {
  const base = (t: string) => `(SELECT COUNT(*) || ':' || COUNT(deleted_at) || ':' || IFNULL(MAX(updated_at), '') || ':' || IFNULL(MAX(rowid), '') FROM ${t})`;
  const row = await db.get<Record<string, string | number | null>>(
    `SELECT ${base("session")} AS s, ${base("workout_set")} AS w, ${base("lift_pin")} AS p, ${base("user_quest")} AS q, ${base("exercise")} AS e, ${base("programme_day_exercise")} AS d,
       (SELECT TOTAL(load) || ':' || TOTAL(reps) || ':' || TOTAL(is_warmup) || ':' || TOTAL(IFNULL(duration_s, 0) + IFNULL(distance_m, 0)) || ':' || TOTAL(length(tags_json)) || ':' || TOTAL(length(outlier_status)) || ':' || TOTAL(length(session_id) * position) FROM workout_set WHERE deleted_at IS NULL) AS wc,
       (SELECT TOTAL(length(status)) || ':' || TOTAL(IFNULL(finished_at, 0)) || ':' || TOTAL(length(IFNULL(local_calendar_date, ''))) FROM session WHERE deleted_at IS NULL) AS sc,
       (SELECT TOTAL(load) || ':' || TOTAL(reps) || ':' || TOTAL(IFNULL(reached_at_utc, 0)) FROM lift_pin WHERE deleted_at IS NULL) AS pc,
       (SELECT TOTAL(length(status)) || ':' || TOTAL(IFNULL(completed_at_utc, 0)) FROM user_quest WHERE deleted_at IS NULL) AS qc`,
  );
  const version = await repos.getLatestProgrammeVersion();
  return JSON.stringify([ACHIEVEMENT_FINGERPRINT_VERSION, ACHIEVEMENT_RULE_VERSION, ACHIEVEMENT_CATALOG.length, await weekStartsOn(repos), version?.versionId ?? null, row]);
}

export function createAchievementRepo(db: Db, deps: Deps, repos: Repos) {
  async function sync(opts: { backfill?: boolean } = {}): Promise<{ inserted: number; reanchored: number; revoked: number }> {
    const result = await syncAchievements(db, deps, { weekStartsOn: await weekStartsOn(repos), backfill: opts.backfill === true, repos });
    await repos.setSetting(ACHV_FINGERPRINT, await achievementFingerprint(db, repos));
    return result;
  }

  async function ensureBackfill(): Promise<{ inserted: number; reanchored: number; revoked: number }> {
    const done = (await repos.getSetting(BACKFILL_DONE)) === "1";
    // Launch path: nothing the evaluation reads changed since the last sync, so the result would be identical.
    if (done && (await repos.getSetting(ACHV_FINGERPRINT)) === (await achievementFingerprint(db, repos))) return { inserted: 0, reanchored: 0, revoked: 0 };
    const result = await sync({ backfill: !done });
    if (!done) {
      await repos.setSetting(BACKFILL_DONE, "1");
      await repos.setSetting(BACKFILL_COUNT, String(result.inserted));
    }
    return result;
  }

  async function bannerCount(): Promise<number | null> {
    if ((await repos.getSetting(BANNER_SEEN)) === "1") return null;
    const n = Number(await repos.getSetting(BACKFILL_COUNT) ?? 0);
    return Number.isInteger(n) && n > 0 ? n : null;
  }

  async function dismissBanner(): Promise<void> {
    await repos.setSetting(BANNER_SEEN, "1");
  }

  async function listStored(where: string, params: (string | number)[] = []): Promise<EarnedAchievementRow[]> {
    const rows = await db.all<StoredRow>(
      `SELECT ${ROW_SELECT} FROM user_achievements WHERE deleted_at IS NULL AND ${where}`,
      params,
    );
    return hydrateRows(db, rows);
  }

  async function listEarned(): Promise<EarnedAchievementRow[]> {
    return listStored("status IN ('earned','revoked_by_edit') ORDER BY CASE status WHEN 'earned' THEN 0 ELSE 1 END, earned_at_utc DESC, id");
  }

  async function listCabinet(): Promise<SurfaceBadge[]> {
    const rows = await listStored("status != 'revoked_by_edit' ORDER BY earned_at_utc DESC, id");
    return buildCabinet(rows);
  }

  async function listLedger(): Promise<SurfaceBadge[]> {
    const earned = (await listEarned()).filter((r) => r.status === "earned");
    return ledgerItems(earned);
  }

  async function listForSession(sessionId: string): Promise<EarnedAchievementRow[]> {
    return listStored(
      "status = 'earned' AND primary_session_id = ? AND is_backfilled = 0 AND celebrated_at_utc IS NULL ORDER BY earned_at_utc DESC, id",
      [sessionId],
    );
  }

  async function markCelebrated(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const t = deps.now();
    await db.run(
      `UPDATE user_achievements SET celebrated_at_utc = ?, updated_at = ? WHERE celebrated_at_utc IS NULL AND id IN (${ids.map(() => "?").join(",")})`,
      [t, t, ...ids],
    );
  }

  async function nowLocalDate(): Promise<string> {
    return logicalTrainingDateFromMs(deps.now());
  }

  async function ensureMonthQuest(sessions: AchievementSession[], week: number, localDate: string): Promise<MonthQuest> {
    const month = monthKey(localDate);
    const row = await db.get<{
      offer_json: string;
      picked_kind: string | null;
      picked_payload_json: string | null;
      status: MonthQuest["status"];
      progress_current: number | null;
      progress_target: number | null;
    }>("SELECT offer_json, picked_kind, picked_payload_json, status, progress_current, progress_target FROM user_quest WHERE month = ? AND deleted_at IS NULL", [month]);
    const program = await loadProgramContext(db, repos);
    let offers = row ? parseOffers(row.offer_json) : [];
    if (!row) {
      offers = offerMonthlyQuests(sessions, { nowLocalDate: localDate, weekStartsOn: week, programPatterns: program.patterns, programPrimaryIds: program.primaryIds });
      const t = deps.now();
      await db.run(
        `INSERT INTO user_quest (id, month, offer_json, status, created_at, updated_at) VALUES (?, ?, ?, 'offered', ?, ?)`,
        [deps.newId(), month, JSON.stringify(offers), t, t],
      );
    }
    const picked = row?.picked_kind
      ? (offers.find((c) => c.kind === row.picked_kind) ?? null)
      : null;
    const progress = picked ? questProgress(picked, sessions, { nowLocalDate: localDate, weekStartsOn: week }) : { current: 0, target: 0, complete: false, primarySessionId: null };
    return {
      month,
      status: row?.status ?? "offered",
      offers,
      picked,
      canSwap: canSwapQuest(localDate) && (row?.status === "picked" || row?.status === "offered"),
      progress: { current: progress.current, target: progress.target, complete: progress.complete },
    };
  }

  async function getHome(): Promise<AchievementHome> {
    await ensureBackfill();
    const sessions = await loadSessions(db);
    const week = await weekStartsOn(repos);
    const localDate = await nowLocalDate();
    const program = await loadProgramContext(db, repos);
    const pins = await loadPins(db);
    const quests = await loadQuestEval(db, sessions, localDate, week);
    const evaluated = evaluateAchievements(sessions, {
      weekStartsOn: week,
      nowLocalDate: localDate,
      programPatterns: program.patterns,
      programPrimaryIds: program.primaryIds,
      pins,
      quests,
    });
    const earned = (await listEarned()).filter((r) => r.status === "earned");
    const inProgress = await listStored("status = 'in_progress'");
    const next = pickNextUp(
      inProgress.map((r) => ({ badgeId: r.badgeId, current: r.progressCurrent ?? 0, target: r.progressTarget ?? 0 })),
      earned.map((r) => r.badgeId),
    );
    const pinNext = pins
      .map((p) => ({ pin: p, progress: pinProgress(p, sessions) }))
      .filter((p) => !p.progress.reached)
      .slice(0, MAX_FOCUS_PINS)
      .map((p) => ({ badgeId: `pin_target:${p.pin.exerciseId}`, i18nKey: "achv.pinTarget", current: Math.round(p.progress.current * 100), target: 100 }));
    const quest = await ensureMonthQuest(sessions, week, localDate);
    if (quest.picked && !quest.progress.complete) {
      next.unshift({ badgeId: `quest_${quest.picked.kind}`, i18nKey: quest.picked.titleKey, current: quest.progress.current, target: quest.progress.target });
    }
    return {
      pulse: evaluated.pulse,
      earned,
      recent: earned.slice(0, 2),
      nextUp: [...pinNext, ...next].slice(0, 3),
      bannerCount: await bannerCount(),
      stats: evaluated.stats,
      quest,
    };
  }

  async function pickQuest(kind: QuestCard["kind"]): Promise<void> {
    const localDate = await nowLocalDate();
    const month = monthKey(localDate);
    const row = await db.get<{ offer_json: string; status: string }>("SELECT offer_json, status FROM user_quest WHERE month = ? AND deleted_at IS NULL", [month]);
    if (!row) throw new Error("No quests this month");
    const offers = parseOffers(row.offer_json);
    const card = offers.find((c) => c.kind === kind);
    if (!card) throw new Error("Unknown quest");
    if (row.status === "picked" && !canSwapQuest(localDate)) throw new Error("Swap window closed");
    const t = deps.now();
    await db.run(
      "UPDATE user_quest SET picked_kind = ?, picked_payload_json = ?, status = 'picked', swapped_at_utc = ?, progress_target = ?, updated_at = ? WHERE month = ? AND deleted_at IS NULL",
      [kind, JSON.stringify(card.payload), t, card.target, t, month],
    );
  }

  async function getPin(exerciseId: string): Promise<LiftPin | null> {
    const r = await db.get<{ id: string; exercise_id: string; equipment: EquipmentType | null; setup: SetupType | null; load: number; reps: number; weeks: number | null; started_week: string | null }>(
      "SELECT id, exercise_id, equipment, setup, load, reps, weeks, started_week FROM lift_pin WHERE exercise_id = ? AND deleted_at IS NULL AND reached_at_utc IS NULL ORDER BY created_at DESC LIMIT 1",
      [exerciseId],
    );
    return r ? pinFromRow(r) : null;
  }

  async function listPins(): Promise<LiftPin[]> {
    const rows = await db.all<{ id: string; exercise_id: string; equipment: EquipmentType | null; setup: SetupType | null; load: number; reps: number; weeks: number | null; started_week: string | null }>(
      "SELECT id, exercise_id, equipment, setup, load, reps, weeks, started_week FROM lift_pin WHERE deleted_at IS NULL AND reached_at_utc IS NULL ORDER BY created_at, rowid",
    );
    return rows.map(pinFromRow);
  }

  async function setPin(pin: LiftPin): Promise<void> {
    const t = deps.now();
    const others = await db.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM lift_pin WHERE deleted_at IS NULL AND reached_at_utc IS NULL AND exercise_id != ?",
      [pin.exerciseId],
    );
    if (Number(others?.n) >= MAX_FOCUS_PINS) throw new FocusTooMany();
    const existing = await getPin(pin.exerciseId);
    const weeks = pin.weeks === 5 || pin.weeks === 6 ? pin.weeks : 4;
    const startedWeek = pin.startedWeek ?? existing?.startedWeek ?? weekStartOf(t, await weekStartsOn(repos));
    await db.run("UPDATE lift_pin SET deleted_at = ?, updated_at = ? WHERE exercise_id = ? AND deleted_at IS NULL AND reached_at_utc IS NULL", [t, t, pin.exerciseId]);
    await db.run(
      `INSERT INTO lift_pin (id, exercise_id, equipment, setup, gym_id, load, reps, weeks, started_week, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [deps.newId(), pin.exerciseId, pin.equipment ?? null, pin.setup ?? null, null, pin.load, pin.reps, weeks, startedWeek, t, t],
    );
  }

  async function clearPin(exerciseId: string): Promise<void> {
    const t = deps.now();
    await db.run("UPDATE lift_pin SET deleted_at = ?, updated_at = ? WHERE exercise_id = ? AND deleted_at IS NULL AND reached_at_utc IS NULL", [t, t, exerciseId]);
  }

  async function getById(id: string): Promise<EarnedAchievementRow | null> {
    const all = await listStored("id = ?", [id]);
    return all[0] ?? null;
  }

  /** Read-only check of this saved set using the finish evaluator. No award/celebration writes. */
  async function previewStrengthPr(sessionId: string, setId: string): Promise<boolean> {
    const sessions = await loadSessions(db, { sessionId, setId, now: deps.now() });
    // Only the checked set participates today; a stronger set must not hide its qualifying PR.
    return evaluateAchievements(sessions).earned.some(e => e.badgeId === "strength_pr" && e.primarySessionId === sessionId && e.primarySetId === setId);
  }

  return { sync, ensureBackfill, dismissBanner, listEarned, listCabinet, listLedger, listForSession, markCelebrated, getHome, getById, pickQuest, getPin, listPins, setPin, clearPin, previewStrengthPr };
}

export type AchievementRepo = ReturnType<typeof createAchievementRepo>;
