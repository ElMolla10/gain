/**
 * Local crash log and the diagnostics report (Step 18). No server, no third-party service, no network: entries are kept in one small file on
 * the phone and only leave it when the lifter taps "Share" and picks where it goes. Entries hold what went wrong in the CODE (error name,
 * short message, a trimmed stack, where it was caught) and never set loads, reps, notes, names or goals. Pure logic; the file is behind `DiagStore`.
 */
export type DiagKind = "crash" | "error" | "warn";

export interface DiagEntry {
  /** First time this exact problem was seen / last time (ms since epoch). */
  at: number;
  last: number;
  count: number;
  kind: DiagKind;
  where: string;
  message: string;
  stack?: string;
}

export const MAX_ENTRIES = 50;
export const MAX_MESSAGE = 300;
export const MAX_STACK_LINES = 12;
export const MAX_STACK_CHARS = 1500;
const FORMAT = 1;

/** Best-effort scrubbing of text that might name the person or the phone: e-mail addresses, file paths and URIs (kept: the last path part). */
export function redact(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/\b(?:file|content):\/\/[^\s)]+/g, (m) => `…/${m.split("/").filter(Boolean).pop() ?? ""}`)
    .replace(/(?<![\w.:])\/(?:[\w.@+-]+\/)+([\w.@+-]+)/g, "…/$1");
}

