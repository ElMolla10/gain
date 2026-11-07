import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useI18n } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import type { LibraryGroup } from "../../db/library/types";
import {
  RANKABLE_MUSCLES,
  rankOf,
  type MusclePriorities,
  type MuscleRank,
} from "../../logic/musclePriority";
import { MIN_TOUCH, radius, space, type as ty, usePalette } from "../../theme";
import { AppText, Card } from "../../ui";

export interface MusclePriorityGridProps {
  priorities: MusclePriorities;
  onSetRank: (group: LibraryGroup, rank: MuscleRank) => void;
}

export function MusclePriorityGrid({ priorities, onSetRank }: MusclePriorityGridProps) {
  const { t } = useI18n();
  const p = usePalette();

  return (
    <Card style={styles.card}>
      {RANKABLE_MUSCLES.map((g, i) => {
        const currentRank = rankOf(priorities, g);
        const isPriority = currentRank === "priority";
        const isLast = i === RANKABLE_MUSCLES.length - 1;
        const muscleTitle = t(`muscle.${g}` as StringKey);
        const toggleLabel = t("coach.priority.toggle");

        return (
          <View
            key={g}
            style={[
              styles.row,
              { borderBottomColor: p.border, borderBottomWidth: isLast ? 0 : 1 },
            ]}
          >
            <AppText style={[styles.muscleName, { color: p.text }]} accessibilityRole="header">
              {muscleTitle}
            </AppText>

            <Pressable
              accessibilityRole="switch"
              accessibilityLabel={`${muscleTitle}, ${toggleLabel}`}
              accessibilityState={{ checked: isPriority }}
              accessibilityHint={t("coach.priority.note")}
              onPress={() => onSetRank(g, isPriority ? "normal" : "priority")}
              hitSlop={8}
              style={({ pressed }) => [
                styles.toggle,
                {
                  backgroundColor: isPriority ? p.tint : "transparent",
                  borderColor: isPriority ? p.accent : p.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <AppText
                style={[
                  styles.toggleText,
                  {
                    color: isPriority ? p.accent : p.muted,
                    fontWeight: isPriority ? "700" : "500",
                  },
                ]}
              >
                {toggleLabel}
              </AppText>
            </Pressable>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  row: {
    minHeight: MIN_TOUCH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.sm,
    gap: space.md,
  },
  muscleName: {
    fontSize: ty.body,
    fontWeight: "600",
    flex: 1,
  },
  toggle: {
    minHeight: 34,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
  },
  toggleText: {
    fontSize: ty.label,
  },
});
