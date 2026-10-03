import { describe, expect, it } from "vitest";
import { sessionMinutes } from "../src/logic/historyRows";

describe("history row duration", () => {
  const T = 1_700_000_000_000;
  it("is whole minutes between start and finish", () => {
    expect(sessionMinutes(T, T + 62 * 60_000, false)).toBe(62);
    expect(sessionMinutes(T, T + 29_000, false)).toBeNull(); // under a minute
  });
  it("is hidden when unknown, imported or implausibly long", () => {
    expect(sessionMinutes(null, T, false)).toBeNull();
    expect(sessionMinutes(T, T + 3_600_000, true)).toBeNull();
    expect(sessionMinutes(T, T + 7 * 3_600_000, false)).toBeNull();
    expect(sessionMinutes(T, T - 60_000, false)).toBeNull();
  });
});
