import React, { useId } from "react";
import { View } from "react-native";
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Stop } from "react-native-svg";
import { useI18n } from "../../i18n";
import type { MedalBack as MedalBackCopy } from "../../logic/achievementCopy";
import { space, type as ty, useAchievementArt } from "../../theme";
import { AppText } from "../../ui";
import { materialFor } from "./Medal";
import { MEDAL_ART } from "./medalArt";

/** Fine horizontal lines for the brushed-metal back: one path, precomputed. */
const BRUSH = Array.from({ length: 48 }, (_, i) => `M-4 ${(-2 + i * 2.25).toFixed(2)} H104`).join(" ");

/**
 * The medal's back: a brushed face in the medal's material with an inner contour, and engraved-look UI text over it (name, value,
 * unit, the full date and "Medal n of 17"). The art never mirrors; the text follows the language.
 */
export function MedalBackFace({ badgeId, size, copy }: { badgeId: string; size: number; copy: MedalBackCopy }) {
  const art = useAchievementArt();
  const { lang } = useI18n();
  const uid = useId().replace(/[^A-Za-z0-9]/g, "");
  const mat = materialFor(badgeId);
  const sil = (MEDAL_ART[badgeId] ?? MEDAL_ART.first_session!).sil;
  const ink = { color: mat.engrave, textAlign: "center" as const };
  return (
    <View style={{ width: size, height: size }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", direction: "ltr" }}>
        <Svg width={size} height={size} viewBox="-4 -4 108 108">
          <Defs>
            <LinearGradient id={`bk${uid}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={mat.base} />
              <Stop offset="0.6" stopColor={mat.lo} />
              <Stop offset="1" stopColor={mat.lo} />
            </LinearGradient>
            <ClipPath id={`bc${uid}`}>
              <Path d={sil} />
            </ClipPath>
          </Defs>
          <Path d={sil} fill={`url(#bk${uid})`} stroke={mat.edge} strokeWidth={1.6} />
          <G clipPath={`url(#bc${uid})`}>
            <Path d={BRUSH} stroke={art.specular} strokeWidth={0.35} opacity={0.1} />
          </G>
          <Path d={sil} fill="none" stroke={mat.edge} strokeWidth={1} opacity={0.6} transform="translate(50 50) scale(0.86) translate(-50 -50)" />
        </Svg>
      </View>
      <View style={{ position: "absolute", top: size * 0.12, bottom: size * 0.12, start: size * 0.22, end: size * 0.22, alignItems: "center", justifyContent: "center", gap: 2 }}>
        <AppText style={[ink, { fontSize: ty.caption, fontWeight: "600", letterSpacing: lang === "ar" ? 0 : 1 }]}>{copy.title}</AppText>
        {copy.value ? (
          <AppText ltr style={[ink, { fontSize: ty.title, fontWeight: "700", fontVariant: ["tabular-nums"] }]}>
            {copy.value}
          </AppText>
        ) : null}
        {copy.unit ? <AppText style={[ink, { fontSize: ty.caption }]}>{copy.unit}</AppText> : null}
        <View style={{ height: 1, alignSelf: "stretch", backgroundColor: mat.engrave, opacity: 0.4, marginVertical: space.xs }} />
        {copy.date ? <AppText style={[ink, { fontSize: ty.caption }]}>{copy.date}</AppText> : null}
        {copy.ordinal ? <AppText style={[ink, { fontSize: ty.caption }]}>{copy.ordinal}</AppText> : null}
      </View>
    </View>
  );
}
