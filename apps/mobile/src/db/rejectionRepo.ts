import { REJECTION_THRESHOLD } from "@gain/engine";
import type { Db, Deps } from "./driver";

export interface StoppedSuggestion {
  id: string;
  lineId: string;
  exerciseId: string;
  nameEn: string;
  nameAr: string;
  gymName: string;
  setup: string;
  jumpKind: string;
  count: number;
  /** True when the engine will no longer propose this jump (count reached the threshold). */
  blocked: boolean;
  lastRejectedAt: number;
}

/** Read and reverse rejection memory ("Things I've stopped suggesting"). Writes happen in finishRepo (reject / accept). */
export function createRejectionRepo(db: Db, deps: Deps) {
  const { now } = deps;

  /** Every live rejection record, blocked ones first, then the most recently declined. */
  async function list(threshold: number = REJECTION_THRESHOLD): Promise<StoppedSuggestion[]> {
    const rows = await db.all<{
      id: string; line_id: string; exercise_id: string; name_en: string; name_ar: string; gym_name: string; setup: string;
      jump_kind: string; count: number; last_rejected_at: number;
    }>(
      `SELECT r.id, r.line_id, l.exercise_id, e.name_en, e.name_ar, g.name AS gym_name, l.setup, r.jump_kind, r.count, r.last_rejected_at
         FROM rejection_memory r
         JOIN exercise_line l ON l.id = r.line_id
         JOIN exercise e ON e.id = l.exercise_id
         JOIN gym g ON g.id = l.gym_id
        WHERE r.deleted_at IS NULL`,
    );
    return rows
      .map((r) => ({
        id: r.id, lineId: r.line_id, exerciseId: r.exercise_id, nameEn: r.name_en, nameAr: r.name_ar, gymName: r.gym_name, setup: r.setup,
        jumpKind: r.jump_kind, count: r.count, blocked: r.count >= threshold, lastRejectedAt: r.last_rejected_at,
      }))
      .sort((a, b) => Number(b.blocked) - Number(a.blocked) || b.lastRejectedAt - a.lastRejectedAt);
  }

  /** Forget the rejections of one jump on one line, so the engine may propose it again. Reversible with `undoBringBack`. */
  async function bringBack(id: string): Promise<void> {
    const t = now();
    await db.run("UPDATE rejection_memory SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL", [t, t, id]);
  }

  /** Put a brought-back record back exactly as it was. False when the lifter declined that jump again meanwhile (nothing changes). */
  async function undoBringBack(id: string): Promise<boolean> {
    const row = await db.get<{ line_id: string; jump_kind: string; deleted_at: number | null }>("SELECT line_id, jump_kind, deleted_at FROM rejection_memory WHERE id = ?", [id]);
    if (!row || row.deleted_at === null) return false;
    const live = await db.get<{ id: string }>("SELECT id FROM rejection_memory WHERE line_id = ? AND jump_kind = ? AND deleted_at IS NULL", [row.line_id, row.jump_kind]);
    if (live) return false;
    await db.run("UPDATE rejection_memory SET deleted_at = NULL, updated_at = ? WHERE id = ?", [now(), id]);
    return true;
  }

  return { list, bringBack, undoBringBack };
}
export type RejectionRepo = ReturnType<typeof createRejectionRepo>;
