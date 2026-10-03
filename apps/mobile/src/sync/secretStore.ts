/** Where the sync device token and recovery code are kept. On a phone this is the OS secure storage (see secureStore.ts), never SQLite. */
export interface SecretStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/** In-memory store for tests. */
export function memorySecretStore(initial: Record<string, string> = {}): SecretStore & { dump(): Record<string, string> } {
  const m = new Map(Object.entries(initial));
  return {
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => void m.set(k, v),
    delete: async (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}
