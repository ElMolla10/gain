import React from "react";
import { StyleSheet, View } from "react-native";
import type { BatchInfo, ImportPreview } from "../../db/importRepo";
import type { ImportParse } from "@gain/engine";
import { useI18n } from "../../i18n";
import { isolateLtr } from "../../i18n/format";
import type { StringKey } from "../../i18n/strings";
import { formatDay } from "../../logic/dateText";
import { dateRange } from "../../logic/importFlow";
import { space, usePalette } from "../../theme";
import { AppText, BigButton, Card, InlineStatus } from "../../ui";

interface ImportBatchHeroProps {
  parsed: { name: string; parse: ImportParse } | null;
  preview: ImportPreview | null;
  heaviestKg: number | null;
  batches: BatchInfo[];
  onPickFile: () => void;
  onUndoBatch: (batch: BatchInfo) => void;
  busy: boolean;
}

export function ImportBatchHero({
  parsed,
  preview,
  heaviestKg,
  batches,
  onPickFile,
  onUndoBatch,
  busy,
}: ImportBatchHeroProps) {
  const { t, fmt, lang } = useI18n();
  const p = usePalette();

  return (
    <View style={styles.container}>
      {/* Staged File Card */}
      {parsed ? (
        <Card style={styles.card}>
          <View style={styles.topRow}>
            <AppText style={[styles.kicker, { color: p.muted }]} accessibilityRole="header">
              {t("vault.import.staged")}
            </AppText>
            <View style={[styles.sourceBadge, { backgroundColor: p.card, borderColor: p.border }]}>
              <AppText style={[styles.sourceText, { color: p.text }]}>
                {t(`import.source.${parsed.parse.source}` as StringKey)}
              </AppText>
            </View>
          </View>

          <AppText ltr style={[styles.fileName, { color: p.text }]} accessibilityRole="header">
            {parsed.name}
          </AppText>

          {/* Preview metrics */}
          {preview ? (
            <View style={styles.metricsRow}>
              <View style={[styles.statBadge, { backgroundColor: p.card, borderColor: p.border }]}>
                <AppText style={[styles.statNumber, { color: p.text }]}>
                  {isolateLtr(String(preview.newWorkouts))}
                </AppText>
                <AppText style={[styles.statLabel, { color: p.muted }]}>{t("vault.label.workouts")}</AppText>
              </View>
              <View style={[styles.statBadge, { backgroundColor: p.card, borderColor: p.border }]}>
                <AppText style={[styles.statNumber, { color: p.text }]}>
                  {isolateLtr(String(preview.newSets))}
                </AppText>
                <AppText style={[styles.statLabel, { color: p.muted }]}>{t("vault.label.sets")}</AppText>
              </View>
            </View>
          ) : null}

          {preview?.firstDate && preview?.lastDate ? (
            <AppText style={[styles.rangeText, { color: p.muted }]}>
              {t("import.preview.range", {
                range: dateRange(preview.firstDate, preview.lastDate),
              })}
            </AppText>
          ) : null}

          {heaviestKg !== null ? (
            <AppText style={[styles.heavyText, { color: p.muted }]}>
              {t("import.preview.heaviest", { load: fmt(heaviestKg) })}
            </AppText>
          ) : null}

          {preview && preview.duplicateWorkouts > 0 ? (
            <InlineStatus
              kind="info"
              text={t("import.preview.duplicates", { n: preview.duplicateWorkouts })}
            />
          ) : null}
        </Card>
      ) : null}

      {/* Import History Batches */}
      {batches.length > 0 ? (
        <Card style={styles.card}>
          <AppText style={[styles.sectionTitle, { color: p.text }]} accessibilityRole="header">
            {t("import.history.title")}
          </AppText>
          <View style={styles.batchesList}>
            {batches.map((b) => (
              <View
                key={b.id}
                style={[
                  styles.batchRow,
                  { backgroundColor: p.card, borderColor: p.border },
                ]}
              >
                <View style={styles.batchInfo}>
                  <AppText style={[styles.batchTitle, { color: p.text }]}>
                    {t("import.history.row", {
                      source: t(`import.source.${b.source}` as StringKey),
                      workouts: b.workouts,
                      sets: b.sets,
                    })}
                  </AppText>
                  <AppText style={[styles.batchDate, { color: p.muted }]}>
                    {formatDay(b.createdAt, lang)}
                    {b.fileName ? ` · ${isolateLtr(b.fileName)}` : ""}
                  </AppText>
                </View>
                <BigButton
                  label={t("import.undo")}
                  variant="secondary"
                  disabled={busy}
                  onPress={() => onUndoBatch(b)}
                />
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.md,
  },
  card: {
    padding: space.lg,
    borderRadius: 16,
    gap: space.md,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kicker: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sourceBadge: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  sourceText: {
    fontSize: 13,
    fontWeight: "700",
  },
  fileName: {
    fontSize: 17,
    fontWeight: "700",
  },
  metricsRow: {
    flexDirection: "row",
    gap: space.sm,
  },
  statBadge: {
    flex: 1,
    padding: space.sm,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    gap: 2,
  },
  statNumber: {
    fontSize: 17,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  rangeText: {
    fontSize: 13,
  },
  heavyText: {
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  batchesList: {
    gap: space.sm,
  },
  batchRow: {
    padding: space.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: space.sm,
  },
  batchInfo: {
    gap: 2,
  },
  batchTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  batchDate: {
    fontSize: 13,
  },
});
