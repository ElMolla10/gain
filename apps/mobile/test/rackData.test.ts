import type { GymLoadSpec } from "@gain/engine";
import { describe, expect, it } from "vitest";
import { translate } from "../src/i18n/format";
import { beatLast } from "../src/logic/beatLast";
import { dockKey, dockModel, type DockExercise, type DockTimer } from "../src/logic/dockModel";
import { foldedSummary } from "../src/logic/foldedSummary";
import { plateLine } from "../src/logic/plateText";
import { describeWhyWeight } from "../src/logic/why";
import { focusedExercise } from "../src/logic/workoutFocus";
import type { SetRowDraft } from "../src/logic/workoutRows";

let n = 0;
const row = (o: Partial<SetRowDraft> = {}): SetRowDraft => ({ key: `r${n++}`, load: null, reps: null, rir: null, warmup: false, tags: [], saved: false, dirty: false, ghostLoad: 80, ghostReps: 8, ...o });
const plain = (s: string) => s.replace(/[\u2066-\u2069]/g, "").replace(/\u00a0/g, " ");
const bar: GymLoadSpec = { equipment: "barbell", min: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] };
const bench: DockExercise = { exerciseId: "bench", equipment: "barbell", loadSpec: bar };
const off: DockTimer = { on: false, endsAt: null, over: false, now: 0 };

describe("dockModel", () => {
  it("follows focusedRowKey and counts work sets", () => {
    const rows = { bench: [row({ warmup: true, saved: true, load: 40, reps: 5 }), row({ saved: true, load: 70, reps: 8 }), row()] };
    const m = dockModel([bench], rows, null, off);
    expect(m.rowKey).toBe(rows.bench[2]!.key);
    expect([m.x, m.y, m.load, m.reps, m.mode, m.objKind]).toEqual([2, 2, 80, 8, "compact", "barbell"]);
    expect(m.change?.kind).toBe("add");
    expect(m.perSide).toEqual([25, 5]);
  });
  it("invalid input cannot log and says why", () => {
    const m = dockModel([bench], { bench: [row({ invalidLoad: true })] }, null, off);
    expect(m.canLog).toBe(false);
    expect(m.reason).toBe("fixWeight");
  });
  it("typing in the focused row does not change the model (committed values only)", () => {
    const r = row();
    const a = dockModel([bench], { bench: [{ ...r, load: 1 }] }, null, off, { editing: r.key });
    const b = dockModel([bench], { bench: [{ ...r, load: 12 }] }, null, off, { editing: r.key });
    expect(dockKey(a)).toBe(dockKey(b));
    expect(a.mode).toBe("hidden");
  });
  it("all logged is done", () => {
    expect(dockModel([bench], { bench: [row({ saved: true, load: 80, reps: 8 })] }, null, off).mode).toBe("done");
  });
  it("rest off: no clock, even with a timer running", () => {
    const m = dockModel([bench], { bench: [row()] }, null, { on: false, endsAt: 5000, over: false, now: 1000 });
    expect(m.mode).toBe("compact");
    expect(m.restEndsAt).toBeNull();
    const on = dockModel([bench], { bench: [row()] }, null, { on: true, endsAt: 5000, over: false, now: 1000 });
    expect([on.mode, on.restEndsAt]).toEqual(["rest", 5000]);
  });
  it("an edited saved set reads as update", () => {
    expect(dockModel([bench], { bench: [row({ saved: true, dirty: true, load: 80, reps: 8 })] }, null, off).update).toBe(true);
  });
});

