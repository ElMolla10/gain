import { describe, expect, it } from "vitest";
import { canonicalRow, compareVersions, sortByDependency, SYNC_TABLES, validateCoachCard, validateEvent, type SyncEvent } from "../src/index";

const NOW = 1_800_000_000_000;
const good = (over: Partial<SyncEvent> = {}): SyncEvent => {
  const data = canonicalRow({ id: "g1", name: "A", created_at: 1, updated_at: NOW, deleted_at: null });
  return { eventId: "123e4567-e89b-42d3-a456-426614174000", table: "gym", rowId: "g1", updatedAt: NOW, deletedAt: null, data, ...over };
};

describe("compareVersions", () => {
  const v = (updatedAt: number, deletedAt: number | null, data: string) => ({ updatedAt, deletedAt, data });
  it("later wins, tombstone wins a tie, then larger data; symmetric", () => {
    expect(compareVersions(v(2, null, "a"), v(1, null, "z"))).toBeGreaterThan(0);
    expect(compareVersions(v(1, null, "z"), v(2, null, "a"))).toBeLessThan(0);
    expect(compareVersions(v(1, 1, "a"), v(1, null, "z"))).toBeGreaterThan(0);
    expect(compareVersions(v(1, null, "z"), v(1, 1, "a"))).toBeLessThan(0);
    expect(compareVersions(v(1, null, "b"), v(1, null, "a"))).toBeGreaterThan(0);
    expect(compareVersions(v(1, null, "a"), v(1, null, "a"))).toBe(0);
  });
});

describe("canonicalRow", () => {
  it("is independent of key order", () => {
    expect(canonicalRow({ b: 1, a: "x" })).toBe(canonicalRow({ a: "x", b: 1 }));
  });
});

describe("validateEvent", () => {
  it("accepts a well-formed event", () => expect(validateEvent(good(), NOW)).toBeNull());
  it.each([
    [null, "not_an_object"],
    [{ ...good(), eventId: "nope" }, "bad_event_id"],
    [{ ...good(), table: "account" }, "unknown_table"],
    [{ ...good(), rowId: "a b" }, "bad_row_id"],
    [{ ...good(), updatedAt: 1.5 }, "bad_updated_at"],
    [{ ...good(), updatedAt: NOW + 3_600_000 }, "clock_ahead"],
    [{ ...good(), deletedAt: -3 }, "bad_deleted_at"],
    [{ ...good(), data: "{" }, "bad_data"],
    [{ ...good(), data: "[]" }, "bad_data"],
    [{ ...good(), data: JSON.stringify({ id: "g1", nested: { a: 1 }, updated_at: NOW, deleted_at: null }) }, "bad_data"],
    [{ ...good(), rowId: "other" }, "id_mismatch"],
  ])("refuses %#", (e, why) => expect(validateEvent(e, NOW)).toBe(why));
  it("only whitelisted settings sync", () => {
    const row = (id: string) => canonicalRow({ id, value: "x", created_at: 1, updated_at: NOW, deleted_at: null });
    expect(validateEvent(good({ table: "setting", rowId: "units", data: row("units") }), NOW)).toBeNull();
    expect(validateEvent(good({ table: "setting", rowId: "language", data: row("language") }), NOW)).toBe("setting_not_synced");
    expect(validateEvent(good({ table: "setting", rowId: "sync_token", data: row("sync_token") }), NOW)).toBe("setting_not_synced");
  });
});

describe("sortByDependency", () => {
  it("puts parents first", () => {
    const sorted = sortByDependency([{ table: "workout_set" as const }, { table: "gym" as const }, { table: "session" as const }]);
    expect(sorted.map((x) => x.table)).toEqual(["gym", "session", "workout_set"]);
  });
  it("lists every table once", () => expect(new Set(SYNC_TABLES).size).toBe(SYNC_TABLES.length));
});

describe("validateCoachCard", () => {
  const card = { lang: "en", dir: "ltr", title: "t", date: "2026-10-03", blocks: [{ heading: "h", lines: ["a", "b"] }], footer: "f" };
  it("accepts a plain card", () => expect(validateCoachCard(card)).toBeNull());
  it("refuses bad shapes and size", () => {
    expect(validateCoachCard({ ...card, lang: "fr" })).toBe("bad_lang");
    expect(validateCoachCard({ ...card, blocks: [] })).toBe("bad_blocks");
    expect(validateCoachCard({ ...card, blocks: [{ heading: "h", lines: [1] }] })).toBe("bad_text");
    expect(validateCoachCard({ ...card, title: "x".repeat(601) })).toBe("bad_text");
    expect(validateCoachCard({ ...card, blocks: [{ heading: "h", lines: Array(61).fill("a") }] })).toBe("too_many_lines");
    expect(validateCoachCard(null)).toBe("not_an_object");
  });
});
