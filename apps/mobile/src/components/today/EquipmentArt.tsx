import React, { useId } from "react";
import Svg, { Circle, Defs, Ellipse, G, Image as SvgImage, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { EQUIPMENT_SOURCES } from "./equipmentSources";
import { FONT_FAMILIES } from "../../fonts";
import { HERO_H, HERO_W } from "../../logic/barArt";
import { weightText, type Unit } from "../../logic/units";
import { usePalette } from "../../theme";
import { TODAY_EQUIPMENT as metal } from "../../palettes";
import { ART_HIDDEN } from "./BarArt";
const VB = `0 0 ${HERO_W} ${HERO_H}`;
const font = FONT_FAMILIES.latin.bold;
export const knownLoadLabel = (load: number | null, unit: Unit): string | null => load != null && Number.isFinite(load) && load >= 0 ? weightText(load, unit) : null;

/** One reusable unnumbered cutout. Labels share its transform; neither geometry nor numerals follow RTL. */
export function DumbbellObject({ x, y, width, label }: { x: number; y: number; width: number; label: string | null }) {
  const height = width * 426 / 1024;
  return <G>
    <SvgImage href={EQUIPMENT_SOURCES.dumbbell} x={x} y={y} width={width} height={height} />
    {label !== null ? <SvgText x={x+width*.853} y={y+height*.58} textAnchor="middle" fontFamily={font} fontWeight="700" fontSize={label.length>4?14:18} fill={metal.stamp} stroke={metal.stampEdge} strokeWidth={.25}>{label}</SvgText> : null}
  </G>;
}
export function DumbbellPairArt({ load, unit, height, count=2 }: { load: number | null; unit: Unit; height: number; count?: 1 | 2 }) {
  const label=knownLoadLabel(load,unit);
  return <Svg width="100%" height={height} viewBox={VB} {...ART_HIDDEN}>
    {count===2 ? <G rotation={-4} origin="160,54"><DumbbellObject x={48} y={14} width={210} label={null}/></G> : null}
    <G rotation={-6} origin="235,80"><DumbbellObject x={count===1?65:123} y={count===1?15:34} width={count===1?250:225} label={label}/></G>
  </Svg>;
}
/** An unknown stack has no selected row. The old default-row and clamp guesses must never return. */
export function stackPinRow(pinIndex: number | null): number | null {
  return pinIndex!=null && Number.isInteger(pinIndex) && pinIndex>0 ? pinIndex : null;
}
function SelectorPin({ x,y,uid }: {x:number;y:number;uid:string}) {
  return <G>
    <Rect x={x-10} y={y-3.5} width={22} height={7} rx={3.4} fill={`url(#${uid}lime)`} stroke={metal.pinEdge} strokeWidth={.65}/>
    <Rect x={x-3.3} y={y-1} width={7} height={11} rx={2.5} fill={`url(#${uid}lime)`} stroke={metal.pinEdge} strokeWidth={.5}/>
    <Path d={`M${x} ${y+10} C${x-1} ${y+26} ${x+16} ${y+26} ${x+16} ${y+10}`} fill="none" stroke={metal.tether} strokeWidth={3}/>
    {Array.from({length:9},(_,i)=>{const a=Math.PI-i*Math.PI/8;return <Ellipse key={i} cx={x+8+8*Math.cos(a)} cy={y+11+11*Math.sin(a)} rx={2} ry={1.1} fill="none" stroke={metal.coil} strokeWidth={.65}/>;})}
    <Circle cx={x+16} cy={y+9} r={2} fill={metal.eyelet} stroke={metal.eyeletEdge} strokeWidth={.6}/>
  </G>;
}
export function StackArt({ pinIndex, height, load=null, unit="kg", rowCount }: { pinIndex:number|null; height:number; load?:number|null; unit?:Unit; rowCount?:number|null }) {
  const p=usePalette();
  const uid=`equipment${useId().replace(/[^a-z0-9]/gi,"")}`;
  const absoluteRow=stackPinRow(pinIndex);
  const total=Math.max(absoluteRow??0,Math.max(1,rowCount??12));
  const firstRow=absoluteRow!==null && total>24 ? Math.max(1,absoluteRow-12) : 1;
  const count=Math.min(24,total-firstRow+1);
  const row=absoluteRow!==null?absoluteRow-firstRow+1:null;
  const pitch=Math.min(7,72/count), top=20+(72-count*pitch)/2, x=42, width=258;
  const holeX=167, pinY=row!==null?top+(row-1)*pitch+pitch*1.5:85;
  const label=knownLoadLabel(load,unit);
  return <Svg width="100%" height={height} viewBox={VB} {...ART_HIDDEN}>
    <Defs>
      <LinearGradient id={`${uid}steel`} x1="0" y1="0" x2="1" y2="0"><Stop stopColor={metal.steelLo}/><Stop offset=".32" stopColor={metal.steelHi}/><Stop offset=".56" stopColor={metal.steelMid}/><Stop offset=".78" stopColor={metal.steelShine}/><Stop offset="1" stopColor={metal.steelEdge}/></LinearGradient>
      <LinearGradient id={`${uid}lime`} x1="0" y1="0" x2="0" y2="1"><Stop stopColor={metal.limeHi}/><Stop offset=".45" stopColor={metal.lime}/><Stop offset="1" stopColor={metal.limeLo}/></LinearGradient>
    </Defs>
    {[103,246].map(rx=><G key={rx}><Rect x={rx-4} y={1} width={8} height={top+pitch*1.3} fill={`url(#${uid}steel)`}/><Ellipse cx={rx} cy={top+1} rx={10} ry={3.2} fill={`url(#${uid}steel)`} stroke={metal.collarEdge} strokeWidth={1}/></G>)}
    {Array.from({length:count},(_,i)=>count-1-i).map(i=><SvgImage key={i} href={EQUIPMENT_SOURCES.plate} x={x} y={top+i*pitch} width={width} height={pitch*2} preserveAspectRatio="none"/>)}
    {Array.from({length:count},(_,i)=><Ellipse key={i} cx={holeX} cy={top+i*pitch+pitch*1.5} rx={2.4} ry={Math.min(2.5,pitch*.35)} fill={metal.hole} stroke={metal.holeEdge} strokeWidth={.5}/>)}
    {firstRow>1 ? <Path d="M42 18l9-3m-9 7 9-3" stroke={p.muted} strokeWidth={1.5}/> : null}
    <SelectorPin x={row!==null?holeX:327} y={pinY} uid={uid}/>
    {label!==null ? <SvgText x={row!==null?holeX+22:327} y={row!==null?pinY+4:69} textAnchor={row!==null?"start":"middle"} fontFamily={font} fontWeight="700" fontSize={row!==null?13:18} fill={row!==null?metal.stackStamp:p.text}>{label}</SvgText>:null}
  </Svg>;
}
