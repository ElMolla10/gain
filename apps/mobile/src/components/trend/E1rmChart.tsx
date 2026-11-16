import React, { useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { smoothPath } from "../../logic/chartPath";
import { space, type as ty, usePalette } from "../../theme";
import { AppText } from "../../ui";

export interface ChartPoint {
  at: number;
  /** Value in the unit it is drawn in (already converted). */
  value: number;
  imported?: boolean;
}

const HEIGHT = 132;
const PAD_X = 8;
const PAD_Y = 12;

/**
 * The Summary chart: one estimated-1RM line with a soft fill, a dashed projection continuing the current pace, and (with a goal)
 * a dashed goal line with a marker where the projection crosses it. Always drawn left-to-right (time does not flip in RTL).
 * Imported sessions are hollow dots. The picture has a spoken `summary`; the numbers are also on screen as text.
 */
export function E1rmChart({
  points,
  projection,
  goal,
  fromLabel,
  toLabel,
  summary,
}: {
  points: ChartPoint[];
  projection?: { at: number; value: number } | null;
  goal?: { value: number; at: number | null } | null;
  fromLabel: string;
  toLabel: string;
  summary: string;
}) {
  const p = usePalette();
  const [width, setWidth] = useState(300);
  if (points.length === 0) return null;
  const first = points[0]!.at;
  const lastPt = points[points.length - 1]!;
  const xEnd = Math.max(lastPt.at, projection?.at ?? lastPt.at, goal?.at ?? lastPt.at);
  const values = [...points.map((q) => q.value), ...(projection ? [projection.value] : []), ...(goal ? [goal.value] : [])];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi - lo < 1) { lo -= 1; hi += 1; }
  const span = xEnd - first || 1;
  const x = (at: number) => PAD_X + ((at - first) / span) * (width - PAD_X * 2);
  const y = (v: number) => PAD_Y + (1 - (v - lo) / (hi - lo)) * (HEIGHT - PAD_Y * 2);
  const xy = points.map((q) => ({ x: points.length === 1 ? x(first) : x(q.at), y: y(q.value) }));
  const line = smoothPath(xy);
  const area = xy.length > 1 ? `${line} L${xy[xy.length - 1]!.x.toFixed(1)},${HEIGHT} L${xy[0]!.x.toFixed(1)},${HEIGHT} Z` : "";
  const last = xy[xy.length - 1]!;
  const showDots = points.length <= 24;
  const goalY = goal ? y(goal.value) : null;
  const marker = goal && goal.at !== null ? { x: x(goal.at), y: y(goal.value) } : null;
  return (
    <View style={{ gap: space.xs }}>
      <View accessible accessibilityRole="image" accessibilityLabel={summary} onLayout={(e) => setWidth(Math.max(120, e.nativeEvent.layout.width))} style={{ direction: "ltr", height: HEIGHT }}>
        <Svg width={width} height={HEIGHT}>
          <Defs>
            <LinearGradient id="e1rmFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={p.accent} stopOpacity={0.32} />
              <Stop offset="1" stopColor={p.accent} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <Line key={f} x1={PAD_X} x2={width - PAD_X} y1={PAD_Y + f * (HEIGHT - PAD_Y * 2)} y2={PAD_Y + f * (HEIGHT - PAD_Y * 2)} stroke={p.border} strokeWidth={1} />
          ))}
          {goalY !== null ? <Line x1={PAD_X} x2={width - PAD_X} y1={goalY} y2={goalY} stroke={p.muted} strokeWidth={1} strokeDasharray="4 4" opacity={0.7} /> : null}
          {area ? <Path d={area} fill="url(#e1rmFill)" /> : null}
          <Path d={line} stroke={p.accent} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {projection ? (
            <Line x1={last.x} y1={last.y} x2={x(projection.at)} y2={y(projection.value)} stroke={p.accent} strokeWidth={2} strokeDasharray="5 5" opacity={0.75} />
          ) : null}
          {showDots
            ? xy.slice(0, -1).map((c, i) =>
                points[i]!.imported ? (
                  <Circle key={points[i]!.at} cx={c.x} cy={c.y} r={3} fill={p.card} stroke={p.muted} strokeWidth={1.5} />
                ) : (
                  <Circle key={points[i]!.at} cx={c.x} cy={c.y} r={3} fill={p.accent} />
                ),
              )
            : null}
          <Circle cx={last.x} cy={last.y} r={7} fill={p.accent} opacity={0.3} />
          <Circle cx={last.x} cy={last.y} r={4} fill={p.accent} />
          {marker ? (
            <>
              <Circle cx={marker.x} cy={marker.y} r={6} fill={p.card} stroke={p.accent} strokeWidth={2} />
              <Circle cx={marker.x} cy={marker.y} r={2} fill={p.accent} />
            </>
          ) : null}
        </Svg>
      </View>
      <View style={{ direction: "ltr", flexDirection: "row", justifyContent: "space-between" }}>
        <AppText style={{ color: p.muted, fontSize: ty.caption }}>{fromLabel}</AppText>
        <AppText style={{ color: p.muted, fontSize: ty.caption }}>{toLabel}</AppText>
      </View>
    </View>
  );
}
