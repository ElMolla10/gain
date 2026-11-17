import { hasInvalidInput, type SetRowDraft } from "./workoutRows";

/**
 * Typed-but-unticked numbers survive iOS terminating the backgrounded app: one setting per session, written when the app goes to the
 * background or the logger closes (never per keystroke) and applied when the workout is reopened. Restored drafts are typed values, not logged sets.
 */
export const draftKey = (sessionId: string): string => `workout_drafts:${sessionId}`;

type DraftMetadata = Partial<Pick<SetRowDraft, "warmup" | "tags" | "invalidLoad" | "invalidReps" | "invalidRir" | "ghostLoad" | "ghostReps">>;
export type SavedDraft = { exerciseId: string; key: string; saved: boolean; index: number; load: number | null; reps: number | null; rir: number | null } & DraftMetadata;

// Settings can be corrupt. Never allocate an unbounded list from a persisted position.
const MAX_DRAFT_ROWS = 1000;
const validIndex = (index: number) => Number.isInteger(index) && index >= 0 && index < MAX_DRAFT_ROWS;

const typed = (r: SetRowDraft) => r.load !== null || r.reps !== null || r.rir !== null;

/** Keep an exercise's unsaved row structure when any row has input, plus dirty saved rows. `index` is the unsaved position. */
export function collectDrafts(rows: Record<string, SetRowDraft[]>, keepStructure = false): SavedDraft[] {
  const out: SavedDraft[] = [];
  for (const [exerciseId, list] of Object.entries(rows)) {
    const keepUnsaved = keepStructure || list.some((r) => !r.saved && (typed(r) || r.warmup || r.tags.length > 0 || hasInvalidInput(r)));
    let unsaved = -1;
    for (const r of list) {
      if (!r.saved) unsaved++;
      if (r.saved ? r.dirty : keepUnsaved) out.push({
        exerciseId, key: r.key, saved: r.saved, index: r.saved ? -1 : unsaved, load: r.load, reps: r.reps, rir: r.rir,
        warmup: r.warmup, tags: [...r.tags], invalidLoad: !!r.invalidLoad, invalidReps: !!r.invalidReps, invalidRir: !!r.invalidRir,
        ghostLoad: r.ghostLoad, ghostReps: r.ghostReps,
      });
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
      .map((d) => {
        const metadata: DraftMetadata = {};
        for (const key of ["warmup", "invalidLoad", "invalidReps", "invalidRir"] as const) {
          if (typeof d[key] === "boolean") metadata[key] = d[key];
        }
        if (Array.isArray(d.tags)) metadata.tags = d.tags.filter((tag): tag is string => typeof tag === "string");
        for (const key of ["ghostLoad", "ghostReps"] as const) {
          if (d[key] === null || (typeof d[key] === "number" && Number.isFinite(d[key]))) metadata[key] = d[key];
        }
        return { exerciseId: d.exerciseId, key: d.key, saved: d.saved === true, index: validIndex(d.index) ? d.index : -1, load: num(d.load), reps: num(d.reps), rir: num(d.rir), ...metadata };
      });
  } catch {
    return [];
  }
}

/**
 * Put saved drafts back: saved rows by key (only edits, they stay saved and become dirty), unsaved rows by key or else by position
 * among the unsaved rows (their keys are regenerated on reopen). Recreate added draft rows, never logged sets.
 * Never overwrites a row that is saved now but was not before. Optional metadata keeps legacy numeric drafts compatible.
 */
export function applyDrafts(rows: Record<string, SetRowDraft[]>, drafts: readonly SavedDraft[]): Record<string, SetRowDraft[]> {
  let out = rows;
  for (const d of drafts) {
    let list = out[d.exerciseId];
    if (!Object.prototype.hasOwnProperty.call(out, d.exerciseId) || !Array.isArray(list)) continue;
    let target = list.find((r) => r.key === d.key);
    if (!target && !d.saved) target = list.filter((r) => !r.saved)[d.index];
    if (!target && !d.saved && validIndex(d.index)) {
      list = [...list];
      for (let index = list.filter((r) => !r.saved).length; index <= d.index; index++) {
        // Legacy snapshots can omit blank gaps. Recreate those without inventing values or ghost targets.
        let key = index === d.index ? d.key : `${d.key}:gap:${index}`;
        while (list.some((r) => r.key === key)) key += ":draft";
        target = { key, load: null, reps: null, rir: null, warmup: false, tags: [], saved: false, dirty: false, ghostLoad: null, ghostReps: null };
        list.push(target);
      }
    }
    if (!target || target.saved !== d.saved) continue;
    const { exerciseId: _exerciseId, key: _key, saved: _saved, index: _index, ...patch } = d;
    const restored = { ...target, ...patch, dirty: target.saved ? true : target.dirty };
    const unchanged = Object.keys(patch).every((key) => {
      if (key === "tags") return target.tags.length === restored.tags.length && target.tags.every((tag, i) => tag === restored.tags[i]);
      if (key.startsWith("invalid")) return !!target[key as "invalidLoad"] === !!restored[key as "invalidLoad"];
      return target[key as keyof SetRowDraft] === restored[key as keyof SetRowDraft];
    }) && target.dirty === restored.dirty;
    const updated = unchanged ? list : list.map((r) => r.key === target.key ? restored : r);
    if (updated !== out[d.exerciseId]) out = { ...out, [d.exerciseId]: updated };
  }
  return out;
}


/** One atomic session setting: complete pending structure, edited saved sets and the active cursor. */
export function serializeSessionDrafts(rows: Record<string, SetRowDraft[]>, cursor: import("./currentSet").SetCursor | null): string {
  const current = cursor?.key ? rows[cursor.exId]?.find(row => row.key === cursor.key) : null;
  return JSON.stringify({ version: 2, exercises: Object.keys(rows), drafts: collectDrafts(rows, true), cursor, cursorSaved: current?.saved ?? false });
}
export function restoreSessionDrafts(initial: Record<string, SetRowDraft[]>, raw: string | null): { rows: Record<string, SetRowDraft[]>; cursor: import("./currentSet").SetCursor | null } {
  let value;
  try { value = raw ? JSON.parse(raw) : null; } catch { return { rows: initial, cursor: null }; }
  if (!value || value.version !== 2) return { rows: applyDrafts(initial, parseDrafts(raw)), cursor: null };
  if (!Array.isArray(value.exercises) || !Array.isArray(value.drafts)) return { rows: initial, cursor: null };
  const drafts = parseDrafts(JSON.stringify(value.drafts));
  const rows = { ...initial };
  const used = new Set(Object.values(initial).flat().filter(row => row.saved).map(row => row.key));
  for (const exId of Object.keys(initial)) {
    if (!value.exercises.includes(exId)) continue;
    const saved = initial[exId]!.filter(row => row.saved);
    const edited = applyDrafts({ [exId]: saved }, drafts.filter(d => d.exerciseId === exId && d.saved))[exId]!;
    const pending: SetRowDraft[] = [];
    for (const d of drafts.filter(d => d.exerciseId === exId && !d.saved && validIndex(d.index)).sort((a, b) => a.index - b.index)) {
      if (used.has(d.key) || pending.length >= MAX_DRAFT_ROWS) continue;
      used.add(d.key);
      pending.push({ key: d.key, load: d.load, reps: d.reps, rir: d.rir, saved: false, dirty: false, warmup: d.warmup ?? false, tags: d.tags ?? [], ghostLoad: d.ghostLoad ?? null, ghostReps: d.ghostReps ?? null, invalidLoad: d.invalidLoad, invalidReps: d.invalidReps, invalidRir: d.invalidRir });
    }
    rows[exId] = [...edited, ...pending];
  }
  const c = value.cursor;
  const valid = c && typeof c.exId === "string" && Object.prototype.hasOwnProperty.call(rows, c.exId) && Array.isArray(rows[c.exId]);
  const row = valid && typeof c.key === "string" ? rows[c.exId]!.find(row => row.key === c.key) : null;
  const cursor = valid && (c.key === null || row) ? { exId: c.exId as string, key: row && (!row.saved || value.cursorSaved === true) ? row.key : null } : null;
  return { rows, cursor };
}
