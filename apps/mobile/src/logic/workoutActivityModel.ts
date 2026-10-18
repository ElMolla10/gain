import { barbellPlates, type EquipmentType, type GymLoadSpec, type Measure, type SetupType } from "@gain/engine";
import { NBSP } from "../i18n/format";
import { changeText, loadChange } from "./loadChange";
import type { StringKey } from "../i18n/strings";
import { focusedRowKey } from "./workoutFocus";
import { effectiveOf, rowLabels, type SetRowDraft } from "./workoutRows";
import { unitLabel, weightText, type Unit } from "./units";

/**
 * The ContentState `props` JSON of the workout Live Activity (Lock Screen + Dynamic Island). Every string arrives already localised:
 * the widget runtime cannot import i18n. Keep it small (ActivityKit caps the payload at 4 KB).
 */
export type WorkoutActivityProps = {
  v: 2;
  title: string;
  /** ms epoch = startedAt + pausedMs (completed pauses only). The native timer counts up from here. */
  timerStart: number;
  /** Non-null = the workout clock is frozen at this ms epoch (passed as Text pauseTime). */
  pausedAt: number | null;
  pausedLabel: string | null;
  exercise: string | null;
  setLine: string;
  detail: string | null;
  rest: { startedAt: number; endsAt: number; label: string } | null;
  rtl: boolean;
  /** v2: the focused barbell set's plates per side, heaviest first (at most 8; empty for anything else). */
  plates: number[];
  /** v2: "Load the change" for the focused set, already localised ("+10 each side"), or null. */
  change: string | null;
};

export type ActivityExercise = { exerciseId: string; nameEn: string; nameAr: string; measure?: Measure; setup?: string; equipment?: EquipmentType; loadSpec?: GymLoadSpec | null };

const MAX_PLATES = 8;

export interface WorkoutActivityInput {
  startedAt: number;
  pausedMs: number;
  pausedAt: number | null;
  /** The exercises in logger order. */
  shown: readonly ActivityExercise[];
  rows: Record<string, SetRowDraft[]>;
  /** The focused exercise (logic/workoutFocus.ts focusedExercise), or null when every row is ticked. */
  focus: string | null;
  timer: { endsAt: number | null; durationMs: number };
  now: number;
  lang: "en" | "ar";
  unit: Unit;
  t: (key: StringKey, params?: Record<string, string | number>) => string;
}

const MAX_NAME = 32;
const cut = (s: string): string => (s.length > MAX_NAME ? `${s.slice(0, MAX_NAME - 1)}…` : s);

export function workoutActivityProps(i: WorkoutActivityInput): WorkoutActivityProps {
  const ex = i.focus ? i.shown.find((e) => e.exerciseId === i.focus) ?? null : null;
  let setLine = i.t("workout.la.allDone");
  let detail: string | null = null;
  let plates: number[] = [];
  let change: string | null = null;
  if (ex) {
    const list = i.rows[ex.exerciseId] ?? [];
    const key = focusedRowKey(list);
    const index = list.findIndex((r) => r.key === key);
    const labels = rowLabels(list);
    const label = labels[index];
    const y = labels.filter((l) => l !== "W" && l !== "D").length;
    if (label === "W") setLine = i.t("workout.la.warmup");
    else if (label === "D") setLine = i.t("workout.la.drop");
    else if (label !== undefined) setLine = i.t("workout.la.setOf", { x: labels.slice(0, index + 1).filter((l) => l !== "W" && l !== "D").length, y });
    const row = list[index];
    if (row) {
      const { load, reps } = effectiveOf(row);
      if (ex.measure === "time") detail = reps === null ? null : `${reps} ${i.t("workout.dur.s")}`;
      else if (ex.measure === "distance") detail = reps === null ? null : `${reps} m`;
      else if (load !== null && reps !== null) detail = load === 0 && ex.setup === "bodyweight_plus_added" ? `×${NBSP}${reps}` : `${weightText(load, i.unit)}${NBSP}${unitLabel(i.unit, i.lang)}${NBSP}×${NBSP}${reps}`;
      if ((ex.measure ?? "reps") === "reps" && load !== null && ex.equipment && ex.loadSpec && ex.setup !== "bodyweight_plus_added") {
        if (ex.equipment === "barbell") plates = (barbellPlates(ex.loadSpec, load)?.perSide ?? []).slice(0, MAX_PLATES);
        const prev = [...list.slice(0, index)].reverse().find((r) => r.saved);
        const c = loadChange(ex.loadSpec, prev ? effectiveOf(prev).load : null, load, ex.equipment, (ex.setup as SetupType | undefined) ?? "free");
        change = prev ? changeText(c, { lang: i.lang, unit: i.unit, t: i.t }) : null;
      }
    }
  }
  const resting = i.timer.endsAt !== null && i.timer.endsAt > i.now;
  return {
    v: 2,
    title: i.t("workout.title"),
    timerStart: i.startedAt + i.pausedMs,
    pausedAt: i.pausedAt,
    pausedLabel: i.pausedAt !== null ? i.t("workout.stat.paused") : null,
    exercise: ex ? cut(i.lang === "ar" ? ex.nameAr : ex.nameEn) : null,
    setLine,
    detail,
    rest: resting ? { startedAt: i.timer.endsAt! - i.timer.durationMs, endsAt: i.timer.endsAt!, label: i.t("workout.restTimerBtn") } : null,
    rtl: i.lang === "ar",
    plates,
    change,
  };
}
