import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDataRepo } from "../src/db/dataRepo";
import { migrate } from "../src/db/migrations";
import { createRepos } from "../src/db/repos";
import { openNodeDb, openNodeMaintenanceDb } from "./nodeDriver";
import { testDeps } from "./helpers";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

async function twoConnections() {
  const dir = mkdtempSync(join(tmpdir(), "gain-maint-"));
  dirs.push(dir);
  const file = join(dir, "t.db");
  const main = openNodeDb(file);
  await main.exec("PRAGMA journal_mode = WAL;");
  await migrate(main);
  const maint = openNodeMaintenanceDb(file);
  return { main, maint };
}

describe("maintenance connection (sync, restore, delete-all)", () => {
  it("turning foreign keys off for a restore does not touch the everyday connection", async () => {
    const { main, maint } = await twoConnections();
    await maint.exec("PRAGMA foreign_keys = OFF");
    expect((await main.get<{ foreign_keys: number }>("PRAGMA foreign_keys"))!.foreign_keys).toBe(1);
    expect((await maint.get<{ foreign_keys: number }>("PRAGMA foreign_keys"))!.foreign_keys).toBe(0);
  });

  it("a rolled-back maintenance transaction leaves other connections' committed rows alone", async () => {
    const { main, maint } = await twoConnections();
    const deps = testDeps();
    const repos = createRepos(main, deps);
    await repos.seedIfNeeded();
    const before = (await main.get<{ n: number }>("SELECT COUNT(*) AS n FROM session_exercise"))!.n;
    await expect(
      maint.transaction(async () => {
        await maint.run("DELETE FROM setting");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect((await main.get<{ n: number }>("SELECT COUNT(*) AS n FROM setting"))!.n).toBeGreaterThan(0);
    expect((await main.get<{ n: number }>("SELECT COUNT(*) AS n FROM session_exercise"))!.n).toBe(before);
  });

  it("restore through the maintenance connection round-trips and leaves foreign keys on for the app", async () => {
    const { main, maint } = await twoConnections();
    const deps = testDeps();
    const repos = createRepos(main, deps);
    await repos.seedIfNeeded();
    const data = createDataRepo(main, deps, maint);
    const json = await data.exportJson();
    const counts = await data.restoreJson(json);
    expect(counts.sessions).toBe(0);
    expect((await main.get<{ foreign_keys: number }>("PRAGMA foreign_keys"))!.foreign_keys).toBe(1);
    expect((await maint.get<{ foreign_keys: number }>("PRAGMA foreign_keys"))!.foreign_keys).toBe(1);
    expect((await main.get<{ n: number }>("SELECT COUNT(*) AS n FROM exercise"))!.n).toBeGreaterThan(0);
    await data.deleteAll();
    expect((await main.get<{ n: number }>("SELECT COUNT(*) AS n FROM exercise"))!.n).toBe(0);
  });
});
