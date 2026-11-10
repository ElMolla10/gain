/**
 * A failed native SQLite open can be transient (for example while the device is
 * resuming). Retry only that specific failure. Never create another database,
 * change its path, or touch its journal files as a recovery attempt.
 */
export async function retrySqliteOpen<T>(open: () => Promise<T>, wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))): Promise<T> {
  const delays = [200, 800];
  for (const delay of delays) {
    try {
      return await open();
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      const nativeOpenFailure = code === "E_SQLITE_OPEN_DATABASE" || String(error).includes("E_SQLITE_OPEN_DATABASE");
      if (!nativeOpenFailure) throw error;
      await wait(delay);
    }
  }
  // Keep the native error (and its stack) intact for the boot details screen.
  return open();
}
