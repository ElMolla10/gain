/** Simple in-app rest timer. Stores the END time, so it stays correct when the screen sleeps or the app is backgrounded. */
export const DEFAULT_REST_SECONDS = 90;
export const MIN_REST_SECONDS = 15;
export const MAX_REST_SECONDS = 600;

export interface RestTimer {
  endsAt: number | null;
  durationMs: number;
}

export const newTimer = (seconds = DEFAULT_REST_SECONDS): RestTimer => ({ endsAt: null, durationMs: clampSeconds(seconds) * 1000 });
export const clampSeconds = (s: number): number => Math.max(MIN_REST_SECONDS, Math.min(MAX_REST_SECONDS, Math.round(s)));
export const startTimer = (t: RestTimer, now: number): RestTimer => ({ ...t, endsAt: now + t.durationMs });
export const stopTimer = (t: RestTimer): RestTimer => ({ ...t, endsAt: null });
export const adjustTimer = (t: RestTimer, deltaSeconds: number, now: number): RestTimer => {
  const durationMs = clampSeconds(t.durationMs / 1000 + deltaSeconds) * 1000;
  if (t.endsAt === null) return { ...t, durationMs };
  return { durationMs, endsAt: Math.max(now, t.endsAt + (durationMs - t.durationMs)) };
};
export const remainingMs = (t: RestTimer, now: number): number => (t.endsAt === null ? t.durationMs : Math.max(0, t.endsAt - now));
export const isRunning = (t: RestTimer, now: number): boolean => t.endsAt !== null && t.endsAt > now;
export const isDone = (t: RestTimer, now: number): boolean => t.endsAt !== null && t.endsAt <= now;

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
