import { describe, expect, it } from "vitest";
import { defaultRestSettings, parseRestSettings, REST_CHOICES, REST_KEYS, restOffFor, syncRestAlert, toggleRestChoice, type RestAlerts } from "../src/logic/restAlert";
import { newTimer, startTimer, stopTimer } from "../src/logic/restTimer";

const text = { title: "Rest is over", body: "Ready" };
function fake(opts: { fail?: boolean } = {}) {
  const calls: string[] = [];
  const a: RestAlerts = {
    ensurePermission: async () => "granted",
    schedule: async (at) => {
      if (opts.fail) throw new Error("boom");
      calls.push(`schedule:${at}`);
    },
    cancel: async () => {
      if (opts.fail) throw new Error("boom");
      calls.push("cancel");
    },
  };
  return { a, calls };
}

describe("rest settings", () => {
  it("defaults: 90 s, vibrate on, notification off, rest after a set off", () => {
    expect(defaultRestSettings()).toEqual({ seconds: 90, vibrate: true, notify: false, auto: false });
    expect(parseRestSettings({ seconds: null, vibrate: null, notify: null })).toEqual(defaultRestSettings());
  });
  it("reads stored values, clamps and ignores junk", () => {
    expect(parseRestSettings({ seconds: "120", vibrate: "0", notify: "1" })).toEqual({ seconds: 120, vibrate: false, notify: true, auto: false });
    expect(parseRestSettings({ seconds: "120", vibrate: "0", notify: "1", auto: "1" }).auto).toBe(true);
    expect(parseRestSettings({ seconds: null, vibrate: null, notify: null, auto: "yes" }).auto).toBe(false);
    expect(parseRestSettings({ seconds: "5", vibrate: "1", notify: "0" }).seconds).toBe(15);
    expect(parseRestSettings({ seconds: "99999", vibrate: null, notify: null }).seconds).toBe(600);
    expect(parseRestSettings({ seconds: "abc", vibrate: null, notify: "yes" })).toEqual(defaultRestSettings());
    for (const c of REST_CHOICES) expect(parseRestSettings({ seconds: String(c), vibrate: null, notify: null }).seconds).toBe(c);
  });
  it("the rest timer starts off: no countdown unless it is on in general and not switched off for the exercise", () => {
    expect(REST_KEYS.auto).toBe("rest_auto");
    expect(restOffFor(defaultRestSettings().auto)).toBe(true);
    expect(restOffFor(false, { restOff: false })).toBe(true);
    expect(restOffFor(true)).toBe(false);
    expect(restOffFor(true, { restOff: true })).toBe(true);
  });
  it("the logger switch turns rest on (and the saved preference with it); switching off affects only that exercise", () => {
    expect(toggleRestChoice(false, false)).toEqual({ auto: true, restOff: false });
    expect(toggleRestChoice(false, true)).toEqual({ auto: true, restOff: false });
    expect(toggleRestChoice(true, true)).toEqual({ auto: true, restOff: false });
    expect(toggleRestChoice(true, false)).toEqual({ auto: true, restOff: true });
  });
});

describe("rest alert follows the timer", () => {
  const now = 1_000_000;
  it("schedules at the end time while a rest runs and notifications are on", async () => {
    const { a, calls } = fake();
    const t = startTimer(newTimer(90), now);
    expect(await syncRestAlert(a, t, { ...defaultRestSettings(), notify: true }, text, now)).toBe("scheduled");
    expect(calls).toEqual([`schedule:${now + 90_000}`]);
  });
  it("cancels when stopped, finished, or notifications are off", async () => {
    const { a, calls } = fake();
    const on = { ...defaultRestSettings(), notify: true };
    const running = startTimer(newTimer(60), now);
    expect(await syncRestAlert(a, stopTimer(running), on, text, now)).toBe("cancelled");
    expect(await syncRestAlert(a, running, on, text, now + 61_000)).toBe("cancelled");
    expect(await syncRestAlert(a, running, defaultRestSettings(), text, now)).toBe("cancelled");
    expect(calls).toEqual(["cancel", "cancel", "cancel"]);
  });
  it("a platform failure never throws into the logger", async () => {
    const { a } = fake({ fail: true });
    const running = startTimer(newTimer(60), now);
    expect(await syncRestAlert(a, running, { ...defaultRestSettings(), notify: true }, text, now)).toBe("failed");
    expect(await syncRestAlert(a, stopTimer(running), defaultRestSettings(), text, now)).toBe("failed");
  });
});
