import React from "react";
import { Pressable, View } from "react-native";
import type { GymLoadSpec, LoggedSet } from "@gain/engine";
import type { Disp } from "../logic/workoutTypes";
import { useI18n } from "../i18n";
import { exerciseLabels, isolateLtr } from "../i18n/format";
import { stepLoadOnGrid } from "../logic/stepLoad";
import { unitLabel, weightText, type Unit } from "../logic/units";
import { isTimed, parseQuantityInput, setQuantity } from "../logic/quantity";
import { beatLast } from "../logic/beatLast";
import { previousCellText } from "../logic/bidiText";
import { parseLoadInput, parseRepsInput, parseRirInput } from "../logic/setInput";
import { kindOf, rowCanLog, type SetRowDraft, type editRow } from "../logic/workoutRows";
import { pendingInputs, tickState } from "../logic/setRowState";
import { radius, space, type as ty, useLogPalette } from "../theme";
import { AppText } from "../ui";
import { Icon } from "./Icon";
import { CellInput, SwipeRow } from "./LogParts";
import { SetMicroSteppers } from "./workout/SetMicroSteppers";
import { haptics } from "../haptics";

export interface WorkoutSetRowProps {
  ex: Disp;
  row: SetRowDraft;
  label: string | number;
  workingIndex: number | null;
  lastSets: LoggedSet[] | null;
  current: boolean;
  stacked: boolean;
  busy: boolean;
  onPatch: (key: string, change: Parameters<typeof editRow>[2]) => void;
  onKind: (row: SetRowDraft) => void;
  onAskDelete: (row: SetRowDraft) => void;
  onDelete: (row: SetRowDraft) => void;
  onLog: (row: SetRowDraft) => void;
  onUntick: (row: SetRowDraft) => void;
  autoFocus?: boolean;
  focusNonce?: number;
  strengthPr?: boolean;
  /** This exercise's own kg / lb choice; absent = the app-wide unit. The row always stores kilograms. */
  unit?: Unit;
  /** This exercise's available loads (its own list or the gym's grid for its equipment); the ± steps snap to them. */
  loadSpec?: GymLoadSpec | null;
}

