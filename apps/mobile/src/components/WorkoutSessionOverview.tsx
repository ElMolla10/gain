import React, { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../i18n";
import { isolateLtr } from "../i18n/format";
import { space, radius, useLogPalette } from "../theme";
import { AppText, BigButton, IconButton, QuietAction } from "../ui";
import { Icon } from "./Icon";

export interface SessionOverviewExercise { id: string; name: string; done: number; total: number }
/** Complete active-session navigation. Mutations remain owned by the existing session handlers. */
export function WorkoutSessionOverview({ visible, exercises, activeId, onJump, onRemove, onAdd, onReorder, onClose, onDismiss, children }: {
  visible: boolean; exercises: SessionOverviewExercise[]; activeId: string | null;
  onJump: (id: string) => void; onRemove: (id: string) => void; onAdd: () => void; onReorder: () => void;
  onClose: () => void; onDismiss: () => void; children?: React.ReactNode;
}) {
  const { t } = useI18n(), p = useLogPalette(), insets = useSafeAreaInsets();
  const [settings, setSettings] = useState(false);
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose} onDismiss={onDismiss}>
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top + space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingStart: space.lg, paddingEnd: space.xs, gap: space.sm }}>
        <AppText accessibilityRole="header" style={{ flex: 1, fontSize: 28, fontWeight: "600" }}>{t("workout.details")}</AppText>
        <IconButton icon="close" label={t("workout.current.back")} onPress={onClose} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: space.lg, columnGap: space.lg }}>
        <QuietAction icon="plus" label={t("workout.add.button")} onPress={onAdd} />
        {exercises.length > 1 ? <QuietAction icon="drag" label={t("workout.reorder.button")} onPress={onReorder} /> : null}
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.sm }} keyboardShouldPersistTaps="handled">
        {exercises.map((ex, i) => <View key={ex.id} style={{ flexDirection: "row", alignItems: "center", borderRadius: radius.card, borderWidth: activeId === ex.id ? 2 : 1, borderColor: activeId === ex.id ? p.accent : p.line, backgroundColor: activeId === ex.id ? p.activeBg : p.card }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${i + 1}. ${ex.name}. ${t("rack.setsOf", { x: ex.done, y: ex.total })}`} accessibilityState={{ selected: activeId === ex.id }} onPress={() => onJump(ex.id)} style={({ pressed }) => ({ flex: 1, minHeight: 72, padding: space.md, flexDirection: "row", gap: space.md, alignItems: "center", opacity: pressed ? 0.7 : 1 })}>
            <AppText ltr style={{ color: p.muted, fontSize: 16 }}>{isolateLtr(String(i + 1))}</AppText>
            <View style={{ flex: 1, gap: space.xs }}>
              <AppText style={{ fontSize: 17, fontWeight: "600" }}>{ex.name}</AppText>
              <AppText style={{ color: p.muted, fontSize: 14 }}>{t("rack.setsOf", { x: ex.done, y: ex.total })}</AppText>
            </View>
            <Icon name={ex.done >= ex.total && ex.total > 0 ? "check" : "chevron"} size={18} color={p.muted} mirror />
          </Pressable>
          <IconButton icon="close" label={`${t("workout.menu.remove")}: ${ex.name}`} color={p.muted} onPress={() => onRemove(ex.id)} />
        </View>)}
        <QuietAction label={t("workout.current.settings")} expanded={settings} onPress={() => setSettings(!settings)} />
        {settings ? children : null}
      </ScrollView>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: insets.bottom + space.sm }}>
        <BigButton variant="secondary" label={t("workout.current.back")} onPress={onClose} />
      </View>
    </View>
  </Modal>;
}
