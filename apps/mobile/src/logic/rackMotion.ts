/**
 * Logger motion and haptics (logger spec §7), pure. Tier A only: RN Animated with the native driver, no Reanimated. The components
 * read these plans; nothing here touches React.
 */
import type { DockModel } from "./dockModel";

export const RACK_MOTION = {
  /** When logRow resolves, the dock dips 4 dp and settles. */
  dip: 160,
  dipDp: 4,
  /** The caption counter / number crossfade. */
  counter: 120,
  /** The change line fades in after the rack. */
  changeDelay: 160,
  /** Folding a finished exercise to 56 dp. */
  fold: 200,
  foldTo: 56,
  /** The expanded dock opens. */
  expand: 220,
  /** Unrack landing: Today's hero (380 dp) lands in the 96 dp mini slot (scale 1 → 0.25, so the mini grows from 4×), number 48 → 28. */
  unrack: 320,
  unrackMiniFrom: 4,
  unrackNumberFrom: 48 / 28,
  /** Reduce Motion: every move becomes a crossfade of at most this. */
  crossfade: 200,
} as const;

export interface DockStep {
  /** A set was logged (same exercise, a later row, or the exercise finished): dip + counter crossfade. */
  rack: boolean;
  /** Plates went on: a Light haptic once (on the last plate). Strip is silent. */
  platesAdded: boolean;
  /** The focus moved to another exercise (fold → next object): the object crossfades with a Selection haptic. */
  nextObject: boolean;
}

/** What changed between two dock models. Typing never reaches here (the dock is hidden and its model frozen while the pad is up). */
export function dockStep(prev: DockModel | null, next: DockModel): DockStep {
  if (!prev || prev.mode === "hidden" || next.mode === "hidden") return { rack: false, platesAdded: false, nextObject: false };
  const moved = prev.rowKey !== next.rowKey || prev.exId !== next.exId;
  const nextObject = moved && prev.exId !== null && next.exId !== null && prev.exId !== next.exId;
  const platesAdded = moved && !nextObject && !!next.change && next.change.add.length > 0 && (next.change.kind === "add" || next.change.kind === "swap" || next.change.kind === "horn");
  return { rack: moved, platesAdded, nextObject };
}

/** The haptics a step fires, in order (spec §7 table): Light only when plates were added, Selection on a new object, nothing for strip. */
export function stepHaptics(s: DockStep): ("light" | "selection")[] {
  const out: ("light" | "selection")[] = [];
  if (s.platesAdded) out.push("light");
  if (s.nextObject) out.push("selection");
  return out;
}

/** The rest drain as a fraction of the bar still showing (1 → 0 over the rest). */
export const drainFraction = (endsAt: number, durationMs: number, now: number): number =>
  durationMs > 0 ? Math.max(0, Math.min(1, (endsAt - now) / durationMs)) : 0;
