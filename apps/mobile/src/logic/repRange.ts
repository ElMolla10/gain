/**
 * P05 / rule-v0.4: the rep range that is actually used. The program's own top is what earns more load (rule-v0.4). The top is replaced only by a
 * ceiling the lifter set on that lift, by the GAIN ceiling for its kind of lift when "Use GAIN rep ceilings" is on, or (no top in the program) by that
 * GAIN ceiling. It must never be silent: wherever a range is shown, this says which numbers are in force and where they come from.
 *  - lift: the lift's own ceiling. setting: "Use GAIN rep ceilings" is on. default: the program has no top. program: the program's own top.
 */
export type CeilingSource = "lift" | "default" | "program" | "setting";

export interface EffectiveRange {
  min: number;
  max: number;
  programmeMin: number;
  programmeMax: number;
  source: CeilingSource;
  /** True when the program's own top differs from the ceiling in force. */
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

type T = (k: "range.line" | "range.override.lift" | "range.override.default" | "range.override.setting", p: Record<string, string | number>) => string;

/** One line for Program and Why. When the ceiling replaces the program's top, it says so and says whose number it is. */
export function rangeText(r: EffectiveRange, t: T): string {
  const base = t("range.line", { min: r.min, max: r.max });
  if (!r.overridesProgramme) return base;
  return `${base} ${t(r.source === "lift" ? "range.override.lift" : r.source === "setting" ? "range.override.setting" : "range.override.default", { pmin: r.programmeMin, pmax: r.programmeMax, max: r.max })}`;
}

/** Maps the engine's reason for the top of the range onto the display source. */
export function sourceOfBasis(basis: "lift" | "program" | "gain_setting" | "no_upper_bound"): CeilingSource {
  return basis === "lift" ? "lift" : basis === "program" ? "program" : basis === "gain_setting" ? "setting" : "default";
}
