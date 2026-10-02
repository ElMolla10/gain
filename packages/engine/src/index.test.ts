import { describe, expect, it } from "vitest";
import { RULE_VERSION } from "./index";

describe("engine scaffold", () => {
  it("exposes a versioned rule string", () => {
    expect(RULE_VERSION).toMatch(/^rule-v\d+\.\d+$/);
  });
});
