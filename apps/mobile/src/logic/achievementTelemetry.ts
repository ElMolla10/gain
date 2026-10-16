/**
 * On-device achievement telemetry and the pilot checklist (Phase 4). No network: counts live in a small JSON blob on this phone,
 * stay off until the lifter opts in, and never reach the next-set path.
 */

export const TELEMETRY_FORMAT = 1;
export const TELEMETRY_WINDOW_MS = 28 * 24 * 60 * 60 * 1000;
const RECENT_CAP = 200;

export const TELEMETRY_EVENTS = [
  "progress_opened",
  "badge_detail",
  "view_workout",
  "share_card",
  "quest_picked",
  "quest_swapped",
  "hero_shown",
] as const;

export type TelemetryEvent = (typeof TELEMETRY_EVENTS)[number];

export interface EventStat {
  count: number;
  lastAt: number | null;
  recentAt: number[];
}

export interface ChecklistAnswers {
  explainBadge: string;
  nextUp: string;
  feltPenalized: boolean | null;
  unexpectedRevoke: boolean | null;
  unexpectedNote: string;
}

export interface TelemetryState {
  v: number;
  optedIn: boolean;
  asked: boolean;
  events: Record<TelemetryEvent, EventStat>;
  checklist: ChecklistAnswers & { savedAt: number | null };
  penalizedYes: number;
  revokeYes: number;
  comprehension: number;
}

export interface GateCounters {
  comprehension: number;
  restDaySafety: number;
  engineIntegrity: number;
  engagement: { progressOpened28d: number; shareCards28d: number };
}

export interface ChecklistExport {
  kind: "gain.pilot-checklist";
  appVersion: string;
  achievementRuleVersion: number;
  sessionCount: number;
  exportedAt: string;
  answers: ChecklistAnswers;
}

export interface TelemetryStore {
  read(): string | null;
  write(text: string): void;
  remove(): void;
}

const emptyStat = (): EventStat => ({ count: 0, lastAt: null, recentAt: [] });

const emptyChecklist = (): ChecklistAnswers & { savedAt: number | null } => ({
  explainBadge: "",
  nextUp: "",
  feltPenalized: null,
  unexpectedRevoke: null,
  unexpectedNote: "",
  savedAt: null,
});

export function emptyTelemetry(): TelemetryState {
  return {
    v: TELEMETRY_FORMAT,
    optedIn: false,
    asked: false,
    events: Object.fromEntries(TELEMETRY_EVENTS.map((k) => [k, emptyStat()])) as Record<TelemetryEvent, EventStat>,
    checklist: emptyChecklist(),
    penalizedYes: 0,
    revokeYes: 0,
    comprehension: 0,
  };
}

function prune(recent: readonly number[], now: number): number[] {
  return recent.filter((t) => Number.isFinite(t) && now - t <= TELEMETRY_WINDOW_MS && t <= now + 60_000).slice(-RECENT_CAP);
}

function asStat(raw: unknown, now: number): EventStat {
  const s = raw as Partial<EventStat> | null;
  const count = typeof s?.count === "number" && s.count >= 0 ? Math.floor(s.count) : 0;
  const lastAt = typeof s?.lastAt === "number" && Number.isFinite(s.lastAt) ? s.lastAt : null;
  const recentAt = Array.isArray(s?.recentAt) ? prune(s.recentAt.filter((x): x is number => typeof x === "number"), now) : [];
  return { count, lastAt, recentAt };
}

/** A damaged blob is treated as empty (opt-in still off) so telemetry can never be why the app fails. */
export function parseTelemetry(text: string | null, now = 0): TelemetryState {
  const blank = emptyTelemetry();
  if (!text) return blank;
  try {
    const raw = JSON.parse(text) as Partial<TelemetryState> | null;
    if (!raw || typeof raw !== "object" || raw.v !== TELEMETRY_FORMAT) return blank;
    const events = { ...blank.events };
    for (const k of TELEMETRY_EVENTS) events[k] = asStat(raw.events?.[k], now);
    const c = raw.checklist ?? emptyChecklist();
    return {
      v: TELEMETRY_FORMAT,
      optedIn: raw.optedIn === true,
      asked: raw.asked === true,
      events,
      checklist: {
        explainBadge: typeof c.explainBadge === "string" ? c.explainBadge : "",
        nextUp: typeof c.nextUp === "string" ? c.nextUp : "",
        feltPenalized: c.feltPenalized === true ? true : c.feltPenalized === false ? false : null,
        unexpectedRevoke: c.unexpectedRevoke === true ? true : c.unexpectedRevoke === false ? false : null,
        unexpectedNote: typeof c.unexpectedNote === "string" ? c.unexpectedNote : "",
        savedAt: typeof c.savedAt === "number" ? c.savedAt : null,
      },
      penalizedYes: typeof raw.penalizedYes === "number" && raw.penalizedYes >= 0 ? Math.floor(raw.penalizedYes) : 0,
      revokeYes: typeof raw.revokeYes === "number" && raw.revokeYes >= 0 ? Math.floor(raw.revokeYes) : 0,
      comprehension: typeof raw.comprehension === "number" && raw.comprehension >= 0 ? Math.floor(raw.comprehension) : 0,
    };
  } catch {
    return blank;
  }
}

