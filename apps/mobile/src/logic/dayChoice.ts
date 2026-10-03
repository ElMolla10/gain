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
