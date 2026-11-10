import { Paths } from "expo-file-system";
import { defaultDatabaseDirectory } from "expo-sqlite";

/** Read-only clues for a persistent native open failure; no database recovery is attempted here. */
export function sqliteOpenDiagnostics(name = "gain.db"): string {
  const lines: string[] = [];
  try {
    const bytes = Paths.availableDiskSpace;
    if (Number.isFinite(bytes) && bytes >= 0) lines.push(`device free storage: ${Math.floor(bytes / 1048576)} MiB`);
  } catch { /* File-system module may itself be unavailable at boot. */ }
  try {
    if (defaultDatabaseDirectory) {
      const dir = Paths.info(defaultDatabaseDirectory);
      const db = Paths.info(defaultDatabaseDirectory, name);
      lines.push(`database directory accessible: ${dir.exists}`);
      lines.push(`database file accessible: ${db.exists}`);
      // exists=false also means no read permission; it is not proof the file is absent.
    }
  } catch { lines.push("database file access check unavailable"); }
  return lines.join("\n");
}
