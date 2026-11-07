import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseImport } from "@gain/engine";
import { describe, expect, it, vi } from "vitest";
import type { MappingChoice, TitlePreview } from "../src/db/importRepo";
import { freshDb } from "./helpers";

const parse = parseImport(readFileSync(join(__dirname, "../../../fixtures/hevy-synthetic.csv"), "utf8"));

function acceptAll(titles: TitlePreview[]): Record<string, MappingChoice> {
  return Object.fromEntries(titles.map(({ title, suggestion: s }) => [title, s.kind === "new"
    ? { kind: "new", nameEn: s.nameEn, pattern: s.pattern, equipment: s.equipment ?? "cable", setup: s.setup ?? "free" }
    : { kind: "existing", exerciseId: s.exerciseId }]));
}

describe("import commit versus follow-up refresh failures", () => {
  it("returns committed counts and a warning, then refreshes without reimporting", async () => {
    const c = await freshDb();
    try {
      await c.repos.seedIfNeeded();
      const gymId = (await c.repos.getActiveGymId())!;
      const preview = await c.imports.preview(parse);
      const refresh = vi.spyOn(c.finish, "refreshPlannedSessions").mockRejectedValueOnce(new Error("target refresh unavailable"));

      const result = await c.imports.importHistory({ parse, gymId, mappings: acceptAll(preview.titles), fileName: "hevy-synthetic.csv" });
      expect(result).toMatchObject({ workouts: preview.newWorkouts, sets: preview.newSets, refreshWarning: "targets" });
      expect(result.batchId).toBeTruthy();
      expect(refresh).toHaveBeenCalledOnce();
      expect(await c.db.get("SELECT COUNT(*) AS n FROM session WHERE import_key IS NOT NULL AND deleted_at IS NULL"))
        .toEqual({ n: preview.newWorkouts });
      expect(await c.db.get("SELECT COUNT(*) AS n FROM workout_set WHERE deleted_at IS NULL"))
        .toEqual({ n: preview.newSets });
      const batches = await c.imports.listBatches();
      expect(batches).toHaveLength(1);
      expect(batches[0]).toMatchObject({ workouts: preview.newWorkouts, sets: preview.newSets });

      await expect(c.imports.refreshAfterImport()).resolves.toBeNull();
      expect(refresh).toHaveBeenCalledTimes(2);
      expect(await c.imports.listBatches()).toHaveLength(1);
      const retry = await c.imports.importHistory({ parse, gymId, mappings: {} });
      expect(retry).toMatchObject({ batchId: null, workouts: 0, sets: 0, duplicates: preview.newWorkouts });
      expect(refresh).toHaveBeenCalledTimes(2);
    } finally {
      c.db.close();
    }
  });

  it("reports an achievement refresh failure and keeps the warning on failed retry", async () => {
    const c = await freshDb();
    try {
      await c.repos.seedIfNeeded();
      const gymId = (await c.repos.getActiveGymId())!;
      const preview = await c.imports.preview(parse);
      const getSetting = c.repos.getSetting.bind(c.repos);
      const settings = vi.spyOn(c.repos, "getSetting").mockImplementation(async (key) => {
        if (key === "week_starts_on") throw new Error("private diagnostic detail");
        return getSetting(key);
      });
      const result = await c.imports.importHistory({ parse, gymId, mappings: acceptAll(preview.titles) });
      expect(result).toMatchObject({ workouts: preview.newWorkouts, sets: preview.newSets, refreshWarning: "achievements" });
      await expect(c.imports.refreshAfterImport()).resolves.toBe("achievements");
      settings.mockRestore();
      await expect(c.imports.refreshAfterImport()).resolves.toBeNull();
      expect(await c.imports.listBatches()).toHaveLength(1);
    } finally {
      c.db.close();
    }
  });

  it("returns normal success without a warning when follow-up refresh succeeds", async () => {
    const c = await freshDb();
    try {
      await c.repos.seedIfNeeded();
      const gymId = (await c.repos.getActiveGymId())!;
      const preview = await c.imports.preview(parse);
      const refresh = vi.spyOn(c.finish, "refreshPlannedSessions");
      const result = await c.imports.importHistory({ parse, gymId, mappings: acceptAll(preview.titles) });
      expect(result).toMatchObject({ workouts: preview.newWorkouts, sets: preview.newSets });
      expect(result.refreshWarning).toBeUndefined();
      expect(refresh).toHaveBeenCalledOnce();
      expect(await c.imports.undoBatch(result.batchId!)).toEqual({ workouts: preview.newWorkouts, sets: preview.newSets });
    } finally {
      c.db.close();
    }
  });

  it("keeps genuine transaction errors atomic and does not start follow-up refresh", async () => {
    const c = await freshDb();
    try {
      await c.repos.seedIfNeeded();
      const gymId = (await c.repos.getActiveGymId())!;
      const preview = await c.imports.preview(parse);
      const mappings = acceptAll(preview.titles);
      const run = c.db.run.bind(c.db);
      vi.spyOn(c.db, "run").mockImplementation(async (sql, params) => {
        if (sql.includes("INSERT INTO workout_set")) throw new Error("set insert failed");
        return run(sql, params);
      });
      const refresh = vi.spyOn(c.finish, "refreshPlannedSessions");

      await expect(c.imports.importHistory({ parse, gymId, mappings })).rejects.toThrow("set insert failed");
      for (const table of ["workout_set", "import_batch"]) {
        expect(await c.db.get(`SELECT COUNT(*) AS n FROM ${table}`)).toEqual({ n: 0 });
      }
      expect(await c.db.get("SELECT COUNT(*) AS n FROM session WHERE import_key IS NOT NULL")).toEqual({ n: 0 });
      expect(refresh).not.toHaveBeenCalled();
    } finally {
      c.db.close();
    }
  });

  it.each(["targets", "achievements"] as const)("returns removed counts when undo commits but %s refresh fails", async (stage) => {
    const c = await freshDb();
    try {
      await c.repos.seedIfNeeded();
      const gymId = (await c.repos.getActiveGymId())!;
      const preview = await c.imports.preview(parse);
      const imported = await c.imports.importHistory({ parse, gymId, mappings: acceptAll(preview.titles) });
      const getSetting = c.repos.getSetting.bind(c.repos);
      const failed = stage === "targets"
        ? vi.spyOn(c.finish, "refreshPlannedSessions").mockRejectedValueOnce(new Error("target refresh unavailable"))
        : vi.spyOn(c.repos, "getSetting").mockImplementation(async (key) => {
          if (key === "week_starts_on") throw new Error("achievement refresh unavailable");
          return getSetting(key);
        });

      await expect(c.imports.undoBatch(imported.batchId!)).resolves.toEqual({ workouts: preview.newWorkouts, sets: preview.newSets, refreshWarning: stage });
      expect(await c.imports.listBatches()).toEqual([]);
      expect(await c.db.get("SELECT COUNT(*) AS n FROM workout_set WHERE deleted_at IS NULL")).toEqual({ n: 0 });
      expect(await c.db.get("SELECT COUNT(*) AS n FROM session WHERE import_key IS NOT NULL AND deleted_at IS NULL")).toEqual({ n: 0 });
      failed.mockRestore();
      const writes = vi.spyOn(c.db, "run");
      await expect(c.imports.refreshAfterImport()).resolves.toBeNull();
      expect(writes.mock.calls.some(([sql]) => /UPDATE (workout_set|session|import_batch) SET deleted_at/.test(sql))).toBe(false);
      expect(await c.imports.listBatches()).toEqual([]);
    } finally {
      c.db.close();
    }
  });

  it("rolls back a genuine undo transaction failure without refreshing", async () => {
    const c = await freshDb();
    try {
      await c.repos.seedIfNeeded();
      const gymId = (await c.repos.getActiveGymId())!;
      const preview = await c.imports.preview(parse);
      const imported = await c.imports.importHistory({ parse, gymId, mappings: acceptAll(preview.titles) });
      const refresh = vi.spyOn(c.finish, "refreshPlannedSessions");
      const run = c.db.run.bind(c.db);
      vi.spyOn(c.db, "run").mockImplementation(async (sql, params) => {
        if (sql.startsWith("UPDATE session SET deleted_at")) throw new Error("session delete failed");
        return run(sql, params);
      });
      await expect(c.imports.undoBatch(imported.batchId!)).rejects.toThrow("session delete failed");
      expect(await c.imports.listBatches()).toHaveLength(1);
      expect(await c.db.get("SELECT COUNT(*) AS n FROM workout_set WHERE deleted_at IS NULL")).toEqual({ n: preview.newSets });
      expect(await c.db.get("SELECT COUNT(*) AS n FROM session WHERE import_key IS NOT NULL AND deleted_at IS NULL")).toEqual({ n: preview.newWorkouts });
      expect(refresh).not.toHaveBeenCalled();
    } finally {
      c.db.close();
    }
  });
});
