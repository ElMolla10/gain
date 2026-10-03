import { SYNC_TABLES, type SyncTable } from "@gain/sync";
import type { Db } from "../db/driver";

export interface TableInfo {
  cols: string[];
  /** Columns that point at another synced table. */
  fks: { col: string; parent: string }[];
}

/** Columns and foreign keys of every synced table, read from the real database so they can never drift from the migrations. */
export async function loadTableInfo(db: Db): Promise<Map<SyncTable, TableInfo>> {
  const out = new Map<SyncTable, TableInfo>();
  for (const t of SYNC_TABLES) {
    const cols = (await db.all<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name);
    const fks = (await db.all<{ table: string; from: string }>(`PRAGMA foreign_key_list(${t})`)).map((f) => ({ col: f.from, parent: f.table }));
    out.set(t, { cols, fks });
  }
  return out;
}
