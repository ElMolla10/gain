import { describe, expect, it } from "vitest";
import { resolveCurrentSet, previousForRow, loadInputMode } from "../src/logic/currentSet";
import { initialRows } from "../src/logic/workoutRows";
const rows = () => ({ a: initialRows([], 3, { load: 67.5, reps: 8 }, () => crypto.randomUUID()), b: initialRows([], 2, { load: 20, reps: 10 }, () => crypto.randomUUID()) });
describe("current set selection and input semantics", () => {
  it("jumps to an unfinished exercise without discarding another draft", () => {
    const r = rows(); r.a[0]!.load = 72.5;
    expect(resolveCurrentSet(["a", "b"], r, { exId: "b", key: r.b[0]!.key }, "a")).toEqual({ exId: "b", key: r.b[0]!.key });
    expect(r.a[0]!.load).toBe(72.5);
  });
  it("can revisit a clean completed row and falls back after removal", () => {
    const r = rows(); r.a[0]!.saved = true;
    expect(resolveCurrentSet(["a", "b"], r, { exId: "a", key: r.a[0]!.key }, null)?.key).toBe(r.a[0]!.key);
    expect(resolveCurrentSet(["b"], r, { exId: "a", key: r.a[0]!.key }, "a")?.exId).toBe("b");
  });
  it("does not turn completion into finishing or invent another set", () => {
    const r = rows(); for (const list of Object.values(r)) for (const row of list) row.saved = true;
    expect(resolveCurrentSet(["a", "b"], r, null, "b")).toEqual({ exId: "b", key: null });
  });
  it("omits missing, warm-up, flagged and non-comparable previous sets", () => {
    expect(previousForRow(null, 0, "reps")).toBeNull();
    expect(previousForRow([{ load: 70, reps: 9, warmup: true }], 0, "reps")).toBeNull();
    expect(previousForRow([{ load: 70, reps: 9, outlierStatus: "unconfirmed" }], 0, "reps")).toBeNull();
    expect(previousForRow([{ load: 70, reps: 9 }], 1, "reps")).toBeNull();
    expect(previousForRow([{ load: 70, reps: 9 }], 0, "time")).toBeNull();
    expect(previousForRow([{ load: 70, reps: 9 }], 0, "reps")).toEqual({ load: 70, reps: 9 });
  });
  it("distinguishes reps-only bodyweight, added load, assistance and loaded exercises", () => {
    expect(loadInputMode({ setup: "bodyweight_plus_added", equipment: "plate" }, 0)).toBe("bodyweight");
    expect(loadInputMode({ setup: "bodyweight_plus_added", equipment: "plate" }, 10)).toBe("added");
    expect(loadInputMode({ setup: "assisted", equipment: "assisted" }, 30)).toBe("assistance");
    for (const equipment of ["barbell", "dumbbell", "machine"]) expect(loadInputMode({ setup: "free", equipment }, 70)).toBe("weight");
  });
});
