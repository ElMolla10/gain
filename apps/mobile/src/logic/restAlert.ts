import { clampSeconds, DEFAULT_REST_SECONDS, type RestTimer } from "./restTimer";

/** Settings for the rest timer, stored as plain strings in the `setting` table. */
export interface RestSettings {
  seconds: number;
  vibrate: boolean;
  /** A local notification at zero, so the alert arrives with the screen off. Off until the lifter allows notifications. */
  notify: boolean;
}

export const REST_CHOICES = [60, 90, 120, 180, 240] as const;
export const REST_KEYS = { seconds: "rest_seconds", vibrate: "rest_vibrate", notify: "rest_notify" } as const;

export const defaultRestSettings = (): RestSettings => ({ seconds: DEFAULT_REST_SECONDS, vibrate: true, notify: false });

export function parseRestSettings(raw: { seconds: string | null; vibrate: string | null; notify: string | null }): RestSettings {
  const n = raw.seconds === null ? NaN : Number(raw.seconds);
  return {
    seconds: Number.isFinite(n) ? clampSeconds(n) : DEFAULT_REST_SECONDS,
    vibrate: raw.vibrate !== "0",
    notify: raw.notify === "1",
  };
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

/** Read the three rest settings through any object with `getSetting`. */
export async function loadRestSettings(repos: { getSetting(key: string): Promise<string | null> }): Promise<RestSettings> {
  return parseRestSettings({
    seconds: await repos.getSetting(REST_KEYS.seconds),
    vibrate: await repos.getSetting(REST_KEYS.vibrate),
    notify: await repos.getSetting(REST_KEYS.notify),
  });
}
