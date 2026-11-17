import React, { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useI18n } from "../i18n";
import { exerciseLabels, formatLoad, isolateLtr } from "../i18n/format";
import { unitLabel, weightText } from "../logic/units";
import { parseLoadInput, parseRepsInput } from "../logic/setInput";
import { isTimed, parseQuantityInput, targetPhrase } from "../logic/quantity";
import { effectiveOf, rowLabels } from "../logic/workoutRows";
import { workingIndexes } from "../logic/liveSummary";
import { loadInputMode, previousForRow } from "../logic/currentSet";
import { radius, space, useLogPalette } from "../theme";
import { AppText, IconButton, QuietAction } from "../ui";
import { CellInput } from "./LogParts";
import { Icon } from "./Icon";
import type { ExerciseSectionProps } from "./WorkoutExerciseSection";

/** One editable set. Every displayed number comes from the same draft/ghost pair used by logRow. */
export function CurrentExerciseSets({ section, currentKey }: { section: ExerciseSectionProps; currentKey: string | null }) {
  const { ex, list, info, previousSource = "any", onPatch, onSelect, onKind, onAskDelete } = section;
  const { t, lang, unit: appUnit } = useI18n();
  const unit = section.unitOverride ?? appUnit;
  const p = useLogPalette();
  const large = useWindowDimensions().fontScale > 1.3;
  const [added, setAdded] = useState(false);
  const numbering = rowLabels(list), indexes = workingIndexes(list);
  const row = list.find(row => row.key === currentKey);
  const index = row ? list.indexOf(row) : -1;
  const units = { s: t("qty.s"), m: t("qty.m") };
  const values = row ? effectiveOf(row) : null;
  const mode = loadInputMode(ex, values?.load ?? null);
  const showLoad = mode !== "bodyweight" || added;
  const count = indexes.filter(index => index !== null).length;
  const label = (i: number) => numbering[i] === "W" ? t("workout.la.warmup") : numbering[i] === "D" ? t("workout.la.drop") : t("workout.la.setOf", { x: numbering[i]!, y: count });
  const valueText = (load: number | null, quantity: number | null) => {
    if (quantity == null || load == null) return "—";
    if (ex.setup === "bodyweight_plus_added" && load === 0 && !isTimed(ex.measure)) return `${isolateLtr(String(quantity))} ${t("workout.col.reps")}`;
    return targetPhrase(load, quantity, ex.measure, kg => formatLoad(kg, lang, unit), units);
  };
  const previous = previousForRow((info.previous ? info.previous[previousSource] : info.last)?.sets, indexes[index] ?? null, ex.measure);
  const context = row ? t("workout.setContext", { exercise: exerciseLabels(ex, lang).primary, n: numbering[index]! }) : "";
  const loadLabel = `${t(mode === "assistance" ? "workout.current.assistance" : ex.setup === "bodyweight_plus_added" ? "workout.current.addedWeight" : "workout.load")} (${unitLabel(unit, lang)})`;
  const qLabel = t(ex.measure === "time" ? "workout.seconds" : ex.measure === "distance" ? "workout.metres" : "workout.reps");
  return <View style={{ gap: space.md, paddingHorizontal: space.lg, paddingTop: space.sm }}>
    {row ? <View key={row.key} testID="active-set-card" style={{ padding: space.lg, gap: space.md, borderRadius: radius.card, borderWidth: 1, borderColor: p.line, backgroundColor: p.card }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <AppText accessibilityRole="header" style={{ flex: 1, color: p.muted, fontSize: 16, fontWeight: "600" }}>{label(index)}</AppText>
        <IconButton icon="more" label={`${t("workout.setOptions")}: ${context}`} onPress={() => onKind(row)} />
      </View>
      <View style={{ flexDirection: large ? "column" : "row", gap: space.md }}>
        {showLoad ? <View style={{ flex: large ? undefined : 1, gap: space.sm }}>
          <AppText style={{ color: p.muted, fontSize: 14 }}>{loadLabel}</AppText>
          <CellInput a11y={`${loadLabel}. ${context}`} value={row.load} format={value => weightText(value, unit)} parse={(text, current) => parseLoadInput(text, unit, current)}
            onValue={(load, invalidLoad = false) => onPatch(row.key, { load, invalidLoad })} placeholder={row.ghostLoad == null ? undefined : weightText(row.ghostLoad, unit)}
            invalid={row.invalidLoad} decimal current prominent fontSize={large ? 32 : 40} minHeight={72} onFocus={() => onSelect?.(row.key)}
            autoFocus={section.focusRow?.key === row.key} focusNonce={section.focusRow?.nonce} />
        </View> : null}
        <View style={{ flex: large ? undefined : 1, gap: space.sm }}>
          <AppText style={{ color: p.muted, fontSize: 14 }}>{qLabel}</AppText>
          <CellInput a11y={`${qLabel}. ${context}`} value={row.reps} format={String} parse={text => isTimed(ex.measure) ? parseQuantityInput(text, ex.measure) : parseRepsInput(text)}
            onValue={(reps, invalidReps = false) => onPatch(row.key, { reps, invalidReps })} placeholder={row.ghostReps == null ? undefined : String(row.ghostReps)}
            invalid={row.invalidReps} decimal={ex.measure === "distance"} current prominent fontSize={large ? 32 : 40} minHeight={72} onFocus={() => onSelect?.(row.key)} />
        </View>
      </View>
      {ex.setup === "bodyweight_plus_added" ? <QuietAction label={showLoad ? t("workout.current.bodyweightOnly") : t("workout.current.addWeight")} onPress={() => {
        setAdded(!showLoad); if (showLoad) onPatch(row.key, { load: 0, invalidLoad: false });
      }} /> : null}
      {previous ? <AppText style={{ color: p.muted, fontSize: 14 }}>{t("workout.current.previous", { value: valueText(previous.load, previous.reps) })}</AppText> : null}
    </View> : <AppText style={{ color: p.muted, paddingVertical: space.lg }}>{t("workout.current.complete")}</AppText>}
    {list.filter(item => item.key !== currentKey).map(item => {
      const i = list.indexOf(item), value = effectiveOf(item);
      return <Pressable key={item.key} testID={`compact-set-${item.key}`} accessibilityRole="button" accessibilityLabel={`${label(i)}. ${valueText(value.load, value.reps)}. ${t(item.saved ? "workout.current.editSaved" : "workout.current.selectSet")}`}
        onPress={() => onSelect?.(item.key)} onLongPress={() => onAskDelete(item)} style={({ pressed }) => ({ minHeight: 48, padding: space.sm, flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.button, backgroundColor: pressed ? p.field : "transparent" })}>
        <AppText style={{ color: p.muted, flex: 1, fontSize: 14 }}>{label(i)}</AppText>
        <AppText style={{ color: p.muted, fontSize: 16 }}>{valueText(value.load, value.reps)}</AppText>
        <Icon name={item.saved && !item.dirty ? "check" : "edit"} color={item.saved ? p.accent : p.muted} size={18} />
      </Pressable>;
    })}
  </View>;
}
