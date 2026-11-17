import React from "react";
import Svg, { Circle, Defs, Ellipse, G, Line, Path, Polygon, Rect, Text as SvgText } from "react-native-svg";
import { FONT_FAMILIES } from "../../fonts";
import { HERO_H, HERO_W, plateLook } from "../../logic/barArt";
import { weightText, type Unit } from "../../logic/units";
import { BAR_STEEL, PLATE_NUMERAL_INK, TODAY_OBJECTS, TODAY_PLATES } from "../../palettes";
import { usePalette, useIsDark } from "../../theme";
import { ART_HIDDEN, BarBody, PlateRamps } from "./BarArt";
import { barLayout } from "../../logic/barArt";

const VB = `0 0 ${HERO_W} ${HERO_H}`;
const NUM_FONT = FONT_FAMILIES.latin.bold;

export { DumbbellPairArt, StackArt, stackPinRow } from "./EquipmentArt";
import { DumbbellObject } from "./EquipmentArt";

/** Plate-loaded machine: the frame arm, the horn sleeve, and one side's plates from the frame outward (the load is the total). */
export function HornArt({ perSide, unit, height }: { perSide: readonly number[]; unit: Unit; height: number }) {
  const dark = useIsDark();
  const o = dark ? TODAY_OBJECTS.dark : TODAY_OBJECTS.light;
  const steel = dark ? BAR_STEEL.dark : BAR_STEEL.light;
  const p = usePalette();
  const cy = HERO_H / 2;
  const frameX = 120;
  const looks = perSide.map((kg) => plateLook(kg, unit));
  const room = 150;
  const total = looks.reduce((n, l) => n + l.thickness + 0.8, 0) || 1;
  const k = Math.min(1, room / total);
  let x = frameX + 12;
  return (
    <Svg width="100%" height={height} viewBox={VB} {...ART_HIDDEN}>
      <Defs>
        <PlateRamps tokens={looks.map((l) => l.token)} prefix="th" />
      </Defs>
      <Path d={`M 40 ${HERO_H - 6} L ${frameX} ${cy - 20} L ${frameX + 12} ${cy - 20} L ${frameX + 12} ${cy + 20} L 70 ${HERO_H - 6} Z`} fill={o.frame} stroke={p.edge} strokeWidth={1} />
      <Rect x={frameX + 12} y={cy - 7} width={room + 30} height={14} rx={2} fill={steel.base} stroke={steel.edge} strokeWidth={0.6} />
      {looks.map((l, i) => {
        const w = l.thickness * k;
        const r = <Rect key={i} x={x} y={cy - l.diameter / 2} width={w} height={l.diameter} rx={Math.min(2, w / 3)} fill={`url(#th-${l.token})`} stroke={TODAY_PLATES[l.token].lip} strokeWidth={1} />;
        x += w + 0.8;
        return r;
      })}
    </Svg>
  );
}

/** A face-on plate disc with its numeral and hub (belt, racked plates on the floor). */
export function FaceOnPlate({ cx, cy, kg, unit, r }: { cx: number; cy: number; kg: number; unit: Unit; r: number }) {
  const look = plateLook(kg, unit);
  const c = TODAY_PLATES[look.token];
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r} fill={c.face} stroke={c.lip} strokeWidth={1.2} />
      <Circle cx={cx} cy={cy} r={r * 0.22} fill={c.lo} />
      <SvgText x={cx} y={cy - r * 0.38} fontSize={13} fontFamily={NUM_FONT} fontWeight="700" fill={PLATE_NUMERAL_INK[look.token]} textAnchor="middle">
        {weightText(kg, unit)}
      </SvgText>
    </G>
  );
}

/** Dip belt: strap, two chain links, and the face-on plate disc(s) that make the added load. */
export function BeltArt({ plates, unit, height }: { plates: readonly number[]; unit: Unit; height: number }) {
  const dark = useIsDark();
  const o = dark ? TODAY_OBJECTS.dark : TODAY_OBJECTS.light;
  const steel = dark ? BAR_STEEL.dark : BAR_STEEL.light;
  const shown = plates.slice(0, 3);
  return (
    <Svg width="100%" height={height} viewBox={VB} {...ART_HIDDEN}>
      <Path d={`M 60 18 Q ${HERO_W / 2} 44 ${HERO_W - 60} 18`} fill="none" stroke={o.frame} strokeWidth={10} strokeLinecap="round" />
      <Ellipse cx={HERO_W / 2} cy={42} rx={5} ry={8} fill="none" stroke={steel.base} strokeWidth={2.5} />
      <Ellipse cx={HERO_W / 2} cy={56} rx={5} ry={8} fill="none" stroke={steel.base} strokeWidth={2.5} />
      {shown.map((kg, i) => (
        <FaceOnPlate key={i} cx={HERO_W / 2 + (i - (shown.length - 1) / 2) * 62} cy={94} kg={kg} unit={unit} r={Math.max(16, plateLook(kg, unit).diameter * 0.27)} />
      ))}
    </Svg>
  );
}

/** Timed hold: the object (a dumbbell or a bar) beside a quiet, static seconds dial. Not a countdown. */
export function HoldArt({ object, load, unit, height }: { object: "dumbbell" | "bar" | "none"; load: number; unit: Unit; height: number }) {
  const dark = useIsDark();
  const p = usePalette();
  const dialX = object === "none" ? HERO_W / 2 : HERO_W - 70;
  return (
    <Svg width="100%" height={height} viewBox={VB} {...ART_HIDDEN}>
      {object === "dumbbell" ? <DumbbellObject x={40} y={25} width={200} label={load > 0 ? weightText(load, unit) : null} /> : null}
      {object === "bar" ? (
        <G transform="translate(0 0) scale(0.72)">
          <BarBody layout={barLayout([], { unit })} dark={dark} />
        </G>
      ) : null}
      <Circle cx={dialX} cy={HERO_H / 2} r={40} fill="none" stroke={p.edge} strokeWidth={2} />
      <Path d={`M ${dialX} ${HERO_H / 2 - 40} A 40 40 0 0 1 ${dialX + 40} ${HERO_H / 2}`} fill="none" stroke={p.text} strokeWidth={4} strokeLinecap="round" />
    </Svg>
  );
}

/** Done for today: the next day's bar on J-hooks; its plates stand face-on on the floor beside the right upright, not on the bar. */
export function RackedArt({ perSide, unit, height }: { perSide: readonly number[]; unit: Unit; height: number }) {
  const dark = useIsDark();
  const o = dark ? TODAY_OBJECTS.dark : TODAY_OBJECTS.light;
  const steel = dark ? BAR_STEEL.dark : BAR_STEEL.light;
  const shown = perSide.slice(0, 3);
  return (
    <Svg width="100%" height={height} viewBox={VB} {...ART_HIDDEN}>
      <Rect x={70} y={10} width={10} height={HERO_H - 14} fill={o.frame} />
      <Rect x={HERO_W - 120} y={10} width={10} height={HERO_H - 14} fill={o.frame} />
      <Path d={`M 80 40 h 10 v 8 h -10 M ${HERO_W - 110} 40 h 10 v 8 h -10`} fill="none" stroke={steel.lo} strokeWidth={3} />
      <Rect x={30} y={36} width={HERO_W - 110} height={8} rx={3} fill={steel.base} />
      {shown.map((kg, i) => (
        <FaceOnPlate key={i} cx={HERO_W - 70 + i * 6} cy={HERO_H - 34 + i * 2} kg={kg} unit={unit} r={Math.max(14, plateLook(kg, unit).diameter * 0.25)} />
      ))}
    </Svg>
  );
}
