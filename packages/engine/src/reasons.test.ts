import { describe, expect, it } from "vitest";
import { renderReason } from "./reasons";

describe("renderReason", () => {
  it("the product sentence", () => {
    expect(
      renderReason({ key: "reps_in_range", params: { load: 30, reps: 12, nextLoad: 32.5, equipment: "dumbbell", unit: "kg" } }),
    ).toBe("Stay at 30 kg, aim for 12, the next dumbbell is 32.5.");
  });
  it("drops the next-load clause when there is no heavier load", () => {
    expect(renderReason({ key: "reps_in_range", params: { load: 40, reps: 11, equipment: "dumbbell", unit: "kg" } })).toBe(
      "Stay at 40 kg, aim for 11.",
    );
  });
  it("names the quality change", () => {
    const s = renderReason({
      key: "quality_change",
      params: { load: 30, reps: 12, quality: "pause", nextLoad: 32.5, equipment: "dumbbell", unit: "kg" },
    });
    expect(s).toContain("a one-second pause");
  });
  it("missing params stay visible instead of silently disappearing", () => {
    expect(renderReason({ key: "load_up", params: { load: 32.5, unit: "kg" } })).toContain("{reps}");
  });
  it("Arabic and English both exist for the no-history message", () => {
    expect(renderReason({ key: "no_history", params: {} }, "en")).toMatch(/nothing is proposed/);
    expect(renderReason({ key: "no_history", params: {} }, "ar")).toMatch(/[\u0600-\u06FF]/);
  });
});

describe("old or unknown reason keys (Step 7)", () => {
  it("a key this build does not know is shown as stored, never a crash", () => {
    const r = { key: "from_rule_v0_1_only", params: { load: 60, reps: 8 } } as unknown as Parameters<typeof renderReason>[0];
    expect(renderReason(r, "en")).toBe("from_rule_v0_1_only (load=60, reps=8)");
    expect(renderReason(r, "ar")).toBe("from_rule_v0_1_only (load=60, reps=8)");
    expect(renderReason({ key: "gone", params: {} } as unknown as Parameters<typeof renderReason>[0])).toBe("gone");
  });
});
