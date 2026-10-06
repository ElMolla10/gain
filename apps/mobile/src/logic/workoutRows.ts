/**
 * The active workout as one list: every exercise shows its set rows. A row is either logged (saved on the phone, has a set id)
 * or not yet. Pure helpers, no I/O, so the rules are tested without a phone.
 */
import { ROLE_BACKOFF_TAG, ROLE_TOP_TAG, SLOT_TAG_PREFIX, roleOfTags, slotOfTags, tagsForLoggedSet, tagsWithSlot, topIdentityKnown, workingLoadsBySlot, type SetRole } from "@gain/engine";
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

/** The row fields that make a set the given kind (other tags are kept; a warm-up or a drop set never keeps a slot or a role). */
export function kindPatch(kind: SetKind, tags: readonly string[] = []): { warmup: boolean; tags: string[] } {
  const rest = tags.filter((t) => !KIND_TAGS.includes(t));
  const bare = rest.filter((t) => t !== ROLE_TOP_TAG && t !== ROLE_BACKOFF_TAG && !t.startsWith(SLOT_TAG_PREFIX));
  if (kind === "drop") return { warmup: false, tags: [...bare, "drop"] };
  if (kind === "warmup") return { warmup: true, tags: bare };
  if (kind === "failure") return { warmup: false, tags: [...rest, "failure"] };
  return { warmup: false, tags: rest };
}

/** Drop sets are lighter follow-up sets: they are not working sets for progression, PREVIOUS or the target comparison. */
export const isDropRow = (r: { warmup: boolean; tags?: readonly string[] }): boolean => kindOf(r) === "drop";

const fromSaved = (s: SavedSet): SetRowDraft => ({ key: s.id, load: s.load, reps: s.reps, rir: s.rir, warmup: s.warmup, tags: s.tags ?? [], saved: true, dirty: false, ghostLoad: null, ghostReps: null });
const blank = (key: string, p: Prefill): SetRowDraft => ({ key, load: null, reps: null, rir: null, warmup: false, tags: [], saved: false, dirty: false, ghostLoad: p.load, ghostReps: p.reps });

const isWorkingRow = (r: { warmup: boolean; tags?: readonly string[] }): boolean => !r.warmup && !r.tags?.includes("drop");
const SCHEME_END = 500;

/**
 * Freezes a slot on a saved set only when stored data already names its role and it has no slot yet.
 * A set with neither a slot nor a role is left unmarked. Log order is not a top set, so opening a workout cannot
 * turn the first logged set into one. Straight sets are left alone.
 */
export function stampSavedSlots(saved: SavedSet[], topSets: number | null | undefined, plannedSets: number): { id: string; tags: string[] }[] {
  if (typeof topSets !== "number" || !(topSets >= 1) || topSets >= plannedSets) return [];
  const drafts = saved.map(fromSaved);
  claimSlots(drafts.filter(isWorkingRow), topSets);
  const out: { id: string; tags: string[] }[] = [];
  for (const w of drafts) {
    if (!isWorkingRow(w)) continue;
    const prev = saved.find((s) => s.id === w.key);
    if (!prev) continue;
    if (JSON.stringify(prev.tags ?? []) !== JSON.stringify(w.tags)) out.push({ id: w.key, tags: w.tags });
  }
  return out;
}

/**
 * Keeps a unique stored `slot:N`. A stored role with no slot takes the lowest free slot on that role's side.
 * A set with neither is left unmarked: log order is not a top set. Duplicate slot numbers are not trusted.
 * Returns the slots that are now taken.
 */
function claimSlots(working: SetRowDraft[], topSets: number): Set<number> {
  const claims = new Map<number, SetRowDraft[]>();
  for (const w of working) {
    const s = slotOfTags(w.tags);
    if (s == null) continue;
    const arr = claims.get(s) ?? [];
    arr.push(w);
    claims.set(s, arr);
  }
  const used = new Set<number>();
  const kept = new Set<string>();
  for (const [slot, owners] of claims) {
    if (owners.length !== 1) continue;
    kept.add(owners[0]!.key);
    used.add(slot);
    owners[0]!.tags = tagsWithSlot(owners[0]!.tags, slot, topSets);
  }
  const firstFree = (start: number, end: number): number | null => {
    for (let s = start; s <= end; s++) if (!used.has(s)) return s;
    return null;
  };
  for (const w of working) {
    if (kept.has(w.key)) continue;
    const role = roleOfTags(w.tags);
    if (role == null) continue;
    const slot = role === "top" ? firstFree(1, topSets) : firstFree(topSets + 1, SCHEME_END);
    if (slot == null) continue;
    if ((slot <= topSets ? "top" : "backoff") !== role) continue;
    used.add(slot);
    w.tags = tagsWithSlot(w.tags, slot, topSets);
  }
  return used;
}

