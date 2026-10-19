import React from "react";
import { StyleSheet, View } from "react-native";
import type { DataCounts } from "../../db/dataRepo";
import { useI18n } from "../../i18n";
import { isolateLtr } from "../../i18n/format";
import { space, usePalette } from "../../theme";
import { AppText, BigButton, Card, InlineStatus } from "../../ui";

interface VaultStatsHeroProps {
  counts: DataCounts | null;
  safetyCopy: boolean;
  restoreCopy: boolean;
  onExportJson: () => void;
  onExportCsv: () => void;
  onRestore: () => void;
}

export function VaultStatsHero({
  counts,
  safetyCopy,
  restoreCopy,
  onExportJson,
  onExportCsv,
  onRestore,
}: VaultStatsHeroProps) {
  const { t } = useI18n();
  const p = usePalette();

  const sessions = counts ? isolateLtr(String(counts.sessions)) : "-";
  const sets = counts ? isolateLtr(String(counts.sets)) : "-";
  const programmes = counts ? isolateLtr(String(counts.programmes)) : "-";
  const gyms = counts ? isolateLtr(String(counts.gyms)) : "-";

  return (
    <View style={styles.container}>
      {/* High-Density Vault Metrics Card */}
      <Card style={styles.heroCard}>
        <View style={styles.topRow}>
          <AppText style={[styles.kicker, { color: p.muted }]} accessibilityRole="header">
            {t("vault.hero.title")}
          </AppText>
        </View>

        <View style={styles.metricsGrid}>
          <View style={[styles.metricTile, { backgroundColor: p.card, borderColor: p.border }]}>
            <AppText style={[styles.metricNumber, { color: p.text }]}>{sessions}</AppText>
            <AppText style={[styles.metricLabel, { color: p.muted }]}>{t("vault.label.workouts")}</AppText>
          </View>
          <View style={[styles.metricTile, { backgroundColor: p.card, borderColor: p.border }]}>
            <AppText style={[styles.metricNumber, { color: p.text }]}>{sets}</AppText>
            <AppText style={[styles.metricLabel, { color: p.muted }]}>{t("vault.label.sets")}</AppText>
          </View>
          <View style={[styles.metricTile, { backgroundColor: p.card, borderColor: p.border }]}>
            <AppText style={[styles.metricNumber, { color: p.text }]}>{programmes}</AppText>
            <AppText style={[styles.metricLabel, { color: p.muted }]}>{t("vault.label.programmes")}</AppText>
          </View>
          <View style={[styles.metricTile, { backgroundColor: p.card, borderColor: p.border }]}>
            <AppText style={[styles.metricNumber, { color: p.text }]}>{gyms}</AppText>
            <AppText style={[styles.metricLabel, { color: p.muted }]}>{t("vault.label.gyms")}</AppText>
          </View>
        </View>

        {/* Safety Copies Indicator */}
        {safetyCopy || restoreCopy ? (
          <View style={styles.safetyRow}>
            <InlineStatus
              kind="info"
              text={safetyCopy ? t("data.safetyCopy") : t("data.restoreCopy")}
            />
          </View>
        ) : null}

        {/* Export & Restore Action Triggers */}
        <View style={styles.actionsContainer}>
          <BigButton
            label={t("data.exportJson")}
            variant="secondary"
            onPress={onExportJson}
          />
          <BigButton
            label={t("data.exportCsv")}
            variant="secondary"
            onPress={onExportCsv}
          />
          <BigButton
            label={t("data.restore")}
            variant="secondary"
            onPress={onRestore}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.md,
  },
  heroCard: {
    padding: space.lg,
    borderRadius: 16,
    gap: space.md,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  kicker: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  metricTile: {
    flex: 1,
    minWidth: 120,
    padding: space.md,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    gap: 4,
  },
  metricNumber: {
    fontSize: 20,
    fontWeight: "800",
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  safetyRow: {
    paddingTop: space.xs,
  },
  actionsContainer: {
    gap: space.sm,
    marginTop: space.xs,
  },
});
