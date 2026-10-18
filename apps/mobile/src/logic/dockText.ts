/**
 * Every string the Rack Dock shows or speaks (logger spec §2, §8), pure. Numbers LTR-isolated, NBSP around the unit and the ×.
 */
import type { StringKey } from "../i18n/strings";
import { formatLoad, isolateLtr, NBSP, type Lang } from "../i18n/format";
import type { DockModel } from "./dockModel";
import { changeText } from "./loadChange";
import type { Unit } from "./units";

type T = (key: StringKey, params?: Record<string, string | number>) => string;
export interface DockCtx { lang: Lang; unit: Unit; t: T }

/** "Set 2 of 3" / "Warm-up" / "Drop set". */
export function dockSetText(m: DockModel, t: T): string {
  if (m.label === "W") return t("workout.la.warmup");
  if (m.label === "D") return t("workout.la.drop");
  return t("workout.la.setOf", { x: m.x, y: m.y });
}

/** The big number: "40 kg × 10", "45 s", "× 8" (bodyweight), or "—" when nothing is set yet. */
export function dockNumberText(m: DockModel, c: DockCtx): string {
  const reps = m.reps === null ? "—" : isolateLtr(String(m.reps));
  if (m.measure === "time") return m.reps === null ? "—" : `${isolateLtr(String(m.reps))}${NBSP}${c.t("qty.s")}`;
  if (m.measure === "distance") return m.reps === null ? "—" : `${isolateLtr(String(m.reps))}${NBSP}m`;
  if (m.load === null) return m.reps === null ? "—" : `×${NBSP}${reps}`;
  if (m.load === 0 && (m.objKind === "belt" || m.objKind === "bodyweight")) return `×${NBSP}${reps}`;
  return `${formatLoad(m.load, c.lang, c.unit)}${NBSP}×${NBSP}${reps}`;
}

/** The line under the number: the reason when it can't log, else "Load the change", else null. */
export function dockLineText(m: DockModel, c: DockCtx): { text: string; warn: boolean } | null {
  if (!m.canLog && m.reason) return { text: c.t(`rack.reason.${m.reason}` as StringKey), warn: true };
  const change = m.change ? changeText(m.change, c) : null;
  return change ? { text: change, warn: false } : null;
}

/** The Log set label: "Log set", or "Update set 2" for an edited saved set. */
export const dockButtonText = (m: DockModel, t: T): string => (m.update ? t("rack.update", { n: m.x }) : t("rack.log"));

/** One screen-reader group: "Set 2 of 3, Lat pulldown. 40 kg for 10 reps. Pin to 40 kg." */
export function dockA11y(m: DockModel, name: string, c: DockCtx): string {
  const set = dockSetText(m, c.t);
  const what = m.load !== null && m.reps !== null && m.measure === "reps" ? c.t("rack.a11y.what", { load: formatLoad(m.load, c.lang, c.unit), reps: m.reps }) : dockNumberText(m, c);
  const line = dockLineText(m, c);
  return `${c.t("rack.a11y.group", { set, exercise: name, what })}.${line ? ` ${line.text}.` : ""}`;
}

/** The polite announcement after a log: "Set 2 of 3 logged. Next: Set 3 of 3". */
export function dockLoggedText(prev: DockModel, next: DockModel, c: DockCtx): string {
  const set = dockSetText(prev, c.t);
  return next.mode === "done" || next.exId === null ? c.t("rack.a11y.loggedLast", { set }) : c.t("rack.a11y.logged", { set, next: dockSetText(next, c.t) });
}
