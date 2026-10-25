/** Finish "Session Perception" (smooth / target / heavy): tapping the selected answer again clears it. */
export type FeelOption = "smooth" | "target" | "heavy";
export const nextFeel = (current: FeelOption | null, tapped: FeelOption): FeelOption | null => (current === tapped ? null : tapped);

/** Writes the answer in the background. Never throws and never blocks Finish: a failure is only reported (diagnostics warning). */
export async function persistFeel(write: () => Promise<void>, onError: (e: unknown) => void): Promise<boolean> {
  try {
    await write();
    return true;
  } catch (e) {
    try { onError(e); } catch { /* reporting must not throw either */ }
    return false;
  }
}
