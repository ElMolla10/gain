import React from "react";
import { StyleSheet, View } from "react-native";
import { REJECTION_THRESHOLD } from "@gain/engine";
import type { StoppedSuggestion } from "../../db/rejectionRepo";
import { useI18n } from "../../i18n";
import { exerciseLabels } from "../../i18n/format";
import { jumpKindText } from "../../logic/jumpText";
import { space, usePalette } from "../../theme";
import { AppText, BigButton, Card, InlineStatus } from "../../ui";

interface StoppedSuggestionCard10xProps {
  item: StoppedSuggestion;
  onBringBack: () => Promise<void> | void;
}

export function StoppedSuggestionCard10x({ item: it, onBringBack }: StoppedSuggestionCard10xProps) {
  const { t, lang, unit } = useI18n();
  const p = usePalette();

  const lastDateIso = new Date(it.lastRejectedAt).toISOString().slice(0, 10);

  return (
    <Card style={styles.card}>
      {/* Top row: Exercise Name & Status */}
      <View style={styles.headerRow}>
        <AppText style={[styles.exerciseName, { color: p.text }]} accessibilityRole="header">
          {exerciseLabels(it, lang).primary}
        </AppText>
        <InlineStatus
          kind={it.blocked ? "warn" : "info"}
          text={it.blocked ? t("stop.stopped") : t("stop.counting", { count: it.count, max: REJECTION_THRESHOLD })}
        />
      </View>

      {/* Jump Kind Title */}
      <View style={[styles.jumpKindBox, { backgroundColor: p.card, borderColor: p.border }]}>
        <AppText style={[styles.jumpKindText, { color: p.text }]}>
          {jumpKindText(it.jumpKind, unit, t as never)}
        </AppText>
      </View>

      {/* Rejection date & autonomy info */}
      <View style={styles.infoRow}>
        <AppText style={[styles.dateText, { color: p.muted }]}>
          {t("stop.last", { date: lastDateIso })}
        </AppText>
      </View>

      {/* Restore Button */}
      <BigButton label={t("stop.bringBack")} variant="secondary" onPress={onBringBack} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space.md,
    borderRadius: 16,
    gap: space.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: space.xs,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  jumpKindBox: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: 10,
    borderWidth: 1,
  },
  jumpKindText: {
    fontSize: 18,
    fontWeight: "700",
  },
  infoRow: {
    paddingVertical: 2,
  },
  dateText: {
    fontSize: 13,
  },
});
