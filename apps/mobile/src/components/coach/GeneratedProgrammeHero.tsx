import React from "react";
import { StyleSheet, View } from "react-native";
import type { LibraryExercise } from "../../db/programmeRepo";
import { useI18n } from "../../i18n";
import { exerciseLabels, isolateLtr } from "../../i18n/format";
import type { GeneratedProgramme } from "../../logic/programGenerator";
import { space, type as ty, usePalette } from "../../theme";
import { AppText, BigButton, Card } from "../../ui";

interface GeneratedProgrammeHeroProps {
  preview: GeneratedProgramme;
  library: LibraryExercise[];
  minutes: number;
  busy: boolean;
  onSave: () => Promise<void> | void;
}

export function GeneratedProgrammeHero({
  preview,
  library,
  minutes,
  busy,
  onSave,
}: GeneratedProgrammeHeroProps) {
  const { t, lang } = useI18n();
  const p = usePalette();

  const totalExercises = preview.draft.days.reduce((acc, d) => acc + d.exercises.length, 0);
  const totalWeeklySets = preview.draft.days.reduce(
    (acc, d) => acc + d.exercises.reduce((n, e) => n + e.sets, 0),
    0
  );

  return (
    <View style={styles.container}>
      {/* Blueprint Hero Card */}
      <Card style={styles.heroCard}>
        <View style={styles.topRow}>
          <AppText style={[styles.kicker, { color: p.muted }]} accessibilityRole="header">
            {t("coach.blueprint.title")}
          </AppText>
        </View>

        <AppText style={[styles.title, { color: p.text }]} accessibilityRole="header">
          {preview.draft.name}
        </AppText>

        <View style={styles.statsRow}>
          <View style={[styles.statBadge, { backgroundColor: p.card, borderColor: p.border }]}>
            <AppText style={[styles.statText, { color: p.text }]}>
              {isolateLtr(String(preview.draft.days.length))} {t("coach.days")}
            </AppText>
          </View>
          <View style={[styles.statBadge, { backgroundColor: p.card, borderColor: p.border }]}>
            <AppText style={[styles.statText, { color: p.text }]}>
              {isolateLtr(String(totalExercises))} movements
            </AppText>
          </View>
          <View style={[styles.statBadge, { backgroundColor: p.card, borderColor: p.border }]}>
            <AppText style={[styles.statText, { color: p.text }]}>
              {isolateLtr(String(totalWeeklySets))} weekly sets
            </AppText>
          </View>
        </View>

        {/* Days Breakdown */}
        <View style={styles.daysList}>
          {preview.draft.days.map((day, i) => {
            const daySets = day.exercises.reduce((n, e) => n + e.sets, 0);
            return (
              <View
                key={i}
                style={[
                  styles.dayCard,
                  { backgroundColor: p.card, borderColor: p.border },
                ]}
              >
                <View style={styles.dayHeader}>
                  <AppText style={[styles.dayName, { color: p.text }]}>{day.name}</AppText>
                  <AppText style={[styles.dayMeta, { color: p.muted }]}>
                    {isolateLtr(String(day.exercises.length))} exercises · {isolateLtr(String(daySets))} sets
                  </AppText>
                </View>
              </View>
            );
          })}
        </View>

        {/* Dropped / Omitted Movements Rationale */}
        {preview.dropped.length > 0 ? (
          <View style={styles.droppedSection}>
            <AppText style={[styles.droppedTitle, { color: p.text }]} accessibilityRole="header">
              {t("ob.programme.dropped")}
            </AppText>
            {preview.dropped.map((d, i) => {
              const ex = library.find((e) => e.seedKey === d.key);
              const lift = ex ? exerciseLabels(ex, lang).primary : d.key;
              const line =
                d.reason === "avoid"
                  ? t("coach.dropped.avoid", { day: d.day, lift })
                  : d.reason === "equipment"
                    ? t("ob.programme.droppedEquipment", { day: d.day, lift })
                    : t("ob.programme.droppedTime", { day: d.day, lift, n: minutes });
              return (
                <View key={i} style={styles.droppedRow}>
                  <AppText style={[styles.droppedText, { color: p.muted }]}>• {line}</AppText>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Save CTA */}
        <BigButton
          hero
          label={busy ? t("coach.creating") : t("coach.blueprint.launch")}
          disabled={busy}
          onPress={onSave}
        />
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
  title: {
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 28,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  statBadge: {
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statText: {
    fontSize: 13,
    fontWeight: "700",
  },
  daysList: {
    gap: space.xs,
    marginTop: space.xs,
  },
  dayCard: {
    padding: space.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: space.xs,
  },
  dayName: {
    fontSize: 14,
    fontWeight: "700",
  },
  dayMeta: {
    fontSize: 13,
  },
  droppedSection: {
    gap: space.xs,
    paddingTop: space.xs,
  },
  droppedTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  droppedRow: {
    paddingVertical: 2,
  },
  droppedText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
