/** Today: the lifter picks which of the programme's days to do. The rotation only SUGGESTS one; nothing is forced. */
export interface DayLite {
  id: string;
  name: string;
  sets: number;
  exercises: number;
}

export interface DayChoice extends DayLite {
  suggested: boolean;
}

/** Days in programme order with the suggested one marked. A suggestion that is not in the list marks nothing. */
export const markSuggested = (days: DayLite[], suggestedId: string | null): DayChoice[] => days.map((d) => ({ ...d, suggested: d.id === suggestedId }));

/**
 * Which day starts selected: the open workout's day (it must be resumed, not abandoned), else the lifter's earlier pick if that day still
 * exists, else the suggestion, else the first day.
 */
export function initialSelection(days: DayLite[], suggestedId: string | null, openDayId: string | null, current: string | null): string | null {
  const has = (id: string | null) => id !== null && days.some((d) => d.id === id);
  if (has(openDayId)) return openDayId;
  if (has(current)) return current;
  if (has(suggestedId)) return suggestedId;
  return days[0]?.id ?? null;
}

/** How the chosen day is labelled on Today. Always words, never a symbol alone: "Suggested today", "In progress" or "Your choice". */
export type DayLabel = "inProgress" | "suggested" | "pick";
export function dayLabel(day: { id: string; suggested: boolean }, openDayId: string | null): DayLabel {
  if (openDayId !== null && day.id === openDayId) return "inProgress";
  return day.suggested ? "suggested" : "pick";
}

/**
 * What the one big button does for the chosen day. An open workout is always resumed (never abandoned, never stacked under another
 * day): choosing a different day while one is open still resumes the open one, and says so (`elsewhere`). Otherwise the chosen day starts.
 */
export type SessionAction = { kind: "start"; dayId: string } | { kind: "resume"; dayId: string; elsewhere: boolean };
export function sessionAction(chosenId: string, openDayId: string | null): SessionAction {
  return openDayId === null ? { kind: "start", dayId: chosenId } : { kind: "resume", dayId: openDayId, elsewhere: openDayId !== chosenId };
}
