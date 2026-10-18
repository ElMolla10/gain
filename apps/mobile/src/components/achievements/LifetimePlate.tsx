import React, { useId } from "react";
import { useWindowDimensions, View } from "react-native";
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText, TextPath } from "react-native-svg";
import { FONT_FAMILIES } from "../../fonts";
import { useI18n } from "../../i18n";
import { plateCopy } from "../../logic/achievementCopy";
import { PLATE_ORDER, plateProgress, plateTier, type PlateTier } from "../../logic/achievementShowcase";
import { PLATE_COLOURS } from "../../palettes";
import { space, type as ty, useAchievementArt, useIsDark, usePalette } from "../../theme";
import { AppText } from "../../ui";

/** Plate diameter (dp), and the smaller size used above fontScale 1.3 so text never has to shrink first (spec §8). */
export const PLATE_SIZE = 248;
export const PLATE_SIZE_LARGE_TEXT = 200;
export const LARGE_TEXT = 1.3;
const R = 104;
const CIRC = 2 * Math.PI * R;
/** The collar hole is r = 44 in the 228-unit view box. */
const HOLE = 88 / 228;

export interface LifetimePlateProps {
  days: number | null;
  /** Only a lower bound is known ("1000+"). */
  daysIsFloor?: boolean;
  /** Coloured bumper plates (primary) or the lime-rim mono fallback. */
  variant?: "colour" | "mono";
  /** Earn moment only: draw this tier / arc share instead of the one `days` implies (plate tier-up recolour). */
  tierOverride?: PlateTier;
  progressOverride?: number;
  /** Earn moment only: hide the caption under the plate. */
  bare?: boolean;
}

/**
 * The Lifetime Plate hero: a competition bumper plate in the hundred_club tier colour, the training-day count in the collar hole and a rim
 * arc toward the next plate (in the NEXT plate's colour). The art never mirrors and its engraving is Latin brand + numerals only; the
 * numeral and label are UI text over the art, and the whole block is one accessibility element (spec §2, §7, §9).
 */
export function LifetimePlate({ days, daysIsFloor = false, variant = "colour", tierOverride, progressOverride, bare }: LifetimePlateProps) {
  const { t, lang } = useI18n();
  const p = usePalette();
  const art = useAchievementArt();
  const dark = useIsDark();
  const { fontScale } = useWindowDimensions();
  const large = fontScale > LARGE_TEXT;
  const size = large ? PLATE_SIZE_LARGE_TEXT : PLATE_SIZE;
  const copy = plateCopy(days, daysIsFloor, lang, t);
  const uid = useId().replace(/[^A-Za-z0-9]/g, "");
  const hole = Math.round(size * HOLE);
  const numeralSize = copy.numeral.length >= 4 ? ty.load : ty.display;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={copy.a11y} style={{ alignItems: "center", gap: space.sm }}>
      <View style={{ width: size, height: size }}>
        <PlateArt
          size={size}
          uid={uid}
          empty={copy.empty}
          tier={tierOverride ?? plateTier(days)}
          progress={progressOverride ?? plateProgress(days)}
          mono={variant === "mono"}
          art={art}
          dark={dark}
        />
        <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, start: 0, end: 0, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: hole, alignItems: "center" }}>
            <AppText ltr numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={{ fontSize: numeralSize, fontWeight: "600", color: copy.empty ? art.collarLabel : art.collarText }}>
              {copy.numeral}
            </AppText>
            {large ? null : <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: art.collarLabel, textAlign: "center" }}>{copy.label}</AppText>}
          </View>
        </View>
      </View>
      {large ? <AppText style={{ fontSize: ty.section, fontWeight: "600", textAlign: "center" }}>{`${copy.numeral} ${copy.label}`}</AppText> : null}
      {bare ? null : (
        <>
          <AppText style={{ fontSize: copy.empty ? ty.section : ty.body, fontWeight: "600", textAlign: "center" }}>{copy.caption}</AppText>
          {copy.body ? <AppText style={{ color: p.muted, textAlign: "center" }}>{copy.body}</AppText> : null}
        </>
      )}
    </View>
  );
}

