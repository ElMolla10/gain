import type { Template, TemplateGear, TemplateGoal, TemplateLevel, TemplateVenue } from "./templateTypes";

/** Picker filters. `null` = no filter on that facet. */
export interface TemplateFilter {
  days: number | null;
  /** Home vs gym: Home = programs that need only bodyweight, dumbbells or bands; Gym = all programs that can be done in a gym, which includes the home ones. */
  venue: TemplateVenue | null;
  /** "I have": a full gym covers everything; dumbbells / bands cover their own programs plus the bodyweight ones; nothing covers the bodyweight ones only. */
  gear: TemplateGear | null;
  goal: TemplateGoal | null;
  level: TemplateLevel | null;
}
export const NO_FILTER: TemplateFilter = { days: null, venue: null, gear: null, goal: null, level: null };

/** True when a lifter who has `have` can do a program that needs `needs`. Dumbbells and bands do not stand in for each other. */
export const gearFits = (needs: TemplateGear, have: TemplateGear): boolean => have === "gym" || needs === have || needs === "bodyweight";

/** Where a template can be done. Everything can be done at a gym; only bodyweight / dumbbell / band programs can be done at home. */
export const venuesOf = (t: Template): TemplateVenue[] => (t.gear === "gym" ? ["gym"] : ["home", "gym"]);
export const usableAtHome = (t: Template): boolean => t.gear !== "gym";

export function matchesFilter(t: Template, f: TemplateFilter): boolean {
  return (f.days === null || t.days === f.days) && (f.venue === null || venuesOf(t).includes(f.venue)) && (f.gear === null || gearFits(t.gear, f.gear)) && (f.goal === null || t.goal === f.goal) && (f.level === null || t.level === f.level);
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

export type Facet = "days" | "venue" | "gear" | "goal" | "level";

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
