import { describe, expect, it } from "vitest";
import { applyDrafts, collectDrafts, draftKey, parseDrafts, serializeDrafts } from "../src/logic/draftPersist";
import type { SetRowDraft } from "../src/logic/workoutRows";

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
});
