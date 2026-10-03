import { buildCsv, BACKUP_APP, BACKUP_FORMAT, parseBackup, BackupInvalid, type BackupFile, type CsvSetRow } from "../logic/backup";
import { LATEST_VERSION } from "./migrations";
import type { Db, Deps } from "./driver";
import { hasLoggedSets } from "./sessionSql";

export class BackupIncomplete extends Error {
  constructor(detail: string) {
    super(`The backup would be incomplete (${detail}); nothing was saved.`);
  }
}
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
/**
 * `maint` is the connection used for restore and delete-everything (a second connection on a device, so the foreign-key switch and the
 * big transaction cannot mix with the app's other statements). It defaults to `db` (tests, and anything without a second connection).
 */
export function createDataRepo(db: Db, deps: Deps, maint: Db = db) {
  async function userTables(): Promise<string[]> {
    const rows = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    return rows.map((r) => r.name);
  }

  async function counts(): Promise<DataCounts> {
    const n = async (sql: string) => (await db.get<{ n: number }>(sql))!.n;
    return {
      sessions: await n(`SELECT COUNT(*) AS n FROM session s WHERE s.status = 'finished' AND s.deleted_at IS NULL AND ${hasLoggedSets("s")}`),
      sets: await n("SELECT COUNT(*) AS n FROM workout_set WHERE deleted_at IS NULL"),
      gyms: await n("SELECT COUNT(*) AS n FROM gym WHERE deleted_at IS NULL"),
      programmes: await n("SELECT COUNT(*) AS n FROM programme WHERE deleted_at IS NULL"),
    };
  }

  /** Full-fidelity backup: every row of every table (soft-deleted rows too, so a restore is exact). */
  async function exportJson(nowMs: number = deps.now()): Promise<string> {
    const v = await db.get<{ user_version: number }>("PRAGMA user_version");
    const tables: BackupFile["tables"] = {};
    // sync_* is bookkeeping and holds the account token: it never goes into a file the lifter may share.
    for (const name of await userTables()) if (!name.startsWith("sync_")) tables[name] = await db.all(`SELECT * FROM ${name}`);
    const file: BackupFile = { app: BACKUP_APP, format: BACKUP_FORMAT, schemaVersion: Number(v?.user_version ?? LATEST_VERSION), exportedAt: new Date(nowMs).toISOString(), tables };
    // A backup only counts as made when it is complete: every table has as many rows in the file as in the database, and the file reads back.
    for (const [name, rows] of Object.entries(tables)) {
      const n = (await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${name}`))!.n;
      if (n !== rows.length) throw new BackupIncomplete(`table ${name} has ${n} rows but ${rows.length} were written`);
    }
    const text = JSON.stringify(file);
    parseBackup(text, Math.max(file.schemaVersion, LATEST_VERSION));
    return text;
  }

  /** Finished sessions' sets in Hevy's column layout (kg): opens in Excel, and GAIN's own import reads it back. */
  async function exportCsv(): Promise<string> {
    const rows = await db.all<{
      title: string; started_at: number | null; finished_at: number; exercise: string; exercise_id: string; load: number; reps: number; rir: number | null; duration_s: number | null; distance_m: number | null;
      is_warmup: number; tags_json: string; sid: string;
    }>(
      `SELECT d.name AS title, s.started_at, s.finished_at, e.name_en AS exercise, e.id AS exercise_id, ws.load, ws.reps, ws.rir, ws.duration_s, ws.distance_m, ws.is_warmup, ws.tags_json, s.id AS sid
         FROM workout_set ws JOIN session s ON s.id = ws.session_id JOIN exercise e ON e.id = ws.exercise_id JOIN programme_day d ON d.id = s.programme_day_id
        WHERE s.status = 'finished' AND s.deleted_at IS NULL AND ws.deleted_at IS NULL AND s.finished_at IS NOT NULL
        ORDER BY s.finished_at, s.rowid, ws.created_at, ws.position, ws.rowid`,
    );
    // A superset is written as a number per workout (1, 2, ...), under the exercise's name as shown (the swapped-in one if it was swapped).
    const groups = await db.all<{ session_id: string; slot: string; replaced_by: string | null; g: string }>(
      "SELECT session_id, slot_exercise_id AS slot, replaced_by, superset_group AS g FROM session_exercise WHERE superset_group IS NOT NULL AND removed = 0 AND deleted_at IS NULL ORDER BY created_at",
    );
    const ssId = new Map<string, string>();
    const ssNumber = new Map<string, number>();
    for (const g of groups) {
      const n = ssNumber.get(`${g.session_id}|${g.g}`) ?? new Set([...ssNumber.keys()].filter((k) => k.startsWith(`${g.session_id}|`))).size;
      ssNumber.set(`${g.session_id}|${g.g}`, n);
      ssId.set(`${g.session_id}|${g.replaced_by ?? g.slot}`, String(n));
    }
    const out: CsvSetRow[] = [];
    const idx = new Map<string, number>();
    for (const r of rows) {
      const k = `${r.sid}|${r.exercise_id}`;
      const i = idx.get(k) ?? 0;
      idx.set(k, i + 1);
      out.push({
        title: r.title, startMs: r.started_at ?? r.finished_at, endMs: r.finished_at, exerciseTitle: r.exercise, setIndex: i,
        warmup: r.is_warmup === 1, drop: (JSON.parse(r.tags_json) as string[]).includes("drop"), failure: (JSON.parse(r.tags_json) as string[]).includes("failure"), supersetId: ssId.get(k) ?? null, weightKg: r.load, reps: r.reps, rir: r.rir, durationS: r.duration_s, distanceM: r.distance_m,
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
  async function restoreJson(text: string, opts: { keepCurrent?: (json: string) => void | Promise<void> } = {}): Promise<{ sessions: number; sets: number }> {
    const { file, counts: c } = await inspectBackup(text);
    const tables = await userTables();
    // First an automatic local copy of what is on the phone now. If it cannot be made (or verified by the caller), nothing is replaced.
    if (opts.keepCurrent) {
      try {
        await opts.keepCurrent(await exportJson());
      } catch (e) {
        throw new RestoreFailed(`could not keep a copy of the current data first (${e instanceof Error ? e.message : String(e)})`);
      }
    }
    await maint.exec("PRAGMA foreign_keys = OFF");
    try {
      await maint.transaction(async () => {
        for (const t of tables) await maint.run(`DELETE FROM ${t}`);
        for (const [name, rows] of Object.entries(file.tables)) {
          for (const r of rows) {
            const cols = Object.keys(r);
            await maint.run(`INSERT INTO ${name} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, cols.map((k) => r[k]!));
          }
        }
        const bad = await maint.all("PRAGMA foreign_key_check");
        if (bad.length > 0) throw new RestoreFailed("the backup refers to rows it does not contain");
        // Completeness: every table holds exactly the rows the file had (tables the file does not have must be empty).
        for (const t of tables) {
          const want = file.tables[t]?.length ?? 0;
          const have = (await maint.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`))!.n;
          if (have !== want) throw new RestoreFailed(`incomplete restore: ${t} has ${have} rows instead of ${want}`);
        }
      });
    } catch (e) {
      throw e instanceof RestoreFailed ? e : new RestoreFailed(e instanceof Error ? e.message : String(e));
    } finally {
      await maint.exec("PRAGMA foreign_keys = ON");
    }
    return c;
  }

  /** Erase everything this app stored on the phone. The schema stays; the app goes back to first run. */
  async function deleteAll(): Promise<void> {
    const tables = await userTables();
    await maint.exec("PRAGMA foreign_keys = OFF");
    try {
      await maint.transaction(async () => {
        for (const t of tables) await maint.run(`DELETE FROM ${t}`);
      });
    } finally {
      await maint.exec("PRAGMA foreign_keys = ON");
    }
    // Rows are gone from the table pages; compact the file so deleted content does not linger on disk.
    await maint.exec("VACUUM").catch(() => undefined);
  }

  return { counts, exportJson, exportCsv, inspectBackup, restoreJson, deleteAll };
}
export type DataRepo = ReturnType<typeof createDataRepo>;
