import React from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useI18n } from "../i18n";
import { useLogPalette } from "../theme";
import { AppText } from "../ui";

/**
 * The instruction paragraphs of the workout logger. They used to sit in the default view of every workout; now they live behind the
 * Help button so the screen shows only sets, targets and inputs.
 */
export function WorkoutHelp({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const p = useLogPalette();
  const keys = ["workout.help.target", "workout.setHint", "workout.superset.note", "workout.replace.note", "workout.add.note", "workout.finishNote"] as const;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: p.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28, gap: 10, maxHeight: "80%" }}>
          <AppText style={{ fontSize: 18, fontWeight: "800" }}>{t("workout.help.title")}</AppText>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={{ gap: 12 }}>
              {keys.map((k) => (
                <AppText key={k} style={{ fontSize: 15, color: p.muted }}>
                  {t(k)}
                </AppText>
              ))}
            </View>
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 52, borderRadius: 12, backgroundColor: p.fill, alignItems: "center", justifyContent: "center" }}>
            <AppText style={{ color: p.onFill, fontWeight: "800", fontSize: 16 }}>{t("common.close")}</AppText>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
