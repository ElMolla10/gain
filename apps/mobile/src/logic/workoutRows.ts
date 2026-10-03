/**
 * The active workout as one list: every exercise shows its set rows. A row is either logged (saved on the phone, has a set id)
 * or not yet. Pure helpers, no I/O, so the rules are tested without a phone.
 */
export interface SetRowDraft {
  /** Set id: generated once per row, so a double tap on "log" can never insert the same set twice. */
  key: string;
  load: number | null;
  reps: number | null;
  rir: number | null;
  warmup: boolean;
  /** Set tags kept with the set: "drop" (drop set), "failure" (taken to failure). A warm-up never carries one. */
  tags: string[];
  /** Saved on the phone. */
  saved: boolean;
  /** Saved, but typed over since (needs "update"). */
  dirty: boolean;
  /**
   * Ghost text for an empty KG / REPS box: today's target (or the previous set). Never stored by itself: it only becomes the
   * row's value when the lifter ticks the row, so one tap on the checkmark accepts the target.
   */
  ghostLoad: number | null;
  ghostReps: number | null;
}

export interface SavedSet {
  id: string;
  load: number;
  reps: number;
  rir: number | null;
  warmup: boolean;
  tags?: string[];
}

export interface Prefill {
  load: number | null;
  reps: number | null;
}

export const rowReady = (r: Pick<SetRowDraft, "load" | "reps">): r is Pick<SetRowDraft, "load" | "reps"> & { load: number; reps: number } => r.load !== null && r.reps !== null && r.reps >= 1 && r.load >= 0;

/** What the row means right now: what was typed, else the ghost target. */
export const effectiveOf = (r: Pick<SetRowDraft, "load" | "reps" | "ghostLoad" | "ghostReps">): { load: number | null; reps: number | null } => ({ load: r.load ?? r.ghostLoad, reps: r.reps ?? r.ghostReps });

/** True when ticking the row can log a set (typed values and/or ghost values fill both boxes). */
export const rowCanLog = (r: Pick<SetRowDraft, "load" | "reps" | "ghostLoad" | "ghostReps">): boolean => rowReady(effectiveOf(r));

/** What a set is: a normal working set, a warm-up, a drop set (lighter, straight after the previous set) or a set taken to failure. */
export type SetKind = "normal" | "warmup" | "drop" | "failure";
export const SET_KINDS: readonly SetKind[] = ["normal", "warmup", "drop", "failure"];
const KIND_TAGS = ["drop", "failure"];

export const kindOf = (r: { warmup: boolean; tags?: readonly string[] }): SetKind => (r.warmup ? "warmup" : r.tags?.includes("drop") ? "drop" : r.tags?.includes("failure") ? "failure" : "normal");

/** The row fields that make a set the given kind (other tags are kept; a warm-up never carries drop / failure). */
export function kindPatch(kind: SetKind, tags: readonly string[] = []): { warmup: boolean; tags: string[] } {
  const rest = tags.filter((t) => !KIND_TAGS.includes(t));
  if (kind === "drop" || kind === "failure") return { warmup: false, tags: [...rest, kind] };
  return { warmup: kind === "warmup", tags: rest };
}

/** Drop sets are lighter follow-up sets: they are not working sets for progression, PREVIOUS or the target comparison. */
export const isDropRow = (r: { warmup: boolean; tags?: readonly string[] }): boolean => kindOf(r) === "drop";

const fromSaved = (s: SavedSet): SetRowDraft => ({ key: s.id, load: s.load, reps: s.reps, rir: s.rir, warmup: s.warmup, tags: s.tags ?? [], saved: true, dirty: false, ghostLoad: null, ghostReps: null });
const blank = (key: string, p: Prefill): SetRowDraft => ({ key, load: null, reps: null, rir: null, warmup: false, tags: [], saved: false, dirty: false, ghostLoad: p.load, ghostReps: p.reps });

/**
 * Rows to show for one exercise: the sets already logged today (oldest first), then empty rows prefilled with today's target
 * until the programme's number of working sets is reached. Never invents numbers: with no target and no history the rows are empty.
 */
