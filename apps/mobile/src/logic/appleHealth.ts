/** Settings key for "Save workouts to Apple Health": "1" = on. Unset = off (opt-in). */
export const APPLE_HEALTH_KEY = "apple_health_save";
export const appleHealthSetting = (raw: string | null | undefined): boolean => raw === "1";

export interface HealthExportSession {
  id: string;
  startedAt: number | null;
  finishedAt: number;
  pausedMs: number;
  imported: boolean;
  healthUuid: string | null;
  dayName: string;
  sets: number;
}

export interface HealthWindow {
  start: number;
  end: number;
  /** Active time: end - start minus pauses (never below 0). */
  activeMs: number;
  /** True when the start was not recorded and was estimated from the set count. */
  estimated: boolean;
}

const MIN_MS = 60_000;
const PER_SET_MS = 3 * 60_000;

/** The Health workout's time window. A missing start is estimated as finished - max(60 s, sets × 3 min). */
export function healthWindow(s: Pick<HealthExportSession, "startedAt" | "finishedAt" | "pausedMs" | "sets">): HealthWindow {
  const end = s.finishedAt;
  if (s.startedAt === null || !(s.startedAt < end)) {
    const start = end - Math.max(MIN_MS, Math.max(0, s.sets) * PER_SET_MS);
    return { start, end, activeMs: end - start, estimated: true };
  }
  return { start: s.startedAt, end, activeMs: Math.max(0, end - s.startedAt - Math.max(0, s.pausedMs)), estimated: false };
}

/** Write only lifter-logged, finished, not-yet-written sessions (imports never; a re-finish or edit never rewrites). */
export const shouldWriteToHealth = (on: boolean, s: HealthExportSession | null): s is HealthExportSession =>
  on && s !== null && !s.imported && s.healthUuid === null;

export interface AppleHealthWriter {
  isAvailable(): boolean;
  saveWorkout(w: { start: number; end: number; metadata: Record<string, string | number | boolean> }): Promise<string>;
}

/**
 * After Finish: write one strength-training workout and store its UUID. Never throws and is never awaited by the UI;
 * failures go to onError only. No energy / calories: GAIN makes no calorie claims.
 */
export async function exportFinishedSession(
  sessionId: string,
  deps: {
    setting: () => Promise<string | null>;
    load: (id: string) => Promise<HealthExportSession | null>;
    store: (id: string, uuid: string) => Promise<boolean>;
    health: AppleHealthWriter;
    onError: (e: unknown) => void;
  },
): Promise<string | null> {
  try {
    if (!deps.health.isAvailable()) return null;
    const on = appleHealthSetting(await deps.setting());
    const s = await deps.load(sessionId);
    if (!shouldWriteToHealth(on, s)) return null;
    const w = healthWindow(s);
    const metadata: Record<string, string | number | boolean> = {
      HKMetadataKeyExternalUUID: s.id,
      GAINDayName: s.dayName,
      GAINWorkingSets: s.sets,
      GAINActiveSeconds: Math.round(w.activeMs / 1000),
    };
    if (w.estimated) metadata.GAINTimesEstimated = true;
    const uuid = await deps.health.saveWorkout({ start: w.start, end: w.end, metadata });
    await deps.store(s.id, uuid);
    return uuid;
  } catch (e) {
    try { deps.onError(e); } catch { /* reporting must not throw */ }
    return null;
  }
}