/** Log order, then working sets by slot. Warm-ups and drops stick to the working set they followed. They do not take a slot. */
function orderBySlot(rows: SetRowDraft[]): SetRowDraft[] {
  if (!rows.some((r) => isWorkingRow(r) && slotOfTags(r.tags) != null)) return rows;
  const leading: SetRowDraft[] = [];
  const attach = new Map<string, SetRowDraft[]>();
  const working: SetRowDraft[] = [];
  let current: SetRowDraft | null = null;
  for (const r of rows) {
    if (!isWorkingRow(r)) {
      if (!current) leading.push(r);
      else {
        const list = attach.get(current.key) ?? [];
        list.push(r);
        attach.set(current.key, list);
      }
    } else {
      working.push(r);
      current = r;
    }
  }
  const slotted = working.filter((w) => slotOfTags(w.tags) != null).sort((a, b) => slotOfTags(a.tags)! - slotOfTags(b.tags)!);
  const loose = working.filter((w) => slotOfTags(w.tags) == null);
  const out = [...leading];
  for (const w of [...slotted, ...loose]) {
    out.push(w);
    const extra = attach.get(w.key);
    if (extra) out.push(...extra);
  }
  return out;
}

function schemeCount(backoff: BackoffPrefill | null | undefined, perSet: Prefill[] | null | undefined, plannedSets: number, topSets: number | null | undefined): number | null {
  if (!backoff && !perSet) return null;
  const n = topSets ?? backoff?.topSets;
  if (typeof n !== "number" || !(n >= 1) || n >= plannedSets) return null;
  return Math.floor(n);
}

function ghostFor(slot: number, n: number, prefill: Prefill, backoff: BackoffPrefill | null | undefined, perSet: Prefill[] | null | undefined): Prefill {
  if (perSet) {
    const g = perSet[slot - 1];
    return g && g.load != null && g.reps != null ? g : { load: null, reps: null };
  }
  if (slot <= n) return prefill;
  const prev = backoff?.last[slot - 1];
  if (!prev || prev.load == null || prev.reps == null) return { load: null, reps: null };
  return { load: prev.load, reps: prev.reps };
}

/**
 * Rows to show for one exercise: the sets already logged today (oldest first), then empty rows prefilled with today's target
 * until the program's number of working sets is reached. Never invents numbers: with no target and no history the rows are empty.
 * A top-set scheme (a back-off prefill or a per-set plan, and fewer top sets than planned sets) stamps a stable slot on each working
 * set and leaves a blank for a missing slot. Straight sets keep the old list, including drop sets counting toward the row count.
 */
export function initialRows(saved: SavedSet[], plannedSets: number, prefill: Prefill, newKey: () => string, backoff?: BackoffPrefill | null, perSet?: Prefill[] | null, topSets?: number | null): SetRowDraft[] {
  const n = schemeCount(backoff, perSet, plannedSets, topSets);
  if (n == null) {
    const rows = saved.map(fromSaved);
    const working = rows.filter((r) => !r.warmup).length;
    for (let i = working; i < plannedSets; i++) {
      const ghost = perSet ? (perSet[i] ?? { load: null, reps: null }) : backoff && i >= backoff.topSets ? (backoff.last[i] ?? { load: null, reps: null }) : prefill;
      rows.push(blank(newKey(), ghost));
    }
    return rows;
  }
  const rows = saved.map(fromSaved);
  const working = rows.filter(isWorkingRow);
  // Already-logged sets with no slot and no role are not lined up as top then back-off, and they do not gain a second grid of slotted rows.
  if (working.length > 0 && !working.some((w) => slotOfTags(w.tags) != null || roleOfTags(w.tags) != null)) {
    for (let i = working.length; i < plannedSets; i++) rows.push(blank(newKey(), { load: null, reps: null }));
    return rows;
  }
  const used = claimSlots(working, n);
  for (let slot = 1; slot <= plannedSets; slot++) {
    if (used.has(slot)) continue;
    const row = blank(newKey(), ghostFor(slot, n, prefill, backoff, perSet));
    row.tags = tagsWithSlot([], slot, n);
    rows.push(row);
  }
  return orderBySlot(rows);
}

