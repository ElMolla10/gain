import React from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useI18n } from "../../i18n";
import { countKey, exerciseName, prCopy } from "../../logic/achievementCopy";
import { formatSetEvidence } from "../../logic/achievementEvidence";
import { plaques, prBaseline, prStair, type Plaque } from "../../logic/achievementShowcase";
import type { SurfaceBadge } from "../../logic/achievementSurface";
import { radius, space, type as ty, usePalette } from "../../theme";
import { AppText, SectionTitle } from "../../ui";
import { Icon } from "../Icon";
import { LARGE_TEXT } from "./LifetimePlate";
import { Medal } from "./Medal";
import { PrStaircase } from "./PrStaircase";

type PrRow = Parameters<typeof prCopy>[0];

/** Plaque width (dp): 156, 220 at large text (spec §2, §8). */
export const PLAQUE_W = 156;
export const PLAQUE_W_LARGE = 220;
export const PLAQUE_MIN_H = 128;

/** Before → after arrow; mirrors in right-to-left (S-7). */
function Arrow({ color, rtl }: { color: string; rtl: boolean }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }}>
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Path d="M4 12 H19 M13 6 L19 12 L13 18" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

/**
 * The latest verified PR (never "best"): medal, eyebrow and date, the lift, before → after as real sets, the delta chip and the PR
 * staircase for that lift. The chevron opens the lift trend. With no PR yet: the baseline rule instead.
 */
export function PrSpotlight({ pr, cabinet, onOpenTrend, onOpen }: { pr: PrRow | null; cabinet: SurfaceBadge[]; onOpenTrend?: (pr: PrRow) => void; onOpen: (row: SurfaceBadge) => void }) {
  const { t, lang, unit, direction } = useI18n();
  const p = usePalette();
  const { fontScale } = useWindowDimensions();
  const large = fontScale > LARGE_TEXT;
  const cardStyle = { padding: space.lg, gap: space.md, borderRadius: radius.card, borderWidth: 1, borderColor: p.border };
  if (!pr) {
    return (
      <View accessible accessibilityLabel={`${t("achv.r2.pr.emptyTitle")}. ${t("achv.r2.pr.empty")}`} style={[cardStyle, { flexDirection: "row", alignItems: "center", backgroundColor: p.card }]}>
        <Medal badgeId="strength_pr" state="locked" size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ fontWeight: "600" }}>{t("achv.r2.pr.emptyTitle")}</AppText>
          <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("achv.r2.pr.empty")}</AppText>
        </View>
      </View>
    );
  }
  const c = prCopy(pr, cabinet, lang, unit, t);
  const e = pr.evidence;
  const steps = prStair(cabinet, e.identity);
  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
      <Medal badgeId="strength_pr" state="earned" size={40} />
      <View style={{ flex: 1 }}>
        <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.accent }}>{t("achv.r2.pr.eyebrow")}</AppText>
        <AppText style={{ fontSize: ty.label, color: p.muted }}>{c.date}</AppText>
      </View>
      {onOpenTrend ? <Icon name="chevron" color={p.muted} size={20} mirror /> : null}
    </View>
  );
  const body = (
    <>
      <AppText style={{ fontSize: ty.section, fontWeight: "600" }}>{c.exercise}</AppText>
      <View style={{ flexDirection: large ? "column" : "row", alignItems: large ? "flex-start" : "flex-end", gap: space.md }}>
        <View style={{ gap: 2 }}>
          <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("achv.r2.pr.before")}</AppText>
          <AppText style={{ fontSize: ty.label, color: p.muted }}>{c.before}</AppText>
        </View>
        {large ? null : (
          <View style={{ paddingBottom: space.sm }}>
            <Arrow color={p.accent} rtl={direction === "rtl"} />
          </View>
        )}
        <View style={{ gap: 2, flexShrink: 1 }}>
          <AppText style={{ fontSize: ty.label, fontWeight: "600", color: p.accent }}>{t("achv.r2.pr.now")}</AppText>
          <AppText style={{ fontSize: ty.load, fontWeight: "600" }}>{c.after}</AppText>
        </View>
      </View>
      <View style={{ flexDirection: large ? "column" : "row", alignItems: large ? "flex-start" : "flex-end", justifyContent: "space-between", gap: space.md }}>
        <View style={{ flexShrink: 1, gap: space.sm, alignItems: "flex-start" }}>
          <View style={{ backgroundColor: p.tint, borderRadius: radius.button, paddingHorizontal: space.md, paddingVertical: space.xs }}>
            <AppText style={{ fontSize: ty.body, fontWeight: "600", color: p.accent }}>{c.delta}</AppText>
          </View>
          <AppText style={{ fontSize: ty.label, color: p.muted }}>{c.caption}</AppText>
        </View>
        <PrStaircase steps={steps} baseline={prBaseline(cabinet, e.identity) ?? e.previousBest.load} assisted={e.identity.setup === "assisted"} label={c.stairA11y} />
      </View>
    </>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={c.a11y}
      accessibilityHint={onOpenTrend ? t("history.liftHint") : t("achv.r2.medal.hint")}
      onPress={() => (onOpenTrend ? onOpenTrend(pr) : onOpen(pr))}
      style={({ pressed }) => [cardStyle, { backgroundColor: pressed ? p.raised : p.card }]}
    >
      {header}
      {body}
    </Pressable>
  );
}

/** "Other recent records": the latest PR on up to 4 other lifts, a horizontal scroller from the start edge. Hidden when there are none. */
export function PrPlaques({ cabinet, onOpen }: { cabinet: SurfaceBadge[]; onOpen: (row: SurfaceBadge) => void }) {
  const { t, lang, unit } = useI18n();
  const p = usePalette();
  const { fontScale } = useWindowDimensions();
  const list = plaques(cabinet);
  if (list.length === 0) return null;
  const width = fontScale > LARGE_TEXT ? PLAQUE_W_LARGE : PLAQUE_W;
  return (
    <View style={{ gap: space.sm }}>
      <SectionTitle>{t("achv.r2.plaques.title")}</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {list.map((pl: Plaque) => {
          const name = exerciseName(pl.row, lang);
          const set = formatSetEvidence(pl.row.evidence.newBest.load, pl.row.evidence.newBest.reps, lang, unit);
          const count = t(countKey(pl.count, lang, "achv.r2.plaques.count.one", "achv.r2.plaques.count.few"), { n: pl.count });
          return (
            <Pressable
              key={pl.row.id}
              accessibilityRole="button"
              accessibilityLabel={[name, set, count].join(lang === "ar" ? "، " : ", ")}
              accessibilityHint={t("achv.r2.medal.hint")}
              onPress={() => onOpen(pl.row)}
              style={({ pressed }) => ({ width, minHeight: PLAQUE_MIN_H, padding: space.md, gap: space.xs, borderRadius: radius.card, borderWidth: 1, borderColor: p.border, backgroundColor: pressed ? p.raised : p.card })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Medal badgeId="strength_pr" state="earned" size={32} />
                <AppText style={{ fontSize: ty.label, color: p.muted }}>{count}</AppText>
              </View>
              <AppText style={{ fontSize: ty.label, fontWeight: "600" }}>{name}</AppText>
              <AppText style={{ fontSize: ty.body, fontWeight: "600" }}>{set}</AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
