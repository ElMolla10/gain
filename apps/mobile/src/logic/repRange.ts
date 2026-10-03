/**
 * P05: the rep range that is actually used. The rule replaces the TOP of the programme's range with the rep ceiling (the lift's own
 * ceiling, else the app-wide default for its kind of lift), because the ceiling is what earns more load. That is a deliberate GAIN
 * convention, but it must never be silent: wherever a range is shown, this says which numbers are in force and where they come from.
 */
export type CeilingSource = "lift" | "default";

export interface EffectiveRange {
  min: number;
  max: number;
  programmeMin: number;
  programmeMax: number;
  source: CeilingSource;
  /** True when the programme's own top differs from the ceiling in force. */
  overridesProgramme: boolean;
}

export function effectiveRange(i: { programmeMin: number; programmeMax: number; ceiling: number; source: CeilingSource }): EffectiveRange {
  return {
    min: Math.min(i.programmeMin, i.ceiling),
    max: i.ceiling,
    programmeMin: i.programmeMin,
    programmeMax: i.programmeMax,
    source: i.source,
    overridesProgramme: i.programmeMax !== i.ceiling,
  };
}

type T = (k: "range.line" | "range.override.lift" | "range.override.default", p: Record<string, string | number>) => string;

/** One line for Programme and Why. When the ceiling replaces the programme's top, it says so and says whose number it is. */
export function rangeText(r: EffectiveRange, t: T): string {
  const base = t("range.line", { min: r.min, max: r.max });
  if (!r.overridesProgramme) return base;
  return `${base} ${t(r.source === "lift" ? "range.override.lift" : "range.override.default", { pmin: r.programmeMin, pmax: r.programmeMax, max: r.max })}`;
}
