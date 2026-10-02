import React from "react";
import { Image, View } from "react-native";

// PNG fallback for the SVG master (assets/brand/gain-mark.svg): react-native-svg is not a dependency.
const mark = require("../assets/gain-logo.png") as number;

/** The official GAIN plate-and-arrow mark on its black tile. Decorative: the adjacent "GAIN" text names the app. */
export function BrandLogo({ size = 40 }: { size?: number }) {
  const pad = Math.round(size * 0.1);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="GAIN logo"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.24), backgroundColor: "#000000", padding: pad }}
    >
      <Image source={mark} style={{ width: size - pad * 2, height: size - pad * 2 }} resizeMode="contain" />
    </View>
  );
}
