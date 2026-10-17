import type { EquipmentType, Measure } from "@gain/engine";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import type { LibraryExercise, NewExerciseInput } from "../db/programmeRepo";
import type { MachineLoadKind, PinMachineStep } from "../logic/machineLoadKind";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import { computeExposure } from "../logic/exposure";
import {
  addDay, addExercise, reorderDays, newExerciseFor, removeDay, removeExercise, renameDay, renameProgramme, reorderExercises, swapExercise, updateExercise, type ProgrammeDraft,
} from "../logic/programmeDraft";
import { substitutionCandidates } from "../logic/substitutions";
import { space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Card, Chip, Field, IconButton, Stepper } from "../ui";
import { EffectView, ExposureView } from "./ExposureView";
import { ExercisePicker } from "./ExercisePicker";
import { ExerciseReorderModal } from "./ExerciseReorderModal";
import { WorkoutSettingsModal } from "./WorkoutSettingsModal";
import { MenuSheet } from "./LogParts";
import { Icon } from "./Icon";

/**
 * The program editor body, shared by the Program tab and onboarding. Pure UI over a ProgrammeDraft:
 * every edit returns a new draft; saving is the caller's job (a save writes a new version, see programmeRepo).
 * `baseline` is the saved version being edited; with it the editor shows what the edit changes in weekly exposure.
 */