export function recordEvent(state: TelemetryState, event: TelemetryEvent, at: number): TelemetryState {
  if (!state.optedIn) return state;
  const cur = state.events[event];
  const recentAt = prune([...cur.recentAt, at], at);
  const next: TelemetryState = {
    ...state,
    events: { ...state.events, [event]: { count: cur.count + 1, lastAt: at, recentAt } },
  };
  if (event === "view_workout") next.comprehension = state.comprehension + 1;
  return next;
}

export function setConsent(state: TelemetryState, optedIn: boolean): TelemetryState {
  return { ...state, optedIn, asked: true };
}

export function saveChecklist(state: TelemetryState, answers: ChecklistAnswers, at: number): TelemetryState {
  return {
    ...state,
    checklist: { ...answers, savedAt: at },
    penalizedYes: state.penalizedYes + (answers.feltPenalized === true && state.checklist.feltPenalized !== true ? 1 : 0),
    revokeYes: state.revokeYes + (answers.unexpectedRevoke === true && state.checklist.unexpectedRevoke !== true ? 1 : 0),
  };
}

/** Zeros counts and answers; keeps the opt-in choice. */
export function clearTelemetry(state: TelemetryState): TelemetryState {
  return { ...emptyTelemetry(), optedIn: state.optedIn, asked: state.asked };
}

export function gateCounters(state: TelemetryState, now: number): GateCounters {
  return {
    comprehension: state.comprehension,
    restDaySafety: state.penalizedYes,
    engineIntegrity: state.revokeYes,
    engagement: {
      progressOpened28d: prune(state.events.progress_opened.recentAt, now).length,
      shareCards28d: prune(state.events.share_card.recentAt, now).length,
    },
  };
}

export function buildChecklistExport(
  state: TelemetryState,
  meta: { appVersion: string; achievementRuleVersion: number; sessionCount: number; now: number },
): ChecklistExport {
  const { explainBadge, nextUp, feltPenalized, unexpectedRevoke, unexpectedNote } = state.checklist;
  return {
    kind: "gain.pilot-checklist",
    appVersion: meta.appVersion,
    achievementRuleVersion: meta.achievementRuleVersion,
    sessionCount: meta.sessionCount,
    exportedAt: new Date(meta.now).toISOString(),
    answers: { explainBadge, nextUp, feltPenalized, unexpectedRevoke, unexpectedNote },
  };
}

export function formatChecklistExport(exp: ChecklistExport): string {
  return JSON.stringify(exp, null, 2);
}

export function memoryStore(initial: string | null = null): TelemetryStore {
  let text = initial;
  return {
    read: () => text,
    write: (s) => {
      text = s;
    },
    remove: () => {
      text = null;
    },
  };
}

export interface AchievementTelemetry {
  isOptedIn(): boolean;
  hasAsked(): boolean;
  setOptedIn(on: boolean): void;
  record(event: TelemetryEvent): void;
  snapshot(): TelemetryState;
  gates(): GateCounters;
  saveChecklist(answers: ChecklistAnswers): void;
  clear(): void;
  wipe(): void;
  exportChecklist(meta: { appVersion: string; achievementRuleVersion: number; sessionCount: number }): ChecklistExport;
}

/** Never throws: a full disk or a missing folder must not become another crash. */
export function createTelemetry(store: TelemetryStore, now: () => number = Date.now): AchievementTelemetry {
  const load = (): TelemetryState => {
    try {
      return parseTelemetry(store.read(), now());
    } catch {
      return emptyTelemetry();
    }
  };
  const save = (s: TelemetryState) => {
    try {
      store.write(JSON.stringify(s));
    } catch {
      /* ignore */
    }
  };
  return {
    isOptedIn: () => load().optedIn,
    hasAsked: () => load().asked,
    setOptedIn(on) {
      try {
        save(setConsent(load(), on));
      } catch {
        /* ignore */
      }
    },
    record(event) {
      try {
        save(recordEvent(load(), event, now()));
      } catch {
        /* ignore */
      }
    },
    snapshot: () => load(),
    gates: () => gateCounters(load(), now()),
    saveChecklist(answers) {
      try {
        save(saveChecklist(load(), answers, now()));
      } catch {
        /* ignore */
      }
    },
    clear() {
      try {
        save(clearTelemetry(load()));
      } catch {
        /* ignore */
      }
    },
    wipe() {
      try {
        store.remove();
      } catch {
        try {
          save(emptyTelemetry());
        } catch {
          /* ignore */
        }
      }
    },
    exportChecklist(meta) {
      return buildChecklistExport(load(), { ...meta, now: now() });
    },
  };
}