export function initialRows(saved: SavedSet[], plannedSets: number, prefill: Prefill, newKey: () => string): SetRowDraft[] {
  const rows = saved.map(fromSaved);
  const working = rows.filter((r) => !r.warmup).length;
  for (let i = working; i < plannedSets; i++) rows.push(blank(newKey(), prefill));
  return rows;
}

/** After a reload from the database: logged sets in database order, then the rows not logged yet. Typed-over edits of a logged row survive. */
export function mergeRows(prev: SetRowDraft[], saved: SavedSet[]): SetRowDraft[] {
  const byKey = new Map(prev.map((r) => [r.key, r]));
  const out: SetRowDraft[] = saved.map((s) => {
    const p = byKey.get(s.id);
    return p && p.dirty ? { ...p, saved: true } : fromSaved(s);
  });
  return [...out, ...prev.filter((r) => !r.saved)];
}

/** A new empty row whose ghost is the last working row (the common case is the same weight again), else the target. */
export function addRow(rows: SetRowDraft[], target: Prefill, newKey: () => string): SetRowDraft[] {
  const last = [...rows].reverse().find((r) => !r.warmup && rowCanLog(r));
  return [...rows, blank(newKey(), last ? effectiveOf(last) : target)];
}

/** Ticking an unlogged row with empty boxes takes the ghost values as the row's own (so the screen shows what was logged). */
export function acceptGhost(rows: SetRowDraft[], key: string): SetRowDraft[] {
  return rows.map((r) => (r.key === key ? { ...r, ...effectiveOf(r) } : r));
}

/**
 * Un-ticking a logged row: it goes back to unlogged and keeps its numbers. It gets a NEW key, because the old set id belongs to a set
 * that is now deleted (logging the same id again would be ignored as a duplicate).
 */
export function unlogRow(rows: SetRowDraft[], key: string, newKey: string): SetRowDraft[] {
  return rows.map((r) => (r.key === key ? { ...r, key: newKey, saved: false, dirty: false, ghostLoad: r.load, ghostReps: r.reps } : r));
}

export const removeRow = (rows: SetRowDraft[], key: string): SetRowDraft[] => rows.filter((r) => r.key !== key);

/** Typing into a row. A logged row becomes "dirty" (it shows "update"). */
export function editRow(rows: SetRowDraft[], key: string, patch: Partial<Pick<SetRowDraft, "load" | "reps" | "rir" | "warmup" | "tags">>): SetRowDraft[] {
  return rows.map((r) => (r.key === key ? { ...r, ...patch, dirty: r.saved ? true : r.dirty } : r));
}

export const markSaved = (rows: SetRowDraft[], key: string): SetRowDraft[] => rows.map((r) => (r.key === key ? { ...r, saved: true, dirty: false } : r));

/**
 * Labels shown to the lifter: W warm-up, D drop set (neither is numbered), F a failure set (a working set: it keeps its place in the
 * numbering, so the next set still reads 3 after a set 2 taken to failure shown as F), working sets 1, 2, 3 ...
 */
export function rowLabels(rows: SetRowDraft[]): string[] {
  let n = 0;
  return rows.map((r) => {
    const k = kindOf(r);
    if (k === "warmup") return "W";
    if (k === "drop") return "D";
    n++;
    return k === "failure" ? "F" : String(n);
  });
}

/** Rows that are filled in but not logged: what finishing would leave out (shown as a note, never saved silently). */
export const unloggedFilled = (rows: SetRowDraft[]): number => rows.filter((r) => !r.saved && (r.load !== null || r.reps !== null) && rowCanLog(r)).length;

/** Rows whose numbers are not in the database yet: typed but not ticked, or a ticked row edited since (needs "update"). Never hidden. */
export const pendingCount = (rows: SetRowDraft[]): number => unloggedFilled(rows) + rows.filter((r) => r.saved && r.dirty).length;

/** The set the lifter is on: the first row that is not ticked. Null when every row is ticked. Only a visual emphasis; nothing depends on it. */
export const currentRowKey = (rows: SetRowDraft[]): string | null => rows.find((r) => !r.saved)?.key ?? null;
