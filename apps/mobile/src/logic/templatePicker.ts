import type { StringKey } from "../i18n/strings";
import { daysAvailable, facetCounts, filterTemplates, groupByDays, NO_FILTER, type DayGroup, type Facet, type TemplateFilter } from "./templateFilter";
import { TEMPLATE_GEARS, TEMPLATE_GOALS, TEMPLATE_LEVELS, TEMPLATE_VENUES, type Template } from "./templateTypes";

/**
 * The programme picker as data: which filter chips exist, how many programmes each would show, which are greyed out, and the
 * grouped list. Pure, so the screens stay thin and the behaviour is tested without rendering.
 */
export interface FacetOption {
  value: string | number;
  /** i18n key, or null for a number shown as "{n} days". */
  labelKey: StringKey | null;
  count: number;
  selected: boolean;
  /** Would show nothing with the other filters as they are (and is not the current choice): shown greyed out and not tappable. */
  disabled: boolean;
}
export interface FacetView {
  facet: Facet;
  titleKey: StringKey;
  options: FacetOption[];
}
export interface PickerView {
  facets: FacetView[];
  sections: DayGroup[];
  total: number;
  active: number;
}

export const FACET_TITLE: Record<Facet, StringKey> = {
  days: "tpl.filter.days",
  venue: "tpl.filter.venue",
  gear: "tpl.filter.gear",
  goal: "tpl.filter.goal",
  level: "tpl.filter.level",
};

export const activeFilterCount = (f: TemplateFilter): number => [f.days, f.venue, f.gear, f.goal, f.level].filter((v) => v !== null).length;

/** Tapping the chosen option again clears the facet. */
export const toggleFilter = (f: TemplateFilter, facet: Facet, value: string | number): TemplateFilter => ({ ...f, [facet]: f[facet] === value ? null : value });

export function pickerView(list: readonly Template[], filter: TemplateFilter, opts: { showDays?: boolean } = {}): PickerView {
  const showDays = opts.showDays ?? true;
  const present = <V,>(values: readonly V[], of: (t: Template) => V) => values.filter((v) => list.some((t) => of(t) === v));
  const make = <V extends string | number>(facet: Facet, values: readonly V[], labelKey: (v: V) => StringKey | null): FacetView => {
    const counts = facetCounts(list, filter, facet, values);
    return {
      facet,
      titleKey: FACET_TITLE[facet],
      options: values.map((v) => {
        const count = counts.get(v) ?? 0;
        const selected = filter[facet] === v;
        return { value: v, labelKey: labelKey(v), count, selected, disabled: count === 0 && !selected };
      }),
    };
  };
  const facets: FacetView[] = [];
  if (showDays) facets.push(make("days", daysAvailable(list), () => null));
  facets.push(make("venue", TEMPLATE_VENUES.filter((v) => list.some((t) => (v === "gym" ? true : t.gear !== "gym"))), (v) => `tpl.venue.${v}` as StringKey));
  facets.push(make("gear", present(TEMPLATE_GEARS, (t) => t.gear), (v) => `tpl.gear.${v}` as StringKey));
  facets.push(make("goal", present(TEMPLATE_GOALS, (t) => t.goal), (v) => `tpl.goal.${v}` as StringKey));
  facets.push(make("level", present(TEMPLATE_LEVELS, (t) => t.level), (v) => `tpl.level.${v}` as StringKey));
  const shown = filterTemplates(list, filter);
  return { facets, sections: groupByDays(shown), total: shown.length, active: activeFilterCount(filter) };
}

export { NO_FILTER };
