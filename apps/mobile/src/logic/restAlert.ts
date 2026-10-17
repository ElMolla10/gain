import { clampSeconds, DEFAULT_REST_SECONDS, type RestTimer } from "./restTimer";

/** Settings for the rest timer, stored as plain strings in the `setting` table. */
export interface RestSettings {
  seconds: number;
  vibrate: boolean;
  /** A local notification at zero, so the alert arrives with the screen off. Off until the lifter allows notifications. */
  notify: boolean;
  /** Start a rest countdown when a working set is ticked. Off until the lifter turns it on (in the logger or Settings). */
  auto: boolean;
}

export const REST_CHOICES = [60, 90, 120, 180, 240] as const;
export const REST_KEYS = { seconds: "rest_seconds", vibrate: "rest_vibrate", notify: "rest_notify", auto: "rest_auto" } as const;
/** Set once the logger has offered the lock-screen alert (asked for the notification permission), so it never asks again. */
export const REST_NOTIFY_ASKED_KEY = "rest_notify_asked";

/**
 * Whether turning on the logger's rest switch should also offer the lock-screen alert (one permission prompt per install):
 * only when the switch turns rest ON, the alert is still off, and the logger has not asked before.
 */
export const shouldOfferRestNotify = (turningOn: boolean, notify: boolean, asked: boolean): boolean => turningOn && !notify && !asked;

export const defaultRestSettings = (): RestSettings => ({ seconds: DEFAULT_REST_SECONDS, vibrate: true, notify: false, auto: false });

export function parseRestSettings(raw: { seconds: string | null; vibrate: string | null; notify: string | null; auto?: string | null }): RestSettings {
  const n = raw.seconds === null ? NaN : Number(raw.seconds);
  return {
    seconds: Number.isFinite(n) ? clampSeconds(n) : DEFAULT_REST_SECONDS,
    vibrate: raw.vibrate !== "0",
    notify: raw.notify === "1",
    auto: raw.auto === "1",
  };
}

/** Whether a ticked working set of this exercise starts no rest: the timer is off unless it is on in general and not switched off here. */
export const restOffFor = (auto: boolean, state?: { restOff: boolean }): boolean => !auto || (state?.restOff ?? false);

/**
 * The logger's per-exercise rest switch. Turning it on also turns the rest timer on in general (the saved preference),
 * so the next workout starts with it on; turning it off only affects this exercise in this workout.
 */
export function toggleRestChoice(auto: boolean, restOff: boolean): { auto: boolean; restOff: boolean } {
  return restOffFor(auto, { restOff }) ? { auto: true, restOff: false } : { auto, restOff: true };
}

export type PermissionResult = "granted" | "denied" | "unavailable";

/** What the screen needs from the platform. The Expo implementation lives in notifications/restAlerts.ts (device only). */
export interface RestAlerts {
  /** Asks for the notification permission if needed (Android 13+ shows a prompt). */
  ensurePermission(): Promise<PermissionResult>;
  /** Replaces any earlier scheduled rest alert. */
  schedule(endsAtMs: number, text: { title: string; body: string }): Promise<void>;
  cancel(): Promise<void>;
}

/**
 * Keep the scheduled alert in step with the timer: scheduled while a rest is running and notifications are on,
 * cancelled otherwise (stopped, finished, switched off). Never throws: an alert that cannot be scheduled must not break logging.
 */
export async function syncRestAlert(a: RestAlerts, timer: RestTimer, s: RestSettings, text: { title: string; body: string }, now: number): Promise<"scheduled" | "cancelled" | "failed"> {
  try {
    if (s.notify && timer.endsAt !== null && timer.endsAt > now) {
      await a.schedule(timer.endsAt, text);
      return "scheduled";
    }
    await a.cancel();
    return "cancelled";
  } catch {
    return "failed";
  }
}

/** Read the rest settings through any object with `getSetting`. */
export async function loadRestSettings(repos: { getSetting(key: string): Promise<string | null> }): Promise<RestSettings> {
  return parseRestSettings({
    seconds: await repos.getSetting(REST_KEYS.seconds),
    vibrate: await repos.getSetting(REST_KEYS.vibrate),
    notify: await repos.getSetting(REST_KEYS.notify),
    auto: await repos.getSetting(REST_KEYS.auto),
  });
}
