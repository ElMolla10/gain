import { createRequire } from "node:module";
import { createMutex, type Db, type Param } from "../src/db/driver";

// node:sqlite is loaded through require so bundlers/test runners do not try to resolve the builtin.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

/** Test-only Db backed by Node's built-in SQLite. Same SQL dialect as expo-sqlite (both are SQLite). */
export function openNodeDb(path = ":memory:"): Db {
  const raw = new DatabaseSync(path);
  raw.exec("PRAGMA foreign_keys = ON;");
  const serial = createMutex();
  const db: Db = {
    exec: async (sql) => {
      raw.exec(sql);
    },
    run: async (sql, params: Param[] = []) => {
      const r = raw.prepare(sql).run(...params);
      return { changes: Number(r.changes) };
    },
    all: async <T>(sql: string, params: Param[] = []) => raw.prepare(sql).all(...params) as T[],
    get: async <T>(sql: string, params: Param[] = []) => (raw.prepare(sql).get(...params) as T | undefined) ?? null,
    transaction: (fn) =>
      serial(async () => {
        raw.exec("BEGIN");
        try {
          const r = await fn();
          raw.exec("COMMIT");
          return r;
        } catch (e) {
          raw.exec("ROLLBACK");
          throw e;
        }
      }),
  };
  return db;
}

/**
 * A second connection to the same file with the maintenance driver's semantics (BEGIN IMMEDIATE), for tests of work that runs on its
 * own connection. Needs a file path shared with the first connection (WAL).
 */
export function openNodeMaintenanceDb(path: string): Db {
  const raw = new DatabaseSync(path);
  raw.exec("PRAGMA foreign_keys = ON;");
  const serial = createMutex();
  return {
    exec: async (sql) => {
      raw.exec(sql);
    },
    run: async (sql, params: Param[] = []) => ({ changes: Number(raw.prepare(sql).run(...params).changes) }),
    all: async <T>(sql: string, params: Param[] = []) => raw.prepare(sql).all(...params) as T[],
    get: async <T>(sql: string, params: Param[] = []) => (raw.prepare(sql).get(...params) as T | undefined) ?? null,
    transaction: (fn) =>
      serial(async () => {
        raw.exec("BEGIN IMMEDIATE");
        try {
          const r = await fn();
          raw.exec("COMMIT");
          return r;
        } catch (e) {
          raw.exec("ROLLBACK");
          throw e;
        }
      }),
  };
}
