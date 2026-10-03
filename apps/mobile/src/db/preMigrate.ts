import { createDataRepo } from "./dataRepo";
import type { Db, Deps } from "./driver";
import { parseBackup } from "../logic/backup";
import { migrationInfo } from "./migrations";

export const PRE_MIGRATION_FILE = "gain-before-update.json";

/** The copy kept just before a restore replaces the data on the phone (one copy; the newest overwrites the older). */
export const PRE_RESTORE_FILE = "gain-before-restore.json";

export interface PreMigrateResult {
  backedUp: boolean;
  from: number;
  to: number;
  error?: unknown;
  /** There is data to protect and no verified copy of it exists: the update must NOT change the database layout. */
  blocked?: boolean;
}

/**
 * Migration safety rule: before an update changes the database layout, keep a full copy of the lifter's data in the app's private folder
 * (the same JSON as Settings > Your data > backup, so it can be restored with the normal restore). One copy: the newest overwrites the
 * older. Only when there IS data to protect (the database exists and is behind).
 *
 * The copy must be real: after writing, `read` (when given) loads it back and it must be identical to what was written and parse as a
 * backup. If the copy cannot be written or verified the result is `blocked`: the caller stops before migrating and offers a recovery path
 * (try again, or knowingly continue without a copy). `write` / `read` are the file functions (injected for tests).
 */
export async function backupBeforeMigrate(db: Db, deps: Deps, write: (name: string, text: string) => void, read?: (name: string) => string): Promise<PreMigrateResult> {
  const { from, to } = await migrationInfo(db);
  if (from === 0 || from >= to) return { backedUp: false, from, to };
  try {
    const text = await createDataRepo(db, deps).exportJson();
    write(PRE_MIGRATION_FILE, text);
    if (read) {
      const back = read(PRE_MIGRATION_FILE);
      if (back !== text) throw new Error("the saved copy does not match the data it was made from");
      parseBackup(back, Math.max(from, to));
    }
    return { backedUp: true, from, to };
  } catch (error) {
    return { backedUp: false, from, to, error, blocked: true };
  }
}
