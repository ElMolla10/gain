import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

/**
 * A small D1Database look-alike over Node's built-in SQLite (same SQL dialect as D1). Covers prepare/bind/run/all/first/batch/exec.
 * `batch` is atomic like D1's. `failNext` lets a test make the next statement throw (fault injection).
 */
export function openTestD1(): D1Database & { failNext: (n?: number) => void; raw: InstanceType<typeof DatabaseSync> } {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON;");
  let failures = 0;
  const check = () => {
    if (failures > 0) {
      failures--;
      throw new Error("injected D1 failure");
    }
  };
  const meta = (changes: number) => ({ changes, duration: 0, last_row_id: 0, rows_read: 0, rows_written: changes, changed_db: changes > 0, size_after: 0 });
  // D1 accepts numbered placeholders (?1); node:sqlite does not, so rewrite them to plain ? with the parameters repeated in order.
  const numbered = (sql: string, params: unknown[]): [string, unknown[]] => {
    if (!/\?\d/.test(sql)) return [sql, params];
    const out: unknown[] = [];
    const text = sql.replace(/\?(\d+)/g, (_m, n: string) => {
      out.push(params[Number(n) - 1]);
      return "?";
    });
    return [text, out];
  };
  const make = (sql0: string, params0: unknown[] = []) => {
    const [sql, params] = numbered(sql0, params0);
    return makeRaw(sql, params, sql0);
  };
  const makeRaw = (sql: string, params: unknown[], original: string): ReturnType<typeof makeStmt> => makeStmt(sql, params, original);
  const makeStmt = (sql: string, params: unknown[], original: string) => ({
    bind: (...p: unknown[]) => make(original, p),
    run: async () => {
      check();
      const r = raw.prepare(sql).run(...(params as never[]));
      return { success: true, results: [], meta: meta(Number(r.changes)) };
    },
    all: async () => {
      check();
      const rows = raw.prepare(sql).all(...(params as never[]));
      return { success: true, results: rows, meta: meta(0) };
    },
    first: async (col?: string) => {
      check();
      const row = raw.prepare(sql).get(...(params as never[])) as Record<string, unknown> | undefined;
      if (!row) return null;
      return col ? row[col] : row;
    },
    raw: async () => (raw.prepare(sql).all(...(params as never[])) as Record<string, unknown>[]).map((r) => Object.values(r)),
    _run: () => {
      check();
      const upper = sql.trimStart().toUpperCase();
      const isRead = upper.startsWith("SELECT") || /\bRETURNING\b/i.test(sql);
      if (isRead) {
        const rows = raw.prepare(sql).all(...(params as never[]));
        return { success: true, results: rows, meta: meta(0) };
      }
      const r = raw.prepare(sql).run(...(params as never[]));
      return { success: true, results: [], meta: meta(Number(r.changes)) };
    },
  });
  const db = {
    prepare: (sql: string) => make(sql),
    batch: async (stmts: ReturnType<typeof make>[]) => {
      raw.exec("BEGIN");
      try {
        const out = stmts.map((s) => s._run());
        raw.exec("COMMIT");
        return out;
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },
    exec: async (sql: string) => {
      raw.exec(sql);
      return { count: 1, duration: 0 };
    },
    failNext: (n = 1) => {
      failures = n;
    },
    raw,
  };
  const dir = join(import.meta.dirname, "..", "migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) raw.exec(readFileSync(join(dir, f), "utf8"));
  return db as unknown as D1Database & { failNext: (n?: number) => void; raw: InstanceType<typeof DatabaseSync> };
}
