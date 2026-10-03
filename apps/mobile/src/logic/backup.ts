/** Pure helpers for export / backup (Step 12). No I/O. */

export const BACKUP_APP = "gain";
export const BACKUP_FORMAT = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  format: number;
  /** PRAGMA user_version of the database the backup was taken from. */
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, Record<string, string | number | null>[]>;
}

export type BackupProblem = "not_json" | "not_gain" | "bad_format" | "newer_schema" | "bad_tables" | "bad_values";

export class BackupInvalid extends Error {
  constructor(public readonly code: BackupProblem, detail = "") {
    super(`Backup is not usable: ${code}${detail ? ` (${detail})` : ""}`);
  }
}

const isScalar = (v: unknown): v is string | number | null => v === null || typeof v === "string" || (typeof v === "number" && Number.isFinite(v));

/** Check shape and versions. Does not know the live schema; the repo checks table and column names against it. */
export function parseBackup(text: string, latestSchema: number): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupInvalid("not_json");
  }
  if (!raw || typeof raw !== "object") throw new BackupInvalid("not_gain");
  const b = raw as Partial<BackupFile>;
  if (b.app !== BACKUP_APP) throw new BackupInvalid("not_gain");
  if (b.format !== BACKUP_FORMAT) throw new BackupInvalid("bad_format", String(b.format));
  if (typeof b.schemaVersion !== "number" || !Number.isInteger(b.schemaVersion) || b.schemaVersion < 1) throw new BackupInvalid("bad_format", "schemaVersion");
  if (b.schemaVersion > latestSchema) throw new BackupInvalid("newer_schema", String(b.schemaVersion));
  if (!b.tables || typeof b.tables !== "object" || Array.isArray(b.tables)) throw new BackupInvalid("bad_tables");
  for (const [name, rows] of Object.entries(b.tables)) {
    if (!/^[a-z_][a-z0-9_]*$/.test(name) || !Array.isArray(rows)) throw new BackupInvalid("bad_tables", name);
    for (const r of rows) {
      if (!r || typeof r !== "object" || Array.isArray(r)) throw new BackupInvalid("bad_values", name);
      for (const [col, v] of Object.entries(r)) {
        if (!/^[a-z_][a-z0-9_]*$/.test(col) || !isScalar(v)) throw new BackupInvalid("bad_values", `${name}.${col}`);
      }
    }
  }
  return b as BackupFile;
}

// ---- CSV in Hevy's columns, so the file opens in Excel and re-imports with GAIN's own Hevy importer ----------------

export const CSV_COLUMNS = ["title", "start_time", "end_time", "description", "exercise_title", "superset_id", "exercise_notes", "set_index", "set_type", "weight_kg", "reps", "distance_km", "duration_seconds", "rpe"] as const;

export interface CsvSetRow {
  title: string;
  startMs: number;
  endMs: number;
  exerciseTitle: string;
  setIndex: number;
  warmup: boolean;
  drop: boolean;
  /** Taken to failure (Hevy set_type "failure"). */
  failure?: boolean;
  /** Superset group of this exercise in that workout (Hevy superset_id): same value = same superset. */
  supersetId?: string | null;
  weightKg: number;
  reps: number;
  rir: number | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Local wall clock as "Sep 29, 2026, 3:15 PM" (what the Hevy parser reads; local time, like Hevy writes it). */
export function csvTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${h12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const q = (s: string): string => `"${s.replace(/"/g, '""')}"`;
/** A cell that starts with = + - @ could run as a formula in Excel; prefix it. Numbers are written bare. */
const text = (s: string): string => q(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);

export function buildCsv(rows: CsvSetRow[]): string {
  const out = [CSV_COLUMNS.map(q).join(",")];
  for (const r of rows) {
    const type = r.warmup ? "warmup" : r.drop ? "dropset" : r.failure ? "failure" : "normal";
    const rpe = r.rir === null ? "" : String(Math.max(0, Math.min(10, 10 - r.rir)));
    out.push(
      [text(r.title), q(csvTime(r.startMs)), q(csvTime(r.endMs)), '""', text(r.exerciseTitle), r.supersetId ? q(r.supersetId) : "", '""', String(r.setIndex), q(type), String(r.weightKg), String(r.reps), "", "", rpe].join(","),
    );
  }
  return out.join("\n") + "\n";
}
