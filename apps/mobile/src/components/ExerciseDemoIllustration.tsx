import React from "react";
import { Image, View, type ImageSourcePropType } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { gainTokens } from "../design/tokens";
import { demoArrowPath, exerciseDemoMotion } from "../logic/exerciseDemoMotion";
import { radius } from "../theme";

/** The illustration and arrows share contain fitting. Anatomical motion never mirrors with UI direction. */
export function ExerciseDemoIllustration({ source, seedKey, accessibilityLabel, backgroundColor }: {
  source: ImageSourcePropType;
  seedKey: string;
  accessibilityLabel: string;
  backgroundColor: string;
}) {
  const motion = exerciseDemoMotion(seedKey);
  const stroke = motion ? Math.max(motion.width, motion.height) * 0.008 : 0;
  return (
    <View style={{ width: "100%", height: 400, borderRadius: radius.card, overflow: "hidden", backgroundColor, direction: "ltr" }}>
      <Image source={source} resizeMode="contain" accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ width: "100%", height: "100%" }} />
      {motion ? (
        <Svg
          width="100%" height="100%" viewBox={`0 0 ${motion.width} ${motion.height}`} preserveAspectRatio="xMidYMid meet"
          style={{ position: "absolute", start: 0, top: 0 }} pointerEvents="none"
          accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        >
          {motion.arrows.map((arrow, i) => {
            const d = demoArrowPath(arrow, motion.width, motion.height);
            return (
              <G key={i} fill="none" strokeLinecap="round" strokeLinejoin="round">
                <Path d={d} stroke={gainTokens.colors.ink} strokeWidth={stroke * 1.75} />
                <Path d={d} stroke={gainTokens.colors.lime} strokeWidth={stroke} />
              </G>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}
