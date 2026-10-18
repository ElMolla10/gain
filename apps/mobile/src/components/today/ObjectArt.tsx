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

function hex(cx: number, cy: number, r: number): string {
  return [0, 1, 2, 3, 4, 5].map((i) => `${cx + r * Math.cos((Math.PI / 3) * i + Math.PI / 6)},${cy + r * Math.sin((Math.PI / 3) * i + Math.PI / 6)}`).join(" ");
}

/** One hex dumbbell, side-on: handle + two rubber heads, the load printed on the front head (Latin digits, LTR). */
function Dumbbell({ cx, cy, label, dark }: { cx: number; cy: number; label: string | null; dark: boolean }) {
  const o = dark ? TODAY_OBJECTS.dark : TODAY_OBJECTS.light;
  const steel = dark ? BAR_STEEL.dark : BAR_STEEL.light;
  return (
    <G>
      <Rect x={cx - 40} y={cy - 4} width={80} height={8} rx={3} fill={steel.base} />
      <Polygon points={hex(cx - 52, cy, 26)} fill={o.rubber} stroke={o.rubberEdge} strokeWidth={1.5} />
      <Polygon points={hex(cx + 52, cy, 26)} fill={o.rubber} stroke={o.rubberEdge} strokeWidth={1.5} />
      {label ? (
        <SvgText x={cx + 52} y={cy + 6} fontSize={17} fontFamily={NUM_FONT} fontWeight="700" fill={o.rubberInk} textAnchor="middle">
          {label}
        </SvgText>
      ) : null}
    </G>
  );
}

/** A pair of dumbbells, one offset behind the other. */
export function DumbbellPairArt({ load, unit, height }: { load: number; unit: Unit; height: number }) {
  const dark = useIsDark();
  return (
    <Svg width="100%" height={height} viewBox={VB} {...ART_HIDDEN}>
      <G opacity={0.55}>
        <Dumbbell cx={HERO_W / 2 - 34} cy={HERO_H / 2 - 18} label={null} dark={dark} />
      </G>
      <Dumbbell cx={HERO_W / 2 + 18} cy={HERO_H / 2 + 16} label={weightText(load, unit)} dark={dark} />
    </Svg>
  );
}

const STACK_VISIBLE = 12;
/** Where the pin sits in the 12-plate window: its own plate up to the 10th, then held at the 10th (the window scrolls with the pin). */
export function stackPinRow(pinIndex: number | null): number {
  return Math.max(1, Math.min(pinIndex ?? 10, 10));
}

/** The weight stack: 12 plates around the pin, the plates above it (the ones that lift) lighter, a steel pin with a red knob. No numbers. */
export function StackArt({ pinIndex, height }: { pinIndex: number | null; height: number }) {
  const dark = useIsDark();
  const o = dark ? TODAY_OBJECTS.dark : TODAY_OBJECTS.light;
  const steel = dark ? BAR_STEEL.dark : BAR_STEEL.light;
  const row = stackPinRow(pinIndex);
  const x = HERO_W / 2 - 60;
  const h = 8;
  const top = 12;
  return (
    <Svg width="100%" height={height} viewBox={VB} {...ART_HIDDEN}>
      <Rect x={x - 10} y={4} width={140} height={HERO_H - 8} rx={4} fill="none" stroke={o.frame} strokeWidth={3} />
      <Line x1={HERO_W / 2} y1={4} x2={HERO_W / 2} y2={top + row * (h + 1)} stroke={steel.base} strokeWidth={3} />
      {Array.from({ length: STACK_VISIBLE }, (_, i) => (
        <Rect key={i} x={x} y={top + i * (h + 1)} width={120} height={h} rx={1.5} fill={i < row ? o.stackLifted : o.stackPlate} stroke={o.stackPlateEdge} strokeWidth={0.8} />
      ))}
      <Line x1={x + 120} y1={top + (row - 1) * (h + 1) + h / 2} x2={x + 150} y2={top + (row - 1) * (h + 1) + h / 2} stroke={steel.base} strokeWidth={3} />
      <Circle cx={x + 154} cy={top + (row - 1) * (h + 1) + h / 2} r={6} fill={TODAY_PLATES.red.face} stroke={TODAY_PLATES.red.lip} strokeWidth={1} />
    </Svg>
  );
}

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
      {object === "dumbbell" ? <Dumbbell cx={140} cy={HERO_H / 2} label={load > 0 ? weightText(load, unit) : null} dark={dark} /> : null}
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
