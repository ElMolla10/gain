import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REST_NOTIFY_ASKED_KEY, shouldOfferRestNotify } from "../src/logic/restAlert";
import { ar, en } from "../src/i18n/strings";

const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");

describe("logger rest switch offers the lock-screen alert once (iOS audit 2)", () => {
  it("asks only when turning rest on with the alert off and not asked yet", () => {
    expect(shouldOfferRestNotify(true, false, false)).toBe(true);
    expect(shouldOfferRestNotify(true, false, true)).toBe(false);
    expect(shouldOfferRestNotify(true, true, false)).toBe(false);
    expect(shouldOfferRestNotify(false, false, false)).toBe(false);
    expect(REST_NOTIFY_ASKED_KEY).toBe("rest_notify_asked");
  });
  it("the logger runs the offer after the toggle, records the ask and shows the denied hint until the next tick", () => {
    const s = read("src/hooks/useWorkoutSession.ts");
    expect(s).toMatch(/if \(turningOn && !rest\.notify\) void offerRestNotify\(\);/);
    expect(s).toMatch(/setSetting\(REST_NOTIFY_ASKED_KEY, "1"\)/);
    expect(s).toMatch(/async function logRow[^\n]*\n\s*setRestPermDenied\(false\);/);
    expect(read("src/screens/WorkoutScreen.tsx")).toMatch(/restPermDenied \? .*t\("rest\.perm\.denied"\)/);
  });
  it("Settings picks the notify note per platform; the iOS note exists in both languages", () => {
    expect(read("src/screens/SettingsScreen.tsx")).toMatch(/osTextKey\("rest\.notifyNote", Platform\.OS\)/);
    expect(en["rest.notifyNote.ios"]).not.toMatch(/battery/i);
    expect(ar["rest.notifyNote.ios"]).toBeTruthy();
  });
});
