import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SYNC_TABLES, SYNCED_SETTING_KEYS } from "@gain/sync";
import { describe, expect, it } from "vitest";
import { migrate } from "../src/db/migrations";
import { loadTableInfo } from "../src/sync/schema";
import { openNodeDb } from "./nodeDriver";

/**
 * Guards that keep sync honest as the app grows: a new table, a new column-less UPDATE or a physical DELETE would silently stop a row
 * from syncing, so these tests fail first.
 */
const dbDir = join(__dirname, "..", "src", "db");
const dbFiles = readdirSync(dbDir).filter((f) => f.endsWith(".ts") && f !== "migrations.ts");

describe("sync covers the real schema", () => {
  it("SYNC_TABLES is exactly the app's tables minus the sync_* bookkeeping, and every table has id/created_at/updated_at/deleted_at", async () => {
    const db = openNodeDb();
    await migrate(db);
    const all = (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")).map((r) => r.name);
    expect([...all.filter((t) => !t.startsWith("sync_"))].sort()).toEqual([...SYNC_TABLES].sort());
    const info = await loadTableInfo(db);
    for (const t of SYNC_TABLES) for (const c of ["id", "created_at", "updated_at", "deleted_at"]) expect(info.get(t)!.cols, `${t}.${c}`).toContain(c);
  });

  it("SYNC_TABLES lists every parent before its children (foreign keys)", async () => {
    const db = openNodeDb();
    await migrate(db);
    const info = await loadTableInfo(db);
    SYNC_TABLES.forEach((t, i) => {
      for (const fk of info.get(t)!.fks) expect(SYNC_TABLES.indexOf(fk.parent as never), `${t} -> ${fk.parent}`).toBeLessThan(i);
    });
  });

  it("every setting key the app writes that describes lifter data is either synced or deliberately device-only", () => {
    const keys = new Set<string>();
    for (const f of readdirSync(join(__dirname, "..", "src"), { recursive: true }) as string[]) {
      if (!/\.(ts|tsx)$/.test(f)) continue;
      const text = readFileSync(join(__dirname, "..", "src", f), "utf8");
      for (const m of text.matchAll(/(?:setSetting|getSetting)\(\s*"([a-z_]+)"/g)) keys.add(m[1]!);
    }
    const deviceOnly = new Set(["language", "rtl_override", "rest_seconds", "rest_vibrate", "rest_notify", "last_update_check", "update_skipped", "app_version_seen"]);
    const unknown = [...keys].filter((k) => !(SYNCED_SETTING_KEYS as readonly string[]).includes(k) && !deviceOnly.has(k));
    expect(unknown, "decide for each: sync it (SYNCED_SETTING_KEYS) or list it as device-only here").toEqual([]);
  });
});

describe("every write to a synced table leaves a trace sync can see", () => {
  it("every UPDATE sets updated_at (otherwise the change would never be uploaded)", () => {
    const bad: string[] = [];
    for (const f of dbFiles) {
      const text = readFileSync(join(dbDir, f), "utf8");
      for (const m of text.matchAll(/UPDATE\s+(\w+)\s+SET\s+([\s\S]{0,400}?)(?=\bWHERE\b)/g)) {
        if ((SYNC_TABLES as readonly string[]).includes(m[1]!) && !/updated_at/.test(m[2]!)) bad.push(`${f}: UPDATE ${m[1]} SET ${m[2]!.slice(0, 60)}`);
      }
      for (const m of text.matchAll(/DO UPDATE SET\s+([\s\S]{0,600}?)(?=\bWHERE\b|`|")/g)) if (!/updated_at/.test(m[1]!)) bad.push(`${f}: ON CONFLICT DO UPDATE SET ${m[1]!.slice(0, 60)}`);
    }
    expect(bad).toEqual([]);
  });

  it("no code deletes rows of a synced table physically (a delete must be a tombstone), except 'delete everything' and restore", () => {
    const bad: string[] = [];
    for (const f of dbFiles) {
      if (f === "dataRepo.ts") continue;
      const text = readFileSync(join(dbDir, f), "utf8");
      for (const m of text.matchAll(/DELETE\s+FROM\s+(\w+)/g)) if ((SYNC_TABLES as readonly string[]).includes(m[1]!)) bad.push(`${f}: DELETE FROM ${m[1]}`);
    }
    expect(bad).toEqual([]);
  });
});
