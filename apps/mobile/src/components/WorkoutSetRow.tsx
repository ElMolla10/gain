import React from "react";
import { Pressable, View } from "react-native";
import type { LoggedSet } from "@gain/engine";
import type { Disp } from "../logic/workoutTypes";
import { useI18n } from "../i18n";
import { exerciseLabels, isolateLtr } from "../i18n/format";
import { weightText } from "../logic/units";
import { isTimed, parseQuantityInput, previousQuantityText } from "../logic/quantity";
import { previousText } from "../logic/liveSummary";
import { parseLoadInput, parseRepsInput, parseRirInput } from "../logic/setInput";
import { kindOf, rowCanLog, type SetRowDraft, type editRow } from "../logic/workoutRows";
import { radius, space, useLogPalette } from "../theme";
import { AppText } from "../ui";
import { Icon } from "./Icon";
import { CellInput, SwipeRow } from "./LogParts";

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
}

/** Inputs and actions for one set. Persistence and draft state belong to the logger. */
export function WorkoutSetRow({ ex, row, label, workingIndex, lastSets, current, stacked, busy, onPatch, onKind, onAskDelete, onDelete, onLog, onUntick, autoFocus, focusNonce, strengthPr = false }: WorkoutSetRowProps) {
  const { t, lang, unit, unitText } = useI18n();
  const p = useLogPalette();
  const labels = exerciseLabels(ex, lang);
  const timed = isTimed(ex.measure);
  const qUnits = { s: t("qty.s"), m: t("qty.m") };
  const colSet = { width: 48, alignItems: "center" as const };
  const colTick = { width: 48, alignItems: "center" as const };

  const done = row.saved && !row.dirty;
  const canTick = rowCanLog(row);
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
        style={{ width: 48, height: 48, borderRadius: radius.button, backgroundColor: p.field, alignItems: "center", justifyContent: "center" }}
      >
        <AppText ltr style={{ fontWeight: "600", fontSize: 14, color: row.warmup ? p.warn : kindOf(row) === "normal" ? p.text : p.accent }}>{label}</AppText>
      </Pressable>
    </View>
  );
  // Previous performance wraps instead of shrinking or cutting off.
  const previous = (
    <View style={{ flex: 1.3 }}>
      <AppText ltr style={{ color: p.muted, fontSize: 14, textAlign: "center" }}>
        {isolateLtr(timed ? previousQuantityText(lastSets, workingIndex, ex.measure, (kg) => `${weightText(kg, unit)}${unitText}`, qUnits) : previousText(lastSets, workingIndex, unit, unitText))}
      </AppText>
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
      unitLabel={stacked ? unitText : undefined}
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
      unitLabel={stacked ? (timed ? (ex.measure === "time" ? t("workout.col.sec") : t("workout.col.metres")) : t("workout.col.reps")) : undefined}
      done={done}
      current={current}
    />
  );
  const rirCell = ex.trackEffort ? (
    <CellInput<number> a11y={`${t("workout.rir")}. ${ctx}`} style={{ flex: 0, width: stacked ? 96 : 52 }} value={row.rir} format={(v) => String(v)} parse={(txt) => parseRirInput(txt)} onValue={(v, invalid = false) => onPatch(row.key, { rir: v, invalidRir: invalid })} unitLabel={stacked ? t("workout.col.rir") : undefined} done={done} current={current} />
  ) : null;
  const bar = current ? <View pointerEvents="none" style={{ position: "absolute", start: 0, top: 6, bottom: 6, width: 4, borderRadius: 2, backgroundColor: p.accent }} /> : null;
  const tick = (
    <View style={colTick}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, disabled: tickDisabled }}
        accessibilityLabel={`${done ? t("workout.untick") : row.saved ? t("workout.tickUpdate") : t("workout.tick")}. ${ctx}`}
        disabled={tickDisabled}
        onPress={() => (done ? onUntick(row) : onLog(row))}
        style={{ width: 48, height: 48, borderRadius: radius.button, alignItems: "center", justifyContent: "center", backgroundColor: done ? p.doneFill : p.field, borderWidth: done ? 1.5 : current ? 2 : 1.5, borderColor: done ? p.doneEdge : (row.saved && row.dirty) || current ? p.accent : p.edge, opacity: !done && !row.saved && !canTick ? 0.5 : 1 }}
      >
        {row.saved && row.dirty ? <Icon name="edit" color={p.accent} size={20} /> : <Icon name="check" color={done ? p.onDone : p.muted} size={22} />}
      </Pressable>
    </View>
  );
  return (
    <SwipeRow key={row.key} background={bg} deleteLabel={t("workout.deleteSet")} deleteA11y={`${t("workout.deleteSet")}. ${ctx}`} onDelete={() => onDelete(row)}>
      {stacked ? (
        <View style={{ gap: space.xs, paddingHorizontal: space.md, paddingVertical: space.xs }}>
          {bar}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {setButton}
            {previous}
            {tick}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {loadCell}
            {repsCell}
            {rirCell}
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.md, paddingVertical: 2 }}>
          {bar}
          {setButton}
          {previous}
          {loadCell}
          {repsCell}
          {rirCell}
          {tick}
        </View>
      )}
      {done && strengthPr ? <AppText accessibilityLiveRegion="polite" style={{ color: p.accent, fontSize: 13, paddingHorizontal: space.md, paddingBottom: space.xs }}>{t("achv.strengthPr")}</AppText> : null}
    </SwipeRow>
  );
}