/**
 * Top set + back-offs: the target is for the top set(s). The back-off rows must not be pre-filled with the top set's load (they are lighter),
 * so they show last time's set at the same position when there was one, else stay empty. Never invents a back-off number.
 */
export interface BackoffPrefill {
  topSets: number;
  /** Last session's working sets in order. */
  last: Prefill[];
}
export function backoffPrefill(topSets: number | null | undefined, lastWorkingSets: { load: number; reps: number; warmup?: boolean; tags?: readonly string[] }[] | null | undefined): BackoffPrefill | null {
  if (!topSets || topSets < 1) return null;
  const known = topIdentityKnown(lastWorkingSets ?? []);
  const lined = known ? workingLoadsBySlot(lastWorkingSets ?? []) : [];
  return { topSets, last: lined.map((s) => (s ? { load: s.load, reps: s.reps } : { load: null, reps: null })) };
}

/** Ghosts for a stored per-set plan. A missing position stays empty, never filled from another set. */
export function perSetGhosts(targets: { position: number; load: number | null; reps: number | null }[] | null | undefined, plannedSets: number): Prefill[] | null {
  if (!targets || targets.length === 0) return null;
  const out: Prefill[] = [];
  for (let i = 0; i < plannedSets; i++) {
    const t = targets.find((x) => x.position === i + 1);
    out.push(t ? { load: t.load, reps: t.reps } : { load: null, reps: null });
  }
  return out;
}

/**
 * Which ghosts the logger shows. A stored per-set plan that was not rejected wins, and the old back-off prefill is not also applied.
 * Rejected, straight-set and older targets keep the previous behaviour.
 */
export function loggerGhosts(args: {
  timed: boolean;
  topSets: number | null | undefined;
  lastWorking: { load: number; reps: number; warmup?: boolean; tags?: readonly string[] }[] | null | undefined;
  stored: { status: string; setTargets: { position: number; load: number | null; reps: number | null }[] | null } | null;
  plannedSets: number;
}): { backoff: BackoffPrefill | null; perSet: Prefill[] | null } {
  if (args.timed) return { backoff: null, perSet: null };
  if (args.stored && args.stored.status !== "rejected" && args.stored.setTargets && args.stored.setTargets.length > 0) {
    return { backoff: null, perSet: perSetGhosts(args.stored.setTargets, args.plannedSets) };
  }
  return { backoff: backoffPrefill(args.topSets, args.lastWorking), perSet: null };
}

/** 0-based index among non-warmup, non-drop rows. -1 when this row is not a working set. */
export function workingIndexOf(rows: { key: string; warmup: boolean; tags?: readonly string[] }[], key: string): number {
  let n = -1;
  for (const r of rows) {
    if (r.warmup || r.tags?.includes("drop")) continue;
    n++;
    if (r.key === key) return n;
  }
  return -1;
}

/** Top-set slot vs back-off slot from the row's place. Null when this exercise is straight sets. */
export function roleForWorkingIndex(topSets: number | null | undefined, workingIndex: number): SetRole | null {
  if (!topSets || topSets < 1 || workingIndex < 0) return null;
  return workingIndex < topSets ? "top" : "backoff";
}

/** Adds or clears the role tag. Other tags (drop, failure, ...) stay. */
export function withRoleTag(tags: readonly string[], role: SetRole | null): string[] {
  const rest = tags.filter((t) => t !== ROLE_TOP_TAG && t !== ROLE_BACKOFF_TAG);
  if (!role) return rest;
  return [...rest, role === "top" ? ROLE_TOP_TAG : ROLE_BACKOFF_TAG];
}

