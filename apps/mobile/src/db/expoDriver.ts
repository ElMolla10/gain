import * as SQLite from "expo-sqlite";
import type { Db, Param } from "./driver";

/** expo-sqlite implementation of Db. NOT exercised by the Linux unit tests (needs a device/emulator). */
export async function openExpoDb(name = "gain.db"): Promise<Db> {
  const raw = await SQLite.openDatabaseAsync(name);
  await raw.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  return {
    exec: (sql) => raw.execAsync(sql),
    run: async (sql, params: Param[] = []) => {
      const r = await raw.runAsync(sql, params);
      return { changes: r.changes };
    },
    all: <T>(sql: string, params: Param[] = []) => raw.getAllAsync<T & Record<string, unknown>>(sql, params) as Promise<T[]>,
    get: async <T>(sql: string, params: Param[] = []) =>
      ((await raw.getFirstAsync<T & Record<string, unknown>>(sql, params)) as T | null) ?? null,
    transaction: (fn) => {
      let out: unknown;
      return raw
        .withTransactionAsync(async () => {
          out = await fn();
        })
        .then(() => out as never);
    },
  };
}
