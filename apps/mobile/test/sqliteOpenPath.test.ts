import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const sqliteIos = join(dirname(require.resolve("expo-sqlite/package.json")), "ios");

/**
 * iOS open used `URL(string:)` on a filesystem path. A `#` or `?` in that path made the directory
 * it created a different path from the one `sqlite3_open` received, so the constructor threw
 * E_SQLITE_OPEN_DATABASE and discarded the SQLite message. The native patch resolves plain paths
 * with `URL(fileURLWithPath:)` and reports the SQLite code.
 */
describe("expo-sqlite iOS database open", () => {
  const moduleSrc = readFileSync(join(sqliteIos, "SQLiteModule.swift"), "utf8");
  const pathSrc = readFileSync(join(sqliteIos, "DatabaseFileUtils.swift"), "utf8");

  it("resolves the database file as a file URL and keeps a failed open's SQLite error", () => {
    expect(moduleSrc).toContain("DatabaseFileUtils.fileURL(fromDatabasePath: path)");
    expect(moduleSrc).not.toContain("guard let pathUrl = URL(string: path)");
    expect(moduleSrc).toContain("OpenDatabaseFailedException");
    expect(moduleSrc).toContain("exsqlite3_extended_errcode");
    expect(moduleSrc).toContain("exsqlite3_close(db)");
    expect(pathSrc).toContain("URL(fileURLWithPath: path)");
    expect(pathSrc).toContain("migrateLegacyDatabaseFiles");
  });
});
