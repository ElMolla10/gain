import { buildCsv, BACKUP_APP, BACKUP_FORMAT, parseBackup, BackupInvalid, type BackupFile, type CsvSetRow } from "../logic/backup";
import { LATEST_VERSION } from "./migrations";
import type { Db, Deps } from "./driver";

export class RestoreFailed extends Error {
  constructor(detail: string) {
    super(`Restore failed, nothing was changed: ${detail}`);
  }
}

export interface DataCounts {
  sessions: number;
  sets: number;
  gyms: number;
  programmes: number;
}

/** Export everything, restore a backup, delete everything. The user owns the data. Runs on the local database only. */
export function createDataRepo(db: Db, deps: Deps) {
  async function userTables(): Promise<string[]> {
    const rows = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    return rows.map((r) => r.name);
  }

  async function counts(): Promise<DataCounts> {
    const n = async (sql: string) => (await db.get<{ n: number }>(sql))!.n;
    return {
      sessions: await n("SELECT COUNT(*) AS n FROM session WHERE status = 'finished' AND deleted_at IS NULL"),
      sets: await n("SELECT COUNT(*) AS n FROM workout_set WHERE deleted_at IS NULL"),
      gyms: await n("SELECT COUNT(*) AS n FROM gym WHERE deleted_at IS NULL"),
      programmes: await n("SELECT COUNT(*) AS n FROM programme WHERE deleted_at IS NULL"),
    };
  }

  /** Full-fidelity backup: every row of every table (soft-deleted rows too, so a restore is exact). */
  async function exportJson(nowMs: number = deps.now()): Promise<string> {
    const v = await db.get<{ user_version: number }>("PRAGMA user_version");
    const tables: BackupFile["tables"] = {};
    for (const name of await userTables()) tables[name] = await db.all(`SELECT * FROM ${name}`);
    const file: BackupFile = { app: BACKUP_APP, format: BACKUP_FORMAT, schemaVersion: Number(v?.user_version ?? LATEST_VERSION), exportedAt: new Date(nowMs).toISOString(), tables };
    return JSON.stringify(file);
  }

  /** Finished sessions' sets in Hevy's column layout (kg): opens in Excel, and GAIN's own import reads it back. */
  async function exportCsv(): Promise<string> {
    const rows = await db.all<{
      title: string; started_at: number | null; finished_at: number; exercise: string; exercise_id: string; load: number; reps: number; rir: number | null;
      is_warmup: number; tags_json: string; sid: string;
    }>(
      `SELECT d.name AS title, s.started_at, s.finished_at, e.name_en AS exercise, e.id AS exercise_id, ws.load, ws.reps, ws.rir, ws.is_warmup, ws.tags_json, s.id AS sid
         FROM workout_set ws JOIN session s ON s.id = ws.session_id JOIN exercise e ON e.id = ws.exercise_id JOIN programme_day d ON d.id = s.programme_day_id
        WHERE s.status = 'finished' AND s.deleted_at IS NULL AND ws.deleted_at IS NULL AND s.finished_at IS NOT NULL
        ORDER BY s.finished_at, s.rowid, ws.created_at, ws.position, ws.rowid`,
    );
    const out: CsvSetRow[] = [];
    const idx = new Map<string, number>();
    for (const r of rows) {
      const k = `${r.sid}|${r.exercise_id}`;
      const i = idx.get(k) ?? 0;
      idx.set(k, i + 1);
      out.push({
        title: r.title, startMs: r.started_at ?? r.finished_at, endMs: r.finished_at, exerciseTitle: r.exercise, setIndex: i,
        warmup: r.is_warmup === 1, drop: (JSON.parse(r.tags_json) as string[]).includes("drop"), weightKg: r.load, reps: r.reps, rir: r.rir,
      });
    }
    return buildCsv(out);
  }

  /** Check a backup file without touching anything: its shape, and that every table and column exists in this app. */
  async function inspectBackup(text: string): Promise<{ file: BackupFile; counts: { sessions: number; sets: number } }> {
    const file = parseBackup(text, LATEST_VERSION);
    const known = new Set(await userTables());
    for (const [name, rows] of Object.entries(file.tables)) {
      if (!known.has(name)) throw new BackupInvalid("bad_tables", `unknown table ${name}`);
      if (rows.length === 0) continue;
      const cols = new Set((await db.all<{ name: string }>(`PRAGMA table_info(${name})`)).map((c) => c.name));
      for (const r of rows) for (const c of Object.keys(r)) if (!cols.has(c)) throw new BackupInvalid("bad_tables", `unknown column ${name}.${c}`);
    }
    const live = (rows: Record<string, unknown>[] | undefined) => (rows ?? []).filter((r) => r.deleted_at === null || r.deleted_at === undefined);
    return {
      file,
      counts: {
        sessions: live(file.tables.session).filter((r) => r.status === "finished").length,
        sets: live(file.tables.workout_set).length,
      },
    };
  }

  /**
   * Replace everything on this phone with a backup. All or nothing: the file is checked first, then the swap runs in one
   * transaction with foreign keys verified before it commits. Needs a backup from this app version or an older one.
   */
  async function restoreJson(text: string): Promise<{ sessions: number; sets: number }> {
    const { file, counts: c } = await inspectBackup(text);
    const tables = await userTables();
    await db.exec("PRAGMA foreign_keys = OFF");
    try {
      await db.transaction(async () => {
        for (const t of tables) await db.run(`DELETE FROM ${t}`);
        for (const [name, rows] of Object.entries(file.tables)) {
          for (const r of rows) {
            const cols = Object.keys(r);
            await db.run(`INSERT INTO ${name} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, cols.map((k) => r[k]!));
          }
        }
        const bad = await db.all("PRAGMA foreign_key_check");
        if (bad.length > 0) throw new RestoreFailed("the backup refers to rows it does not contain");
      });
    } catch (e) {
      throw e instanceof RestoreFailed ? e : new RestoreFailed(e instanceof Error ? e.message : String(e));
    } finally {
      await db.exec("PRAGMA foreign_keys = ON");
    }
    return c;
  }

  /** Erase everything this app stored on the phone. The schema stays; the app goes back to first run. */
  async function deleteAll(): Promise<void> {
    const tables = await userTables();
    await db.exec("PRAGMA foreign_keys = OFF");
    try {
      await db.transaction(async () => {
        for (const t of tables) await db.run(`DELETE FROM ${t}`);
      });
    } finally {
      await db.exec("PRAGMA foreign_keys = ON");
    }
    // Rows are gone from the table pages; compact the file so deleted content does not linger on disk.
    await db.exec("VACUUM").catch(() => undefined);
  }

  return { counts, exportJson, exportCsv, inspectBackup, restoreJson, deleteAll };
}
export type DataRepo = ReturnType<typeof createDataRepo>;
