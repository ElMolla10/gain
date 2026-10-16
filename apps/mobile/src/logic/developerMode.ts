export const DEVELOPER_MODE_KEY = "developer_mode";
interface Storage {
  getSetting: (key: string) => Promise<string | null>;
  setSetting: (key: string, value: string) => Promise<unknown>;
}

/** Local UI preference, not an authorization boundary. A failed read keeps tools hidden. */
export function createDeveloperMode(storage: Storage) {
  let snapshot = { enabled: false, ready: false, saving: false };
  let revision = 0;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<typeof snapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(notify => notify());
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (notify: () => void) => { listeners.add(notify); return () => { listeners.delete(notify); }; },
    async load() {
      const started = revision;
      try {
        const value = await storage.getSetting(DEVELOPER_MODE_KEY);
        if (started === revision) publish({ enabled: value === "1", ready: true });
      } catch (error) {
        if (started === revision) publish({ ready: true });
        throw error;
      }
    },
    async setEnabled(enabled: boolean) {
      if (snapshot.saving) return;
      revision++;
      publish({ saving: true });
      try {
        await storage.setSetting(DEVELOPER_MODE_KEY, enabled ? "1" : "0");
        publish({ enabled, ready: true });
      } finally { publish({ saving: false }); }
    },
  };
}

/** Seven deliberate taps in a five-second window; a long press/accessibility action also unlocks. */
export function developerUnlock() {
  let taps = 0, startedAt = 0;
  return (now: number) => {
    if (!taps || now - startedAt > 5000 || now < startedAt) { taps = 0; startedAt = now; }
    taps++;
    if (taps < 7) return false;
    taps = 0;
    return true;
  };
}
