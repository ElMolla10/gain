import React from "react";
import { View } from "react-native";

export type TabIconName = "today" | "plan" | "history" | "settings";

/**
 * Explicit tab icons drawn with plain Views (no icon font to fail to load, so there is never a broken-glyph box).
 * The size is 24 dp; the tab bar passes the focus colour. Labels carry the meaning, the icon is decoration.
 */
export function TabIcon({ name, color, size = 24 }: { name: TabIconName; color: string; size?: number }) {
  const w = 2;
  const box = { width: size, height: size, alignItems: "center", justifyContent: "center" } as const;
  if (name === "today") {
    // A calendar page: outlined square with a header bar and a dot.
    return (
      <View style={box} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ width: size - 4, height: size - 4, borderWidth: w, borderColor: color, borderRadius: 4, alignItems: "center" }}>
          <View style={{ width: "100%", height: 5, backgroundColor: color }} />
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginTop: 3 }} />
        </View>
      </View>
    );
  }
  if (name === "plan") {
    // A list: three bars with bullets.
    return (
      <View style={[box, { gap: 4 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 3, width: size - 4 }}>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
            <View style={{ flex: 1, height: w, backgroundColor: color, borderRadius: 1 }} />
          </View>
        ))}
      </View>
    );
  }
  if (name === "history") {
    // A clock face.
    return (
      <View style={box} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ width: size - 2, height: size - 2, borderRadius: (size - 2) / 2, borderWidth: w, borderColor: color, alignItems: "center" }}>
          <View style={{ width: w, height: 8, backgroundColor: color, marginTop: 3 }} />
          <View style={{ width: 6, height: w, backgroundColor: color, alignSelf: "flex-start", marginStart: (size - 2) / 2 - 2 }} />
        </View>
      </View>
    );
  }
  // Settings: three sliders.
  return (
    <View style={[box, { gap: 4 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0.3, 0.7, 0.45].map((pos, i) => (
        <View key={i} style={{ width: size - 4, height: 6, justifyContent: "center" }}>
          <View style={{ height: w, backgroundColor: color }} />
          <View style={{ position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginStart: (size - 10) * pos }} />
        </View>
      ))}
    </View>
  );
}