describe("superset focus", () => {
  const ids = ["a1", "a2", "c"];
  const groups = { a1: "g", a2: "g", c: null };
  it("after A1 set n, A2 set n; after the last member, A1 set n+1", () => {
    const afterA1 = { a1: [row({ saved: true, load: 50, reps: 8 }), row()], a2: [row(), row()], c: [row()] };
    expect(focusedExercise(ids, afterA1, "a1", groups)).toBe("a2");
    const afterA2 = { a1: [row({ saved: true, load: 50, reps: 8 }), row()], a2: [row({ saved: true, load: 30, reps: 8 }), row()], c: [row()] };
    expect(focusedExercise(ids, afterA2, "a2", groups)).toBe("a1");
  });
  it("tapping into A2 first, or typing, keeps focus where the lifter is", () => {
    const fresh = { a1: [row(), row()], a2: [row(), row()], c: [row()] };
    expect(focusedExercise(ids, fresh, "a2", groups)).toBe("a2");
    const typing = { a1: [row({ saved: true, load: 50, reps: 8 }), row({ load: 52.5 })], a2: [row(), row()], c: [row()] };
    expect(focusedExercise(ids, typing, "a1", groups)).toBe("a1");
  });
  it("without groups nothing changes", () => {
    const afterA1 = { a1: [row({ saved: true, load: 50, reps: 8 }), row()], a2: [row(), row()], c: [row()] };
    expect(focusedExercise(ids, afterA1, "a1")).toBe("a1");
  });
});

describe("beatLast", () => {
  it("more load at the same reps, or the same load with more reps", () => {
    expect(beatLast({ load: 82.5, reps: 8 }, { load: 80, reps: 8 })).toBe(true);
    expect(beatLast({ load: 80, reps: 9 }, { load: 80, reps: 8 })).toBe(true);
    expect(beatLast({ load: 82.5, reps: 7 }, { load: 80, reps: 8 })).toBe(false);
    expect(beatLast({ load: 80, reps: 8 }, { load: 80, reps: 8 })).toBe(false);
    expect(beatLast({ load: 80, reps: 8 }, null)).toBe(false);
  });
  it("timed sets compare by quantity; W and D never count", () => {
    expect(beatLast({ load: 0, reps: 50 }, { load: 0, reps: 45 }, "time")).toBe(true);
    expect(beatLast({ load: 90, reps: 8, warmup: true }, { load: 80, reps: 8 })).toBe(false);
    expect(beatLast({ load: 90, reps: 8, tags: ["drop"] }, { load: 80, reps: 8 })).toBe(false);
  });
});

describe("foldedSummary", () => {
  const sets = [{ load: 40, reps: 5, warmup: true }, { load: 57.5, reps: 8 }, { load: 57.5, reps: 9 }, { load: 57.5, reps: 10 }, { load: 40, reps: 12, tags: ["drop"] }];
  it("EN and AR", () => {
    expect(plain(foldedSummary(sets, "en", "kg"))).toBe("57.5 kg × 8, 9, 10");
    expect(plain(foldedSummary(sets, "ar", "kg"))).toBe("57.5 كجم × 8، 9، 10");
    expect(foldedSummary(sets, "en", "kg")).toContain("\u00a0×\u00a0");
  });
});

describe("plateText in Arabic (C5)", () => {
  it("Arabic units, isolates and NBSP", () => {
    const t = (k: "plates.each" | "plates.nearest" | "plates.bar", p?: Record<string, string | number>) => translate("ar", k, p);
    const line = plateLine(bar, 77.5, "kg", "ar", t)!;
    expect(plain(line.text)).toBe("كل ناحية: 25 كجم + 2.5 كجم + 1.25 كجم");
    expect(line.text).not.toContain("kg");
    expect(line.text).toContain("\u2066");
    expect(line.text).toContain("\u00a0كجم");
  });
});

describe("why sentence (C11)", () => {
  const input = { trigger: { load: 80, reps: 8, rir: null }, afterExercise: "Squat", action: "maintain" as const, loadSpec: bar, loadSource: "gym" as const };
  it("EN: capitalised sentences ending in a full stop", () => {
    const s = plain(describeWhyWeight(input as never, (k, p) => translate("en", k as never, p), "en").sentence);
    expect(s).toContain(". The rule kept the load. Using the gym steps: ");
    expect(s).not.toMatch(/\. [a-z]/);
    expect(s.endsWith(".")).toBe(true);
  });
  it("AR keeps the comma join and ends with a full stop", () => {
    const s = describeWhyWeight(input as never, (k, p) => translate("ar", k as never, p), "ar").sentence;
    expect(s).toContain("، ");
    expect(s.endsWith(".")).toBe(true);
  });
});