const oneLine = (s: string, max: number): string => {
  const t = redact(s).replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

const describe = (err: unknown): { message: string; stack?: string } => {
  if (err instanceof Error) {
    const stack = err.stack ? redact(err.stack).split("\n").slice(1, 1 + MAX_STACK_LINES).map((l) => l.trim()).join("\n").slice(0, MAX_STACK_CHARS) : undefined;
    return { message: `${err.name}: ${err.message}`, stack: stack || undefined };
  }
  if (typeof err === "string") return { message: err };
  try {
    return { message: JSON.stringify(err) ?? String(err) };
  } catch {
    return { message: String(err) };
  }
};

export function makeEntry(kind: DiagKind, where: string, err: unknown, at: number): DiagEntry {
  const d = describe(err);
  return { at, last: at, count: 1, kind, where: oneLine(where, 60), message: oneLine(d.message, MAX_MESSAGE), ...(d.stack ? { stack: d.stack } : {}) };
}

/** Add an entry. The same problem again right after itself only counts up; the log keeps the newest MAX_ENTRIES. */
export function appendEntry(entries: readonly DiagEntry[], e: DiagEntry, max = MAX_ENTRIES): DiagEntry[] {
  const lastE = entries[entries.length - 1];
  if (lastE && lastE.kind === e.kind && lastE.where === e.where && lastE.message === e.message) {
    return [...entries.slice(0, -1), { ...lastE, count: lastE.count + 1, last: e.last }];
  }
  return [...entries, e].slice(-max);
}

export interface DiagFile {
  v: number;
  /** The lifter can switch the crash log off. On by default; local only. */
  enabled: boolean;
  entries: DiagEntry[];
}

const isEntry = (x: unknown): x is DiagEntry => {
  const e = x as Partial<DiagEntry> | null;
  return !!e && typeof e === "object" && (e.kind === "crash" || e.kind === "error" || e.kind === "warn") && typeof e.where === "string" && typeof e.message === "string" && typeof e.at === "number" && typeof e.last === "number" && typeof e.count === "number";
};

/** A damaged or foreign file is treated as empty (and replaced on the next write) so the log can never be the reason the app fails. */
export function parseDiagFile(text: string | null): DiagFile {
  if (!text) return { v: FORMAT, enabled: true, entries: [] };
  try {
    const raw = JSON.parse(text) as Partial<DiagFile>;
    const entries = Array.isArray(raw.entries) ? raw.entries.filter(isEntry).slice(-MAX_ENTRIES) : [];
    return { v: FORMAT, enabled: raw.enabled !== false, entries };
  } catch {
    return { v: FORMAT, enabled: true, entries: [] };
  }
}

/** Where the log lives. Synchronous on purpose: a fatal error must be written before the process dies. */
export interface DiagStore {
  read(): string | null;
  write(text: string): void;
  remove(): void;
}

export function memoryStore(initial: string | null = null): DiagStore & { text: () => string | null } {
  let v = initial;
  return { read: () => v, write: (t) => void (v = t), remove: () => void (v = null), text: () => v };
}

export interface ReportContext {
  appVersion: string;
  platform: string;
  osVersion: string | number | null;
  language: string;
  schemaVersion: number | null;
  generatedAt: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/** The text the lifter sees before sharing, and the file that is shared. Contains no workout data by construction. */
export function buildReport(entries: readonly DiagEntry[], ctx: ReportContext): string {
  const head = [
    "GAIN diagnostics (draft format)",
    "Made on this phone. It lists problems in the app's code only: no sets, weights, names, notes or goals. Read it before you send it anywhere.",
    "",
    `Generated: ${stamp(ctx.generatedAt)} (phone local time)`,
    `App version: ${ctx.appVersion}`,
    `Platform: ${ctx.platform} ${ctx.osVersion ?? ""}`.trimEnd(),
    `Language: ${ctx.language}`,
    `Database schema: ${ctx.schemaVersion ?? "unknown"}`,
    `Entries: ${entries.length} (the newest ${MAX_ENTRIES} are kept)`,
    "",
  ];
  if (entries.length === 0) return [...head, "No problems recorded."].join("\n") + "\n";
  const body = entries.flatMap((e) => [
    `[${stamp(e.at)}] ${e.kind.toUpperCase()} at ${e.where}${e.count > 1 ? `  (x${e.count}, last ${stamp(e.last)})` : ""}`,
    `  ${e.message}`,
    ...(e.stack ? e.stack.split("\n").map((l) => `    ${l}`) : []),
    "",
  ]);
  return [...head, ...body].join("\n");
}

export interface Diagnostics {
  record(kind: DiagKind, where: string, err: unknown): void;
  entries(): DiagEntry[];
  isEnabled(): boolean;
  setEnabled(on: boolean): void;
  clear(): void;
  report(ctx: Omit<ReportContext, "generatedAt">): string;
}

/** Never throws: logging must not be able to cause a crash. */
export function createDiagnostics(store: DiagStore, now: () => number = Date.now): Diagnostics {
  const load = (): DiagFile => {
    try {
      return parseDiagFile(store.read());
    } catch {
      return parseDiagFile(null);
    }
  };
  const save = (f: DiagFile) => {
    try {
      store.write(JSON.stringify(f));
    } catch {
      /* a full disk or a missing folder must not turn into another crash */
    }
  };
  return {
    record(kind, where, err) {
      try {
        const f = load();
        if (!f.enabled) return;
        f.entries = appendEntry(f.entries, makeEntry(kind, where, err, now()));
        save(f);
      } catch {
        /* never throw from the logger */
      }
    },
    entries: () => load().entries,
    isEnabled: () => load().enabled,
    setEnabled(on) {
      const f = load();
      f.enabled = on;
      save(f);
    },
    clear() {
      const f = load();
      f.entries = [];
      save(f);
    },
    report: (ctx) => buildReport(load().entries, { ...ctx, generatedAt: now() }),
  };
}

/** The shape of React Native's global error hook (`ErrorUtils`), so it can be tested without React Native. */
export interface ErrorHook {
  getGlobalHandler(): (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler(handler: (error: unknown, isFatal?: boolean) => void): void;
}

/**
 * Record uncaught JavaScript errors (fatal ones as "crash"), then hand over to the handler that was there before so the app behaves as it
 * always did. Installing twice does not stack handlers.
 */
export function installCrashHandler(diag: Diagnostics, hook: ErrorHook | undefined | null): boolean {
  if (!hook) return false;
  const prev = hook.getGlobalHandler();
  if ((prev as { __gainDiag?: boolean }).__gainDiag) return false;
  const wrapped = (error: unknown, isFatal?: boolean) => {
    diag.record(isFatal ? "crash" : "error", "uncaught", error);
    prev(error, isFatal);
  };
  (wrapped as { __gainDiag?: boolean }).__gainDiag = true;
  hook.setGlobalHandler(wrapped);
  return true;
}