/**
 * Tags stored for this row. A slot or a role already on the row is kept.
 * A row with neither is not given one: saving an old unmarked set must not invent a top set.
 * New scheme rows already carry their slot from the blank that was shown.
 */
export function tagsForRow(args: {
  tags: readonly string[];
  warmup: boolean;
  timed: boolean;
  topSets: number | null | undefined;
  plannedSets: number;
  rows: { key: string; warmup: boolean; tags?: readonly string[] }[];
}): string[] {
  const scheme = !args.timed && typeof args.topSets === "number" && args.topSets >= 1 && args.topSets < args.plannedSets;
  return tagsForLoggedSet({ tags: args.tags, warmup: args.warmup, topSets: scheme ? args.topSets : null, plannedSets: args.plannedSets });
}

/** After a reload from the database: logged sets in database order, then the rows not logged yet. Typed-over edits of a logged row survive. Slots, when any set has one, are shown in slot order. No blank is invented here. */
export function mergeRows(prev: SetRowDraft[], saved: SavedSet[]): SetRowDraft[] {
  const byKey = new Map(prev.map((r) => [r.key, r]));
  const out: SetRowDraft[] = saved.map((s) => {
    const p = byKey.get(s.id);
    return p && p.dirty ? { ...p, saved: true } : fromSaved(s);
  });
  return orderBySlot([...out, ...prev.filter((r) => !r.saved)]);
}

/** A new empty row. Straight sets copy the last working row. A top-set scheme takes the next slot, and a new back-off never copies the top load. */
export function addRow(rows: SetRowDraft[], target: Prefill, newKey: () => string, topSets?: number | null): SetRowDraft[] {
  const scheme = typeof topSets === "number" && topSets >= 1;
  if (!scheme) {
    const last = [...rows].reverse().find((r) => !r.warmup && rowCanLog(r));
    return [...rows, blank(newKey(), last ? effectiveOf(last) : target)];
  }
  let max = 0;
  for (const r of rows) {
    if (!isWorkingRow(r)) continue;
    const s = slotOfTags(r.tags);
    if (s != null && s > max) max = s;
  }
  const slot = max + 1;
  const back = slot > topSets;
  const source = [...rows].reverse().find((r) => {
    if (!isWorkingRow(r) || !rowCanLog(r)) return false;
    const s = slotOfTags(r.tags);
    return back ? s != null && s > topSets : s == null || s <= topSets;
  });
  const ghost = source ? effectiveOf(source) : back ? { load: null, reps: null } : target;
  const row = blank(newKey(), ghost);
  row.tags = tagsWithSlot([], slot, topSets);
  return [...rows, row];
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
  const slotted = rows.some((r) => isWorkingRow(r) && slotOfTags(r.tags) != null);
  if (!slotted) {
    let n = 0;
    return rows.map((r) => {
      const k = kindOf(r);
      if (k === "warmup") return "W";
      if (k === "drop") return "D";
      n++;
      return k === "failure" ? "F" : String(n);
    });
  }
  return rows.map((r) => {
    const k = kindOf(r);
    if (k === "warmup") return "W";
    if (k === "drop") return "D";
    if (k === "failure") return "F";
    const s = slotOfTags(r.tags);
    return s != null ? String(s) : "·";
  });
}

/** Rows that are filled in but not logged: what finishing would leave out (shown as a note, never saved silently). */
export const unloggedFilled = (rows: SetRowDraft[]): number => rows.filter((r) => !r.saved && (r.load !== null || r.reps !== null) && rowCanLog(r)).length;

/**
 * Rows whose numbers are not in the database yet: anything typed into a row that is not ticked (even if it cannot be ticked yet, e.g. a
 * weight with no reps), and a ticked row edited since (it needs "update"). Counted so the save status never hides them.
 */
export const pendingCount = (rows: SetRowDraft[]): number => rows.filter((r) => (!r.saved && (r.load !== null || r.reps !== null)) || (r.saved && r.dirty)).length;

/** The set the lifter is on: the first row that is not ticked. Null when every row is ticked. Only a visual emphasis; nothing depends on it. */
export const currentRowKey = (rows: SetRowDraft[]): string | null => rows.find((r) => !r.saved)?.key ?? null;
