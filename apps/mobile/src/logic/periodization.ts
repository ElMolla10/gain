import { weekStartOf } from "@gain/engine";

export const PERIODIZATION_SETTING = "periodization";

export type PeriodizationWeeks = 4 | 5 | 6;

export interface PeriodizationState {
  enabled: boolean;
  weeks: PeriodizationWeeks;
  /** YYYY-MM-DD week start when the current block began. Null until first enable. */
  startedWeek: string | null;
  /** Week the reminder was already shown (dismissed or continued). */
  lastPromptWeek: string | null;
}

export const DEFAULT_PERIODIZATION: PeriodizationState = {
  enabled: false,
  weeks: 4,
  startedWeek: null,
  lastPromptWeek: null,
};

export function parsePeriodization(raw: string | null | undefined): PeriodizationState {
  if (!raw) return { ...DEFAULT_PERIODIZATION };
  try {
    const v = JSON.parse(raw) as Partial<PeriodizationState>;
    const weeks = v.weeks === 5 || v.weeks === 6 ? v.weeks : 4;
    return {
      enabled: v.enabled === true,
      weeks,
      startedWeek: typeof v.startedWeek === "string" ? v.startedWeek : null,
      lastPromptWeek: typeof v.lastPromptWeek === "string" ? v.lastPromptWeek : null,
    };
  } catch {
    return { ...DEFAULT_PERIODIZATION };
  }
}

export const serializePeriodization = (s: PeriodizationState): string => JSON.stringify(s);

/** Distinct training weeks (with at least one finished session) from `startedWeek` inclusive. */
export function countProgressWeeks(sessionWeekStarts: readonly string[], startedWeek: string | null): number {
  const weeks = [...new Set(sessionWeekStarts.filter((w) => !startedWeek || w >= startedWeek))];
  return weeks.length;
}

export function weekStartsOf(finishedAtMs: readonly number[], weekStartsOn: number, tzOffsetMs: number): string[] {
  return finishedAtMs.map((ms) => weekStartOf(ms + tzOffsetMs, weekStartsOn));
}

/**
 * Reminder when a progression block has enough training weeks. Off by default.
 * Hidden while an existing deload suggestion or lighter week is already in front of the lifter,
 * so the two systems never fight.
 */
export function periodizationDue(
  state: PeriodizationState,
  nowWeek: string,
  progressWeeks: number,
  deloadBusy: boolean,
): boolean {
  if (!state.enabled) return false;
  if (deloadBusy) return false;
  if (state.lastPromptWeek === nowWeek) return false;
  return progressWeeks >= state.weeks;
}
