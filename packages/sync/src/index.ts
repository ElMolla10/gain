/**
 * GAIN sync protocol, shared by the Worker (apps/server) and the phone (apps/mobile). Pure: no I/O.
 *
 * Model: every synced table row is one JSON object (all its columns). The phone turns each changed row into an EVENT with a
 * client-generated UUID and sends batches; the server keeps the winning version per (table, row id) and a change sequence number
 * (`seq`) the other phones pull from. Conflict rule: last write wins per row by `updated_at`; equal timestamps are decided the same way
 * on every machine (a tombstone beats a live row, then the larger canonical JSON string), so two phones always pick the same winner.
 * A delete is a tombstone row (`deleted_at` set), never a physical removal.
 */

export const SYNC_PROTOCOL = 1;

/**
 * Tables that sync, in dependency order (a table appears after every table it references). `setting` is filtered by SYNCED_SETTING_KEYS.
 * A test in apps/mobile checks this list against the real schema, so a new table cannot be forgotten.
 */
export const SYNC_TABLES = [
  "setting",
  "gym",
  "gym_load",
  "exercise",
  "exercise_line",
  "programme",
  "programme_version",
  "programme_day",
  "programme_day_exercise",
  "import_batch",
  "import_mapping",
  "session",
  "session_exercise",
  "workout_set",
  "goal",
  "bodyweight_entry",
  "target",
  "decision_log",
  "rejection_memory",
  "weekly_review",
  "short_week",
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

/** Settings that describe the lifter's data and follow them to a new phone. Device-only settings (language, RTL, rest timer, update checks) do not. */
export const SYNCED_SETTING_KEYS = [
  "active_gym_id",
  "active_programme_id",
  "units",
  "rep_ceilings",
  "use_gain_ceilings",
  "days_per_week",
  "session_minutes",
  "equipment_json",
  "height_cm",
  "birth_date",
  "bodyweight_kg",
  "onboarding_state",
  "week_starts_on",
  "seed_version",
  "library_version",
] as const;

export const MAX_EVENTS_PER_PUSH = 100;
export const MAX_ROW_BYTES = 64 * 1024;
export const MAX_PULL_LIMIT = 500;
/** An event stamped further ahead than this is refused: a wrong clock would otherwise beat every honest write forever. */
export const MAX_CLOCK_AHEAD_MS = 10 * 60 * 1000;

export type Cell = string | number | null;
export type RowData = Record<string, Cell>;

export interface SyncEvent {
  /** Client-generated UUID. Re-sending the same event is always safe. */
  eventId: string;
  table: SyncTable;
  rowId: string;
  updatedAt: number;
  /** Set = tombstone. */
  deletedAt: number | null;
  /** All columns of the row, canonical JSON (see canonicalRow). */
  data: string;
}

export type PushStatus = "applied" | "duplicate" | "stale" | "rejected";
export interface PushResult {
  eventId: string;
  status: PushStatus;
  reason?: string;
}
export interface PushRequest {
  events: SyncEvent[];
}
export interface PushResponse {
  results: PushResult[];
  head: number;
  /** Changes when the server's copy of the account was replaced or rewound (wipe, restore). Absent on servers older than this field. */
  generation?: number;
}

export interface PulledRow {
  table: SyncTable;
  rowId: string;
  updatedAt: number;
  deletedAt: number | null;
  data: string;
  seq: number;
}
export interface PullResponse {
  rows: PulledRow[];
  /** Highest sequence number this account has. */
  head: number;
  /** The cursor to send next time (seq of the last row returned, or `since` if none). */
  next: number;
  hasMore: boolean;
  /** See PushResponse.generation. */
  generation?: number;
}

/** A row as a canonical JSON string: keys sorted, so the same row is the same string on every device. */
export function canonicalRow(row: RowData): string {
  const out: RowData = {};
  for (const k of Object.keys(row).sort()) out[k] = row[k]!;
  return JSON.stringify(out);
}

export interface Version {
  updatedAt: number;
  deletedAt: number | null;
  data: string;
}

/** > 0 when `a` wins over `b`, < 0 when `b` wins, 0 when they are the same version. Deterministic and symmetric. */
export function compareVersions(a: Version, b: Version): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? 1 : -1;
  const ad = a.deletedAt !== null, bd = b.deletedAt !== null;
  if (ad !== bd) return ad ? 1 : -1; // same instant: the delete wins
  if (a.data === b.data) return 0;
  return a.data > b.data ? 1 : -1;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID = /^[A-Za-z0-9_.:-]{1,80}$/;

export function isSyncTable(t: unknown): t is SyncTable {
  return typeof t === "string" && (SYNC_TABLES as readonly string[]).includes(t);
}

export function isSyncedSetting(key: string): boolean {
  return (SYNCED_SETTING_KEYS as readonly string[]).includes(key);
}

/** Why an event cannot be accepted, or null when it is well-formed. Never throws on hostile input. */
export function validateEvent(e: unknown, nowMs: number): string | null {
  if (typeof e !== "object" || e === null) return "not_an_object";
  const ev = e as Record<string, unknown>;
  if (typeof ev.eventId !== "string" || !UUID.test(ev.eventId)) return "bad_event_id";
  if (!isSyncTable(ev.table)) return "unknown_table";
  if (typeof ev.rowId !== "string" || !ID.test(ev.rowId)) return "bad_row_id";
  if (typeof ev.updatedAt !== "number" || !Number.isInteger(ev.updatedAt) || ev.updatedAt <= 0) return "bad_updated_at";
  if (ev.updatedAt > nowMs + MAX_CLOCK_AHEAD_MS) return "clock_ahead";
  if (ev.deletedAt !== null && (typeof ev.deletedAt !== "number" || !Number.isInteger(ev.deletedAt) || ev.deletedAt <= 0)) return "bad_deleted_at";
  if (typeof ev.data !== "string" || ev.data.length > MAX_ROW_BYTES) return "bad_data";
  let parsed: unknown;
  try {
    parsed = JSON.parse(ev.data);
  } catch {
    return "bad_data";
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return "bad_data";
  const row = parsed as Record<string, unknown>;
  for (const v of Object.values(row)) if (v !== null && typeof v !== "string" && typeof v !== "number") return "bad_data";
  if (canonicalRow(row as RowData) !== ev.data) return "not_canonical";
  if (row.id !== ev.rowId) return "id_mismatch";
  if (row.updated_at !== ev.updatedAt) return "updated_at_mismatch";
  if ((row.deleted_at ?? null) !== ev.deletedAt) return "deleted_at_mismatch";
  if (ev.table === "setting" && !isSyncedSetting(ev.rowId)) return "setting_not_synced";
  return null;
}

/** Orders rows so parents come before children (SYNC_TABLES order). Stable within a table. */
export function sortByDependency<T extends { table: SyncTable }>(items: T[]): T[] {
  const rank = new Map<string, number>(SYNC_TABLES.map((t, i) => [t, i]));
  return items.map((x, i) => ({ x, i })).sort((a, b) => rank.get(a.x.table)! - rank.get(b.x.table)! || a.i - b.i).map((p) => p.x);
}

/** What a coach link carries: the finished coach card, as text blocks. Rendered by the Worker with escaping. */
export interface CoachCardPayload {
  lang: "en" | "ar";
  dir: "ltr" | "rtl";
  title: string;
  date: string;
  blocks: { heading: string; lines: string[] }[];
  footer: string;
}
export const COACH_LIMITS = { maxBytes: 24 * 1024, maxBlocks: 12, maxLines: 60, maxText: 600, maxDays: 30, defaultDays: 7, maxActiveLinks: 20 } as const;

/** Why a coach card payload is refused, or null. Only plain strings are allowed; the page escapes them anyway. */
export function validateCoachCard(p: unknown): string | null {
  if (typeof p !== "object" || p === null) return "not_an_object";
  const c = p as Record<string, unknown>;
  const text = (v: unknown) => typeof v === "string" && v.length <= COACH_LIMITS.maxText;
  if (c.lang !== "en" && c.lang !== "ar") return "bad_lang";
  if (c.dir !== "ltr" && c.dir !== "rtl") return "bad_dir";
  if (!text(c.title) || !text(c.date) || !text(c.footer)) return "bad_text";
  if (!Array.isArray(c.blocks) || c.blocks.length === 0 || c.blocks.length > COACH_LIMITS.maxBlocks) return "bad_blocks";
  let lines = 0;
  for (const b of c.blocks) {
    if (typeof b !== "object" || b === null) return "bad_blocks";
    const bb = b as Record<string, unknown>;
    if (!text(bb.heading) || !Array.isArray(bb.lines)) return "bad_blocks";
    for (const l of bb.lines) if (!text(l)) return "bad_text";
    lines += bb.lines.length;
  }
  if (lines > COACH_LIMITS.maxLines) return "too_many_lines";
  if (JSON.stringify(p).length > COACH_LIMITS.maxBytes) return "too_big";
  return null;
}
