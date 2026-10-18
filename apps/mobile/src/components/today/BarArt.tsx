import React from "react";
import Svg, { Defs, Ellipse, G, LinearGradient, Rect, Stop } from "react-native-svg";
import { barLayout, gridPlates, HERO_H, HERO_W, type BarLayout } from "../../logic/barArt";
import type { Unit } from "../../logic/units";
import { BAR_STEEL, TODAY_OBJECTS, TODAY_PLATES, type TodayPlateName } from "../../palettes";
import { useIsDark } from "../../theme";

/** Art is decorative: the hero's one accessibility element speaks for it. It never mirrors (direction ltr on the Svg). */
export const ART_HIDDEN = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const, style: { direction: "ltr" as const } };

/** One vertical ramp per plate colour actually drawn: lo 0% → face 16% → hi 34% → face 58% → lo 100% (spec §2.2). */
export function PlateRamps({ tokens, prefix }: { tokens: readonly TodayPlateName[]; prefix: string }) {
  return (
    <>
      {[...new Set(tokens)].map((k) => {
        const r = TODAY_PLATES[k];
        return (
          <LinearGradient key={k} id={`${prefix}-${k}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={r.lo} />
            <Stop offset="0.16" stopColor={r.face} />
            <Stop offset="0.34" stopColor={r.hi} />
            <Stop offset="0.58" stopColor={r.face} />
            <Stop offset="1" stopColor={r.lo} />
          </LinearGradient>
        );
      })}
    </>
  );
}

/** The bar body (floor shadow, shaft + knurl, sleeves, inner collars) and its loaded plates, clamps and ghosts. */
export function BarBody({ layout, dark, prefix = "tb" }: { layout: BarLayout; dark: boolean; prefix?: string }) {
  const steel = dark ? BAR_STEEL.dark : BAR_STEEL.light;
  const o = dark ? TODAY_OBJECTS.dark : TODAY_OBJECTS.light;
  const { cy, xL, xR } = layout;
  return (
    <G>
      <Ellipse cx={HERO_W / 2} cy={HERO_H - 4} rx={HERO_W / 2 - 24} ry={3} fill={o.shadow} opacity={dark ? 0.5 : 0.12} />
      <Rect x={xL} y={cy - 4} width={xR - xL} height={8} fill={steel.base} />
      <Rect x={xL + 40} y={cy - 4} width={xR - xL - 80} height={8} fill={steel.lo} opacity={0.35} />
      <Rect x={0} y={cy - 7} width={xL} height={14} rx={2} fill={steel.base} stroke={steel.edge} strokeWidth={0.6} />
      <Rect x={xR} y={cy - 7} width={HERO_W - xR} height={14} rx={2} fill={steel.base} stroke={steel.edge} strokeWidth={0.6} />
      <Rect x={xL - 10} y={cy - 16} width={10} height={32} rx={1.5} fill={steel.hi} stroke={steel.lo} strokeWidth={0.8} />
      <Rect x={xR} y={cy - 16} width={10} height={32} rx={1.5} fill={steel.hi} stroke={steel.lo} strokeWidth={0.8} />
      {layout.ghosts.map((g, i) => (
        <Rect key={`g${i}`} x={g.x} y={g.y} width={g.w} height={g.h} rx={2} fill="none" stroke={o.ghost} strokeWidth={1.5} strokeDasharray="4 3" />
      ))}
      {layout.plates.map((p, i) => (
        <Rect key={`p${i}`} x={p.x} y={p.y} width={p.w} height={p.h} rx={Math.min(2, p.w / 3)} fill={`url(#${prefix}-${p.token})`} stroke={TODAY_PLATES[p.token].lip} strokeWidth={1} />
      ))}
      {layout.clamps.map((c, i) => (
        <Rect key={`c${i}`} x={c.x} y={c.y} width={c.w} height={c.h} rx={1.5} fill={steel.hi} stroke={steel.lo} strokeWidth={0.8} />
      ))}
    </G>
  );
}

/**
 * The side-on barbell. `lod="hero"` (default) is the Today hero: plates per side heaviest first from the inner collar, optional dashed
 * ghosts. `lod="grid"` is the logger dock's 96×32 mini (logger spec §2.2): shaft, two collars and one flat rect per plate, outer plates
 * merged above 4 per side, no gradients (≤12 shapes).
 */
export function BarArt({ perSide, ghost, unit, height, lifted, lod = "hero", width = "100%" }: { perSide: readonly number[]; ghost?: readonly number[] | null; unit: Unit; height: number; lifted?: number; lod?: "hero" | "grid"; width?: number | "100%" }) {
  const dark = useIsDark();
  if (lod === "grid") {
    const steel = dark ? BAR_STEEL.dark : BAR_STEEL.light;
    const l = barLayout(gridPlates(perSide), { unit });
    return (
      <Svg width={width} height={height} viewBox={`0 0 ${HERO_W} ${HERO_H}`} {...ART_HIDDEN}>
        <Rect x={0} y={l.cy - 8} width={HERO_W} height={16} fill={steel.base} />
        <Rect x={l.xL - 14} y={l.cy - 22} width={14} height={44} fill={steel.hi} />
        <Rect x={l.xR} y={l.cy - 22} width={14} height={44} fill={steel.hi} />
        {l.plates.map((p, i) => (
          <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={TODAY_PLATES[p.token].face} stroke={TODAY_PLATES[p.token].lip} strokeWidth={2} />
        ))}
      </Svg>
    );
  }
  const layout = barLayout(perSide, { unit, ghost, lifted });
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${HERO_W} ${HERO_H}`} {...ART_HIDDEN}>
      <Defs>
        <PlateRamps tokens={layout.plates.map((p) => p.token)} prefix="tb" />
      </Defs>
      <BarBody layout={layout} dark={dark} />
    </Svg>
  );
}
