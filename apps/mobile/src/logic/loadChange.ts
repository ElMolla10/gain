/**
 * "Load the change" (logger spec §3), pure: what to physically do between the last saved load and the next one. All plate math goes
 * through the engine (barbellPlates / calculatePlates / platesOf / nextLoadAbove). Barbell and horn use the FEWEST MOVES (Mohamed,
 * 2026-10-18): from 100 [25, 15] to 120 the answer is "+10 each side", not "swap 15 for 25". The canonical re-load (longest common inner
 * prefix) is the fallback and wins ties, so the bar never shows plates that don't sum.
 */
import { barbellPlates, calculatePlates, nextLoadAbove, platesOf, type EquipmentType, type GymLoadSpec, type SetupType } from "@gain/engine";
import { formatLoad, isolateLtr, NBSP, type Lang } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { pinIndex } from "./todayHero";
import { unitLabel, weightText, type Unit } from "./units";

export type LoadChangeKind = "same" | "add" | "strip" | "swap" | "bar" | "grab" | "pin" | "nearest" | "horn" | "assist" | "none";

export interface LoadChange {
  kind: LoadChangeKind;
  /** Plates to add (per side / per horn), heaviest first. */
  add: number[];
  /** Plates to strip (per side / per horn), heaviest first. */
  strip: number[];
  /** The load you end on (the nearest loadable load when `nearest`). */
  to: number;
  from: number | null;
  /** Stack: whether the pin positions are known (a grid), so "Pin to" may be said. */
  known?: boolean;
}

const EPS = 1e-6;
const sum = (xs: readonly number[]) => xs.reduce((n, x) => n + x, 0);
const desc = (xs: number[]) => [...xs].sort((a, b) => b - a);

/** Fewest moves from per-side list `a` to per-side list `b` (the canonical target), with the plates on hand. */
export function plateMoves(a: readonly number[], b: readonly number[], plates: readonly number[]): { add: number[]; strip: number[] } {
  // Canonical: keep the longest common inner prefix (a bar loads from the collar out).
  let i = 0;
  while (i < a.length && i < b.length && Math.abs(a[i]! - b[i]!) < EPS) i++;
  let best = { add: b.slice(i), strip: a.slice(i) };
  const d = sum(b) - sum(a);
  if (d > EPS) {
    // Keep everything on and add the difference (the fewest plates that make it exactly).
    const c = calculatePlates(2 * d, 0, [...plates]);
    if (c && c.exact && c.perSide.length > 0 && c.perSide.length < best.add.length + best.strip.length) best = { add: c.perSide, strip: [] };
  } else if (d < -EPS) {
    // Strip from the outside in: the shortest outer run of `a` that sums to the difference.
    let s = 0;
    for (let k = a.length - 1; k >= 0; k--) {
      s += a[k]!;
      if (Math.abs(s + d) < EPS) {
        const strip = a.slice(k);
        if (strip.length < best.add.length + best.strip.length) best = { add: [], strip };
        break;
      }
      if (s > -d + EPS) break;
    }
  }
  return { add: desc(best.add), strip: desc(best.strip) };
}

export function loadChange(spec: GymLoadSpec | null, fromKg: number | null, toKg: number, equipment: EquipmentType, setup: SetupType = "free"): LoadChange {
  const base = { add: [] as number[], strip: [] as number[], to: toKg, from: fromKg };
  if (setup === "assisted" || equipment === "assisted") return fromKg !== null && Math.abs(fromKg - toKg) < EPS ? { ...base, kind: "same" } : { ...base, kind: "assist" };
  if (fromKg !== null && Math.abs(fromKg - toKg) < EPS) return { ...base, kind: "same" };
  if (!spec) return { ...base, kind: "none" };
  if (equipment === "barbell") {
    const b = barbellPlates(spec, toKg);
    if (!b) return { ...base, kind: "none" };
    const a = fromKg !== null ? barbellPlates(spec, fromKg)?.perSide ?? [] : [];
    if (!b.exact) {
      const m = plateMoves(a, b.perSide, platesOf(spec));
      return { ...base, ...m, to: b.load, kind: "nearest" };
    }
    if (b.perSide.length === 0) return { ...base, strip: desc(a), kind: "bar" };
    const m = plateMoves(a, b.perSide, platesOf(spec));
    const kind = m.add.length && m.strip.length ? "swap" : m.add.length ? "add" : m.strip.length ? "strip" : "same";
    return { ...base, ...m, kind };
  }
  if (equipment === "plate") {
    const plates = platesOf(spec);
    const b = calculatePlates(toKg, 0, plates);
    if (!b || !b.exact) return { ...base, kind: "none" };
    const a = fromKg !== null ? calculatePlates(fromKg, 0, plates)?.perSide ?? [] : [];
    return { ...base, ...plateMoves(a, b.perSide, plates), kind: "horn" };
  }
  if (equipment === "dumbbell") return { ...base, kind: "grab" };
  return { ...base, kind: "pin", known: pinIndex(spec, toKg) !== null };
}

/** The dumbbell to grab next above `x` (for "Grab the 30s" when the target is not on the rack yet). */
export const nextDumbbell = (spec: GymLoadSpec, x: number): number | null => nextLoadAbove(spec, x);

type T = (key: StringKey, params?: Record<string, string | number>) => string;
export type ChangeSuffix = "work" | "backoff" | null;

/** "+5 each side" / "حمّل 5 في كل ناحية"; null when there is nothing to say (same load, no spec, first set). */
export function changeText(c: LoadChange, ctx: { lang: Lang; unit: Unit; t: T }, suffix: ChangeSuffix = null): string | null {
  const { lang, unit, t } = ctx;
  const n = (kg: number) => isolateLtr(weightText(kg, unit));
  const list = (xs: number[]) => xs.map(n).join(" + ");
  let s: string | null = null;
  switch (c.kind) {
    case "add":
      s = t("load.change.add", { plates: list(c.add) });
      break;
    case "strip":
      s = t("load.change.strip", { plates: list(c.strip) });
      break;
    case "swap":
      s = t("load.change.swap", { from: list(c.strip), to: list(c.add) });
      break;
    case "bar":
      s = t("load.change.bar");
      break;
    case "nearest":
      s = t("load.change.nearest", { load: formatLoad(c.to, lang, unit) });
      break;
    case "horn":
      s = c.add.length && !c.strip.length ? t("load.change.horn", { plates: list(c.add) }) : c.strip.length && !c.add.length ? t("load.change.strip", { plates: list(c.strip) }) : c.add.length ? t("load.change.swap", { from: list(c.strip), to: list(c.add) }) : null;
      break;
    case "grab":
      s = t("load.change.grab", { load: n(c.to) });
      break;
    case "pin":
      s = c.known ? t("load.change.pin", { load: formatLoad(c.to, lang, unit) }) : t("load.change.stack", { load: formatLoad(c.to, lang, unit) });
      break;
    case "assist":
      s = c.from === null ? null : t("load.change.assist", { from: n(c.from), to: `${n(c.to)}${NBSP}${unitLabel(unit, lang)}`, arrow: lang === "ar" ? "←" : "→" });
      break;
    default:
      s = null;
  }
  if (!s) return null;
  return suffix === "work" ? t("load.change.work", { change: s }) : suffix === "backoff" ? t("load.change.backoff", { change: s }) : s;
}
