import { describe, expect, it } from "vitest";
import { serializeSessionDrafts, restoreSessionDrafts, serializeDrafts } from "../src/logic/draftPersist";
import { initialRows } from "../src/logic/workoutRows";
const make = () => ({ a: initialRows([], 3, { load: 67.5, reps: 8 }, () => crypto.randomUUID()) });
describe("durable current workout snapshot", () => {
  it("restores edits, exact blank row count, stable IDs and selected exercise/set", () => {
    const r = make(); r.a[1]!.load = 72.5; r.a[1]!.reps = 7; r.a.push({ ...r.a[2]!, key: "added" });
    const cursor = { exId: "a", key: r.a[1]!.key };
    const result = restoreSessionDrafts(make(), serializeSessionDrafts(r, cursor));
    expect(result.rows.a).toEqual(r.a.map(row => ({ ...row, invalidLoad: false, invalidReps: false, invalidRir: false }))); expect(result.cursor).toEqual(cursor);
  });
  it("keeps blank additions/deletions and a selected completed set after restart", () => {
    const r = make(); r.a = [r.a[0]!]; r.a[0] = { ...r.a[0]!, key: "saved", saved: true, load: 70, reps: 9 };
    const initial = make(); initial.a.unshift({ ...r.a[0]! });
    const restored = restoreSessionDrafts(initial, serializeSessionDrafts(r, { exId: "a", key: "saved" }));
    expect(restored.rows.a).toHaveLength(1); expect(restored.rows.a![0]!.saved).toBe(true); expect(restored.cursor?.key).toBe("saved");
  });
  it("never restores a committed pending ID as another unsaved set", () => {
    const before = make(); const raw = serializeSessionDrafts(before, { exId: "a", key: before.a[0]!.key });
    const initial = make(); initial.a.unshift({ ...before.a[0]!, saved: true, load: 67.5, reps: 8 });
    const result = restoreSessionDrafts(initial, raw);
    expect(result.rows.a!.filter(r => r.key === before.a[0]!.key)).toHaveLength(1);
    expect(result.cursor).toEqual({ exId: "a", key: null });
  });
  it("supports existing snapshots and ignores corrupt metadata", () => {
    const r = make(); r.a[0]!.load = 75;
    expect(restoreSessionDrafts(make(), serializeDrafts(r)).rows.a![0]!.load).toBe(75);
    expect(restoreSessionDrafts(r, '{broken').rows).toBe(r);
  });
});
