import { describe, expect, it } from "vitest";
import { slotOfTags } from "@gain/engine";
import { BackupInvalid } from "../src/logic/backup";
import { LATEST_VERSION, MIGRATIONS, migrate } from "../src/db/migrations";
import { createSyncEngine } from "../src/sync/engine";
import type { Transport } from "../src/sync/transport";
import { addRow, backoffPrefill, initialRows, mergeRows, removeRow, rowLabels, stampSavedSlots, tagsForRow, type SavedSet } from "../src/logic/workoutRows";
import { freshDb } from "./helpers";
import { copyAtVersion, dumpAll, populatedWithRealHistory } from "./realData";

const key = () => {
  let n = 0;
  return () => `k${n++}`;
};
const saved = (id: string, load: number, reps: number, tags: string[] = [], extra: Partial<SavedSet> = {}): SavedSet => ({ id, load, reps, rir: null, warmup: false, tags, ...extra });
const slotsOf = (rows: { warmup: boolean; tags: string[] }[]) => rows.filter((r) => !r.warmup && !r.tags.includes("drop")).map((r) => slotOfTags(r.tags));

describe("set identity", () => {
  it("warm-ups and drops do not take a slot, and an untagged working set is not labeled as the top", () => {
    const rows = initialRows(
      [saved("w", 40, 5, [], { warmup: true }), saved("a", 100, 8, ["failure"]), saved("d", 60, 6, ["drop"]), saved("b", 80, 12)],
      3,
      { load: 100, reps: 8 },
      key(),
      backoffPrefill(1, [{ load: 100, reps: 8 }, { load: 80, reps: 12 }]),
    );
    expect(rows.find((r) => r.key === "a")!.tags).toEqual(["failure"]);
    expect(rows.find((r) => r.key === "b")!.tags).toEqual([]);
    expect(rows.find((r) => r.key === "d")!.tags).toEqual(["drop"]);
    expect(rows.some((r) => r.tags.some((t) => t.startsWith("slot:") || t.startsWith("role:")))).toBe(false);
    expect(rowLabels(rows)).toEqual(["W", "F", "D", "2", "3"]);
    expect(tagsForRow({ tags: ["failure"], warmup: false, timed: false, topSets: 1, plannedSets: 3, rows })).toEqual(["failure"]);
  });

  it("deleting the top set does not retag the back-off, including after a reload", () => {
    const rows = initialRows(
      [saved("a", 100, 8, ["slot:1", "role:top"]), saved("b", 80, 12, ["slot:2", "role:backoff"])],
      3,
      { load: 100, reps: 8 },
      key(),
      backoffPrefill(1, []),
    );
    const dropped = removeRow(rows, "a");
    const back = dropped.find((r) => r.key === "b")!;
    expect(tagsForRow({ tags: back.tags, warmup: false, timed: false, topSets: 1, plannedSets: 3, rows: dropped })).toEqual(["slot:2", "role:backoff"]);
    const merged = mergeRows(dropped, [saved("b", 80, 12, ["slot:2", "role:backoff"])]);
    expect(slotOfTags(merged.find((r) => r.key === "b")!.tags)).toBe(2);
    expect(merged.find((r) => r.key === "b")!.tags).not.toContain("role:top");
  });

  it("a set logged in slot 3 before slot 1 is shown in slot order, and two exercises do not share slots", () => {
    const rows = initialRows(
      [saved("c", 70, 12, ["slot:3", "role:backoff"]), saved("a", 100, 8, ["slot:1", "role:top"])],
      3,
      { load: 100, reps: 8 },
      key(),
      backoffPrefill(1, []),
    );
    expect(slotsOf(rows)).toEqual([1, 2, 3]);
    expect(rows.find((r) => slotOfTags(r.tags) === 2)!.saved).toBe(false);
    const other = initialRows([saved("b1", 40, 10, ["slot:1", "role:top"])], 2, { load: 40, reps: 10 }, key(), backoffPrefill(1, []));
    expect(slotOfTags(other[0]!.tags)).toBe(1);
    expect(slotOfTags(rows.find((r) => r.key === "a")!.tags)).toBe(1);
  });

  it("an added back-off copies the last back-off, never the top load, and straight sets are not stamped", () => {
    const scheme = initialRows([], 2, { load: 100, reps: 8 }, key(), backoffPrefill(1, [
      { load: 100, reps: 8, tags: ["slot:1", "role:top"] },
      { load: 70, reps: 10, tags: ["slot:2", "role:backoff"] },
    ]));
    const added = addRow(scheme, { load: 100, reps: 8 }, key(), 1);
    expect(slotOfTags(added[added.length - 1]!.tags)).toBe(3);
    expect(added[added.length - 1]!.ghostLoad).toBe(70);
    const empty = initialRows([], 2, { load: 100, reps: 8 }, key(), backoffPrefill(1, []));
    expect(addRow(empty, { load: 100, reps: 8 }, key(), 1).at(-1)!.ghostLoad).toBeNull();
    const straight = initialRows([saved("a", 60, 8)], 3, { load: 60, reps: 8 }, key());
    expect(straight.every((r) => !r.tags.some((t) => t.startsWith("slot:")))).toBe(true);
    expect(addRow(straight, { load: 60, reps: 8 }, key()).at(-1)!.ghostLoad).toBe(60);
  });

  it("opening a session does not stamp an untagged light-then-heavy log, and a stored role stays on its own side", () => {
    const legacy = [saved("light", 50, 12), saved("drop", 40, 12, ["drop"]), saved("heavy", 100, 8)];
    expect(stampSavedSlots(legacy, 1, 4)).toEqual([]);
    const rows = initialRows(legacy, 4, { load: 100, reps: 8 }, key(), backoffPrefill(1, []));
    expect(rows.find((r) => r.key === "light")!.tags).toEqual([]);
    expect(rows.find((r) => r.key === "heavy")!.tags).toEqual([]);
    expect(rows.filter((r) => !r.saved).every((r) => r.tags.length === 0 && r.ghostLoad === null)).toBe(true);
    expect(stampSavedSlots([saved("b", 80, 12, ["role:backoff"])], 1, 4)).toEqual([{ id: "b", tags: ["slot:2", "role:backoff"] }]);
    expect(stampSavedSlots([
      saved("t", 100, 8, ["slot:1", "role:top"]),
      saved("k", 70, 12, ["slot:2", "role:backoff"]),
    ], 1, 4)).toEqual([]);
    expect(stampSavedSlots([saved("a", 60, 8), saved("b", 80, 6)], null, 3)).toEqual([]);
  });
});

