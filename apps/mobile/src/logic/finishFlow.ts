type Level = "warn" | "error";

/** Finish-screen orchestration (13). Only the summary is fatal: planning, the forecast and the extras
 * (milestones, recap detail, achievements) each fail on their own, and the forecast always resolves
 * (to "none" when it fails) so the screen never waits on it. Order is kept: plan -> sync -> preview -> achievements. */
export async function runFinishFlow<S, F>(s: {
  summarize: () => Promise<S>;
  onSummary: (summary: S) => void;
  extras: (summary: S) => Promise<void>;
  plan: () => Promise<unknown>;
  sync: () => void;
  preview: () => Promise<F | null>;
  achievements: () => Promise<void>;
  onForecast: (forecast: F | "none") => void;
  record: (level: Level, label: string, e: unknown) => void;
}): Promise<"ok" | "failed"> {
  let summary: S;
  try {
    summary = await s.summarize();
  } catch (e) {
    s.record("error", "finish summary", e);
    return "failed";
  }
  s.onSummary(summary);
  let forecast: F | "none" = "none";
  try {
    await s.extras(summary);
    try { await s.plan(); }
    catch (e) { s.record("warn", "finish plan next", e); }
    s.sync();
    try { forecast = (await s.preview()) ?? "none"; }
    catch (e) { s.record("warn", "finish forecast", e); }
    await s.achievements();
  } catch (e) {
    s.record("warn", "finish extras", e);
  } finally {
    s.onForecast(forecast);
  }
  return "ok";
}
