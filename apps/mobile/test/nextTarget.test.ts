import { describe, expect, it } from "vitest";
import { hasConcreteTarget, leadTarget, shortReason, targetText } from "../src/logic/nextTarget";

const tg = (exerciseId: string, extra: Record<string, unknown> = {}) => ({ exerciseId, status: "proposed", currency: "reps", measure: "reps" as const, reps: 8, effectiveLoad: 72.5, ...extra });
const kg = (x: number) => `${x} kg`;

describe("next-session headline", () => {
  it("formats 'load × reps' and timed targets", () => {
    expect(targetText(tg("a"), kg, { s: "s", m: "m" })).toBe("72.5 kg × 8");
    expect(targetText(tg("a", { measure: "time", reps: null, durationS: 45, effectiveLoad: 0 }), kg, { s: "s", m: "m" })).toBe("45 s");
  });
  it("keeps only the first sentence of a reason", () => {
    expect(shortReason("You hit 12 reps on every set. Load goes up one step. Reps reset.")).toBe("You hit 12 reps on every set.");
    expect(shortReason("No full stop here")).toBe("No full stop here");
    expect(shortReason("")).toBe("");
  });
  it("a rejected or empty target is not concrete", () => {
    expect(hasConcreteTarget(tg("a", { status: "rejected" }))).toBe(false);
    expect(hasConcreteTarget(tg("a", { currency: "none" }))).toBe(false);
    expect(hasConcreteTarget(tg("a", { effectiveLoad: null }))).toBe(false);
    expect(hasConcreteTarget(tg("a"))).toBe(true);
  });
  it("leads with a goal lift, else the first concrete target, else nothing", () => {
    const list = [tg("a", { effectiveLoad: null }), tg("b"), tg("c")];
    expect(leadTarget(list, new Set(["c"]))?.exerciseId).toBe("c");
    expect(leadTarget(list, new Set())?.exerciseId).toBe("b");
    expect(leadTarget([tg("a", { status: "rejected" })], new Set())).toBeNull();
  });
});
