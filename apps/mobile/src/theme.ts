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
