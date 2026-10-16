import { detectDeload, topSetsOfHistory, weekStartOf } from "@gain/engine";
import { reduceDraftSetsByOne } from "../logic/programmeDraft";
import type { Db, Deps } from "./driver";
import type { HistoryRepo } from "./historyRepo";
import type { FinishRepo } from "./finishRepo";
import { SessionInProgress, type ProgrammeRepo } from "./programmeRepo";
import type { Repos } from "./repos";
import type { ShortWeekRepo } from "./shortWeekRepo";

export const DELOAD_SETTING = "deload";

export type DeloadRecord =
  | { status: "dismissed"; weekStart: string; endsAt: number }
  | { status: "load"; weekStart: string; endsAt: number }
  | { status: "sets"; weekStart: string; endsAt: number; originalVersionId: string; appliedVersionId: string; programmeId: string };

export type DeloadView =
  | { status: "none" }
  | { status: "suggested" }
  | DeloadRecord;

const WEEK_MS = 7 * 86_400_000;

function parse(raw: string | null): DeloadRecord | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as DeloadRecord;
    if (v.status === "dismissed" || v.status === "load" || v.status === "sets") return v;
    return null;
  } catch {
    return null;
  }
}

export function createDeloadRepo(db: Db, deps: Deps, repos: Repos, programmes: ProgrammeRepo, history: HistoryRepo, finish: FinishRepo, shortWeek: ShortWeekRepo) {
  const { now } = deps;

  async function startsOn(): Promise<number> {
    const raw = await repos.getSetting("week_starts_on");
    const v = raw === null || raw === "" ? Number.NaN : Number(raw);
    return Number.isInteger(v) && v >= 0 && v <= 6 ? v : 1;
  }

  async function weekBounds(nowMs: number, tzOffsetMs: number): Promise<{ weekStart: string; endsAt: number }> {
    const weekStart = weekStartOf(nowMs + tzOffsetMs, await startsOn());
    const startMs = Date.parse(`${weekStart}T00:00:00.000Z`) - tzOffsetMs;
    return { weekStart, endsAt: startMs + WEEK_MS };
  }

  async function read(): Promise<DeloadRecord | null> {
    return parse(await repos.getSetting(DELOAD_SETTING));
  }

  async function write(v: DeloadRecord | null): Promise<void> {
    await repos.setSetting(DELOAD_SETTING, v ? JSON.stringify(v) : "");
  }

  async function getState(nowMs: number = now(), tzOffsetMs = 0): Promise<DeloadView> {
    const rec = await read();
    const { weekStart } = await weekBounds(nowMs, tzOffsetMs);
    if (rec && rec.weekStart === weekStart) return rec;
    if (await shortWeek.getActive()) return { status: "none" };
    const lifts = await history.listLifts();
    for (const lift of lifts) {
      if (lift.sessions < 3) continue;
      const data = await history.getLiftTrend(lift.lineId);
      if (!data) continue;
      if (detectDeload(topSetsOfHistory(data.sessions, lift.setup), lift.setup)) return { status: "suggested" };
    }
    return { status: "none" };
  }

  async function dismiss(nowMs: number = now(), tzOffsetMs = 0): Promise<void> {
    const { weekStart, endsAt } = await weekBounds(nowMs, tzOffsetMs);
    await write({ status: "dismissed", weekStart, endsAt });
  }

  async function applyLoad(nowMs: number = now(), tzOffsetMs = 0): Promise<DeloadRecord> {
    const { weekStart, endsAt } = await weekBounds(nowMs, tzOffsetMs);
    const rec: DeloadRecord = { status: "load", weekStart, endsAt };
    await write(rec);
    const gymId = await repos.getActiveGymId();
    if (gymId) await finish.refreshPlannedSessions(gymId);
    return rec;
  }

  async function applySets(nowMs: number = now(), tzOffsetMs = 0): Promise<DeloadRecord> {
    if (await shortWeek.getActive()) throw new SessionInProgress();
    const v = await programmes.getActive();
    if (!v) throw new Error("No program");
    const draft = await programmes.loadDraft(v.versionId);
    const saved = await programmes.saveNewVersion(v.programmeId, reduceDraftSetsByOne(draft));
    const { weekStart, endsAt } = await weekBounds(nowMs, tzOffsetMs);
    const rec: DeloadRecord = {
      status: "sets",
      weekStart,
      endsAt,
      originalVersionId: v.versionId,
      appliedVersionId: saved.versionId,
      programmeId: v.programmeId,
    };
    await write(rec);
    return rec;
  }

  async function restoreSets(rec: Extract<DeloadRecord, { status: "sets" }>): Promise<void> {
    const latest = await db.get<{ id: string }>("SELECT id FROM programme_version WHERE programme_id = ? AND deleted_at IS NULL ORDER BY version DESC LIMIT 1", [rec.programmeId]);
    if (!latest || latest.id !== rec.appliedVersionId) return;
    const original = await programmes.loadDraft(rec.originalVersionId);
    await programmes.saveNewVersion(rec.programmeId, original);
  }

  async function undo(): Promise<void> {
    const rec = await read();
    if (!rec) return;
    if (rec.status === "sets") {
      try {
        await restoreSets(rec);
      } catch (e) {
        if (e instanceof SessionInProgress) throw e;
        throw e;
      }
    }
    await write(null);
    const gymId = await repos.getActiveGymId();
    if (gymId && rec.status === "load") await finish.refreshPlannedSessions(gymId);
  }

  async function endIfExpired(nowMs: number = now(), tzOffsetMs = 0): Promise<void> {
    const rec = await read();
    if (!rec) return;
    const { weekStart } = await weekBounds(nowMs, tzOffsetMs);
    if (rec.weekStart >= weekStart) return;
    if (rec.status === "sets") {
      try {
        await restoreSets(rec);
      } catch (e) {
        if (e instanceof SessionInProgress) return;
        throw e;
      }
    }
    await write(null);
  }

  async function loadActive(nowMs: number = now()): Promise<boolean> {
    const rec = await read();
    return !!rec && rec.status === "load" && nowMs < rec.endsAt;
  }

  return { getState, dismiss, applyLoad, applySets, undo, endIfExpired, loadActive };
}
export type DeloadRepo = ReturnType<typeof createDeloadRepo>;
