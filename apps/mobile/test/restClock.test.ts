import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const stats = readFileSync(join(__dirname, "..", "src", "components", "WorkoutStats.tsx"), "utf8");
const src = readFileSync(join(__dirname, "..", "src", "screens", "WorkoutScreen.tsx"), "utf8");

describe("P27: the 250 ms rest-timer tick does not re-render the whole logger", () => {
  it("the 250 ms interval lives only in the RestClock component", () => {
    expect(stats.match(/, 250\)/g)).toHaveLength(1);
    const clock = stats.slice(stats.indexOf("const RestClock"), stats.indexOf("function LiveDuration"));
    expect(clock).toContain("250");
    const screen = src;
    expect(screen).not.toContain(", 250)");
  });
  it("the end of the rest is one timeout at the end time, not a per-tick check on the screen", () => {
    expect(src).toContain("setTimeout(fire, wait)");
    expect(src).not.toMatch(/isDone\(timer, now\)/);
  });
});
