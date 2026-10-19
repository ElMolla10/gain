import React from "react";
import { StyleSheet, View } from "react-native";
import { useI18n } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import { space, usePalette } from "../../theme";
import { AppText, Card } from "../../ui";
import type { WhySection } from "../../logic/why";

interface EngineReasoningCardProps {
  sections: WhySection[];
}

export function EngineReasoningCard({ sections }: EngineReasoningCardProps) {
  const { t } = useI18n();
  const p = usePalette();

  const sentenceSection = sections.find((s) => s.title === t("why.sentence"));
  const primarySentence = sentenceSection?.lines[0] ?? "";
  const engineReason = sentenceSection?.lines[1] ?? "";
  const extraDetails = sentenceSection?.lines.slice(2) ?? [];

  // Determine action classification
  let actionKey: StringKey = "why.action.planned";
  let actionIcon = "⭐";
  const lowerSentence = primarySentence.toLowerCase();
  if (lowerSentence.includes("increase") || lowerSentence.includes("زيادة")) {
    actionKey = "why.action.advance";
    actionIcon = "⬆️";
  } else if (lowerSentence.includes("decrease") || lowerSentence.includes("fatigued") || lowerSentence.includes("تخفيف") || lowerSentence.includes("استشفاء")) {
    actionKey = "why.action.deload";
    actionIcon = "⬇️";
  } else if (lowerSentence.includes("maintain") || lowerSentence.includes("تثبيت") || lowerSentence.includes("repeat")) {
    actionKey = "why.action.consolidate";
    actionIcon = "➡️";
  }

  // Group remaining sections
  const otherSections = sections.filter((s) => s.title !== t("why.sentence"));

  return (
    <View style={styles.container}>
      {/* Hero Decision Verdict Card */}
      <Card style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <AppText style={[styles.verdictKicker, { color: p.muted }]} accessibilityRole="header">
            {t("why.verdict")}
          </AppText>
          <View style={[styles.actionBadge, { backgroundColor: p.card, borderColor: p.border }]}>
            <AppText style={styles.actionBadgeIcon}>{actionIcon}</AppText>
            <AppText style={[styles.actionBadgeText, { color: p.text }]}>{t(actionKey)}</AppText>
          </View>
        </View>

        <AppText style={[styles.sentenceText, { color: p.text }]} accessibilityRole="header">
          {primarySentence}
        </AppText>

        {engineReason ? (
          <View style={[styles.reasonCallout, { borderStartColor: p.border, backgroundColor: p.card }]}>
            <AppText style={[styles.reasonText, { color: p.muted }]}>{engineReason}</AppText>
          </View>
        ) : null}

        {extraDetails.length > 0 ? (
          <View style={styles.extraContainer}>
            {extraDetails.map((det, idx) => (
              <AppText key={idx} style={[styles.extraText, { color: p.muted }]}>
                • {det}
              </AppText>
            ))}
          </View>
        ) : null}
      </Card>

      {/* Structured Sections */}
      {otherSections.map((s) => {
        return (
          <Card key={s.title} style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <AppText style={[styles.sectionTitle, { color: p.text }]} accessibilityRole="header">
                {s.title}
              </AppText>
            </View>
            <View style={styles.linesList}>
              {s.lines.map((l, i) => (
                <View key={i} style={[styles.lineRow, i < s.lines.length - 1 ? { borderBottomColor: p.border, borderBottomWidth: StyleSheet.hairlineWidth } : null]}>
                  <AppText style={[styles.lineText, { color: p.text }]}>{l}</AppText>
                </View>
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
  heroCard: {
    padding: space.lg,
    borderRadius: 16,
    gap: space.md,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: space.xs,
  },
  verdictKicker: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  actionBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: 8,
    borderWidth: 1,
    gap: space.xs,
  },
  actionBadgeIcon: {
    fontSize: 14,
  },
  actionBadgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  sentenceText: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
  },
  reasonCallout: {
    borderStartWidth: 3,
    paddingStart: space.sm,
    paddingVertical: space.xs,
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 20,
  },
  extraContainer: {
    gap: space.xs,
    marginTop: space.xs,
  },
  extraText: {
    fontSize: 13,
  },
  sectionCard: {
    padding: space.md,
    borderRadius: 12,
    gap: space.sm,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  linesList: {
    gap: space.xs,
  },
  lineRow: {
    paddingVertical: space.xs,
  },
  lineText: {
    fontSize: 14,
    lineHeight: 22,
  },
});
