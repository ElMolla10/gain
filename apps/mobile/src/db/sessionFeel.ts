import type { Db } from "./driver";

/** The Finish "Session Perception" answer stored on the session. */
export type SessionFeel = "smooth" | "target" | "heavy";
export const asSessionFeel = (v: unknown): SessionFeel | null => (v === "smooth" || v === "target" || v === "heavy" ? v : null);

/** Finished sessions since `sinceMs` that have a feel, oldest first. For the weekly review to read later (nothing uses it yet). */
export async function recentSessionFeels(db: Db, sinceMs: number): Promise<{ sessionId: string; finishedAt: number; feel: SessionFeel }[]> {
  const rows = await db.all<{ id: string; finished_at: number; feel: string }>(
    "SELECT id, finished_at, feel FROM session WHERE status = 'finished' AND deleted_at IS NULL AND feel IS NOT NULL AND finished_at >= ? ORDER BY finished_at",
    [sinceMs],
  );
  return rows.flatMap((r) => { const f = asSessionFeel(r.feel); return f ? [{ sessionId: r.id, finishedAt: r.finished_at, feel: f }] : []; });
}
