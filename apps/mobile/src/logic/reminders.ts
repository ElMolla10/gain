/**
 * Training-day reminders (Step 10, optional). OFF by default, opt-in: the lifter picks the weekdays and a time, and allows notifications.
 * One local, repeating weekly notification per chosen weekday. Nothing leaves the phone. The text is neutral: no streaks, no guilt, no
 * "you missed". GAIN's rotation is not tied to weekdays, so the reminder does not name a workout; it just says it is a training day.
 * Weekdays are numbered like JavaScript's Date#getDay (0 = Sunday ... 6 = Saturday), as in the rest of the app.
 */
import { translate, type Lang } from "../i18n/format";

export interface ReminderSettings {
  on: boolean;
  /** 0 = Sunday ... 6 = Saturday, sorted, no duplicates. */
  days: number[];
  hour: number;
  minute: number;
}

export const REMINDER_KEYS = { on: "reminder_on", days: "reminder_days", time: "reminder_time" } as const;
export const REMINDER_ID_PREFIX = "gain-reminder-";

export const defaultReminderSettings = (): ReminderSettings => ({ on: false, days: [], hour: 18, minute: 0 });

const cleanDays = (xs: readonly unknown[]): number[] => [...new Set(xs.filter((x): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 6))].sort((a, b) => a - b);

/** Never throws: junk in the settings table falls back to the defaults (off, no days, 18:00). */
export function parseReminderSettings(raw: { on: string | null; days: string | null; time: string | null }): ReminderSettings {
  const d = defaultReminderSettings();
  let days: number[] = [];
  try {
    const v = raw.days === null ? [] : (JSON.parse(raw.days) as unknown);
    days = Array.isArray(v) ? cleanDays(v) : [];
  } catch {
    days = [];
  }
  const m = raw.time === null ? null : /^(\d{1,2}):(\d{2})$/.exec(raw.time);
  const hour = m ? Number(m[1]) : d.hour;
  const minute = m ? Number(m[2]) : d.minute;
  const okTime = hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
  return { on: raw.on === "1", days, hour: okTime ? hour : d.hour, minute: okTime ? minute : d.minute };
}

export const serializeDays = (days: readonly number[]): string => JSON.stringify(cleanDays(days));
export const serializeTime = (hour: number, minute: number): string => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

export const toggleDay = (days: readonly number[], day: number): number[] => cleanDays(days.includes(day) ? days.filter((d) => d !== day) : [...days, day]);

export interface ReminderSlot {
  id: string;
  /** Expo's numbering: 1 = Sunday ... 7 = Saturday. */
  weekday: number;
  hour: number;
  minute: number;
}

/** What should be scheduled: nothing unless the reminders are on AND at least one weekday is chosen. */
export function reminderSlots(s: ReminderSettings): ReminderSlot[] {
  if (!s.on) return [];
  return cleanDays(s.days).map((d) => ({ id: `${REMINDER_ID_PREFIX}${d}`, weekday: d + 1, hour: s.hour, minute: s.minute }));
}

export type ReminderPermission = "granted" | "denied" | "unavailable";

/** What the screen needs from the platform. The Expo implementation lives in notifications/reminders.ts (device only). */
export interface Reminders {
  ensurePermission(): Promise<ReminderPermission>;
  /** Replaces every earlier reminder with exactly these. */
  replaceAll(slots: ReminderSlot[], text: { title: string; body: string }): Promise<void>;
  cancelAll(): Promise<void>;
}

/** Keep the platform in step with the settings. Never throws: a reminder that cannot be scheduled must not break the app. */
export async function syncReminders(r: Reminders, s: ReminderSettings, text: { title: string; body: string }): Promise<"scheduled" | "cancelled" | "failed"> {
  try {
    const slots = reminderSlots(s);
    if (slots.length === 0) {
      await r.cancelAll();
      return "cancelled";
    }
    await r.replaceAll(slots, text);
    return "scheduled";
  } catch {
    return "failed";
  }
}

export const reminderText = (lang: Lang): { title: string; body: string } => ({ title: translate(lang, "remind.title"), body: translate(lang, "remind.body") });

/** Read the three settings through any object with `getSetting`. */
export async function loadReminderSettings(repos: { getSetting(key: string): Promise<string | null> }): Promise<ReminderSettings> {
  return parseReminderSettings({ on: await repos.getSetting(REMINDER_KEYS.on), days: await repos.getSetting(REMINDER_KEYS.days), time: await repos.getSetting(REMINDER_KEYS.time) });
}
