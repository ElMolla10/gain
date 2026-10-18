import React, { createContext, useContext } from "react";
import { Animated, Easing } from "react-native";
import { unveilWindow } from "../../logic/earnMoment";

/** The running cabinet unveil (see CabinetUnveil): one native-driven clock in ms and each earned slot's place in the stagger. */
export const UnveilContext = createContext<{ clock: Animated.Value; order: Map<string, number> } | null>(null);

/** Wraps a shelf medal: while the unveil runs, it fades and scales 0.6 → 1 in its slot of the stagger. Otherwise a plain pass-through. */
export function UnveilMedal({ slot, children }: { slot: string; children?: React.ReactNode }) {
  const u = useContext(UnveilContext);
  const index = u?.order.get(slot);
  if (!u || index === undefined) return <>{children}</>;
  const range = unveilWindow(index);
  return (
    <Animated.View
      style={{
        opacity: u.clock.interpolate({ inputRange: range, outputRange: [0, 1], extrapolate: "clamp" }),
        transform: [{ scale: u.clock.interpolate({ inputRange: range, outputRange: [0.6, 1], extrapolate: "clamp", easing: Easing.out(Easing.cubic) }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}
