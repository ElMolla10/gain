import { reviewWeek, weekStartOf, WEEKLY_RULE_VERSION, type WeeklyChange, type WeeklyInput, type WeeklyReview } from "@gain/engine";
import { isTodayOrLater } from "../logic/onboarding";
import type { Db, Deps } from "./driver";
import { hasLoggedSets } from "./sessionSql";
import type { GoalRepo } from "./goalRepo";
import type { Repos } from "./repos";

const DAY = 86_400_000;
const WEEK = 7 * DAY;

export type ReviewStatus = "open" | "accepted" | "edited" | "skipped";

export interface StoredReview {
  id: string;
  weekStart: string;
  status: ReviewStatus;
  review: WeeklyReview;
  inputs: WeeklyInput;
  /** What the tap changed, or null when nothing was changed. */
  applied: { kind: "move_date"; newDate: string } | null;
  decidedAt: number | null;
}

export class ReviewAlreadyDecided extends Error {}
export class ReviewDateInvalid extends Error {}

type Row = { id: string; week_start: string; status: ReviewStatus; review_json: string; inputs_json: string; applied_json: string | null; decided_at: number | null };
const toStored = (r: Row): StoredReview => ({
  id: r.id,
  weekStart: r.week_start,
  status: r.status,
  review: JSON.parse(r.review_json) as WeeklyReview,
  inputs: JSON.parse(r.inputs_json) as WeeklyInput,
  applied: r.applied_json ? (JSON.parse(r.applied_json) as StoredReview["applied"]) : null,
  decidedAt: r.decided_at,
});

/**
 * Weekly one-decision review data layer. One review per training week, written once the week is over. It reads the lifter's logs,
 * runs the weekly rule, stores the proposal, and changes NOTHING until the lifter taps. Only a "move the date" proposal edits
 * anything (the goal's target date); the other proposals are recorded and shown, and the lifter applies them in the Programme tab.
 * Weeks are computed in the lifter's local time: pass `tzOffsetMs` (local minus UTC, in ms; `-getTimezoneOffset() * 60000` on a phone).
 */