/** Inputs and actions for one set. Persistence and draft state belong to the logger. */
export function WorkoutSetRow({ ex, row, label, workingIndex, lastSets, current, stacked, busy, onPatch, onKind, onAskDelete, onDelete, onLog, onUntick, autoFocus, focusNonce, strengthPr = false, unit: unitOverride, loadSpec = null }: WorkoutSetRowProps) {
  const { t, lang, unit: appUnit } = useI18n();
  const unit = unitOverride ?? appUnit;
  const unitText = unitLabel(unit, lang);
  const p = useLogPalette();
  const labels = exerciseLabels(ex, lang);
  const timed = isTimed(ex.measure);
  const qUnits = { s: t("qty.s"), m: t("qty.m") };
  const colSet = { width: 48, alignItems: "center" as const };
  const colTick = { width: 48, alignItems: "center" as const };

  const done = row.saved && !row.dirty;
  const canTick = rowCanLog(row);
  const state = tickState(row, canTick);
  const pending = pendingInputs(row);
  const tickDisabled = busy || (!done && !canTick);
  // Ticked rows get only a quiet wash (the muted green check says "done"; lime stays for the current set and primary actions); the set being worked on is the one with the strong wash, bar and outlined boxes.
  const bg = done ? p.doneBg : current ? p.activeBg : p.bg;
  // Every small control says which exercise and which set it belongs to (a screen reader hears a list of identical boxes otherwise).
  const ctx = t("workout.setContext", { exercise: labels.primary, n: label });
  const setButton = (
    <View style={colSet}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t("workout.kind.title")}: ${t(`workout.kind.${kindOf(row)}` as never)}. ${ctx}`}
        accessibilityState={{ selected: kindOf(row) !== "normal" }}
        onPress={() => onKind(row)}
        onLongPress={() => onAskDelete(row)}
        accessibilityActions={[{ name: "delete", label: t("workout.deleteSet") }]}
        onAccessibilityAction={event => { if (event.nativeEvent.actionName === "delete") onAskDelete(row); }}
        style={({ pressed }) => ({ width: 48, height: 48, borderRadius: radius.button, backgroundColor: p.field, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}
      >
        <AppText ltr style={{ fontWeight: "600", fontSize: ty.body, color: row.warmup ? p.warn : kindOf(row) === "normal" ? p.text : p.accent }}>{label}</AppText>
      </Pressable>
    </View>
  );
  // Previous performance wraps instead of shrinking or cutting off. Unitless "55 × 10" (the KG column header names the unit): pure
  // Latin digits, so ltr is safe here (L-3). At large text it is a 13 caption above the kg box instead of a column (L-8).
  // "↑" + text 600 when this logged set beat the same set last time (logger spec §4; plain comparison, no colour, no "best").
  const lastSet = lastSets && workingIndex !== null ? lastSets[workingIndex] ?? null : null;
  const beat = !!lastSet && row.saved && !row.dirty && row.load !== null && row.reps !== null
    && beatLast({ load: row.load, reps: row.reps, warmup: row.warmup, tags: row.tags }, { load: lastSet.load, reps: setQuantity(lastSet, ex.measure) }, ex.measure);
  const previousValue = `${beat ? "↑ " : ""}${previousCellText(lastSets, workingIndex, ex.measure, unit, qUnits)}`;
  const previousA11y = beat ? `${previousValue}, ${t("rack.beatLast")}` : undefined;
  const previous = (
    <View style={{ flex: 1.1 }}>
      <AppText ltr accessibilityLabel={previousA11y} style={{ color: beat ? p.text : p.muted, fontWeight: beat ? "600" : undefined, fontSize: ty.label, textAlign: "center" }}>{previousValue}</AppText>
    </View>
  );
  const loadCell = (
    <CellInput<number>
      a11y={`${t("workout.load")} (${unitText}). ${ctx}`}
      value={row.load}
      format={(v) => weightText(v, unit)}
      parse={(txt, cur) => parseLoadInput(txt, unit, cur)}
      onValue={(v, invalid = false) => onPatch(row.key, { load: v, invalidLoad: invalid })}
      placeholder={row.ghostLoad !== null ? weightText(row.ghostLoad, unit) : undefined}
      pending={pending.load}
      decimal
      done={done}
      current={current}
      autoFocus={autoFocus}
      focusNonce={focusNonce}
    />
  );
  const repsCell = (
    <CellInput<number>
      a11y={`${timed ? (ex.measure === "time" ? t("workout.seconds") : t("workout.metres")) : t("workout.reps")}. ${ctx}`}
      value={row.reps}
      format={(v) => String(v)}
      parse={(txt) => (timed ? parseQuantityInput(txt, ex.measure) : parseRepsInput(txt))}
      decimal={ex.measure === "distance"}
      onValue={(v, invalid = false) => onPatch(row.key, { reps: v, invalidReps: invalid })}
      placeholder={row.ghostReps !== null ? String(row.ghostReps) : undefined}
      pending={pending.reps}
      done={done}
      current={current}
    />
  );
  const rirCell = ex.trackEffort ? (
    <CellInput<number> a11y={`${t("workout.rir")}. ${ctx}`} style={{ flex: 0, width: stacked ? 64 : 52 }} value={row.rir} format={(v) => String(v)} parse={(txt) => parseRirInput(txt)} onValue={(v, invalid = false) => onPatch(row.key, { rir: v, invalidRir: invalid })} done={done} current={current} />
  ) : null;
  // The current set: a 6 dp accent bar on the start edge (right in Arabic; check on device, react-native-web draws it left) (L-6).
  const bar = current ? <View pointerEvents="none" style={{ position: "absolute", start: 0, top: 4, bottom: 4, width: 6, borderRadius: 3, backgroundColor: p.accent }} /> : null;
  // Tick states (L-2): hollow = not ready, field = ready, SOLID = done (inverted check), accent ring + pencil = edited after save.
  const tickFill = state === "done" ? p.doneSolid : state === "notReady" ? "transparent" : p.field;
  const tickBorderWidth = state === "done" ? 0 : state === "edited" || (state === "ready" && current) ? 2 : 1.5;
  const tickBorderColor = state === "edited" || (state === "ready" && current) ? p.accent : p.edge;
  const tick = (
    <View style={colTick}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, disabled: tickDisabled }}
        accessibilityLabel={`${done ? t("workout.untick") : row.saved ? t("workout.tickUpdate") : t("workout.tick")}. ${ctx}`}
        disabled={tickDisabled}
        // The full row pitch is tappable (L-15): the most-tapped control sits at the far left in Arabic.
        hitSlop={{ top: 4, bottom: 4 }}
        onPress={() => { if (done) { haptics.untick(); onUntick(row); } else { haptics.tick(); onLog(row); } }}
        style={({ pressed }) => ({ width: 48, height: 48, borderRadius: radius.button, alignItems: "center", justifyContent: "center", backgroundColor: tickFill, borderWidth: tickBorderWidth, borderColor: tickBorderColor, opacity: busy ? 0.6 : pressed ? 0.7 : 1 })}
      >
        {state === "edited" ? <Icon name="edit" color={p.accent} size={20} /> : state === "done" ? <Icon name="check" color={p.onDoneSolid} size={22} /> : state === "ready" ? <Icon name="check" color={p.muted} size={22} /> : null}
      </Pressable>
    </View>
  );
  return (
    <SwipeRow key={row.key} background={bg} deleteLabel={t("workout.deleteSet")} deleteA11y={`${t("workout.deleteSet")}. ${ctx}`} onDelete={() => onDelete(row)}>
      {stacked ? (
        // Large text (L-8): set | kg | reps | tick stay on ONE line (the tick beside the values it confirms); Previous is a caption above
        // the kg box. Column heads are shown once per exercise, not per row.
        // The caption sits directly on its own row (no gap) and rows are divided, so it never reads as the row above's (C-R3).
        <View style={{ gap: 0, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.xs, borderBottomWidth: 1, borderColor: p.line }}>
          {bar}
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ width: 48 }} />
            <View style={{ flex: 1 }}><AppText ltr accessibilityLabel={previousA11y} style={{ color: beat ? p.text : p.muted, fontWeight: beat ? "600" : undefined, fontSize: ty.caption, textAlign: "center" }}>{previousValue}</AppText></View>
            <View style={{ flex: 1 }} />
            {rirCell ? <View style={{ width: 64 }} /> : null}
            <View style={{ width: 48 }} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            {setButton}
            {loadCell}
            {repsCell}
            {rirCell}
            {tick}
          </View>
        </View>
      ) : (
        // 56 dp row pitch: 8 dp between the 48 dp targets of consecutive rows, 8 dp between columns (L-5).
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.xs }}>
          {bar}
          {setButton}
          {previous}
          {loadCell}
          {repsCell}
          {rirCell}
          {tick}
        </View>
      )}
      {current && !done ? (
        <SetMicroSteppers
          load={row.load ?? row.ghostLoad}
          reps={row.reps ?? row.ghostReps}
          unit={unit}
          rir={row.rir}
          trackEffort={ex.trackEffort}
          onAdjustLoad={(delta) => {
            // The step (±2.5 kg or ±5 lb) is in the unit on screen; the row keeps kilograms.
            // With available loads known, snap in the step's direction to one the gym has (a lb step in a kg gym stays on its grid).
            const next = stepLoadOnGrid(row.load ?? row.ghostLoad ?? 0, delta, unit, loadSpec);
            onPatch(row.key, { load: next, invalidLoad: false });
          }}
          onAdjustReps={(delta) => {
            const base = row.reps ?? row.ghostReps ?? 0;
            const next = Math.max(0, base + delta);
            onPatch(row.key, { reps: next, invalidReps: false });
          }}
          onSetRir={(r) => {
            onPatch(row.key, { rir: r, invalidRir: false });
          }}
        />
      ) : null}
      {done && strengthPr ? <AppText accessibilityLiveRegion="polite" style={{ color: p.accent, fontSize: 13, paddingHorizontal: space.md, paddingBottom: space.xs }}>{t("achv.strengthPr")}</AppText> : null}
    </SwipeRow>
  );
}

/** The row's view of the exercise: only these fields are read, so a fresh `ex` object with the same values is the same row. */
const sameEx = (a: Disp, b: Disp) => a === b || (a.exerciseId === b.exerciseId && a.nameEn === b.nameEn && a.nameAr === b.nameAr && a.measure === b.measure && a.trackEffort === b.trackEffort);

/** Shallow compare, except `ex` (rebuilt each logger render) by the fields above. Handlers must be stable (WorkoutExerciseSection passes ref-backed ones). */
export function sameRowProps(a: WorkoutSetRowProps, b: WorkoutSetRowProps): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof WorkoutSetRowProps>;
  for (const k of keys) {
    if (k === "ex") { if (!sameEx(a.ex, b.ex)) return false; }
    else if (!Object.is(a[k], b[k])) return false;
  }
  return true;
}

/** Memoised row: a keystroke re-renders only the edited row, not every row of every exercise. */
export const MemoWorkoutSetRow = React.memo(WorkoutSetRow, sameRowProps);
