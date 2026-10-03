import * as SQLite from "expo-sqlite";
import { createMutex, type Db, type Param } from "./driver";

/** expo-sqlite implementation of Db. NOT exercised by the Linux unit tests (needs a device/emulator). */
export async function openExpoDb(name = "gain.db"): Promise<Db> {
  const raw = await SQLite.openDatabaseAsync(name);
  await raw.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  const serial = createMutex();
  return {
    exec: (sql) => raw.execAsync(sql),
    run: async (sql, params: Param[] = []) => {
      const r = await raw.runAsync(sql, params);
      return { changes: r.changes };
    },
    all: <T>(sql: string, params: Param[] = []) => raw.getAllAsync<T & Record<string, unknown>>(sql, params) as Promise<T[]>,
    get: async <T>(sql: string, params: Param[] = []) =>
      ((await raw.getFirstAsync<T & Record<string, unknown>>(sql, params)) as T | null) ?? null,
    transaction: (fn) =>
      serial(async () => {
        let out: unknown;
        await raw.withTransactionAsync(async () => {
          out = await fn();
        });
        return out as never;
      }),
  };
}

/**
 * A SECOND connection to the same file, used only for work that must not mix with the app's everyday statements: the sync engine,
 * restore-from-backup and delete-everything.
 *
 * Why: on one expo-sqlite connection a transaction is not exclusive, so any statement issued while it is open (a tap that logs a
 * set, a screen loading) runs INSIDE it, is rolled back with it, and sees half-applied rows; and `PRAGMA foreign_keys = OFF` for a
 * restore would apply to everybody. On its own connection the maintenance work is isolated by SQLite itself (WAL: readers see the last
 * committed state; writers take turns, waiting up to the busy timeout). Its transactions start with BEGIN IMMEDIATE so they take the
 * write lock up front instead of failing halfway with SQLITE_BUSY_SNAPSHOT. Not exercised by the Linux unit tests (needs a device).
 */
export async function openExpoMaintenanceDb(name = "gain.db"): Promise<Db> {
  const raw = await SQLite.openDatabaseAsync(name);
  await raw.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 15000;");
  const serial = createMutex();
  return {
    exec: (sql) => raw.execAsync(sql),
    run: async (sql, params: Param[] = []) => {
      const r = await raw.runAsync(sql, params);
      return { changes: r.changes };
    },
    all: <T>(sql: string, params: Param[] = []) => raw.getAllAsync<T & Record<string, unknown>>(sql, params) as Promise<T[]>,
    get: async <T>(sql: string, params: Param[] = []) => ((await raw.getFirstAsync<T & Record<string, unknown>>(sql, params)) as T | null) ?? null,
    transaction: (fn) =>
      serial(async () => {
        await raw.execAsync("BEGIN IMMEDIATE");
        try {
          const r = await fn();
          await raw.execAsync("COMMIT");
          return r;
        } catch (e) {
          await raw.execAsync("ROLLBACK").catch(() => undefined);
          throw e;
        }
      }),
  };
}
