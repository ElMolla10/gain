import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

// Model Expo's native connection cache, with real SQLite WAL/rollback semantics.
// This is adapter regression coverage, not an Expo/iOS integration test.
const native = vi.hoisted(() => ({ handles: [] as any[], cached: new Map<string, any>() }));
vi.mock("expo-sqlite", () => ({
  openDatabaseAsync: async (name: string, options?: { useNewConnection?: boolean }) => {
    if (!options?.useNewConnection && native.cached.has(name)) return native.cached.get(name);
    const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
    const sql = new DatabaseSync(name);
    const raw = {
      sql,
      execAsync: async (s: string) => {
        // Expo waits for busy locks off the JS thread. Node SQLite is synchronous:
        // yield/retry BEGIN instead, so the other connection can finish its job.
        const statement = s.replace(/PRAGMA busy_timeout = \d+;/g, "PRAGMA busy_timeout = 0;");
        const deadline = Date.now() + 1000;
        for (;;) {
          try { sql.exec(statement); return; }
          catch (e) {
            if (s !== "BEGIN IMMEDIATE" || !String(e).includes("database is locked") || Date.now() >= deadline) throw e;
            await new Promise<void>(resolve => setImmediate(resolve));
          }
        }
      },
      runAsync: async (s: string, p: any[]) => sql.prepare(s).run(...p),
      getAllAsync: async (s: string, p: any[]) => sql.prepare(s).all(...p),
      getFirstAsync: async (s: string, p: any[]) => sql.prepare(s).get(...p) ?? null,
      withTransactionAsync: async (fn: () => Promise<void>) => {
        // Matches Expo's failed-BEGIN rollback behavior too.
        try { sql.exec("BEGIN"); await fn(); sql.exec("COMMIT"); }
        catch (e) { sql.exec("ROLLBACK"); throw e; }
      },
    };
    native.handles.push(raw);
    if (!options?.useNewConnection) native.cached.set(name, raw);
    return raw;
  },
}));
import { openExpoDb, openExpoMaintenanceDb } from "../src/db/expoDriver";

const dirs: string[] = [];
afterEach(() => {
  for (const h of native.handles) h.sql.close();
  native.handles.length = 0;
  native.cached.clear();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

async function setup() {
  const dir = mkdtempSync(join(tmpdir(), "gain-expo-isolation-"));
  dirs.push(dir);
  const file = join(dir, "gain.db");
  const main = await openExpoDb(file);
  const maintenance = await openExpoMaintenanceDb(file);
  await main.exec("CREATE TABLE qa (id TEXT PRIMARY KEY); INSERT INTO qa VALUES ('saved-set');");
  return { main, maintenance };
}

describe("Expo primary/maintenance connection isolation", () => {
  it("keeps restore's connection pragmas out of everyday workout writes", async () => {
    const { main, maintenance } = await setup();
    await maintenance.exec("PRAGMA foreign_keys = OFF;");
    expect(await main.get("PRAGMA foreign_keys")).toEqual({ foreign_keys: 1 });
    expect(await maintenance.get("PRAGMA foreign_keys")).toEqual({ foreign_keys: 0 });
  });

  it("finishes a read-then-write transaction while background capture also writes", async () => {
    const { main, maintenance } = await setup();
    let read!: () => void;
    const ready = new Promise<void>(resolve => { read = resolve; });
    const finishing = main.transaction(async () => {
      expect(await main.all("SELECT id FROM qa")).toEqual([{ id: "saved-set" }]);
      read();
      await new Promise<void>(resolve => setImmediate(resolve));
      await main.run("INSERT INTO qa VALUES ('finished')");
    });
    const capturing = ready.then(() => maintenance.transaction(() => maintenance.run("INSERT INTO qa VALUES ('prediction')")));
    const outcomes = await Promise.allSettled([finishing, capturing]);
    expect(outcomes.map(r => r.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(await main.all("SELECT id FROM qa ORDER BY id")).toEqual([{ id: "finished" }, { id: "prediction" }, { id: "saved-set" }]);
  });

  it("cannot roll back another connection's committed data", async () => {
    const { main, maintenance } = await setup();
    await maintenance.transaction(() => maintenance.run("INSERT INTO qa VALUES ('prediction')"));
    await expect(main.transaction(async () => {
      await main.run("DELETE FROM qa");
      throw new Error("primary failure");
    })).rejects.toThrow("primary failure");
    await expect(maintenance.transaction(async () => {
      await maintenance.run("DELETE FROM qa");
      throw new Error("maintenance failure");
    })).rejects.toThrow("maintenance failure");
    expect(await main.all("SELECT id FROM qa ORDER BY id")).toEqual([{ id: "prediction" }, { id: "saved-set" }]);
  });
});
