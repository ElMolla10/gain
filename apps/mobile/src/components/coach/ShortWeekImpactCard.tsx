import React from "react";
import { StyleSheet, View } from "react-native";
import type { ActiveShortWeek, ShortWeekPreview } from "../../db/shortWeekRepo";
import { useI18n } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import { FLOOR_SESSIONS, FLOOR_SETS, type Cut } from "../../logic/shortWeek";
import { space, usePalette } from "../../theme";
import { AppText, BigButton, Card, InlineStatus } from "../../ui";

interface ShortWeekImpactCardProps {
  preview: ShortWeekPreview | null;
  minutes: number | null;
  active: ActiveShortWeek | null;
  nameOf: (id?: string) => string;
  onApply: () => Promise<void> | void;
  onUndo: () => Promise<void> | void;
}

export function ShortWeekImpactCard({
  preview,
  minutes,
  active,
  nameOf,
  onApply,
  onUndo,
}: ShortWeekImpactCardProps) {
  const { t } = useI18n();
  const p = usePalette();

  const cutText = (c: Cut) => {
    const base =
      c.kind === "day_dropped"
        ? t("short.cut.day_dropped", { day: c.day })
        : c.kind === "exercise_removed"
          ? t("short.cut.exercise_removed", { day: c.day, name: nameOf(c.exerciseId), sets: c.fromSets ?? 0 })
          : c.kind === "sets_reduced"
            ? t("short.cut.sets_reduced", { day: c.day, name: nameOf(c.exerciseId), from: c.fromSets ?? 0, to: c.toSets ?? 0 })
            : t("short.cut.moved", { day: c.day, name: nameOf(c.exerciseId), toDay: c.toDay ?? "" });
    return `${base} (${t(`short.reason.${c.reason}` as StringKey)})`;
  };

  return (
    <View style={styles.container}>
      {/* Active Short Week Hero Banner */}
      {active ? (
        <Card style={styles.activeCard}>
          <View style={styles.activeTopRow}>
            <AppText style={[styles.activeKicker, { color: p.muted }]} accessibilityRole="header">
              {t("short.active.title")}
            </AppText>
          </View>
          <AppText style={[styles.activeText, { color: p.text }]}>
            {t("short.active", { days: active.days })}
          </AppText>
          <BigButton label={t("short.restore.btn")} variant="secondary" onPress={onUndo} />
        </Card>
      ) : null}

      {/* Preview Section */}
      {preview ? (
        <>
          {/* Kept Rotation Card */}
          <Card style={styles.card}>
            <AppText style={[styles.sectionTitle, { color: p.text }]} accessibilityRole="header">
              {t("short.kept.title")}
            </AppText>

            <View style={styles.dayList}>
              {preview.rebuild.draft.days.map((d, i) => {
                const totalSets = d.exercises.reduce((acc, e) => acc + e.sets, 0);
                const estMin = preview.rebuild.minutes[i] ?? 0;
                return (
                  <View
                    key={i}
                    style={[
                      styles.dayRow,
                      { backgroundColor: p.card, borderColor: p.border },
                    ]}
                  >
                    <View style={styles.dayInfo}>
                      <AppText style={[styles.dayName, { color: p.text }]}>{d.name}</AppText>
                    </View>
                    <View style={styles.badgesRow}>
                      <View style={[styles.miniBadge, { backgroundColor: p.card, borderColor: p.border }]}>
                        <AppText style={[styles.miniBadgeText, { color: p.muted }]}>
                          {totalSets} sets
                        </AppText>
                      </View>
                      <View style={[styles.miniBadge, { backgroundColor: p.card, borderColor: p.border }]}>
                        <AppText style={[styles.miniBadgeText, { color: p.muted }]}>
                          ~{estMin} min
                        </AppText>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {preview.rebuild.overBudget && minutes !== null ? (
              <InlineStatus kind="warn" text={t("short.overBudget", { min: minutes })} />
            ) : null}

            {preview.rebuild.floorMissed.length > 0 ? (
              <InlineStatus
                kind="warn"
                text={t("short.floorMissed", {
                  muscles: preview.rebuild.floorMissed.map((m) => t(`muscle.${m}` as StringKey)).join(", "),
                })}
              />
            ) : null}

            <AppText style={[styles.protectedNote, { color: p.muted }]}>
              {t("short.protected", { sets: FLOOR_SETS, sessions: FLOOR_SESSIONS })}
            </AppText>
          </Card>

          {/* Cuts & Consolidation List */}
          <Card style={styles.card}>
            <AppText style={[styles.sectionTitle, { color: p.text }]} accessibilityRole="header">
              {t("short.cuts")}
            </AppText>
            {preview.rebuild.cuts.length === 0 ? (
              <AppText style={{ color: p.muted }}>{t("short.cuts.none")}</AppText>
            ) : (
              <View style={styles.cutsList}>
                {preview.rebuild.cuts.map((c, i) => (
                  <View
                    key={i}
                    style={[
                      styles.cutRow,
                      i < preview.rebuild.cuts.length - 1 ? { borderBottomColor: p.border, borderBottomWidth: StyleSheet.hairlineWidth } : null,
                    ]}
                  >
                    <AppText style={[styles.cutText, { color: p.text }]}>• {cutText(c)}</AppText>
                  </View>
                ))}
              </View>
            )}
          </Card>

          {/* Muscle Exposure Shift Matrix */}
          {preview.exposure.length > 0 ? (
            <Card style={styles.card}>
              <AppText style={[styles.sectionTitle, { color: p.text }]} accessibilityRole="header">
                {t("short.exposure")}
              </AppText>
              <View style={styles.exposureList}>
                {preview.exposure.map((c) => {
                  const beforeSets = c.before?.setsPerWeek ?? c.before?.setsPerRotation ?? 0;
                  const afterSets = c.after?.setsPerWeek ?? c.after?.setsPerRotation ?? 0;
                  const sb = c.before?.sessionsPerWeek ?? 0;
                  const sa = c.after?.sessionsPerWeek ?? 0;
                  return (
                    <View key={c.group} style={[styles.exposureRow, { borderColor: p.border }]}>
                      <AppText style={[styles.muscleName, { color: p.text }]}>
                        {t(`muscle.${c.group}` as StringKey)}
                      </AppText>
                      <AppText style={[styles.exposureData, { color: p.muted }]}>
                        {t("short.exposureLine", {
                          muscle: "",
                          before: beforeSets,
                          after: afterSets,
                          sb,
                          sa,
                        }).trim()}
                      </AppText>
                    </View>
                  );
                })}
              </View>
            </Card>
          ) : null}

          {/* Apply Button */}
          {!active ? (
            <BigButton hero label={t("short.apply")} onPress={onApply} />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.md,
  },
  activeCard: {
    padding: space.md,
    borderRadius: 16,
    gap: space.sm,
  },
  activeTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  activeKicker: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  activeText: {
    fontSize: 16,
    fontWeight: "700",
  },
  card: {
    padding: space.md,
    borderRadius: 16,
    gap: space.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  dayList: {
    gap: space.xs,
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: 10,
    borderWidth: 1,
  },
  dayInfo: {
    flex: 1,
  },
  dayName: {
    fontSize: 14,
    fontWeight: "600",
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  miniBadge: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  miniBadgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  protectedNote: {
    fontSize: 13,
  },
  cutsList: {
    gap: space.xs,
  },
  cutRow: {
    paddingVertical: space.xs,
  },
  cutText: {
    fontSize: 14,
    lineHeight: 20,
  },
  exposureList: {
    gap: space.xs,
  },
  exposureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.xs,
  },
  muscleName: {
    fontSize: 14,
    fontWeight: "600",
  },
  exposureData: {
    fontSize: 13,
  },
});
