import { editRow, type SetRowDraft } from "./workoutRows";

/**
 * Typed-but-unticked numbers survive iOS terminating the backgrounded app: one setting per session, written when the app goes to the
 * background or the logger is left (never per keystroke) and applied when the workout is reopened. Restored drafts are typed values, not logged sets.
 */
export const draftKey = (sessionId: string): string => `workout_drafts:${sessionId}`;

export type SavedDraft = { exerciseId: string; key: string; saved: boolean; index: number; load: number | null; reps: number | null; rir: number | null; warmup?: boolean; tags?: string[]; ghostLoad?: number | null; ghostReps?: number | null };

const typed = (r: SetRowDraft) => r.load !== null || r.reps !== null || r.rir !== null;

/** Unsaved rows with typed values, and saved rows typed over since (dirty). `index` = position among the exercise's unsaved rows. */
export function collectDrafts(rows: Record<string, SetRowDraft[]>): SavedDraft[] {
  const out: SavedDraft[] = [];
  for (const [exerciseId, list] of Object.entries(rows)) {
    let unsaved = -1;
    for (const r of list) {
      if (!r.saved) unsaved++;
      if (r.saved ? r.dirty : typed(r)) out.push({ exerciseId, key: r.key, saved: r.saved, index: r.saved ? -1 : unsaved, load: r.load, reps: r.reps, rir: r.rir, warmup: r.warmup, tags: r.tags, ghostLoad: r.ghostLoad, ghostReps: r.ghostReps });
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
      .map((d) => ({ exerciseId: d.exerciseId, key: d.key, saved: d.saved === true, index: typeof d.index === "number" ? d.index : -1, load: num(d.load), reps: num(d.reps), rir: num(d.rir), ...(typeof d.warmup === "boolean" ? { warmup: d.warmup } : {}), ...(Array.isArray(d.tags) ? { tags: d.tags.filter((t: unknown): t is string => typeof t === "string") } : {}), ghostLoad: num(d.ghostLoad), ghostReps: num(d.ghostReps) }));
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
    let list = out[d.exerciseId];
    if (!list) continue;
    let target = list.find((r) => r.key === d.key);
    if (!target && !d.saved) target = list.filter((r) => !r.saved)[d.index];
    // Added rows can exceed the program's planned count. Keep their own stable key and hints.
    if (!target && !d.saved && Number.isInteger(d.index) && d.index >= 0) {
      target = { key: d.key, load: null, reps: null, rir: null, saved: false, dirty: false, warmup: d.warmup ?? false, tags: d.tags ?? [], ghostLoad: d.ghostLoad ?? null, ghostReps: d.ghostReps ?? null };
      list = [...list, target];
    }
    if (!target || target.saved !== d.saved) continue;
    out = { ...out, [d.exerciseId]: editRow(list, target.key, { load: d.load, reps: d.reps, rir: d.rir, ...(d.warmup !== undefined ? { warmup: d.warmup } : {}), ...(d.tags ? { tags: d.tags } : {}) }) };
  }
  return out;
}


interface DraftStorage {
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, text: string): Promise<void>;
}
interface WorkoutDraftStore {
  read(sessionId: string): Promise<SavedDraft[]>;
  snapshot(sessionId: string, rows: Record<string, SetRowDraft[]>): Promise<void>;
  clear(sessionId: string): Promise<void>;
  save<T>(sessionId: string, operation: () => Promise<T>, latestRows: () => Record<string, SetRowDraft[]>): Promise<T>;
}
// One queue survives logger remounts. A resumed screen must wait for the departing screen's last write.
const draftStores = new WeakMap<DraftStorage, WorkoutDraftStore>();
export function getWorkoutDraftStore(storage: DraftStorage, onError: (error: unknown) => void = () => undefined): WorkoutDraftStore {
  const existing = draftStores.get(storage);
  if (existing) return existing;
  let tail = Promise.resolve();
  const ended = new Set<string>();
  const saves = new Set<Promise<unknown>>();
  const write = (sessionId: string, text: string) => {
    tail = tail.then(() => storage.setSetting(draftKey(sessionId), text)).catch(onError);
    return tail;
  };
  const store: WorkoutDraftStore = {
    async read(sessionId) {
      // Navigation can unmount the old logger while a set write is still pending.
      // Its completion refreshes the snapshot after any earlier cleanup snapshot.
      while (saves.size) await Promise.allSettled([...saves]);
      let pending: Promise<void>;
      do { pending = tail; await pending; } while (pending !== tail);
      return ended.has(sessionId) ? [] : parseDrafts(await storage.getSetting(draftKey(sessionId)));
    },
    snapshot(sessionId, rows) {
      // Serialize now: asynchronous writes must not capture a newer render or mutate the snapshot.
      return ended.has(sessionId) ? tail : write(sessionId, serializeDrafts(rows));
    },
    save(sessionId, operation, latestRows) {
      const result = Promise.resolve().then(operation).then(async value => {
        await store.snapshot(sessionId, latestRows());
        return value;
      });
      saves.add(result);
      void result.then(() => saves.delete(result), () => saves.delete(result));
      return result;
    },
    clear(sessionId) {
      // Block cleanup/background writes immediately, then clear after all already queued snapshots.
      ended.add(sessionId);
      return write(sessionId, "");
    },
  };
  draftStores.set(storage, store);
  return store;
}

/** A loading/cancelled view must not replace a previous snapshot with its still-empty rows. */
export function createWorkoutDraftView(store: WorkoutDraftStore, latestRows: () => Record<string, SetRowDraft[]>) {
  let generation = 0;
  let readySession: string | null = null;
  return {
    begin() { readySession = null; return ++generation; },
    isCurrent(load: number) { return load === generation; },
    restore(load: number, sessionId: string) {
      if (load !== generation) return false;
      readySession = sessionId;
      return true;
    },
    cancel(load: number) { if (load === generation) generation++; },
    snapshot(sessionId: string) {
      return readySession === sessionId ? store.snapshot(sessionId, latestRows()) : Promise.resolve();
    },
  };
}
