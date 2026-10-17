import React, { useState } from "react";
import { Modal, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../i18n";
import { MAX_SETS, updateExercise, type DraftDay } from "../logic/programmeDraft";
import { space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Stepper } from "../ui";

/** One workout's working-set counts. Cancel discards edits; Done updates the program draft. */
export function WorkoutSettingsModal(props: {
  day: DraftDay;
  nameOf: (id: string) => string;
  onCancel: () => void;
  onDone: (day: DraftDay) => void;
}) {
  const { t } = useI18n();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [day, setDay] = useState(() => props.day);
  return (
    <Modal visible animationType="slide" onRequestClose={props.onCancel} {...(Platform.OS === "ios" ? { presentationStyle: "pageSheet" as const, allowSwipeDismissal: true } : {})}>
      <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: Platform.OS === "ios" ? 0 : insets.top }}>
        <View style={{ padding: space.lg, gap: space.sm }}>
          <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600" }}>{t("prog.workout.settings", { workout: day.name })}</AppText>
          <AppText style={{ color: p.muted }}>{t("prog.workout.setsHint")}</AppText>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md }}>
          {day.exercises.map((exercise, i) => (
            <View key={exercise.exerciseId} style={{ gap: space.sm, borderTopWidth: 1, borderColor: p.border, paddingTop: space.md }}>
              <Stepper label={`${props.nameOf(exercise.exerciseId)} · ${t("prog.ex.sets")}`} value={exercise.sets} min={1} max={MAX_SETS}
                onChange={(sets) => setDay(current => updateExercise({ name: "", days: [current] }, 0, i, { sets }).days[0]!)} />
            </View>
          ))}
        </ScrollView>
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: insets.bottom + space.md, gap: space.sm, borderTopWidth: 1, borderColor: p.border }}>
          <BigButton label={t("prog.reorder.done")} onPress={() => props.onDone(day)} />
          <BigButton variant="quiet" label={t("prog.reorder.cancel")} onPress={props.onCancel} />
        </View>
      </View>
    </Modal>
  );
}