describe("schema 12 over real data", () => {
  it("migrates 11 to 12 with set_targets_json NULL, and a broken 12 rolls back to 11", async () => {
    const cur = await populatedWithRealHistory();
    const old = await copyAtVersion(cur.db, 11);
    const before = await dumpAll(old);
    expect((await old.all<{ name: string }>("PRAGMA table_info(target)")).map((c) => c.name)).not.toContain("set_targets_json");
    const broken = [...MIGRATIONS.filter((m) => m.version <= 11), { version: 12, name: "broken", sql: "ALTER TABLE target ADD COLUMN set_targets_json TEXT; INSERT INTO no_such_table VALUES (1);" }];
    await expect(migrate(old, broken)).rejects.toThrow();
    expect((await old.get<{ user_version: number }>("PRAGMA user_version"))!.user_version).toBe(11);
    expect((await old.all<{ name: string }>("PRAGMA table_info(target)")).some((c) => c.name === "set_targets_json")).toBe(false);
    expect(await dumpAll(old)).toEqual(before);
    expect(await migrate(old)).toEqual({ from: 11, to: 12 });
    const after = await dumpAll(old);
    for (const row of after.target as { set_targets_json: string | null; top_sets?: unknown }[]) expect(row.set_targets_json).toBeNull();
    const stripped = { ...after, target: (after.target as Record<string, unknown>[]).map(({ set_targets_json: _s, ...rest }) => rest) };
    expect(stripped).toEqual(before);
    expect(LATEST_VERSION).toBe(12);
    for (const row of after.programme_day_exercise as { top_sets: number | null }[]) expect(row.top_sets).toBeNull();
  });
});

