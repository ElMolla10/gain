/**
 * Today's Bar text (spec §3, §7, §8), pure. The number line is the logger's target line: `formatLoad` (number isolated, unit in the
 * language) + NBSP×NBSP + the isolated reps. It is never drawn `ltr` and never wrapped whole in `isolateLtr`. The spoken label names the
 * unit in words and reads the plates heaviest first.
 */
import { formatLoad, isolateLtr, NBSP, type Lang } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { loadTargetText } from "./bidiText";
import { quantityText } from "./quantity";
import type { TodayHero } from "./todayHero";
import { unitLabel, weightText, type Unit } from "./units";

type T = (key: StringKey, params?: Record<string, string | number>) => string;
type Letters = { s: string; m: string };
export type Shown = Exclude<TodayHero, { kind: "firstRun" }>;

export const MUL = `${NBSP}×${NBSP}`;

/** The load the big number shows (the belt shows the added load; the bar the target, even when only a nearer load can be built). */
export function heroLoad(h: Shown): number {
  return h.kind === "belt" ? h.added : h.load;
}

/** The quantity: reps, or seconds / metres for timed work. Null when there is none. */
function quantity(h: Shown): number | null {
  if (h.measure === "reps") return h.reps;
  return h.measure === "time" ? h.durationS : h.distanceM;
}

/** The pieces of the number line, so the screen can style each (48 number, 20 muted unit, 36 "× reps"). Concatenated = `heroNumberText`. */
export interface HeroNumberParts {
  num: string;
  unit: string;
  /** "NBSP×NBSP" + isolated reps, or "" when there is no quantity. */
  times: string;
  /** Timed work: the whole line from `loadTargetText`, drawn as one run. */
  timed: string | null;
}

export function heroNumberParts(h: Shown, lang: Lang, unit: Unit, letters: Letters): HeroNumberParts {
  const load = heroLoad(h);
  const q = quantity(h);
  if (h.measure !== "reps") return { num: "", unit: "", times: "", timed: q === null ? formatLoad(load, lang, unit) : loadTargetText(load, q, h.measure, lang, unit, letters) };
  return { num: isolateLtr(weightText(load, unit)), unit: `${NBSP}${unitLabel(unit, lang)}`, times: q === null ? "" : `${MUL}${isolateLtr(String(q))}`, timed: null };
}

export function heroNumberText(h: Shown, lang: Lang, unit: Unit, letters: Letters): string {
  const p = heroNumberParts(h, lang, unit, letters);
  return p.timed ?? `${p.num}${p.unit}${p.times}`;
}

/** Plates for the engraving, heaviest first in LOGICAL order (RTL reads them from the right): each number isolated, joined by " · ". */
export function engravingPlates(perSide: readonly number[], unit: Unit): string {
  return perSide.map((p) => isolateLtr(weightText(p, unit))).join(" · ");
}

/** The spoken plates: "25, 15 and 1.25" style lists stay digits; the separator is a comma in both languages. */
function spokenPlates(perSide: readonly number[], unit: Unit, lang: Lang): string {
  return perSide.map((p) => weightText(p, unit)).join(lang === "ar" ? "، " : ", ");
}

/** The hero's one accessibility label (spec §8). */
export function heroA11yLabel(h: TodayHero, t: T, lang: Lang, unit: Unit, letters: Letters, name: string): string {
  if (h.kind === "firstRun") return t("today.emptyBar");
  const u = t(unit === "lb" ? "today.unit.lb" : "today.unit.kg");
  const parts: string[] = [h.isGoal ? t("today.a11y.goal", { name }) : `${name}.`];
  const q = quantity(h);
  const qText = q === null ? "" : h.measure === "reps" ? String(q) : quantityText(q, h.measure, letters);
  const w = (kg: number) => weightText(kg, unit);
  switch (h.kind) {
    case "assisted":
      parts.push(t("today.a11y.assist", { load: w(h.load), unit: u }));
      break;
    case "belt":
      parts.push(t("today.a11y.belt", { load: w(h.added), unit: u, q: qText }));
      break;
    case "stack":
      parts.push(t("today.a11y.stack", { load: w(h.load), unit: u, q: qText }));
      break;
    case "dumbbell":
      parts.push(t("today.a11y.pair", { load: w(h.load), unit: u, q: qText }));
      break;
    case "horn":
      parts.push(t("today.a11y.horn", { load: w(h.load), unit: u, q: qText }));
      parts.push(t("today.a11y.perSide", { plates: spokenPlates(h.perSide, unit, lang) }));
      break;
    case "barbell":
      if (h.calc.perSide.length === 0 && h.calc.exact) {
        parts.push(t("today.a11y.empty", { load: w(h.calc.load), unit: u }));
        break;
      }
      if (h.normalLoad !== null) parts.push(t("today.a11y.lighter", { load: w(h.load), unit: u, normal: w(h.normalLoad) }));
      else parts.push(q === null ? t("today.a11y.timed", { q: `${w(h.load)} ${u}` }) : t("today.a11y.target", { load: w(h.load), unit: u, q: qText }));
      if (!h.calc.exact) parts.push(t("today.a11y.nearest", { load: w(h.calc.load), unit: u, target: w(h.load) }));
      if (h.calc.perSide.length > 0) parts.push(t("today.a11y.perSide", { plates: spokenPlates(h.calc.perSide, unit, lang) }));
      break;
    default:
      if (h.measure !== "reps") parts.push(t("today.a11y.timed", { q: h.load > 0 ? `${w(h.load)} ${u}, ${qText}` : qText }));
      else parts.push(q === null ? t("today.a11y.timed", { q: `${w(h.load)} ${u}` }) : t("today.a11y.target", { load: w(h.load), unit: u, q: qText }));
  }
  return parts.join(" ");
}
