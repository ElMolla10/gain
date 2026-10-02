import React, { useMemo, useState } from "react";
import { View } from "react-native";
import type { LibraryExercise, NewExerciseInput } from "../db/programmeRepo";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import { computeExposure } from "../logic/exposure";
import {
  addDay, addExercise, moveDay, moveExercise, newExercise, removeDay, removeExercise, renameDay, renameProgramme, updateExercise, type ProgrammeDraft,
} from "../logic/programmeDraft";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card, Chip, Field, Stepper } from "../ui";
import { EffectView, ExposureView } from "./ExposureView";
import { ExercisePicker } from "./ExercisePicker";

/**
 * The programme editor body, shared by the Programme tab and onboarding. Pure UI over a ProgrammeDraft:
 * every edit returns a new draft; saving is the caller's job (a save writes a new version, see programmeRepo).
 * `baseline` is the saved version being edited; with it the editor shows what the edit changes in weekly exposure.
 */
export function ProgrammeEditorView(props: {
  draft: ProgrammeDraft;
  onChange: (d: ProgrammeDraft) => void;
  baseline: ProgrammeDraft | null;
  library: LibraryExercise[];
  daysPerWeek: number | null;
  onCreateExercise: (input: NewExerciseInput) => Promise<string>;
  /** Called after a custom exercise is created so the caller can refresh its library list. */
  onLibraryChanged?: () => void;
}) {
  const { t, lang } = useI18n();
  const p = usePalette();
  const [pickerDay, setPickerDay] = useState<number | null>(null);
  const byId = useMemo(() => new Map(props.library.map((e) => [e.id, e])), [props.library]);
  const patternOf = (id: string) => byId.get(id)?.pattern;
  const nameOf = (id: string) => {
    const e = byId.get(id);
    return e ? exerciseLabels(e, lang).primary : id;
  };
  const after = computeExposure(props.draft, patternOf, props.daysPerWeek);
  const before = props.baseline ? computeExposure(props.baseline, patternOf, props.daysPerWeek) : null;
  const d = props.draft;

  return (
    <View style={{ gap: space.md }}>
      <Field label={t("prog.name")} value={d.name} onChangeText={(s) => props.onChange(renameProgramme(d, s))} />
      {d.days.map((day, di) => (
        <Card key={di}>
          <Field label={t("prog.day.name")} value={day.name} onChangeText={(s) => props.onChange(renameDay(d, di, s))} />
          <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
            <Chip label={`↑ ${t("prog.up")}`} onPress={() => props.onChange(moveDay(d, di, di - 1))} />
            <Chip label={`↓ ${t("prog.down")}`} onPress={() => props.onChange(moveDay(d, di, di + 1))} />
            <Chip label={t("prog.day.remove")} onPress={() => props.onChange(removeDay(d, di))} />
          </View>
          {day.exercises.map((e, ei) => (
            <View key={e.exerciseId} style={{ gap: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderColor: p.border }}>
              <AppText style={{ fontWeight: "700", fontSize: 17 }}>{nameOf(e.exerciseId)}</AppText>
              <Stepper label={t("prog.ex.sets")} value={e.sets} min={1} max={12} onChange={(n) => props.onChange(updateExercise(d, di, ei, { sets: n }))} />
              <Stepper label={t("prog.ex.repsFrom")} value={e.repMin} min={1} max={100} onChange={(n) => props.onChange(updateExercise(d, di, ei, { repMin: n, repMax: Math.max(e.repMax, n) }))} />
              <Stepper label={t("prog.ex.repsTo")} value={e.repMax} min={e.repMin} max={100} onChange={(n) => props.onChange(updateExercise(d, di, ei, { repMax: n }))} />
              <Field
                label={t("prog.ex.ceiling")}
                hint={t("prog.ex.ceilingHint")}
                numeric
                value={e.repCeiling === null ? "" : String(e.repCeiling)}
                onChangeText={(s) => {
                  const n = Number(s.replace(/[^\d]/g, ""));
                  props.onChange(updateExercise(d, di, ei, { repCeiling: s.trim() === "" || !Number.isFinite(n) || n < 1 ? null : Math.min(100, n) }));
                }}
              />
              <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
                <Chip label={t("prog.ex.goal")} selected={e.isGoalLift} onPress={() => props.onChange(updateExercise(d, di, ei, { isGoalLift: !e.isGoalLift }))} />
                <Chip label={t("prog.ex.effort")} selected={e.trackEffort} onPress={() => props.onChange(updateExercise(d, di, ei, { trackEffort: !e.trackEffort }))} />
              </View>
              <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
                <Chip label={`↑ ${t("prog.up")}`} onPress={() => props.onChange(moveExercise(d, di, ei, ei - 1))} />
                <Chip label={`↓ ${t("prog.down")}`} onPress={() => props.onChange(moveExercise(d, di, ei, ei + 1))} />
                <Chip label={t("prog.ex.remove")} onPress={() => props.onChange(removeExercise(d, di, ei))} />
              </View>
            </View>
          ))}
          <BigButton label={t("prog.ex.add")} selected={false} onPress={() => setPickerDay(di)} />
        </Card>
      ))}
      <BigButton label={t("prog.day.add")} selected={false} onPress={() => props.onChange(addDay(d, t("prog.day.default", { n: d.days.length + 1 }).replace(/[\u2066\u2069]/g, "")))} />
      {before && props.baseline ? <EffectView before={before} after={after} beforeDraft={props.baseline} afterDraft={d} nameOf={nameOf} /> : <ExposureView rows={after} />}
      <ExercisePicker
        visible={pickerDay !== null}
        exercises={props.library}
        exclude={pickerDay !== null ? d.days[pickerDay]?.exercises.map((e) => e.exerciseId) : []}
        onClose={() => setPickerDay(null)}
        onCreate={async (input) => {
          const id = await props.onCreateExercise(input);
          props.onLibraryChanged?.();
          return id;
        }}
        onPick={(id) => {
          if (pickerDay !== null) props.onChange(addExercise(d, pickerDay, newExercise(id)));
          setPickerDay(null);
        }}
      />
    </View>
  );
}
