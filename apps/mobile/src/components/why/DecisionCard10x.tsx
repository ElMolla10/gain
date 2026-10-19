import React from "react";
import { StyleSheet, View } from "react-native";
import type { DecisionListItem } from "../../db/decisionRepo";
import { useI18n } from "../../i18n";
import { exerciseLabels, isolateLtr } from "../../i18n/format";
import type { StringKey } from "../../i18n/strings";
import { formatDay } from "../../logic/dateText";
import { actionOf, hasNumber } from "../../logic/decisionText";
import { loadTargetText } from "../../logic/bidiText";
import { isTimed, targetQuantity } from "../../logic/quantity";
import { space, usePalette } from "../../theme";
import { AppText, BigButton, Card } from "../../ui";

interface DecisionCard10xProps {
  decision: DecisionListItem;
  sentence: string;
  onWhy: () => void;
  dateFormatted?: string;
}

export function DecisionCard10x({ decision: d, sentence, onWhy, dateFormatted }: DecisionCard10xProps) {
  const { t, lang, unit, fmt } = useI18n();
  const p = usePalette();
  const a = actionOf(d);

  // Target text
  const targetStr = hasNumber(d)
    ? isTimed(d.measure)
      ? t("dec.targetTimed", {
          q: loadTargetText(d.load!, targetQuantity(d, d.measure)!, d.measure, lang, unit, {
            s: t("qty.s"),
            m: t("qty.m"),
          }),
        })
      : t("dec.target", { load: fmt(d.load!), reps: isolateLtr(String(d.reps)) })
    : t("dec.noTarget");

  // Lifter action status
  const actionText = t(a.key as StringKey, a.editedLoad !== null ? { load: fmt(a.editedLoad) } : undefined);
  let actionIcon = "✓";
  if (a.key.includes("edited")) actionIcon = "✎";
  else if (a.key.includes("declined") || a.key.includes("skipped")) actionIcon = "✕";

  return (
    <Card style={styles.card}>
      {/* Date & Training Day Header */}
      <View style={styles.headerRow}>
        <AppText style={[styles.dateText, { color: p.muted }]}>{dateFormatted ?? formatDay(d.decidedAt, lang)}</AppText>
        <View style={[styles.dayBadge, { backgroundColor: p.card, borderColor: p.border }]}>
          <AppText style={[styles.dayText, { color: p.text }]}>{t("dec.for", { day: d.dayName })}</AppText>
        </View>
      </View>

      {/* Exercise Primary Name & Action */}
      <View style={styles.nameRow}>
        <AppText style={[styles.exerciseName, { color: p.text }]} accessibilityRole="header">
          {exerciseLabels(d, lang).primary}
        </AppText>
        <View style={[styles.actionBadge, { backgroundColor: p.card, borderColor: p.border }]}>
          <AppText style={styles.actionIcon}>{actionIcon}</AppText>
          <AppText style={[styles.actionText, { color: p.text }]}>{actionText}</AppText>
        </View>
      </View>

      {/* Target Pill */}
      <View style={[styles.targetBox, { backgroundColor: p.card, borderColor: p.border }]}>
        <AppText style={[styles.targetLabel, { color: p.text }]}>{targetStr}</AppText>
      </View>

      {/* Reason sentence quote */}
      <View style={[styles.reasonBox, { borderStartColor: p.border, backgroundColor: p.card }]}>
        <AppText style={[styles.reasonText, { color: p.muted }]}>{sentence}</AppText>
      </View>

      {/* Engine rule & confidence */}
      <View style={styles.metaRow}>
        <AppText style={[styles.metaText, { color: p.muted }]}>
          {t("dec.rule", {
            version: d.ruleVersion,
            path: t(`dec.path.${d.path === "model" ? "model" : "rule"}` as StringKey),
          })}{" "}
          · {t("dec.confidence", { c: t(`why.confidence.${d.confidence}` as StringKey) })}
        </AppText>
      </View>

      {/* Why action button */}
      <BigButton label={t("dec.why")} variant="secondary" onPress={onWhy} />
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
  },
  dateText: {
    fontSize: 13,
    fontWeight: "600",
  },
  dayBadge: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  dayText: {
    fontSize: 13,
    fontWeight: "600",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: space.xs,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: "700",
    flex: 1,
  },
  actionBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  actionIcon: {
    fontSize: 13,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "700",
  },
  targetBox: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: 10,
    borderWidth: 1,
  },
  targetLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  reasonBox: {
    borderStartWidth: 3,
    paddingStart: space.sm,
    paddingVertical: space.xs,
  },
  reasonText: {
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    paddingTop: 2,
  },
  metaText: {
    fontSize: 13,
  },
});
