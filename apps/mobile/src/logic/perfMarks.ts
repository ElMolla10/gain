/**
 * Developer-Mode-only on-device timings (boot, workoutOpen, tickSaved, loggerCommit). In memory, the last 50 samples per name,
 * persisted to a small local file through an injected store. Nothing is ever uploaded. With Developer Mode off every call returns at once.
 */
export const PERF_RING = 50;
export type PerfSummary = { name: string; n: number; median: number; p90: number };
export interface PerfStore { read(): string | null; write(text: string): void; remove(): void }

/** Nearest-rank percentile of sorted values. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))]!;
}

export function summarize(samples: Record<string, readonly number[]>): PerfSummary[] {
  return Object.keys(samples).sort().filter((name) => samples[name]!.length > 0).map((name) => {
    const s = [...samples[name]!].sort((a, b) => a - b);
    return { name, n: s.length, median: percentile(s, 50), p90: percentile(s, 90) };
  });
}

export function createPerfMarks(saveDelayMs = 2000) {
  let samples: Record<string, number[]> = {};
  /** null = Developer Mode not loaded yet: samples wait (the boot mark happens before it loads) and are kept only if it turns out on. */
  let enabled: boolean | null = null;
  let pending: [string, number][] = [];
  let store: PerfStore | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const push = (name: string, ms: number) => {
    const list = (samples[name] ??= []);
    list.push(Math.round(ms * 10) / 10);
    if (list.length > PERF_RING) list.splice(0, list.length - PERF_RING);
    if (store && !timer) timer = setTimeout(() => { timer = null; try { store?.write(JSON.stringify(samples)); } catch { /* best effort */ } }, saveDelayMs);
  };
  return {
    isOn: () => enabled === true,
    mark(name: string, ms: number) {
      if (enabled === false || !Number.isFinite(ms) || ms < 0) return;
      if (enabled === null) pending.push([name, ms]);
      else push(name, ms);
    },
    setEnabled(on: boolean) {
      enabled = on;
      if (on) pending.forEach(([n, ms]) => push(n, ms));
      pending = [];
    },
    attachStore(s: PerfStore) {
      store = s;
      try {
        const raw = s.read();
        const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        for (const [name, list] of Object.entries(parsed)) {
          if (Array.isArray(list)) samples[name] = [...list.filter((v): v is number => typeof v === "number"), ...(samples[name] ?? [])].slice(-PERF_RING);
        }
      } catch { /* a corrupt file starts empty */ }
    },
    summary: (): PerfSummary[] => summarize(samples),
    clear() {
      samples = {};
      try { store?.remove(); } catch { /* best effort */ }
    },
  };
}
