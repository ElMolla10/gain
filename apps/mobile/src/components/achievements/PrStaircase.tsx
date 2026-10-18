import React from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { stairGeometry, STAIR_H, STAIR_W, type StairStep } from "../../logic/achievementShowcase";
import { useAchievementArt } from "../../theme";

/**
 * The PR staircase (spec §2): one step per verified PR on this lift, oldest on the left, the latest step in the accent with an end dot,
 * rep-only PRs as a small tick. It is a chart, so it never mirrors and rises left → right in both languages; no axis values are drawn.
 * One accessibility element with the spoken summary.
 */
export function PrStaircase({ steps, baseline, assisted, label, scale = 1 }: { steps: StairStep[]; baseline: number | null; assisted?: boolean; label: string; scale?: number }) {
  const art = useAchievementArt();
  const g = stairGeometry(steps, baseline, assisted);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: STAIR_W * scale, height: STAIR_H * scale, direction: "ltr" }}>
      <Svg width={STAIR_W * scale} height={STAIR_H * scale} viewBox={`0 0 ${STAIR_W} ${STAIR_H}`}>
        <Path d={g.area} fill={art.ledge} opacity={0.7} />
        <Path d={g.path} fill="none" stroke={art.ghost} strokeWidth={2} strokeLinejoin="round" />
        {g.ticks.map((tk, i) => (
          <Path key={i} d={`M${tk.x} ${tk.y - 4} V${tk.y + 4}`} stroke={art.ghost} strokeWidth={1.5} />
        ))}
        <Path d={g.last} fill="none" stroke={art.arcDone} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={g.dot.x} cy={g.dot.y} r={3.5} fill={art.arcDone} />
      </Svg>
    </View>
  );
}