describe("export, restore and sync of per-set targets", () => {
  async function withPlan() {
    const s = await freshDb();
    await s.repos.seedIfNeeded();
    const gymId = (await s.repos.getActiveGymId())!;
    const day = (await s.repos.getNextDay())!;
    await s.finish.planDay(day.day.id, gymId);
    const row = (await s.db.get<{ id: string }>("SELECT id FROM target WHERE deleted_at IS NULL LIMIT 1"))!;
    const json = JSON.stringify([
      { position: 1, role: "top", load: 60, reps: 8 },
      { position: 2, role: "backoff", load: 40, reps: 12 },
    ]);
    await s.db.run("UPDATE target SET set_targets_json = ? WHERE id = ?", [json, row.id]);
    return { ...s, targetId: row.id, json };
  }

  it("round-trips set_targets_json, and a schema 11 file without the key restores NULL", async () => {
    const a = await withPlan();
    const text = await a.data.exportJson();
    const parsed = JSON.parse(text) as { tables: { target: Record<string, unknown>[] } };
    expect(parsed.tables.target.find((r) => r.id === a.targetId)!.set_targets_json).toBe(a.json);
    const b = await freshDb();
    await b.data.restoreJson(text);
    expect((await b.db.get<{ set_targets_json: string | null }>("SELECT set_targets_json FROM target WHERE id = ?", [a.targetId]))!.set_targets_json).toBe(a.json);
    const older = JSON.parse(text) as { schemaVersion: number; tables: { target: Record<string, unknown>[] } };
    older.schemaVersion = 11;
    for (const r of older.tables.target) delete r.set_targets_json;
    const c = await freshDb();
    await c.data.restoreJson(JSON.stringify(older));
    expect((await c.db.get<{ set_targets_json: string | null }>("SELECT set_targets_json FROM target WHERE id = ?", [a.targetId]))!.set_targets_json).toBeNull();
    const bad = JSON.parse(text) as { tables: { target: Record<string, unknown>[] } };
    bad.tables.target[0]!.future_col = 1;
    await expect(a.data.restoreJson(JSON.stringify(bad))).rejects.toBeInstanceOf(BackupInvalid);
  });

  it("an older sync row that omits set_targets_json does not wipe it, and an unknown column is parked", async () => {
    const a = await withPlan();
    await a.db.run("INSERT INTO sync_state (id, value) VALUES ('status', 'on'), ('device_token', 'tok')");
    const local = await a.db.get<Record<string, string | number | null>>("SELECT * FROM target WHERE id = ?", [a.targetId]);
    let mode: "omit" | "future" = "omit";
    const transport: Transport = {
      async request(method, path, opts) {
        if (method === "POST" && path === "/v1/sync/push") {
          const events = (opts?.body as { events: { eventId: string }[] }).events;
          return { status: 200, json: { results: events.map((e) => ({ eventId: e.eventId, status: "applied" })), head: 5, generation: 1 } };
        }
        if (method === "GET" && path.startsWith("/v1/sync/pull")) {
          const row = { ...local! };
          if (mode === "omit") {
            delete row.set_targets_json;
            row.reps = 9;
            row.updated_at = Number(local!.updated_at) + 1000;
          } else {
            row.future_col = 1;
            row.updated_at = Number(local!.updated_at) + 2000;
          }
          return {
            status: 200,
            json: { rows: [{ table: "target", rowId: a.targetId, updatedAt: Number(row.updated_at), deletedAt: null, data: JSON.stringify(row), seq: mode === "omit" ? 2 : 4 }], next: mode === "omit" ? 2 : 4, hasMore: false, head: 5, generation: 1 },
          };
        }
        throw new Error(`${method} ${path}`);
      },
    };
    const sync = createSyncEngine(a.db, a.deps, transport, null);
    const first = await sync.syncNow();
    expect(first.ok).toBe(true);
    const kept = await a.db.get<{ set_targets_json: string | null; reps: number }>("SELECT set_targets_json, reps FROM target WHERE id = ?", [a.targetId]);
    expect(kept!.set_targets_json).toBe(a.json);
    expect(kept!.reps).toBe(9);
    mode = "future";
    const second = await sync.syncNow();
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.parked).toBe(1);
    expect((await a.db.get<{ set_targets_json: string | null; reps: number }>("SELECT set_targets_json, reps FROM target WHERE id = ?", [a.targetId]))).toEqual(kept);
    expect((await a.db.get<{ reason: string }>("SELECT reason FROM sync_parked WHERE tbl = 'target'"))!.reason).toBe("newer_app");
  });
});
