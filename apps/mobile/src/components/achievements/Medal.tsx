import React, { useId } from "react";
import { View } from "react-native";
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from "react-native-svg";
import { FONT_FAMILIES } from "../../fonts";
import { prestigeForBadge } from "../../logic/achievementSurface";
import type { MedalState } from "../../logic/achievementShowcase";
import { MATERIAL_FOR_PRESTIGE, MEDAL_MATERIALS, type MedalMaterial } from "../../palettes";
import { useAchievementArt, type AchievementArt } from "../../theme";
import { MEDAL_ART, type MotifShape } from "./medalArt";

/** At or below this size (dp) a medal drops the emboss copies, cast shadow and specular band and uses thicker strokes (≤12 paths). */
export const MEDAL_LOD = 56;
const RING_R = 52.5;
const RING_CIRC = 2 * Math.PI * RING_R;

export interface MedalProps {
  badgeId: string;
  state: MedalState;
  size: number;
  /** In progress: current / target, 0..1 (ring outside the silhouette). */
  progress?: number;
  /** Quest seals: the month (1–12) shown on the boss. */
  month?: number;
  /** Parallax of the motif in view-box units (detail sheet drag-tilt). */
  tilt?: { x: number; y: number };
  /** Specular band position, 0..1. */
  spec?: number;
  /** Draw at this opacity (the ghost medals behind a ×N stack). */
  opacity?: number;
}

/** The material for a badge: prestige tier from prestigeForBadge, the seal wax for quests. */
export function materialFor(badgeId: string): MedalMaterial {
  return MEDAL_MATERIALS[badgeId.startsWith("quest_") ? "seal" : MATERIAL_FOR_PRESTIGE[prestigeForBadge(badgeId)]];
}

/** The decorative numeral on the boss: the tier for weeks / days / sessions, the month for a seal. Null when the badge has none. */
export function bossLabel(badgeId: string, month?: number): string | null {
  if (badgeId.startsWith("quest_")) return month ? String(month) : null;
  return MEDAL_ART[badgeId]?.label ?? null;
}

/** Number of SVG shapes a medal draws; the LOD budget is ≤12 (used by tests). */
export const lodShapes = (badgeId: string): number => (MEDAL_ART[badgeId]?.lod.length ?? 0);

function Shape({ s, colour, k }: { s: MotifShape; colour: string; k: string }) {
  const paint = (v: string | undefined) => (v === "C" ? colour : v);
  const common = {
    fill: paint(s.fill) ?? "none",
    stroke: paint(s.stroke),
    strokeWidth: s.strokeWidth,
    strokeLinecap: s.strokeLinecap,
    strokeLinejoin: s.strokeLinejoin,
    strokeDasharray: s.strokeDasharray,
    opacity: s.opacity,
  };
  if (s.t === "rect") return <Rect key={k} x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx} {...common} />;
  if (s.t === "circle") return <Circle key={k} cx={s.cx} cy={s.cy} r={s.r} {...common} />;
  return <Path key={k} d={s.d} {...common} />;
}

function Motif({ shapes, colour, uid, prefix }: { shapes: MotifShape[]; colour: string; uid: string; prefix: string }) {
  return (
    <>
      {shapes.map((s, i) => {
        const k = `${prefix}${i}`;
        if (!s.clip) return <Shape key={k} s={s} colour={colour} k={k} />;
        return (
          <G key={k} clipPath={`url(#mc${uid}${k})`}>
            <Defs>
              <ClipPath id={`mc${uid}${k}`}>
                <Path d={s.clip} />
              </ClipPath>
            </Defs>
            <Shape s={s} colour={colour} k={k} />
          </G>
        );
      })}
    </>
  );
}

function Boss({ badgeId, mat, art, state, month, lod }: { badgeId: string; mat: MedalMaterial; art: AchievementArt; state: MedalState; month?: number; lod: boolean }) {
  const label = bossLabel(badgeId, month);
  if (!label || state === "locked") return null;
  const earned = state === "earned";
  const font = FONT_FAMILIES.latin.bold;
  if (badgeId.startsWith("qualified_weeks")) {
    // The weeks numeral sits straight on the star face.
    const fs = label.length < 2 ? 24 : 20;
    return (
      <SvgText x={50} y={50 + fs * 0.36} textAnchor="middle" fontFamily={font} fontWeight="700" fontSize={fs} fill={earned ? mat.ink : art.medalProgressBossText}>
        {label}
      </SvgText>
    );
  }
  const r = label.length < 3 ? 16 : 18;
  const fs = ({ 1: 17, 2: 16, 3: 13, 4: 11 } as Record<number, number>)[label.length] ?? 11;
  const size = fs + (lod ? 2 : 0);
  const fill = earned ? mat.boss : art.medalProgressBoss;
  const text = earned ? mat.bossText : art.medalProgressBossText;
  return (
    <>
      <Circle cx={50} cy={50} r={r} fill={fill} stroke={text} strokeOpacity={0.35} strokeWidth={1} />
      <SvgText x={50} y={50 + size * 0.36} textAnchor="middle" fontFamily={font} fontWeight="700" fontSize={size} fill={text}>
        {label}
      </SvgText>
    </>
  );
}

