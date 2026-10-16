/**
 * Active workout duration. Wall-clock start stays honest; paused periods are stored separately and subtracted.
 * `pausedAt` set = the clock is frozen at that instant.
 */
export function elapsedMs(startedAt: number, pausedMs: number, pausedAt: number | null, now: number): number {
  const end = pausedAt ?? now;
  return Math.max(0, end - startedAt - Math.max(0, pausedMs));
}

export function pauseClock(pausedMs: number, pausedAt: number | null, now: number): { pausedMs: number; pausedAt: number | null } {
  if (pausedAt != null) return { pausedMs, pausedAt };
  return { pausedMs, pausedAt: now };
}

export function resumeClock(pausedMs: number, pausedAt: number | null, now: number): { pausedMs: number; pausedAt: number | null } {
  if (pausedAt == null) return { pausedMs, pausedAt: null };
  return { pausedMs: pausedMs + Math.max(0, now - pausedAt), pausedAt: null };
}

/** Fold an open pause into `pausedMs` (finish, or a resume that will not keep `pausedAt`). */
export function foldPausedMs(pausedMs: number, pausedAt: number | null, now: number): number {
  return resumeClock(pausedMs, pausedAt, now).pausedMs;
}
