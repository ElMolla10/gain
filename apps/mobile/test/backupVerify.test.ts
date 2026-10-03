import { describe, expect, it } from "vitest";
import { BackupIncomplete, RestoreFailed } from "../src/db/dataRepo";
import { freshDb } from "./helpers";

describe("backup and restore are verified before they count as done", () => {
  it("a restore first keeps a copy of what is on the phone, and the copy is a normal backup", async () => {
    const a = await freshDb();
    await a.repos.seedIfNeeded();
    const json = await a.data.exportJson();
    const b = await freshDb();
    await b.repos.seedIfNeeded();
    await b.repos.setSetting("language", "ar");
    let kept = "";
    await b.data.restoreJson(json, { keepCurrent: (j) => void (kept = j) });
    expect(JSON.parse(kept).tables.setting.some((r: { id: string; value: string }) => r.id === "language" && r.value === "ar")).toBe(true);
    // restoring the kept copy brings the previous state back
    await b.data.restoreJson(kept);
    expect(await b.repos.getSetting("language")).toBe("ar");
  });

  it("if the copy of the current data cannot be kept, nothing is replaced", async () => {
    const a = await freshDb();
    await a.repos.seedIfNeeded();
    const json = await a.data.exportJson();
    const b = await freshDb();
    await b.repos.seedIfNeeded();
    await b.repos.setSetting("language", "ar");
    await expect(
      b.data.restoreJson(json, {
        keepCurrent: () => {
          throw new Error("ENOSPC");
        },
      }),
    ).rejects.toBeInstanceOf(RestoreFailed);
    expect(await b.repos.getSetting("language")).toBe("ar");
  });

  it("a restore whose row counts do not match the file is rolled back", async () => {
    const a = await freshDb();
    await a.repos.seedIfNeeded();
    const file = JSON.parse(await a.data.exportJson());
    // a table the file does not list is left empty by the restore; a trigger-like leftover would be caught the same way
    const b = await freshDb();
    await b.repos.seedIfNeeded();
    await b.db.exec("CREATE TRIGGER t_extra AFTER INSERT ON gym BEGIN INSERT INTO setting (id, value, created_at, updated_at) VALUES ('zz_extra', '1', 1, 1) ON CONFLICT(id) DO NOTHING; END;");
    const before = await b.repos.getSetting("language");
    await expect(b.data.restoreJson(JSON.stringify(file))).rejects.toThrow(/incomplete restore|Restore failed/);
    expect(await b.repos.getSetting("language")).toBe(before);
    expect(await b.repos.getSetting("zz_extra")).toBeNull();
  });

  it("an export that disagrees with the database is refused, not saved", async () => {
    const a = await freshDb();
    await a.repos.seedIfNeeded();
    const real = a.db.all.bind(a.db);
    // simulate a table read that loses a row
    (a.db as { all: typeof a.db.all }).all = (async (sql: string, params?: never[]) => {
      const rows = await real(sql, params);
      return /^SELECT \* FROM gym$/.test(sql) ? rows.slice(1) : rows;
    }) as typeof a.db.all;
    await expect(a.data.exportJson()).rejects.toBeInstanceOf(BackupIncomplete);
  });
});