/** The plate drawing alone (decorative; hidden from accessibility). Mirrors spec src/plate.py. */
export function PlateArt(props: { size: number; uid: string; empty: boolean; tier: PlateTier; progress: number; mono: boolean; art: ReturnType<typeof useAchievementArt>; dark: boolean }) {
  const { size, uid, empty, tier, progress, mono, art, dark } = props;
  const pl = PLATE_COLOURS[mono ? "steel" : tier];
  const next = PLATE_ORDER[PLATE_ORDER.indexOf(tier) + 1] ?? null;
  const arc = mono || !next ? art.arcDone : dark ? PLATE_COLOURS[next].arcDark : PLATE_COLOURS[next].arcLight;
  const share = Math.max(0, Math.min(1, progress));
  const floor = mono ? "" : tier === "green" ? "100" : tier === "yellow" ? "250" : tier === "blue" ? "500" : tier === "red" ? "1000" : "";
  const engraving = floor ? `${Array(3).fill(`GAIN · ${floor}`).join(" · ")} · ` : "GAIN · GAIN · GAIN · GAIN · ";
  const font = FONT_FAMILIES.latin.bold;
  return (
    <Svg width={size} height={size} viewBox="-14 -14 228 228" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ direction: "ltr" }}>
      <Defs>
        <RadialGradient id={`pf${uid}`} cx="36%" cy="30%" r="80%">
          <Stop offset="0" stopColor={pl.hi} />
          <Stop offset="0.5" stopColor={pl.face} />
          <Stop offset="1" stopColor={pl.lo} />
        </RadialGradient>
        <RadialGradient id={`hub${uid}`} cx="40%" cy="35%" r="70%">
          <Stop offset="0" stopColor={art.hubHi} />
          <Stop offset="0.55" stopColor={art.hubMid} />
          <Stop offset="1" stopColor={art.hubLo} />
        </RadialGradient>
        <LinearGradient id={`sp${uid}`} gradientUnits="userSpaceOnUse" x1="36" y1="0" x2="86" y2="200">
          <Stop offset="0" stopColor={art.specular} stopOpacity={0} />
          <Stop offset="0.5" stopColor={art.specular} stopOpacity={0.16} />
          <Stop offset="1" stopColor={art.specular} stopOpacity={0} />
        </LinearGradient>
        <Path id={`eng${uid}`} d="M100 100 m-80 0 a80 80 0 1 1 160 0 a80 80 0 1 1 -160 0" />
        <ClipPath id={`pc${uid}`}>
          <Circle cx="100" cy="100" r="96" />
        </ClipPath>
      </Defs>
      <Circle cx="100" cy="100" r={R} fill="none" stroke={art.track} strokeWidth={7} />
      {share > 0 && !empty ? (
        <Circle cx="100" cy="100" r={R} fill="none" stroke={arc} strokeWidth={7} strokeLinecap="round" strokeDasharray={`${(CIRC * share).toFixed(1)} ${CIRC.toFixed(1)}`} transform="rotate(-90 100 100)" />
      ) : null}
      {empty ? (
        <G>
          <Circle cx="100" cy="100" r="96" fill="none" stroke={art.ghost} strokeWidth={2} strokeDasharray="6 5" />
          <Circle cx="100" cy="100" r="56" fill="none" stroke={art.ghost} strokeWidth={1.5} strokeDasharray="4 4" />
          <Circle cx="100" cy="100" r="44" fill={art.stage} />
        </G>
      ) : (
        <G>
          <Ellipse cx="100" cy="206" rx="80" ry="7" fill={art.shadow} opacity={art.shadowOpacity} />
          <Circle cx="100" cy="100" r="96" fill={`url(#pf${uid})`} stroke={pl.lip} strokeWidth={2} />
          <Circle cx="100" cy="100" r="90" fill="none" stroke={pl.lo} strokeWidth={5} opacity={0.55} />
          <Circle cx="100" cy="100" r="88" fill="none" stroke={pl.hi} strokeWidth={1} opacity={0.35} />
          <Circle cx="100" cy="100" r="72" fill="none" stroke={pl.lo} strokeWidth={0.8} opacity={0.5} />
          <Circle cx="100" cy="100" r="64" fill="none" stroke={pl.lo} strokeWidth={0.8} opacity={0.5} />
          <SvgText fontFamily={font} fontSize={10} letterSpacing={3} fill={pl.lo} opacity={0.9}>
            <TextPath href={`#eng${uid}`} startOffset="0">{engraving}</TextPath>
          </SvgText>
          <Circle cx="100" cy="100" r="56" fill={`url(#hub${uid})`} stroke={art.hubEdge} strokeWidth={1} />
          {BOLTS.map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r="1.7" fill={art.bolt} />
          ))}
          <Circle cx="100" cy="100" r="44" fill={art.collar} stroke={art.collarEdge} strokeWidth={2} />
          <G clipPath={`url(#pc${uid})`}>
            <Rect x="0" y="0" width="200" height="200" fill={`url(#sp${uid})`} />
          </G>
          <Circle cx="100" cy="100" r="44" fill={art.collar} />
        </G>
      )}
    </Svg>
  );
}

/** Eight hub bolts at r = 50, precomputed (no runtime geometry). */
const BOLTS: readonly [number, number][] = [
  [146.2, 119.1], [119.1, 146.2], [80.9, 146.2], [53.8, 119.1], [53.8, 80.9], [80.9, 53.8], [119.1, 53.8], [146.2, 80.9],
];