/**
 * One medal object (spec §4): silhouette = shelf family, motif = badge, material = prestige tier, plus a state the eye can read without
 * colour. Earned: material gradient, raised rim, embossed motif, specular band. In progress: matte graphite, dimmed motif and a ring
 * outside the silhouette (accent; olive on light). Locked: flat recessed fill, dashed contour, no motif. The art never mirrors and is
 * hidden from screen readers; whoever places it gives the spoken label (its numerals are decorative duplicates of the caption).
 */
export function Medal({ badgeId, state, size, progress = 0, month, tilt, spec = 0.35, opacity }: MedalProps) {
  const art = useAchievementArt();
  const uid = useId().replace(/[^A-Za-z0-9]/g, "");
  const master = MEDAL_ART[badgeId] ?? MEDAL_ART.first_session!;
  const lod = size <= MEDAL_LOD;
  const mat = materialFor(badgeId);
  const tx = tilt?.x ?? 0;
  const ty = tilt?.y ?? 0;
  const motif = lod ? master.lod : master.motif;
  const sx = -60 + spec * 220;
  const share = Math.max(0, Math.min(1, progress));
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: size, height: size, direction: "ltr", opacity }}
    >
      <Svg width={size} height={size} viewBox="-4 -4 108 108">
        {state === "earned" ? (
          <>
            <Defs>
              <RadialGradient id={`mg${uid}`} cx="38%" cy="32%" r="75%">
                <Stop offset="0" stopColor={mat.hi} />
                <Stop offset="0.55" stopColor={mat.base} />
                <Stop offset="1" stopColor={mat.lo} />
              </RadialGradient>
              {lod ? null : (
                <LinearGradient id={`ms${uid}`} gradientUnits="userSpaceOnUse" x1={sx} y1="0" x2={sx + 50} y2="100">
                  <Stop offset="0" stopColor={art.specular} stopOpacity={0} />
                  <Stop offset="0.5" stopColor={art.specular} stopOpacity={0.38} />
                  <Stop offset="1" stopColor={art.specular} stopOpacity={0} />
                </LinearGradient>
              )}
              {lod ? null : (
                <ClipPath id={`msc${uid}`}>
                  <Path d={master.sil} />
                </ClipPath>
              )}
            </Defs>
            {lod ? null : <Ellipse cx={50 - tx * 1.5} cy={98} rx={34} ry={4} fill={art.shadow} opacity={0.45} />}
            <Path d={master.sil} fill={`url(#mg${uid})`} stroke={mat.edge} strokeWidth={lod ? 2 : 1.6} />
            <Path d={master.sil} fill="none" stroke={mat.lo} strokeWidth={5} opacity={0.35} transform="translate(50 50) scale(0.86) translate(-50 -50)" />
            <G transform={`translate(${tx} ${ty})`}>
              {lod ? null : (
                <>
                  <G transform="translate(-0.8 -0.8)" opacity={0.55}>
                    <Motif shapes={motif} colour={mat.hi} uid={uid} prefix="h" />
                  </G>
                  <G transform="translate(0.9 0.9)" opacity={0.7}>
                    <Motif shapes={motif} colour={mat.lo} uid={uid} prefix="l" />
                  </G>
                </>
              )}
              <Motif shapes={motif} colour={mat.ink} uid={uid} prefix="i" />
            </G>
            {lod ? null : (
              <G clipPath={`url(#msc${uid})`}>
                <Rect x={-10} y={-10} width={120} height={120} fill={`url(#ms${uid})`} />
              </G>
            )}
            <G transform={`translate(${tx} ${ty})`}>
              <Boss badgeId={badgeId} mat={mat} art={art} state={state} month={month} lod={lod} />
            </G>
          </>
        ) : state === "in_progress" ? (
          <>
            <Path d={master.sil} fill={art.medalProgressFill} stroke={art.medalProgressEdge} strokeWidth={1.8} />
            <G opacity={0.75}>
              <Motif shapes={motif} colour={art.medalProgressMotif} uid={uid} prefix="p" />
            </G>
            <Circle cx={50} cy={50} r={RING_R} fill="none" stroke={art.ringTrack} strokeWidth={4} />
            {share > 0 ? (
              <Circle
                cx={50}
                cy={50}
                r={RING_R}
                fill="none"
                stroke={art.arcDone}
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray={`${(RING_CIRC * share).toFixed(2)} ${RING_CIRC.toFixed(2)}`}
                transform="rotate(-90 50 50)"
              />
            ) : null}
            <Boss badgeId={badgeId} mat={mat} art={art} state={state} month={month} lod={lod} />
          </>
        ) : (
          <>
            <Path d={master.sil} fill={art.medalLockedFill} stroke={art.ghost} strokeWidth={1.8} strokeDasharray="4 3.2" />
            <Path d={master.sil} fill="none" stroke={art.shadow} strokeWidth={2} opacity={0.25} transform="translate(50 50) scale(0.82) translate(-50 -50)" />
          </>
        )}
      </Svg>
    </View>
  );
}
