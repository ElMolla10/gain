import React from "react";
import { View } from "react-native";
import { useI18n } from "../i18n";
import type { StringKey } from "../i18n/strings";
import type { MuscleGroup } from "../logic/exposure";
import { radius, space, type as ty, usePalette } from "../theme";
import { AppText, Card } from "../ui";

export interface MuscleSetCount {
  group: MuscleGroup;
  sets: number;
}

export function FinishMuscleStrip({ counts }: { counts: MuscleSetCount[] }) {
  const { t } = useI18n();
  const p = usePalette();
  if (counts.length === 0) return null;

  const totalSets = counts.reduce((sum, c) => sum + c.sets, 0);

  return (
    <Card>
      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText accessibilityRole="header" style={{ fontWeight: "600", fontSize: ty.section }}>
            {t("finish.muscleExposure")}
          </AppText>
          <AppText style={{ color: p.muted, fontSize: ty.caption }}>
            {t("finish.countedLine", { n: totalSets })}
          </AppText>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
          {counts.map(({ group, sets }) => (
            <View
              key={group}
              style={{
                backgroundColor: p.raised,
                borderRadius: radius.pill,
                paddingVertical: space.xs,
                paddingHorizontal: space.sm,
                borderWidth: 1,
                borderColor: p.edge,
                flexDirection: "row",
                alignItems: "center",
                gap: space.xs,
              }}
            >
              <AppText style={{ fontSize: ty.label, color: p.text }}>
                {t(`muscle.${group}` as StringKey)}
              </AppText>
              <AppText
                style={{
                  fontSize: ty.label,
                  fontWeight: "600",
                  color: p.accent,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {`\u2066${sets}\u2069`}
              </AppText>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}
