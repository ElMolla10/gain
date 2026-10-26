type T = (key: "import.undo.confirmTitle" | "import.undo.confirmBody", p?: Record<string, string | number>) => string;

/** The confirm shown before an import is removed: how many imported workouts and sets go (translate LTR-isolates the numbers). */
export function undoConfirmText(batch: { workouts: number; sets: number }, t: T): { title: string; body: string } {
  return {
    title: t("import.undo.confirmTitle"),
    body: t("import.undo.confirmBody", { workouts: batch.workouts, sets: batch.sets }),
  };
}

/**
 * Run one undo; never rejects. A failure (e.g. the batch is already gone after a double tap) is handed to onError and
 * resolves to null, so the screen shows an inline error instead of an unhandled rejection.
 */
export async function runUndo<R>(run: () => Promise<R>, onError: (e: unknown) => void): Promise<R | null> {
  try {
    return await run();
  } catch (e) {
    try { onError(e); } catch { /* reporting must not throw */ }
    return null;
  }
}
