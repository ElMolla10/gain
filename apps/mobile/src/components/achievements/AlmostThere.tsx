import React from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { useI18n } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import { medalA11y, medalStateLine } from "../../logic/achievementCopy";
import type { SurfaceBadge } from "../../logic/achievementSurface";
import { radius, space, type as ty, usePalette } from "../../theme";
import { AppText, Card, SectionTitle } from "../../ui";
import { Medal } from "./Medal";

/** Medal size in Almost there (dp), with the progress ring (spec §2). */
export const ALMOST_MEDAL = 84;

const ratio = (r: SurfaceBadge) => ((r.progressTarget ?? 0) > 0 ? (r.progressCurrent ?? 0) / (r.progressTarget ?? 1) : 0);

/**
 * The in-progress medals closest to done (rows from `almostThere()`), side by side from the start edge; one column above fontScale 1.3.
 * With nothing earned yet it becomes "Your first medal": the first-session medal and how to get it.
 */
export function AlmostThere({ rows, first, onOpen }: { rows: SurfaceBadge[]; first?: SurfaceBadge | null; onOpen: (row: SurfaceBadge) => void }) {
  const { t, lang } = useI18n();
  const p = usePalette();
  const { fontScale } = useWindowDimensions();
  if (first) {
    const item = { badgeId: first.badgeId, state: "in_progress" as const, row: { ...first, progressCurrent: first.progressCurrent ?? 0, progressTarget: first.progressTarget ?? 1 }, count: 0, repeatable: false };
    const name = t(first.i18nKey as StringKey);
    return (
      <View style={{ gap: space.sm }}>
        <SectionTitle>{t("achv.r2.almost.first")}</SectionTitle>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${medalA11y(item, name, lang, t)}. ${t("achv.r2.almost.firstBody")}`}
          accessibilityHint={t("achv.r2.medal.hint")}
          onPress={() => onOpen(first)}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: p.border, backgroundColor: pressed ? p.raised : p.card })}
        >
          <Medal badgeId={first.badgeId} state={first.status === "in_progress" ? "in_progress" : "locked"} size={64} progress={ratio(first)} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText style={{ fontWeight: "600" }}>{name}</AppText>
            <AppText style={{ fontSize: ty.label, color: p.muted }}>{medalStateLine(item, lang, t)}</AppText>
            <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("achv.r2.almost.firstBody")}</AppText>
          </View>
        </Pressable>
      </View>
    );
  }
  if (rows.length === 0) return null;
  const stacked = fontScale > 1.3;
  return (
    <View style={{ gap: space.sm }}>
      <SectionTitle>{t("achv.r2.almost.title")}</SectionTitle>
      <Card style={{ flexDirection: stacked ? "column" : "row", gap: space.sm, paddingHorizontal: space.sm }}>
        {rows.map((row) => {
          const item = { badgeId: row.badgeId, state: "in_progress" as const, row, count: 0, repeatable: false };
          return (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              accessibilityLabel={medalA11y(item, t(row.i18nKey as StringKey), lang, t)}
              accessibilityHint={t("achv.r2.medal.hint")}
              accessibilityValue={{ min: 0, max: row.progressTarget ?? 0, now: row.progressCurrent ?? 0 }}
              onPress={() => onOpen(row)}
              style={({ pressed }) => ({
                flex: stacked ? undefined : 1,
                flexDirection: stacked ? "row" : "column",
                alignItems: "center",
                gap: space.sm,
                minHeight: 48,
                padding: space.xs,
                borderRadius: radius.button,
                backgroundColor: pressed ? p.raised : "transparent",
              })}
            >
              <Medal badgeId={row.badgeId} state="in_progress" size={ALMOST_MEDAL} progress={ratio(row)} />
              <View style={{ flex: stacked ? 1 : undefined, alignItems: stacked ? "flex-start" : "center", gap: 2 }}>
                <AppText style={{ fontSize: ty.label, fontWeight: "600", textAlign: stacked ? undefined : "center" }}>{t(row.i18nKey as StringKey)}</AppText>
                <AppText style={{ fontSize: ty.label, color: p.muted }}>{medalStateLine(item, lang, t)}</AppText>
              </View>
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}
