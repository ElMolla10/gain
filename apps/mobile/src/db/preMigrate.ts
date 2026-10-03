import { createDataRepo } from "./dataRepo";
import type { Db, Deps } from "./driver";
import { migrationInfo } from "./migrations";

export const PRE_MIGRATION_FILE = "gain-before-update.json";

/**
 * Migration safety rule (Step 15): before an update changes the database layout, keep a full copy of the lifter's data in the app's private
 * folder (the same JSON as Settings > Your data > backup, so it can be restored with the normal restore). One copy: the newest overwrites
 * the older. Only when there IS data to protect (the database exists and is behind). `write` is the file writer (injected for tests).
 * If the copy cannot be written the update still goes ahead (each step is transactional) and the caller notes it in the crash log.
 */
export async function backupBeforeMigrate(db: Db, deps: Deps, write: (name: string, text: string) => void): Promise<{ backedUp: boolean; from: number; to: number; error?: unknown }> {
  const { from, to } = await migrationInfo(db);
  if (from === 0 || from >= to) return { backedUp: false, from, to };
  try {
    write(PRE_MIGRATION_FILE, await createDataRepo(db, deps).exportJson());
    return { backedUp: true, from, to };
  } catch (error) {
    return { backedUp: false, from, to, error };
  }
}
