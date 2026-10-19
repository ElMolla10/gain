import React from "react";
import { StyleSheet, View } from "react-native";
import { useI18n } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import {
  MUSCLE_RANKS,
  RANKABLE_MUSCLES,
  rankOf,
  type MusclePriorities,
  type MuscleRank,
} from "../../logic/musclePriority";
import { space, usePalette } from "../../theme";
import { AppText, Card, Chip } from "../../ui";

interface MusclePriorityGridProps {
  priorities: MusclePriorities;
  onSetRank: (group: (typeof RANKABLE_MUSCLES)[number], rank: MuscleRank) => void;
}

export function MusclePriorityGrid({ priorities, onSetRank }: MusclePriorityGridProps) {
  const { t } = useI18n();
  const p = usePalette();

  // Compute summary stats
  let priorityCount = 0;
  let maintenanceCount = 0;
  let normalCount = 0;

  for (const g of RANKABLE_MUSCLES) {
    const r = rankOf(priorities, g);
    if (r === "priority") priorityCount++;
    else if (r === "maintenance" || r === "reduced") maintenanceCount++;
    else normalCount++;
  }

  const rankBadgeText = (r: MuscleRank) => {
    switch (r) {
      case "priority":
        return `🔥 ${t("coach.rank.priority")}`;
      case "maintenance":
        return `🛡️ ${t("coach.rank.maintenance")}`;
      case "reduced":
        return `💤 ${t("coach.rank.reduced")}`;
      default:
        return `⚡ ${t("coach.rank.normal")}`;
    }
  };

  return (
    <View style={styles.container}>
      {/* Overview Stat Chip */}
      <View style={[styles.summaryCard, { backgroundColor: p.card, borderColor: p.border }]}>
        <AppText style={[styles.summaryText, { color: p.text }]}>
          {t("coach.priority.summary", {
            p: priorityCount,
            m: maintenanceCount,
            b: normalCount,
          })}
        </AppText>
      </View>

      {/* Muscle List */}
      {RANKABLE_MUSCLES.map((g) => {
        const currentRank = rankOf(priorities, g);
        return (
          <Card key={g} style={styles.muscleCard}>
            <View style={styles.headerRow}>
              <AppText style={[styles.muscleName, { color: p.text }]} accessibilityRole="header">
                {t(`muscle.${g}` as StringKey)}
              </AppText>
              <View style={[styles.rankBadge, { backgroundColor: p.card, borderColor: p.border }]}>
                <AppText style={[styles.rankBadgeText, { color: p.text }]}>
                  {rankBadgeText(currentRank)}
                </AppText>
              </View>
            </View>

            {/* Tactile 4-State Ranks */}
            <View style={styles.chipsRow}>
              {MUSCLE_RANKS.map((r) => (
                <Chip
                  key={r}
                  label={t(`coach.rank.${r}` as StringKey)}
                  selected={currentRank === r}
                  onPress={() => onSetRank(g, r)}
                />
              ))}
            </View>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.md,
  },
  summaryCard: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  summaryText: {
    fontSize: 14,
    fontWeight: "700",
  },
  muscleCard: {
    padding: space.md,
    borderRadius: 16,
    gap: space.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  muscleName: {
    fontSize: 16,
    fontWeight: "700",
  },
  rankBadge: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  rankBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
});