export function ProgrammeEditorView(props: {
  draft: ProgrammeDraft;
  initialSettingsDay?: number;
  initialReorderWorkouts?: boolean;
  onChange: (d: ProgrammeDraft) => void;
  baseline: ProgrammeDraft | null;
  library: LibraryExercise[];
  daysPerWeek: number | null;
  onCreateExercise: (input: NewExerciseInput) => Promise<string>;
  /** Called after a custom exercise is created so the caller can refresh its library list. */
  onLibraryChanged?: () => void;
  /** Switch how an exercise is counted (reps / seconds / metres). Throws when sets are already logged for it. Absent = the chips are not shown. */
  onSetMeasure?: (exerciseId: string, measure: Measure) => Promise<void>;
  /** Open the screen where the weights that exist for an exercise are set. Absent = the chip is not shown (e.g. during onboarding). */
  onOpenLoads?: (exerciseId: string) => void;
  /** Equipment in the current gym. Substitutions are offered only when this is set. */
  gymEquipment?: EquipmentType[];
  onSetMachineLoadKind?: (exerciseId: string, kind: MachineLoadKind, pinStep?: PinMachineStep) => Promise<void>;
}) {
  const { t, lang } = useI18n();
  const p = usePalette();
  const [pickerDay, setPickerDay] = useState<number | null>(null);
  const [reorderWorkouts, setReorderWorkouts] = useState(props.initialReorderWorkouts ?? false);
  const [settingsDay, setSettingsDay] = useState<number | null>(props.initialSettingsDay ?? null);
  const [reorderDay, setReorderDay] = useState<number | null>(null);
  // Start collapsed. Only one exercise needs to reveal its advanced settings at a time.
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<{ day: number; index: number; fatigue: boolean } | null>(null);
  const [swapPick, setSwapPick] = useState<{ day: number; index: number } | null>(null);
  const byId = useMemo(() => new Map(props.library.map((e) => [e.id, e])), [props.library]);
  const measureOf = (id: string): Measure => byId.get(id)?.measure ?? "reps";
  const patternOf = (id: string) => byId.get(id)?.pattern;
  const nameOf = (id: string) => {
    const e = byId.get(id);
    return e ? exerciseLabels(e, lang).primary : id;
  };
  const after = computeExposure(props.draft, patternOf, props.daysPerWeek);
  const before = props.baseline ? computeExposure(props.baseline, patternOf, props.daysPerWeek) : null;
  const d = props.draft;
  const swapCands = useMemo(() => {
    if (!swapFor || !props.gymEquipment) return [];
    const curId = d.days[swapFor.day]?.exercises[swapFor.index]?.exerciseId;
    const cur = curId ? byId.get(curId) : undefined;
    if (!cur) return [];
    const dayIds = d.days[swapFor.day]?.exercises.map((x) => x.exerciseId) ?? [];
    return substitutionCandidates({
      current: cur,
      library: props.library,
      gymEquipment: props.gymEquipment,
      fatigue: swapFor.fatigue,
      exclude: dayIds,
    }).slice(0, 8);
  }, [swapFor, props.gymEquipment, props.library, d, byId]);

  const confirmRemoveExercise = (dayIndex: number, exerciseIndex: number) => {
    const exercise = d.days[dayIndex]?.exercises[exerciseIndex];
    const day = d.days[dayIndex];
    if (!exercise || !day) return;
    Alert.alert(
      t("prog.ex.removeTitle", { exercise: nameOf(exercise.exerciseId) }),
      t("prog.ex.removeBody", { day: day.name }),
      [
        { text: t("finish.cancel"), style: "cancel" },
        {
          text: t("prog.ex.remove"),
          style: "destructive",
          onPress: () => {
            setExpandedExercise(null);
            props.onChange(removeExercise(d, dayIndex, exerciseIndex));
          },
        },
      ],
    );
  };

  // Removing a whole day asks first (it takes all its exercises and settings with it); an empty day goes straight away.
  const confirmRemoveDay = (dayIndex: number) => {
    const day = d.days[dayIndex];
    if (!day) return;
    const remove = () => { setExpandedExercise(null); props.onChange(removeDay(d, dayIndex)); };
    if (day.exercises.length === 0) return remove();
    const name = day.name.trim() || t("prog.day.default", { n: dayIndex + 1 });
    Alert.alert(
      t("prog.day.removeTitle", { day: name }),
      t("prog.day.removeBody", { day: name, n: day.exercises.length }),
      [
        { text: t("finish.cancel"), style: "cancel" },
        { text: t("prog.ex.remove"), style: "destructive", onPress: remove },
      ],
    );
  };

  return (
    <View style={{ gap: space.md }}>
      <Field label={t("prog.name")} value={d.name} onChangeText={(s) => props.onChange(renameProgramme(d, s))} />
      {d.days.length > 1 ? <BigButton variant="secondary" label={t("prog.workouts.reorder")} onPress={() => setReorderWorkouts(true)} /> : null}
      {d.days.map((day, di) => (
        <Card key={di} style={{ gap: space.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <View style={{ flex: 1 }}><Field label={t("prog.day.name")} value={day.name} onChangeText={(s) => props.onChange(renameDay(d, di, s))} /></View>
            <IconButton icon="settings" label={t("prog.workout.settings", { workout: day.name })} onPress={() => setSettingsDay(di)} />
          </View>
          <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
            <Chip label={t("prog.day.remove")} tone="danger" onPress={() => confirmRemoveDay(di)} />
          </View>
          {day.exercises.length > 1 ? <BigButton variant="secondary" label={t("prog.reorder.button")} onPress={() => setReorderDay(di)} /> : null}
          {day.exercises.map((e, ei) => (
            <View key={e.exerciseId} style={{ borderTopWidth: 1, borderColor: p.border }}>
              {/* Keep the default view names-only; no sets or settings until tapped. */}
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={nameOf(e.exerciseId)}
                  accessibilityHint={expandedExercise === `${di}:${e.exerciseId}` ? t("prog.ex.collapseHint") : t("prog.ex.expandHint")}
                  accessibilityState={{ expanded: expandedExercise === `${di}:${e.exerciseId}` }}
                  onPress={() => setExpandedExercise(current => current === `${di}:${e.exerciseId}` ? null : `${di}:${e.exerciseId}`)}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 60,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.sm,
                    paddingStart: space.sm,
                    backgroundColor: pressed ? p.raised : "transparent",
                  })}
                >
                  <AppText style={{ flex: 1, fontWeight: "600", fontSize: ty.body }}>{nameOf(e.exerciseId)}</AppText>
                  <View style={{ transform: [{ rotate: expandedExercise === `${di}:${e.exerciseId}` ? "90deg" : "0deg" }] }}>
                    <Icon name="chevron" color={p.muted} size={20} mirror />
                  </View>
                </Pressable>
                <IconButton
                  icon="trash"
                  color={p.danger}
                  label={t("prog.ex.removeButton", { exercise: nameOf(e.exerciseId) })}
                  onPress={() => confirmRemoveExercise(di, ei)}
                />
              </View>
              {expandedExercise === `${di}:${e.exerciseId}` ? (
                <View style={{ gap: space.md, paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.md }}>
                  <Stepper label={t("prog.ex.sets")} value={e.sets} min={1} max={12} onChange={(n) => props.onChange(updateExercise(d, di, ei, { sets: n }))} />
              {measureOf(e.exerciseId) === "reps" ? (
                <>
                  <Stepper label={t("prog.ex.repsFrom")} value={e.repMin} min={1} max={100} onChange={(n) => props.onChange(updateExercise(d, di, ei, { repMin: n, repMax: Math.max(e.repMax, n) }))} />
                  <Stepper label={t("prog.ex.repsTo")} value={e.repMax} min={e.repMin} max={100} onChange={(n) => props.onChange(updateExercise(d, di, ei, { repMax: n }))} />
                </>
              ) : (
                <>
                  <Stepper label={t(measureOf(e.exerciseId) === "time" ? "prog.ex.secFrom" : "prog.ex.metresFrom")} step={5} value={e.repMin} min={1} max={measureOf(e.exerciseId) === "time" ? 3600 : 5000} onChange={(n) => props.onChange(updateExercise(d, di, ei, { repMin: n, repMax: Math.max(e.repMax, n) }))} />
                  <Stepper label={t(measureOf(e.exerciseId) === "time" ? "prog.ex.secTo" : "prog.ex.metresTo")} step={5} value={e.repMax} min={e.repMin} max={measureOf(e.exerciseId) === "time" ? 3600 : 5000} onChange={(n) => props.onChange(updateExercise(d, di, ei, { repMax: n }))} />
                </>
              )}
              {props.onSetMeasure ? (
                <View style={{ gap: space.xs }}>
                  <AppText style={{ fontWeight: "600" }}>{t("prog.ex.countIn")}</AppText>
                  <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
                    {(["reps", "time", "distance"] as const).map((m) => (
                      <Chip key={m} label={t(`prog.ex.count.${m}` as never)} selected={measureOf(e.exerciseId) === m} onPress={() => void props.onSetMeasure!(e.exerciseId, m)} />
                    ))}
                  </View>
                </View>
              ) : null}
              {measureOf(e.exerciseId) !== "reps" ? null : <Field
                label={t("prog.ex.ceiling")}
                hint={t("prog.ex.ceilingHint")}
                numeric
                value={e.repCeiling === null ? "" : String(e.repCeiling)}
                onChangeText={(s) => {
                  const n = Number(s.replace(/[^\d]/g, ""));
                  props.onChange(updateExercise(d, di, ei, { repCeiling: s.trim() === "" || !Number.isFinite(n) || n < 1 ? null : Math.min(100, n) }));
                }}
              />}
              {measureOf(e.exerciseId) !== "reps" ? null : (
                <View style={{ gap: space.xs }}>
                  <AppText style={{ fontWeight: "600" }}>{t("prog.ex.scheme")}</AppText>
                  <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
                    <Chip label={t("prog.ex.scheme.straight")} selected={!e.topSets} onPress={() => props.onChange(updateExercise(d, di, ei, { topSets: null }))} />
                    <Chip label={t("prog.ex.scheme.top")} selected={!!e.topSets} onPress={() => props.onChange(updateExercise(d, di, ei, { topSets: e.topSets || 1 }))} />
                  </View>
                  {e.topSets ? <Stepper label={t("prog.ex.topSets")} value={e.topSets} min={1} max={Math.max(1, e.sets - 1)} onChange={(n) => props.onChange(updateExercise(d, di, ei, { topSets: n }))} /> : null}
                  <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("prog.ex.schemeHint")}</AppText>
                </View>
              )}
              {measureOf(e.exerciseId) !== "reps" ? null : (
                <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
                  <Chip label={t("prog.ex.goal")} selected={e.isGoalLift} onPress={() => props.onChange(updateExercise(d, di, ei, { isGoalLift: !e.isGoalLift }))} />
                  <Chip label={t("prog.ex.effort")} selected={e.trackEffort} onPress={() => props.onChange(updateExercise(d, di, ei, { trackEffort: !e.trackEffort }))} />
                </View>
              )}
              {props.gymEquipment && props.gymEquipment.length > 0 ? (
                <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
                  <Chip label={t("coach.sub.title")} onPress={() => setSwapFor({ day: di, index: ei, fatigue: false })} />
                </View>
              ) : null}
              {byId.get(e.exerciseId)?.equipment === "machine" && props.onSetMachineLoadKind ? (
                <View style={{ gap: space.xs }}>
                  <AppText style={{ fontWeight: "600" }}>{t("loads.machine.title")}</AppText>
                  <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
                    {(["pin", "plate"] as const).map(kind => (
                      <Chip key={kind} label={t(`loads.machine.${kind}`)} selected={byId.get(e.exerciseId)?.machineLoadKind === kind} onPress={() => void props.onSetMachineLoadKind!(e.exerciseId, kind)} />
                    ))}
                  </View>
                  {byId.get(e.exerciseId)?.machineLoadKind === "pin" ? (
                    <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
                      {([2.5, 5] as const).map(step => <Chip key={step} label={t("loads.machine.step", { step })} selected={byId.get(e.exerciseId)?.machinePinStep === step} onPress={() => void props.onSetMachineLoadKind!(e.exerciseId, "pin", step)} />)}
                    </View>
                  ) : null}
                  <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("loads.machine.hint")}</AppText>
                </View>
              ) : null}
              {props.onOpenLoads ? <BigButton variant="secondary" label={t("loads.open")} onPress={() => props.onOpenLoads!(e.exerciseId)} /> : null}
                </View>
              ) : null}
            </View>
          ))}
          <BigButton variant="secondary" icon="plus" label={t("prog.ex.add")} onPress={() => setPickerDay(di)} />
        </Card>
      ))}
      <BigButton variant="secondary" icon="plus" label={t("prog.day.add")} onPress={() => props.onChange(addDay(d, t("prog.day.default", { n: d.days.length + 1 }).replace(/[\u2066\u2069]/g, "")))} />
      {before && props.baseline ? <EffectView before={before} after={after} beforeDraft={props.baseline} afterDraft={d} nameOf={nameOf} /> : <ExposureView rows={after} />}
      {settingsDay !== null && d.days[settingsDay] ? <WorkoutSettingsModal
        day={d.days[settingsDay]!}
        nameOf={nameOf}
        onCancel={() => setSettingsDay(null)}
        onDone={(day) => {
          props.onChange({ ...d, days: d.days.map((original, i) => i === settingsDay ? day : original) });
          setSettingsDay(null);
        }}
      /> : null}
      <ExerciseReorderModal
        visible={reorderWorkouts}
        title={t("prog.workouts.reorder")}
        hint={t("prog.workouts.reorderHint")}
        items={d.days.map((day, i) => ({ id: String(i), name: day.name }))}
        onCancel={() => setReorderWorkouts(false)}
        onDone={(ids) => {
          setExpandedExercise(null);
          props.onChange(reorderDays(d, ids.map(Number)));
          setReorderWorkouts(false);
        }}
      />
      <ExerciseReorderModal
        visible={reorderDay !== null}
        items={reorderDay !== null ? (d.days[reorderDay]?.exercises ?? []).map((e) => ({ id: e.exerciseId, name: nameOf(e.exerciseId) })) : []}
        onCancel={() => setReorderDay(null)}
        onDone={(ids) => {
          if (reorderDay !== null) props.onChange(reorderExercises(props.draft, reorderDay, ids));
          setReorderDay(null);
        }}
      />
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
          if (pickerDay !== null) props.onChange(addExercise(d, pickerDay, newExerciseFor(id, measureOf(id))));
          setPickerDay(null);
        }}
      />
      <MenuSheet
        visible={swapFor !== null}
        title={swapCands.length === 0 ? t("coach.sub.none") : t("coach.sub.title")}
        onClose={() => setSwapFor(null)}
        items={
          swapFor
            ? [
                ...swapCands.map((c) => ({
                  label: nameOf(c.id),
                  onPress: () => props.onChange(swapExercise(d, swapFor.day, swapFor.index, c.id)),
                })),
                {
                  label: t("coach.sub.fatigue"),
                  selected: swapFor.fatigue,
                  onPress: () => {
                    const next = { ...swapFor, fatigue: !swapFor.fatigue };
                    setTimeout(() => setSwapFor(next), 0);
                  },
                },
                {
                  label: t("coach.sub.other"),
                  onPress: () => {
                    const pick = { day: swapFor.day, index: swapFor.index };
                    setTimeout(() => setSwapPick(pick), 0);
                  },
                },
              ]
            : []
        }
      />
      <ExercisePicker
        visible={swapPick !== null}
        exercises={props.library}
        exclude={swapPick !== null ? d.days[swapPick.day]?.exercises.map((e) => e.exerciseId) : []}
        onClose={() => setSwapPick(null)}
        onCreate={async (input) => {
          const id = await props.onCreateExercise(input);
          props.onLibraryChanged?.();
          return id;
        }}
        onPick={(id) => {
          if (swapPick) props.onChange(swapExercise(d, swapPick.day, swapPick.index, id));
          setSwapPick(null);
        }}
      />
    </View>
  );
}
