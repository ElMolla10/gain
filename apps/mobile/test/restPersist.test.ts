import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cancelRestOnLeave, parseRunningRest, restoreDecision, serializeRunningRest } from "../src/logic/restPersist";

const rest = { sessionId: "s1", endsAt: 2000, durationMs: 90000, label: "Squat" };

describe("running rest persistence (iOS audit 3)", () => {
  it("round-trips and ignores invalid JSON", () => {
    expect(parseRunningRest(serializeRunningRest(rest))).toEqual(rest);
    expect(serializeRunningRest(null)).toBe("");
    for (const bad of [null, "", "{", "[]", '{"sessionId":1}', '{"sessionId":"s","endsAt":"x","durationMs":1}']) expect(parseRunningRest(bad)).toBeNull();
  });
  it("restores a future rest of this session, shows rest over for a past one, clears another session's", () => {
    expect(restoreDecision(rest, "s1", 1000)).toBe("restore");
    expect(restoreDecision(rest, "s1", 2000)).toBe("over");
    expect(restoreDecision(rest, "s2", 1000)).toBe("clear");
    expect(restoreDecision(null, "s1", 1000)).toBe("none");
  });
  it("leaving without finishing keeps the alert; finish or discard cancels it", () => {
    expect(cancelRestOnLeave(false)).toBe(false);
    expect(cancelRestOnLeave(true)).toBe(true);
  });
  it("useWorkoutRest no longer cancels the alert or Live Activity on unmount", () => {
    const src = readFileSync(join(__dirname, "..", "src", "hooks", "useWorkoutRest.ts"), "utf8");
    expect(src).not.toMatch(/useEffect\(\(\) => \(\) =>/);
    const end = src.slice(src.indexOf("async function endRest"));
    expect(end).toMatch(/restAlerts\.cancel\(\)/);
    expect(end).toMatch(/restLiveActivity\.stop\(\)/);
  });
});
