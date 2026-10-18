import React, { useId } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useI18n } from "../../i18n";
import { sleeveCopy } from "../../logic/achievementCopy";
import { space, type as ty, useAchievementArt, usePalette } from "../../theme";
import { AppText, Card } from "../../ui";

const W = 380;
const H = 72;
const CY = 36;
/** More slots than this would run off the sleeve; the engine's dayTarget is 2 (QUALIFIED_WEEK_DAYS). */
export const MAX_SLOTS = 8;

/**
 * This week as a barbell sleeve: `qualifiedDays` loaded plates out of `dayTarget` slots, empty slots as dashed ghosts (solid vs dashed is
 * the state cue, not colour). It is a start-edge progress bar, so the ART mirrors in right-to-left (the collar sits on the right); the text
 * does not (spec §2, §7, S-7). One accessibility element.
 */
export function WeekSleeve({ qualifiedDays, dayTarget }: { qualifiedDays: number; dayTarget: number }) {
  const { t, direction } = useI18n();
  const p = usePalette();
  const art = useAchievementArt();
  const uid = useId().replace(/[^A-Za-z0-9]/g, "");
  const slots = Math.max(1, Math.min(MAX_SLOTS, dayTarget));
  const done = Math.max(0, Math.min(slots, qualifiedDays));
  const copy = sleeveCopy(qualifiedDays, dayTarget, t);
  return (
    <Card>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={copy.a11y} accessibilityValue={{ min: 0, max: dayTarget, now: Math.min(qualifiedDays, dayTarget) }} style={{ gap: space.sm }}>
        <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted }}>{t("achv.r2.week.title")}</AppText>
        <View style={{ transform: [{ scaleX: direction === "rtl" ? -1 : 1 }] }}>
          <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Defs>
              <LinearGradient id={`sl${uid}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={art.steelHi} />
                <Stop offset="0.5" stopColor={art.steelMid} />
                <Stop offset="1" stopColor={art.steelLo} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y={CY - 5} width="96" height="10" rx="3" fill={`url(#sl${uid})`} opacity={0.8} />
            <Rect x="96" y={CY - 22} width="16" height="44" rx="3" fill={`url(#sl${uid})`} />
            <Rect x="112" y={CY - 11} width={W - 120} height="22" rx="5" fill={`url(#sl${uid})`} />
            {Array.from({ length: slots }, (_, i) => {
              const x = 118 + i * 30;
              return i < done ? (
                <React.Fragment key={i}>
                  <Rect x={x} y={CY - 32} width="24" height="64" rx="5" fill={art.loaded} stroke={art.loadedEdge} strokeWidth={1.5} />
                  <Rect x={x + 4} y={CY - 28} width="3" height="56" rx="1.5" fill={art.specular} opacity={0.35} />
                </React.Fragment>
              ) : (
                <Rect key={i} x={x} y={CY - 32} width="24" height="64" rx="5" fill="none" stroke={art.ghost} strokeWidth={1.5} strokeDasharray="4 3" />
              );
            })}
            <Rect x={W - 10} y={CY - 13} width="8" height="26" rx="3" fill={`url(#sl${uid})`} />
          </Svg>
        </View>
        <AppText style={{ fontSize: ty.body, fontWeight: "600" }}>{copy.line}</AppText>
        <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("achv.r2.week.rest")}</AppText>
      </View>
    </Card>
  );
}
