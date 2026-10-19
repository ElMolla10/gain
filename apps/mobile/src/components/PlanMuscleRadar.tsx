import React from "react";
import { View } from "react-native";
import { useI18n } from "../i18n";
import { isolateLtr } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import type { ExposureRow } from "../logic/exposure";
import { radius, space, type as ty, usePalette } from "../theme";
import { AppText, Card, QuietAction } from "../ui";

export function PlanMuscleRadar({
  rows,
  onOpenExposure,
}: {
  rows: ExposureRow[];
  onOpenExposure?: () => void;
}) {
  const { t } = useI18n();
  const p = usePalette();
  if (rows.length === 0) return null;

  // Filter groups with planned sets
  const activeRows = rows
    .filter((r) => (r.setsPerWeek ?? r.setsPerRotation) > 0)
    .sort((a, b) => (b.setsPerWeek ?? b.setsPerRotation) - (a.setsPerWeek ?? a.setsPerRotation))
    .slice(0, 6);

  if (activeRows.length === 0) return null;

  const maxSets = Math.max(...activeRows.map((r) => r.setsPerWeek ?? r.setsPerRotation), 14);

  return (
    <Card>
      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm, flexWrap: "wrap" }}>
          <AppText accessibilityRole="header" style={{ fontWeight: "600", fontSize: ty.section, flexShrink: 1 }}>
            {t("prog.volumeRadar.title")}
          </AppText>
          {onOpenExposure ? (
            <QuietAction label={t("prog.exposure.title")} icon="why" onPress={onOpenExposure} />
          ) : null}
        </View>

        <View style={{ gap: space.sm }}>
          {activeRows.map((r) => {
            const sets = r.setsPerWeek ?? r.setsPerRotation;
            const pct = Math.min(100, Math.round((sets / maxSets) * 100));
            const groupName = t(`muscle.${r.group}` as StringKey);

            return (
              <View key={r.group} style={{ gap: 3 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <AppText style={{ fontSize: ty.label, fontWeight: "500" }}>{groupName}</AppText>
                  <AppText style={{ fontSize: ty.caption, color: p.muted, fontVariant: ["tabular-nums"] }}>
                    {isolateLtr(`${sets} ${t("prog.volumeRadar.sets", { n: sets }).split(" ")[1] ?? "sets"}`)}
                  </AppText>
                </View>
                <View
                  style={{
                    height: 6,
                    borderRadius: radius.pill,
                    backgroundColor: p.raised,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      borderRadius: radius.pill,
                      backgroundColor: p.accent,
                    }}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </Card>
  );
}