export function createWeeklyRepo(db: Db, deps: Deps, repos: Repos, goals: GoalRepo) {
  const { newId, now } = deps;

  async function weekStartsOn(): Promise<number> {
    const raw = await repos.getSetting("week_starts_on");
    const v = raw === null || raw === "" ? Number.NaN : Number(raw);
    return Number.isInteger(v) && v >= 0 && v <= 6 ? v : 1; // Monday unless the lifter chose another day
  }
  async function setWeekStartsOn(day: number): Promise<void> {
    if (!Number.isInteger(day) || day < 0 || day > 6) throw new Error("day must be 0-6");
    await repos.setSetting("week_starts_on", String(day));
  }

  async function finishedBetween(fromUtc: number, toUtc: number): Promise<number> {
    const r = await db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM session s WHERE s.status = 'finished' AND s.deleted_at IS NULL AND ${hasLoggedSets("s")} AND COALESCE(s.finished_at, s.started_at, s.created_at) >= ? AND COALESCE(s.finished_at, s.started_at, s.created_at) < ?`,
      [fromUtc, toUtc],
    );
    return Number(r?.n ?? 0);
  }

  /** Builds the rule input for the week that ended before the week containing `nowMs`. */
  async function buildInput(nowMs: number, tzOffsetMs: number): Promise<WeeklyInput> {
    const startsOn = await weekStartsOn();
    const thisWeek = weekStartOf(nowMs + tzOffsetMs, startsOn);
    const thisWeekLocal = Date.parse(`${thisWeek}T00:00:00Z`);
    const reviewedLocal = thisWeekLocal - WEEK;
    const toUtc = (local: number) => local - tzOffsetMs;
    const start = toUtc(reviewedLocal);
    const end = toUtc(thisWeekLocal);
    const plannedRaw = await repos.getSetting("days_per_week");
    const planned = plannedRaw === null || plannedRaw === "" ? Number.NaN : Number(plannedRaw);
    const first = await db.get<{ t: number | null }>(`SELECT MIN(COALESCE(s.finished_at, s.started_at, s.created_at)) AS t FROM session s WHERE s.status = 'finished' AND s.deleted_at IS NULL AND ${hasLoggedSets("s")}`);
    const pace = await goals.getPace(nowMs);
    let goal: WeeklyInput["goal"] = null;
    if (pace.kind === "lift") {
      const ex = await goals.liftExposures(pace.goal.exerciseId);
      goal = { kind: "lift", status: pace.pace.status, targetDate: pace.goal.targetDate, dateGone: pace.pace.dateGone, projectedDate: pace.pace.projectedDate, ratePerExposure: pace.pace.ratePerExposure, lastE1rm: ex.slice(-3).map((e) => Math.round(e.e1rm * 100) / 100) };
    } else if (pace.kind === "bodyweight") {
      goal = { kind: "bodyweight", status: pace.pace.status, targetDate: pace.goal.targetDate, dateGone: pace.pace.dateGone, projectedDate: pace.pace.projectedDate, ratePerExposure: null, lastE1rm: [] };
    } else if (pace.kind === "muscle") {
      goal = { kind: "muscle", status: pace.pace.status, targetDate: null, dateGone: false, projectedDate: null, ratePerExposure: null, lastE1rm: [] };
    }
    return {
      weekStart: weekStartOf(reviewedLocal, startsOn),
      plannedSessions: Number.isInteger(planned) && planned > 0 ? planned : null,
      sessionsDone: await finishedBetween(start, end),
      priorWeeks: [await finishedBetween(toUtc(reviewedLocal - 2 * WEEK), toUtc(reviewedLocal - WEEK)), await finishedBetween(toUtc(reviewedLocal - WEEK), start)],
      historyDays: first?.t ? Math.max(0, Math.floor((end - first.t) / DAY)) : 0,
      goal,
    };
  }

  /**
   * The review for the last finished week, or null when the lifter already decided it. It is created on first call and kept
   * (not recomputed) so it reads the same until the lifter decides. At most one per week.
   */
  async function getDue(nowMs: number = now(), tzOffsetMs = 0): Promise<StoredReview | null> {
    const input = await buildInput(nowMs, tzOffsetMs);
    const existing = await db.get<Row>("SELECT * FROM weekly_review WHERE week_start = ? AND deleted_at IS NULL", [input.weekStart]);
    if (existing) return existing.status === "open" ? toStored(existing) : null;
    const review = reviewWeek(input);
    const id = newId();
    const t = now();
    await db.run(
      "INSERT INTO weekly_review (id, week_start, rule_version, inputs_json, review_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'open', ?, ?)",
      [id, input.weekStart, WEEKLY_RULE_VERSION, JSON.stringify(input), JSON.stringify(review), t, t],
    );
    return toStored((await db.get<Row>("SELECT * FROM weekly_review WHERE id = ?", [id]))!);
  }

  async function applyDate(newDate: string): Promise<void> {
    const g = await goals.getGoal();
    if (!g || g.kind === "muscle") return;
    await goals.setGoal({ ...g, targetDate: newDate });
  }

  async function mustOpen(id: string): Promise<StoredReview> {
    const r = await db.get<Row>("SELECT * FROM weekly_review WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!r) throw new Error("Unknown review");
    if (r.status !== "open") throw new ReviewAlreadyDecided();
    return toStored(r);
  }

  /** Accept the proposal as written. Only "move the date" changes anything (the goal's date). */
  async function accept(id: string): Promise<void> {
    const s = await mustOpen(id);
    const change: WeeklyChange = s.review.change;
    const applied = change.kind === "move_date" ? { kind: "move_date" as const, newDate: change.newDate } : null;
    if (applied) await applyDate(applied.newDate);
    const t = now();
    await db.run("UPDATE weekly_review SET status = 'accepted', applied_json = ?, decided_at = ?, updated_at = ? WHERE id = ?", [applied ? JSON.stringify(applied) : null, t, t, id]);
  }

  /** Accept with the lifter's own date instead of the proposed one (only for a "move the date" proposal). */
  async function editDate(id: string, newDate: string): Promise<void> {
    const s = await mustOpen(id);
    if (s.review.change.kind !== "move_date") throw new Error("Only a move-the-date proposal can be edited");
    if (!isTodayOrLater(newDate, now())) throw new ReviewDateInvalid();
    await applyDate(newDate);
    const t = now();
    await db.run("UPDATE weekly_review SET status = 'edited', applied_json = ?, decided_at = ?, updated_at = ? WHERE id = ?", [JSON.stringify({ kind: "move_date", newDate }), t, t, id]);
  }

  async function skip(id: string): Promise<void> {
    await mustOpen(id);
    const t = now();
    await db.run("UPDATE weekly_review SET status = 'skipped', decided_at = ?, updated_at = ? WHERE id = ?", [t, t, id]);
  }

  /** Past reviews, newest first (what was proposed and what the lifter did with it). */
  async function listDecided(limit = 20): Promise<StoredReview[]> {
    const rows = await db.all<Row>("SELECT * FROM weekly_review WHERE deleted_at IS NULL AND status <> 'open' ORDER BY week_start DESC LIMIT ?", [limit]);
    return rows.map(toStored);
  }

  return { weekStartsOn, setWeekStartsOn, buildInput, getDue, accept, editDate, skip, listDecided };
}
export type WeeklyRepo = ReturnType<typeof createWeeklyRepo>;
