import type { EquipmentType, SetupType } from "@gain/engine";
import React from "react";
import { Pressable, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { useI18n } from "../../i18n";
import { barLayout, HERO_W } from "../../logic/barArt";
import type { Unit } from "../../logic/units";
import { BAR_STEEL, TODAY_PLATES } from "../../palettes";
import { radius, space, type as ty, useIsDark, usePalette } from "../../theme";
import { AppText } from "../../ui";
import { ART_HIDDEN } from "./BarArt";
import { RACK_GLYPHS, type RackGlyphName } from "./glyphPaths";

export const RACK_ROW_HEIGHT = 64;
export const XRAY_LONG_PRESS_MS = 400;
/** Grid LOD: plate thickness × 0.36, never under 2.4 dp at the 160 dp size. */
export const XRAY_THICKNESS = 0.36;
const XRAY_MIN = 2.4;

export function glyphFor(equipment: EquipmentType, setup: SetupType): RackGlyphName {
  if (setup === "assisted" || equipment === "assisted") return "assisted";
  if (setup === "bodyweight_plus_added") return "body";
  return equipment;
}

export function RackGlyph({ name, color }: { name: RackGlyphName; color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" {...ART_HIDDEN}>
      {RACK_GLYPHS[name].map((d, i) => (
        <Path key={i} d={d} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

/** The delta chip, in words: 13/18 600, raised fill, 1 dp edge, pill. Never colour alone. */
export function DeltaChip({ text }: { text: string }) {
  const p = usePalette();
  return (
    <View style={{ alignSelf: "flex-end", paddingHorizontal: space.sm, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: p.raised, borderWidth: 1, borderColor: p.edge }}>
      <AppText style={{ fontSize: ty.caption, lineHeight: 18, fontWeight: "600", color: p.text }}>{text}</AppText>
    </View>
  );
}

/** The x-ray: a 160 × 46 mini bar in grid LOD (flat fills, thickness × 0.36, min 2.4), in a raised panel. */
export function PlateXray({ perSide, unit }: { perSide: readonly number[]; unit: Unit }) {
  const dark = useIsDark();
  const p = usePalette();
  const steel = dark ? BAR_STEEL.dark : BAR_STEEL.light;
  const l = barLayout(perSide, { unit });
  return (
    <View style={{ alignSelf: "flex-end", padding: space.sm, borderRadius: radius.button, backgroundColor: p.raised, shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
      <Svg width={160} height={46} viewBox={`0 0 ${HERO_W} 132`} {...ART_HIDDEN}>
        <Rect x={0} y={l.cy - 6} width={HERO_W} height={12} fill={steel.base} />
        {l.plates.map((r, i) => {
          const w = Math.max(XRAY_MIN * (HERO_W / 160), r.w * XRAY_THICKNESS);
          const inner = i < l.plates.length / 2 ? r.x + r.w - w : r.x;
          return <Rect key={i} x={inner} y={r.y} width={w} height={r.h} fill={TODAY_PLATES[r.token].face} />;
        })}
      </Svg>
    </View>
  );
}

export interface RackRowProps {
  name: string;
  scheme: string;
  target: string | null;
  noTarget: string;
  chip: string | null;
  glyph: RackGlyphName;
  a11yLabel: string;
  expanded: boolean;
  onToggle: () => void;
  /** Barbell rows: the x-ray plates; long-press shows them. */
  xray?: { perSide: number[]; open: boolean; onOpen: () => void } | null;
  /** The inline expansion (last time's sets, reason, Why). */
  children?: React.ReactNode;
}

/** A 64 dp rack row: glyph at the start, name 16/600 + scheme 14 muted, target 20/26 600 tabular in `text` with the chip under it. */
export function RackRow(props: RackRowProps) {
  const { t, unit } = useI18n();
  const p = usePalette();
  const actions = [{ name: "activate", label: t("today.rack.expand") }, ...(props.xray ? [{ name: "longpress", label: t("today.rack.showPlates") }] : [])];
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.a11yLabel}
        accessibilityState={{ expanded: props.expanded }}
        accessibilityActions={actions}
        onAccessibilityAction={(e) => (e.nativeEvent.actionName === "longpress" ? props.xray?.onOpen() : props.onToggle())}
        onPress={props.onToggle}
        onLongPress={props.xray ? props.xray.onOpen : undefined}
        delayLongPress={XRAY_LONG_PRESS_MS}
        style={({ pressed }) => ({ minHeight: RACK_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, backgroundColor: pressed ? p.raised : "transparent", borderRadius: radius.button })}
      >
        <RackGlyph name={props.glyph} color={p.muted} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ fontSize: ty.body, fontWeight: "600" }}>{props.name}</AppText>
          <AppText style={{ fontSize: ty.label, lineHeight: 20, color: p.muted }}>{props.scheme}</AppText>
        </View>
        <View style={{ alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
          {props.target ? (
            <AppText style={{ fontSize: ty.section, lineHeight: 26, fontWeight: "600", color: p.text, fontVariant: ["tabular-nums"] }}>{props.target}</AppText>
          ) : (
            <AppText style={{ fontSize: ty.label, color: p.muted }}>{props.noTarget}</AppText>
          )}
          {props.chip ? <DeltaChip text={props.chip} /> : null}
        </View>
      </Pressable>
      {props.xray?.open ? <PlateXray perSide={props.xray.perSide} unit={unit} /> : null}
      {props.expanded ? <View style={{ paddingBottom: space.sm, gap: space.xs }}>{props.children}</View> : null}
    </View>
  );
}
