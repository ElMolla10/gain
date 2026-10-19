import React from "react";
import { View } from "react-native";
import { Icon } from "./Icon";
import { useI18n } from "../i18n";
import { radius, space, type as ty, usePalette } from "../theme";
import { AppText, Card } from "../ui";

export function FinishHeroPlaque({
  pbLines,
  milestones,
  countedSets,
}: {
  pbLines: string[];
  milestones: string[];
  countedSets: number;
}) {
  const { t } = useI18n();
  const p = usePalette();
  const hasPbs = pbLines.length > 0;

  if (hasPbs) {
    return (
      <View
        style={{
          backgroundColor: p.tint,
          borderRadius: radius.card,
          padding: space.lg,
          gap: space.sm,
          borderStartWidth: 4,
          borderStartColor: p.accent,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Icon name="trophy" color={p.accent} size={20} />
          <AppText
            accessibilityRole="header"
            style={{
              flexShrink: 1,
              fontSize: ty.section,
              fontWeight: "600",
              color: p.accent,
            }}
          >
            {t("recap.personalBests")}
            {pbLines.length > 1 ? ` (${pbLines.length})` : ""}
          </AppText>
        </View>
        <View style={{ gap: space.xs }}>
          {pbLines.map((line, i) => (
            <AppText key={i} style={{ fontSize: ty.body, fontWeight: i === 0 ? "600" : "400" }}>
              {line}
            </AppText>
          ))}
          {milestones.map((line, i) => (
            <AppText key={`m${i}`} style={{ color: p.muted, fontSize: ty.label }}>
              {line}
            </AppText>
          ))}
        </View>
      </View>
    );
  }

  if (countedSets > 0) {
    return (
      <Card tone="default">
        <View style={{ gap: space.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Icon name="check" color={p.accent} size={20} />
            <AppText
              accessibilityRole="header"
              style={{
                flexShrink: 1,
                fontSize: ty.section,
                fontWeight: "600",
                color: p.text,
              }}
            >
              {t("finish.heroPlaque.bankedTitle")}
            </AppText>
          </View>
          <AppText style={{ color: p.muted, fontSize: ty.label }}>
            {t("finish.heroPlaque.bankedSubtitle", { n: countedSets })}
          </AppText>
          {milestones.map((line, i) => (
            <AppText key={`m${i}`} style={{ color: p.muted, fontSize: ty.label }}>
              {line}
            </AppText>
          ))}
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <View style={{ gap: space.xs }}>
        <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600", color: p.text }}>
          {t("recap.personalBests")}
        </AppText>
        <AppText style={{ color: p.muted }}>{t("recap.noPbs")}</AppText>
      </View>
    </Card>
  );
}
