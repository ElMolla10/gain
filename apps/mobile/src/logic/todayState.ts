/**
 * Which Today state is on screen (spec §4), pure. Precedence: an open workout (this day, then another day) > done for today > the rest.
 * The rest are notes layered on the normal screen (welcome back, lighter week, first run, no gym). There is no "missed" state, no streak
 * and no readiness score.
 */
import { logicalTrainingDateFromMs } from "@gain/engine";

export type TodayMode = "open" | "openElsewhere" | "done" | "normal";

export function todayMode(input: { openDayId: string | null; chosenId: string; lastFinishedAt: number | null; now: number }): TodayMode {
  if (input.openDayId) return input.openDayId === input.chosenId ? "open" : "openElsewhere";
  if (input.lastFinishedAt !== null && logicalTrainingDateFromMs(input.lastFinishedAt) === logicalTrainingDateFromMs(input.now)) return "done";
  return "normal";
}

/** A lighter week in force (load or sets): until when. Null otherwise. */
export function lighterUntil(state: { status: string; endsAt?: number } | null, now: number): number | null {
  if (!state || (state.status !== "load" && state.status !== "sets") || typeof state.endsAt !== "number" || state.endsAt <= now) return null;
  return state.endsAt;
}

/** "08:41" / "1:02:09": the resume clock, Western digits. */
export function clockText(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${String(m).padStart(2, "0")}:${ss}`;
}

/** The Ease-in chip shows only in the welcome-back state AND when Start can pass the flag on. */
export const showEaseIn = (welcomeBackDays: number | null, canPassThrough: boolean): boolean => welcomeBackDays !== null && canPassThrough;
