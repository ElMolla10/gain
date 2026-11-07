import { describe, expect, it } from "vitest";
import { applyDrafts, collectDrafts, draftKey, parseDrafts, serializeDrafts } from "../src/logic/draftPersist";
import { addRow, editRow, initialRows, rowCanLog, type SetRowDraft } from "../src/logic/workoutRows";

const row = (o: Partial<SetRowDraft>): SetRowDraft => ({ key: "k", load: null, reps: null, rir: null, warmup: false, tags: [], saved: false, dirty: false, ghostLoad: 60, ghostReps: 8, ...o });

describe("typed drafts across app termination (iOS audit 10)", () => {
  const before = { bench: [row({ key: "s1", saved: true, load: 60, reps: 8 }), row({ key: "u1", load: 62.5, reps: 8 }), row({ key: "u2" })] };
  it("round-trips onto regenerated keys by position; ghosts and untouched rows stay", () => {
    expect(draftKey("abc")).toBe("workout_drafts:abc");
    const raw = serializeDrafts(before);
    const reopened = { bench: [row({ key: "s1", saved: true, load: 60, reps: 8 }), row({ key: "n1" }), row({ key: "n2" })] };
    const out = applyDrafts(reopened, parseDrafts(raw));
    expect(out.bench![1]).toMatchObject({ key: "n1", load: 62.5, reps: 8, saved: false, ghostLoad: 60 });
    expect(out.bench![2]).toBe(reopened.bench[2]);
    expect(out.bench![0]).toBe(reopened.bench[0]);
  });
  it("never overwrites a row that is saved now; a dirty saved row comes back dirty by key", () => {
    const nowSaved = { bench: [row({ key: "s1", saved: true }), row({ key: "s2", saved: true, load: 70, reps: 5 }), row({ key: "n2" })] };
    const out = applyDrafts(nowSaved, parseDrafts(serializeDrafts(before)));
    expect(out.bench![1]).toMatchObject({ load: 70, reps: 5 });
    const edited = { bench: [row({ key: "s1", saved: true, dirty: true, load: 65, reps: 8 })] };
    const back = applyDrafts({ bench: [row({ key: "s1", saved: true, load: 60, reps: 8 })] }, collectDrafts(edited));
    expect(back.bench![0]).toMatchObject({ load: 65, saved: true, dirty: true });
  });
  it("invalid JSON is ignored and nothing typed gives an empty value (key cleared)", () => {
    expect(parseDrafts("{")).toEqual([]);
    expect(parseDrafts("[1,{\"x\":1}]")).toEqual([]);
    expect(serializeDrafts({ bench: [row({ key: "u" }), row({ key: "s", saved: true })] })).toBe("");
  });
  it("restores added rows, blank gaps and trailing blanks in order without logging them", () => {
    let rows = initialRows([], 1, { load: 60, reps: 8 }, () => "first");
    rows = addRow(rows, { load: 60, reps: 8 }, () => "gap");
    rows = addRow(rows, { load: 60, reps: 8 }, () => "extra");
    rows = editRow(rows, "extra", { reps: 6 });
    rows = addRow(rows, { load: 60, reps: 8 }, () => "trailing");
    const out = applyDrafts({ bench: initialRows([], 1, { load: 100, reps: 3 }, () => "new") }, parseDrafts(serializeDrafts({ bench: rows })));
    expect(out.bench).toHaveLength(4);
    expect(out.bench!.map((r) => [r.load, r.reps])).toEqual([[null, null], [null, null], [null, 6], [null, null]]);
    expect(out.bench![2]).toMatchObject({ saved: false, dirty: false, ghostLoad: 60, ghostReps: 8 });
    expect(out.bench!.every((r) => !r.saved)).toBe(true);
  });
  it.each([
    { warmup: true, tags: [] },
    { warmup: false, tags: ["drop"] },
    { warmup: false, tags: ["failure"] },
  ])("restores typed, kind-only, and dirty saved rows with %j", (kind) => {
    for (const values of [{ load: 20, reps: 10 }, {}]) {
      const out = applyDrafts({ bench: [row({ key: "new" })] }, parseDrafts(serializeDrafts({ bench: [row({ ...kind, ...values })] })));
      expect(out.bench![0]).toMatchObject({ ...kind, ...values, saved: false });
    }
    const dirty = row({ key: "saved", saved: true, dirty: true, ...kind, load: 20, reps: 10 });
    const out = applyDrafts({ bench: [row({ key: "saved", saved: true })] }, parseDrafts(serializeDrafts({ bench: [dirty] })));
    expect(out.bench![0]).toMatchObject({ ...kind, saved: true, dirty: true, load: 20, reps: 10 });
  });
  it("keeps invalid input from silently accepting a ghost target", () => {
    const out = applyDrafts({ bench: [row({ key: "new" })] }, parseDrafts(serializeDrafts({ bench: [row({ invalidLoad: true, invalidReps: true, invalidRir: true })] })));
    expect(out.bench![0]).toMatchObject({ invalidLoad: true, invalidReps: true, invalidRir: true, load: null, reps: null });
    expect(rowCanLog(out.bench![0]!)).toBe(false);
  });
  it("accepts legacy numeric drafts without clearing current row metadata", () => {
    const drafts = parseDrafts(JSON.stringify([{ exerciseId: "bench", key: "old", saved: false, index: 0, load: 40, reps: 5, rir: null }]));
    const out = applyDrafts({ bench: [row({ key: "new", warmup: true, tags: ["custom"] })] }, drafts);
    expect(out.bench![0]).toMatchObject({ load: 40, reps: 5, warmup: true, tags: ["custom"], saved: false });
  });
  it("restores a sparse legacy extra row with blank gaps and no invented ghost values", () => {
    const drafts = parseDrafts('[{"exerciseId":"bench","key":"extra","saved":false,"index":2,"load":75,"reps":6,"rir":null}]');
    const out = applyDrafts({ bench: [row({ key: "new" })] }, drafts);
    expect(out.bench).toHaveLength(3);
    expect(out.bench![1]).toMatchObject({ load: null, reps: null, ghostLoad: null, ghostReps: null, saved: false });
    expect(out.bench![2]).toMatchObject({ key: "extra", load: 75, reps: 6, saved: false, dirty: false });
  });
  it("does not recreate a draft whose original key is already saved", () => {
    const drafts = collectDrafts({ bench: [row({ key: "logged", load: 75, reps: 6 })] });
    const logged = row({ key: "logged", saved: true, load: 80, reps: 5 });
    expect(applyDrafts({ bench: [logged] }, drafts).bench).toEqual([logged]);
  });
  it("rejects corrupt restoration indices and unknown exercise keys", () => {
    for (const index of [1e9, -2, 0.5]) {
      const drafts = parseDrafts(JSON.stringify([{ exerciseId: "bench", key: "missing", saved: false, index, load: 40, reps: 5, rir: null }]));
      expect(applyDrafts({ bench: [] }, drafts).bench).toEqual([]);
    }
    expect(() => applyDrafts({}, parseDrafts('[{"exerciseId":"__proto__","key":"x","index":0}]'))).not.toThrow();
  });
});
