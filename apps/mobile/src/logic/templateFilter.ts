import type { Template, TemplateGear, TemplateGoal, TemplateLevel } from "./templateTypes";

/** Picker filters. `null` = no filter on that facet. */
export interface TemplateFilter {
  days: number | null;
  /** "I have": a lifter with a full gym can do everything, one with dumbbells can do the dumbbell and bodyweight programmes, one with nothing only the bodyweight ones. */
  gear: TemplateGear | null;
  goal: TemplateGoal | null;
  level: TemplateLevel | null;
}
export const NO_FILTER: TemplateFilter = { days: null, gear: null, goal: null, level: null };

const GEAR_RANK: Record<TemplateGear, number> = { bodyweight: 0, dumbbell: 1, gym: 2 };

/** True when a lifter who has `have` can do a programme that needs `needs`. */
export const gearFits = (needs: TemplateGear, have: TemplateGear): boolean => GEAR_RANK[needs] <= GEAR_RANK[have];

export function matchesFilter(t: Template, f: TemplateFilter): boolean {
  return (f.days === null || t.days === f.days) && (f.gear === null || gearFits(t.gear, f.gear)) && (f.goal === null || t.goal === f.goal) && (f.level === null || t.level === f.level);
}

export const filterTemplates = (list: readonly Template[], f: TemplateFilter): Template[] => list.filter((t) => matchesFilter(t, f));

export interface DayGroup {
  days: number;
  templates: Template[];
}
/** Groups by days per week, fewest days first; order inside a group is the catalogue order. */
export function groupByDays(list: readonly Template[]): DayGroup[] {
  const m = new Map<number, Template[]>();
  for (const t of list) m.set(t.days, [...(m.get(t.days) ?? []), t]);
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([days, templates]) => ({ days, templates }));
}

export type Facet = "days" | "gear" | "goal" | "level";

/**
 * How many templates each option of one facet would show, with the OTHER facets' filters applied. The picker greys out options
 * that would show nothing, so a lifter is never sent to an empty list.
 */
export function facetCounts<V extends string | number>(list: readonly Template[], f: TemplateFilter, facet: Facet, options: readonly V[]): Map<V, number> {
  const out = new Map<V, number>();
  for (const o of options) out.set(o, filterTemplates(list, { ...f, [facet]: o } as TemplateFilter).length);
  return out;
}

/** Options present in the catalogue for a facet, in a stable order (numbers ascending). */
export const daysAvailable = (list: readonly Template[]): number[] => [...new Set(list.map((t) => t.days))].sort((a, b) => a - b);
