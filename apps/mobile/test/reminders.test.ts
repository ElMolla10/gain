import { describe, expect, it } from "vitest";
import {
  defaultReminderSettings, parseReminderSettings, reminderSlots, reminderText, serializeDays, serializeTime, syncReminders, toggleDay,
  type ReminderSlot, type Reminders,
} from "../src/logic/reminders";

class Fake implements Reminders {
  scheduled: ReminderSlot[] = [];
  text: { title: string; body: string } | null = null;
  cancels = 0;
  calls: string[] = [];
  fail = false;
  async ensurePermission() { return "granted" as const; }
  async replaceAll(slots: ReminderSlot[], text: { title: string; body: string }) {
    if (this.fail) throw new Error("boom");
    this.calls.push("replace");
    this.scheduled = slots;
    this.text = text;
  }
  async cancelAll() {
    this.calls.push("cancel");
    this.cancels++;
    this.scheduled = [];
  }
}

describe("training-day reminders (logic)", () => {
  it("are off by default and schedule nothing", () => {
    const d = defaultReminderSettings();
    expect(d).toEqual({ on: false, days: [], hour: 18, minute: 0 });
    expect(reminderSlots(d)).toEqual([]);
    expect(parseReminderSettings({ on: null, days: null, time: null })).toEqual(d);
  });
  it("on with no day chosen schedules nothing", () => {
    expect(reminderSlots({ on: true, days: [], hour: 18, minute: 0 })).toEqual([]);
  });
  it("one slot per chosen weekday, in Expo's numbering (Sunday = 1), at the chosen time", () => {
    const slots = reminderSlots({ on: true, days: [6, 0, 2], hour: 7, minute: 30 });
    expect(slots).toEqual([
      { id: "gain-reminder-0", weekday: 1, hour: 7, minute: 30 },
      { id: "gain-reminder-2", weekday: 3, hour: 7, minute: 30 },
      { id: "gain-reminder-6", weekday: 7, hour: 7, minute: 30 },
    ]);
  });
  it("turned off keeps the chosen days but schedules nothing", () => {
    expect(reminderSlots({ on: false, days: [1, 3], hour: 18, minute: 0 })).toEqual([]);
  });
  it("junk in the settings falls back to safe values", () => {
    expect(parseReminderSettings({ on: "1", days: "not json", time: "25:99" })).toEqual({ on: true, days: [], hour: 18, minute: 0 });
    expect(parseReminderSettings({ on: "1", days: "[1,1,9,-1,\"x\",3]", time: "06:05" })).toEqual({ on: true, days: [1, 3], hour: 6, minute: 5 });
    expect(parseReminderSettings({ on: "yes", days: "{}", time: null }).on).toBe(false);
  });
  it("round-trips through the stored strings", () => {
    const raw = { on: "1", days: serializeDays([5, 1, 1]), time: serializeTime(9, 5) };
    expect(raw).toEqual({ on: "1", days: "[1,5]", time: "09:05" });
    expect(parseReminderSettings(raw)).toEqual({ on: true, days: [1, 5], hour: 9, minute: 5 });
  });
  it("toggling a day adds or removes it and keeps the list sorted", () => {
    expect(toggleDay([], 3)).toEqual([3]);
    expect(toggleDay([3], 1)).toEqual([1, 3]);
    expect(toggleDay([1, 3], 3)).toEqual([1]);
  });
  it("sync replaces everything with exactly the chosen slots, and cancels when off or empty", async () => {
    const f = new Fake();
    const text = reminderText("en");
    expect(await syncReminders(f, { on: true, days: [1, 4], hour: 18, minute: 0 }, text)).toBe("scheduled");
    expect(f.scheduled.map((s) => s.id)).toEqual(["gain-reminder-1", "gain-reminder-4"]);
    expect(await syncReminders(f, { on: true, days: [2], hour: 18, minute: 0 }, text)).toBe("scheduled");
    expect(f.scheduled.map((s) => s.id)).toEqual(["gain-reminder-2"]);
    expect(await syncReminders(f, { on: false, days: [2], hour: 18, minute: 0 }, text)).toBe("cancelled");
    expect(f.scheduled).toEqual([]);
    expect(await syncReminders(f, { on: true, days: [], hour: 18, minute: 0 }, text)).toBe("cancelled");
  });
  it("a platform failure is reported, never thrown", async () => {
    const f = new Fake();
    f.fail = true;
    expect(await syncReminders(f, { on: true, days: [1], hour: 18, minute: 0 }, reminderText("en"))).toBe("failed");
  });
  it("the wording is neutral in both languages: no streak, no guilt, no pressure", () => {
    const bad = /streak|miss|lazy|don't break|do not break|behind|fail|last chance|hurry|skip|فاتك|كسل|متأخر|سلسلة|ما تضيّعش|فوّت/i;
    for (const lang of ["en", "ar"] as const) {
      const t = reminderText(lang);
      expect(t.title).not.toBe("remind.title");
      expect(t.body).not.toBe("remind.body");
      expect(`${t.title} ${t.body}`).not.toMatch(bad);
    }
  });
});

describe("reminders are opt-in and wired without side effects at start", () => {
  it("nothing schedules unless the settings say on", async () => {
    const f = new Fake();
    // what App.tsx does at boot: only syncs when the stored setting is on
    const rs = parseReminderSettings({ on: null, days: null, time: null });
    if (rs.on) await syncReminders(f, rs, reminderText("en"));
    expect(f.calls).toEqual([]);
  });
});
