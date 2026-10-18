import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";
import { haptics } from "../../haptics";
import { useI18n } from "../../i18n";
import { unveilDuration } from "../../logic/earnMoment";
import { useReducedMotion } from "../../ui";
import { UnveilContext } from "./UnveilMedal";

/**
 * The one-time cabinet unveil after a history backfill (spec §6.1 E): on the Achievements tab, when `bannerCount > 0`, the earned
 * medals fade and scale onto their shelves in reading order (40 ms stagger, 300 ms each, no flip), one Success fires at the end, it is
 * announced once, then `onDone` dismisses the banner. Reduce Motion: no stagger, the medals are simply there, still one Success.
 */
export function CabinetUnveil({ active, count, order, onDone, children }: { active: boolean; count: number; order: Map<string, number>; onDone: () => void; children?: React.ReactNode }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const clock = useRef(new Animated.Value(0)).current;
  const end = unveilDuration(order.size);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const finish = () => {
      if (!alive) return;
      haptics.celebrate();
      AccessibilityInfo.announceForAccessibility(t("achv.banner", { n: count }));
      onDone();
    };
    if (reduced || end === 0) {
      clock.setValue(end);
      finish();
    } else {
      clock.setValue(0);
      Animated.timing(clock, { toValue: end, duration: end, easing: Easing.linear, useNativeDriver: true }).start(({ finished }) => {
        if (!finished) clock.setValue(end);
        finish();
      });
    }
    return () => {
      alive = false;
      clock.stopAnimation();
      clock.setValue(end);
    };
  }, [active]);
  return <UnveilContext.Provider value={active && !reduced ? { clock, order } : null}>{children}</UnveilContext.Provider>;
}
