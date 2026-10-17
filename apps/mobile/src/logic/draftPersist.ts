import { editRow, type SetRowDraft } from "./workoutRows";

/**
 * Typed-but-unticked numbers survive iOS terminating the backgrounded app: one setting per session, written when the app goes to the
 * background (never per keystroke) and applied when the workout is reopened. Restored drafts are typed values, not logged sets.
 */
export const draftKey = (sessionId: string): string => `workout_drafts:${sessionId}`;

export type SavedDraft = { exerciseId: string; key: string; saved: boolean; index: number; load: number | null; reps: number | null; rir: number | null };

const typed = (r: SetRowDraft) => r.load !== null || r.reps !== null || r.rir !== null;

/** Unsaved rows with typed values, and saved rows typed over since (dirty). `index` = position among the exercise's unsaved rows. */
export function collectDrafts(rows: Record<string, SetRowDraft[]>): SavedDraft[] {
  const out: SavedDraft[] = [];
  for (const [exerciseId, list] of Object.entries(rows)) {
    let unsaved = -1;
    for (const r of list) {
      if (!r.saved) unsaved++;
      if (r.saved ? r.dirty : typed(r)) out.push({ exerciseId, key: r.key, saved: r.saved, index: r.saved ? -1 : unsaved, load: r.load, reps: r.reps, rir: r.rir });
    }
  }
  return out;
}

/** "" when there is nothing to keep (the caller clears the setting). */
export const serializeDrafts = (rows: Record<string, SetRowDraft[]>): string => {
  const d = collectDrafts(rows);
  return d.length ? JSON.stringify(d) : "";
};

export function parseDrafts(raw: string | null): SavedDraft[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
    return v.filter((d): d is SavedDraft => !!d && typeof d.exerciseId === "string" && typeof d.key === "string")
      .map((d) => ({ exerciseId: d.exerciseId, key: d.key, saved: d.saved === true, index: typeof d.index === "number" ? d.index : -1, load: num(d.load), reps: num(d.reps), rir: num(d.rir) }));
  } catch {
    return [];
  }
}

/**
 * Put saved drafts back: saved rows by key (only edits, they stay saved and become dirty), unsaved rows by key or else by position
 * among the unsaved rows (their keys are regenerated on reopen). Never overwrites a row that is saved now but was not before; ghosts stay.
 */
export function applyDrafts(rows: Record<string, SetRowDraft[]>, drafts: readonly SavedDraft[]): Record<string, SetRowDraft[]> {
  let out = rows;
  for (const d of drafts) {
    const list = out[d.exerciseId];
    if (!list) continue;
    let target = list.find((r) => r.key === d.key);
    if (!target && !d.saved) target = list.filter((r) => !r.saved)[d.index];
    if (!target || target.saved !== d.saved) continue;
    out = { ...out, [d.exerciseId]: editRow(list, target.key, { load: d.load, reps: d.reps, rir: d.rir }) };
  }
  return out;
}
