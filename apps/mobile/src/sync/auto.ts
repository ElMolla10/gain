import type { SyncEngine, SyncOutcome } from "./engine";

/**
 * When sync is ON, sync quietly at start, when the app comes back to the front, and after a workout is finished. Never when it is off
 * (then this does one local database read and no network). Never twice within `minGapMs` unless forced; never throws.
 */
export function createAutoSync(engine: Pick<SyncEngine, "status" | "syncNow">, now: () => number = Date.now, minGapMs = 5 * 60 * 1000) {
  let last = 0;
  return {
    async run(force = false): Promise<SyncOutcome | null> {
      try {
        if ((await engine.status()) !== "on") return null;
        if (!force && now() - last < minGapMs) return null;
        last = now();
        return await engine.syncNow();
      } catch {
        return null; // a sync problem must never reach the screen the lifter is using
      }
    },
  };
}
