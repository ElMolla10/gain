/**
 * The Rack Dock's model (logger spec §2), pure. Everything the dock draws is a primitive here (perSide is compared by `dockKey`), so the
 * dock can be memoised on it and a keystroke in a row never re-renders the dock. It reads COMMITTED values: while a row is being edited
 * (`editing` = that row's key) its typed load/reps are ignored and the dock is hidden; it comes back on blur with the typed values.
 */
import { barbellPlates, calculatePlates, platesOf, type EquipmentType, type GymLoadSpec, type Measure, type SetupType } from "@gain/engine";
import { focusedExercise, focusedRowKey } from "./workoutFocus";
import { loadChange, type LoadChange } from "./loadChange";
import { effectiveOf, hasInvalidInput, rowLabels, rowReady, type SetRowDraft } from "./workoutRows";

export type DockMode = "compact" | "rest" | "over" | "done" | "hidden";
export type DockObj = "barbell" | "dumbbell" | "stack" | "horn" | "assist" | "belt" | "timed" | "bodyweight";
export type DockReason = "fixWeight" | "fixReps" | "fixEffort" | "empty" | null;

export interface DockExercise {
  exerciseId: string;
  equipment: EquipmentType;
  setup?: SetupType | string | null;
  measure?: Measure | null;
  loadSpec?: GymLoadSpec | null;
}

export interface DockTimer {
  /** Rest is switched on for the focused exercise. When off there is no clock at all (Mohamed, 2026-10-18). */
  on: boolean;
  endsAt: number | null;
  over: boolean;
  now: number;
}

export interface DockModel {
  exId: string | null;
  rowKey: string | null;
  /** "W", "D" or the working-set number as text. */
  label: string | null;
  /** Working set x of y (W and D rows don't count). */
  x: number;
  y: number;
  load: number | null;
  reps: number | null;
  measure: Measure;
  canLog: boolean;
  reason: DockReason;
  /** An edited saved set: the button reads "Update set x". */
  update: boolean;
  change: LoadChange | null;
  mode: DockMode;
  objKind: DockObj | null;
  perSide: readonly number[];
  /** Only while resting with rest on; never a since-last-set clock. */
  restEndsAt: number | null;
}

export function objKindOf(ex: DockExercise): DockObj {
  if (ex.measure === "time" || ex.measure === "distance") return "timed";
  if (ex.setup === "assisted" || ex.equipment === "assisted") return "assist";
  if (ex.setup === "bodyweight_plus_added") return "belt";
  if (ex.equipment === "barbell") return "barbell";
  if (ex.equipment === "dumbbell") return "dumbbell";
  if (ex.equipment === "plate") return "horn";
  return "stack";
}

const reasonOf = (r: SetRowDraft): DockReason =>
  r.invalidLoad ? "fixWeight" : r.invalidReps ? "fixReps" : r.invalidRir ? "fixEffort" : rowReady(effectiveOf(r)) ? null : "empty";

export function dockModel(
  shown: readonly DockExercise[],
  rows: Readonly<Record<string, SetRowDraft[]>>,
  preferred: string | null,
  timer: DockTimer,
  opts: { groups?: Readonly<Record<string, string | null | undefined>>; editing?: string | null } = {},
): DockModel {
  const exId = focusedExercise(shown.map((e) => e.exerciseId), rows as Record<string, SetRowDraft[]>, preferred, opts.groups);
  const ex = exId ? shown.find((e) => e.exerciseId === exId) ?? null : null;
  const empty: DockModel = { exId: null, rowKey: null, label: null, x: 0, y: 0, load: null, reps: null, measure: "reps", canLog: false, reason: null, update: false, change: null, mode: "done", objKind: null, perSide: [], restEndsAt: null };
  if (!ex) return empty;
  const list = rows[ex.exerciseId] ?? [];
  const rowKey = focusedRowKey(list);
  const index = list.findIndex((r) => r.key === rowKey);
  const raw = list[index];
  if (!raw) return empty;
  const editing = opts.editing === raw.key;
  // Committed view: while editing, the typed text is not committed yet.
  const row: SetRowDraft = editing ? { ...raw, load: null, reps: null, invalidLoad: false, invalidReps: false, invalidRir: false } : raw;
  const labels = rowLabels(list);
  const work = (l: string) => l !== "W" && l !== "D";
  const label = labels[index] ?? null;
  const x = labels.slice(0, index + 1).filter(work).length;
  const y = labels.filter(work).length;
  const { load, reps } = effectiveOf(row);
  const measure: Measure = ex.measure ?? "reps";
  const objKind = objKindOf(ex);
  const prev = [...list.slice(0, index)].reverse().find((r) => r.saved);
  const from = prev ? effectiveOf(prev).load : null;
  const spec = ex.loadSpec ?? null;
  const change = measure === "reps" && load !== null && objKind !== "belt" && objKind !== "bodyweight" ? loadChange(spec, from, load, ex.equipment, (ex.setup as SetupType) ?? "free") : null;
  let perSide: readonly number[] = [];
  if (spec && load !== null && measure === "reps") {
    if (objKind === "barbell") perSide = barbellPlates(spec, load)?.perSide ?? [];
    else if (objKind === "horn") perSide = calculatePlates(load, 0, platesOf(spec))?.perSide ?? [];
  }
  const resting = timer.on && timer.endsAt !== null && timer.endsAt > timer.now;
  const mode: DockMode = editing ? "hidden" : resting ? "rest" : timer.on && timer.over ? "over" : "compact";
  return {
    exId: ex.exerciseId,
    rowKey: raw.key,
    label,
    x,
    y,
    load,
    reps,
    measure,
    canLog: !editing && !hasInvalidInput(row) && rowReady({ load, reps }),
    reason: editing ? null : reasonOf(row),
    update: raw.saved && raw.dirty,
    change,
    mode,
    objKind,
    perSide,
    restEndsAt: resting ? timer.endsAt : null,
  };
}

/** A stable string of every field the dock draws, for React.memo equality. */
export const dockKey = (m: DockModel): string =>
  [m.exId, m.rowKey, m.label, m.x, m.y, m.load, m.reps, m.measure, m.canLog, m.reason, m.update, m.mode, m.objKind, m.perSide.join(","), m.restEndsAt, m.change ? `${m.change.kind}:${m.change.add.join(",")}:${m.change.strip.join(",")}:${m.change.to}:${m.change.from}:${m.change.known}` : ""].join("|");
