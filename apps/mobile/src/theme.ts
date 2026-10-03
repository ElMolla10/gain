import { useColorScheme } from "react-native";

export interface Palette {
  bg: string;
  card: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  border: string;
  disabled: string;
}

const light: Palette = { bg: "#f6f6f4", card: "#ffffff", text: "#141414", muted: "#5d5d5a", accent: "#1f6f4a", accentText: "#ffffff", border: "#d9d9d4", disabled: "#b9b9b3" };
const dark: Palette = { bg: "#101211", card: "#1a1d1b", text: "#f2f2ee", muted: "#a5a8a2", accent: "#4cc38a", accentText: "#06150e", border: "#303432", disabled: "#555955" };

/** Optional dark mode follows the system. Colour is never the only status: labels always carry the meaning. */
export function usePalette(): Palette {
  return useColorScheme() === "dark" ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const MIN_TOUCH = 56; // large one-thumb targets

/**
 * Colours of the active workout screen (Hevy-style: near-black with a blue accent in dark mode, soft grey and white in light mode).
 * Follows the system theme like everything else. Status is never colour alone: ticks, "W" and text carry it too.
 */
export interface LogPalette {
  bg: string;
  card: string;
  field: string;
  line: string;
  text: string;
  muted: string;
  /** Blue used for text and icons on `bg`. */
  blue: string;
  /** Blue used as a button / filled box background (white text on it). */
  blueFill: string;
  onBlue: string;
  /** Background of a ticked (logged) row. */
  doneBg: string;
  warn: string;
  danger: string;
}

const logDark: LogPalette = { bg: "#000000", card: "#111214", field: "#1e2024", line: "#2a2c31", text: "#f5f5f5", muted: "#9ea3ab", blue: "#5aa2ff", blueFill: "#2563eb", onBlue: "#ffffff", doneBg: "#0f2342", warn: "#f5b13d", danger: "#ff6b6b" };
const logLight: LogPalette = { bg: "#f2f3f5", card: "#ffffff", field: "#e8eaee", line: "#d5d9df", text: "#111418", muted: "#566070", blue: "#1558c0", blueFill: "#1d5fd0", onBlue: "#ffffff", doneBg: "#dfeafb", warn: "#8a5a00", danger: "#c4262b" };

export function useLogPalette(): LogPalette {
  return useColorScheme() === "dark" ? logDark : logLight;
}
