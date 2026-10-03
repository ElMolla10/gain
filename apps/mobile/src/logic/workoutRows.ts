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
  /** Saved on the phone. */
  saved: boolean;
  /** Saved, but typed over since (needs "update"). */
  dirty: boolean;
}

export interface SavedSet {
  id: string;
  load: number;
  reps: number;
  rir: number | null;
  warmup: boolean;
}

export interface Prefill {
  load: number | null;
  reps: number | null;
}

export const rowReady = (r: Pick<SetRowDraft, "load" | "reps">): r is Pick<SetRowDraft, "load" | "reps"> & { load: number; reps: number } => r.load !== null && r.reps !== null && r.reps >= 1 && r.load >= 0;

const fromSaved = (s: SavedSet): SetRowDraft => ({ key: s.id, load: s.load, reps: s.reps, rir: s.rir, warmup: s.warmup, saved: true, dirty: false });
const blank = (key: string, p: Prefill): SetRowDraft => ({ key, load: p.load, reps: p.reps, rir: null, warmup: false, saved: false, dirty: false });

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

/** A new empty row, prefilled from the last working row (the common case is the same weight again), else from the target. */
export function addRow(rows: SetRowDraft[], target: Prefill, newKey: () => string): SetRowDraft[] {
  const last = [...rows].reverse().find((r) => !r.warmup && r.load !== null && r.reps !== null);
  return [...rows, blank(newKey(), last ? { load: last.load, reps: last.reps } : target)];
}

export const removeRow = (rows: SetRowDraft[], key: string): SetRowDraft[] => rows.filter((r) => r.key !== key);

/** Typing into a row. A logged row becomes "dirty" (it shows "update"). */
export function editRow(rows: SetRowDraft[], key: string, patch: Partial<Pick<SetRowDraft, "load" | "reps" | "rir" | "warmup">>): SetRowDraft[] {
  return rows.map((r) => (r.key === key ? { ...r, ...patch, dirty: r.saved ? true : r.dirty } : r));
}

export const markSaved = (rows: SetRowDraft[], key: string): SetRowDraft[] => rows.map((r) => (r.key === key ? { ...r, saved: true, dirty: false } : r));

/** Numbering shown to the lifter: warm-ups are labelled W, working sets count 1, 2, 3 ... */
export function rowLabels(rows: SetRowDraft[]): string[] {
  let n = 0;
  return rows.map((r) => (r.warmup ? "W" : String(++n)));
}

/** Rows that are filled in but not logged: what finishing would leave out (shown as a note, never saved silently). */
export const unloggedFilled = (rows: SetRowDraft[]): number => rows.filter((r) => !r.saved && rowReady(r)).length;
