/**
 * What the expanded dock draws (spec §2.1), pure: the focused set's plates and, before the first working set of a barbell lift, the
 * warm-up ramp from the same warmupOffer / generateWarmups the Warm-ups sheet uses. Plates come from the engine.
 */
import { barbellPlates, calculatePlates, platesOf, type GymLoadSpec, type SetupType } from "@gain/engine";
import type { ExpandInfo } from "../components/RackDockExpanded";
import type { DockModel } from "./dockModel";
import type { Unit } from "./units";
import { isIsolationPattern, warmupOffer, warmupsUsuallySkipped } from "./warmups";
import type { SetRowDraft } from "./workoutRows";

export function dockExpandInfo(
  m: DockModel,
  ex: { loadSpec?: GymLoadSpec | null; setup?: string | null; pattern?: string; equipment: string },
  rows: readonly SetRowDraft[],
  position: number,
  title: string,
  unit: Unit,
): ExpandInfo | null {
  const spec = ex.loadSpec ?? null;
  if (!spec || m.load === null) return null;
  if (m.objKind === "horn") {
    const c = calculatePlates(m.load, 0, platesOf(spec));
    return c && c.perSide.length ? { title, perSide: c.perSide, unit, warmups: [], work: { load: m.load, reps: m.reps ?? 0, perSide: c.perSide }, skippedHint: false } : null;
  }
  if (m.objKind !== "barbell") return null;
  const calc = barbellPlates(spec, m.load);
  if (!calc) return null;
  const firstWork = !rows.some((r) => r.saved && !r.warmup);
  const offer = firstWork ? warmupOffer({ workingLoad: calc.load, spec, setup: (ex.setup as SetupType) ?? "free", loggedToday: 0, isolation: isIsolationPattern(ex.pattern) }) : null;
  const warmups = offer && offer.kind === "offer" ? offer.sets.map((s) => ({ load: s.load, reps: s.reps, perSide: barbellPlates(spec, s.load)?.perSide ?? [] })) : [];
  return { title, perSide: calc.perSide, unit, warmups, work: { load: calc.load, reps: m.reps ?? 0, perSide: calc.perSide }, skippedHint: warmupsUsuallySkipped(position, ex.pattern) };
}
