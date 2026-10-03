import { useColorScheme } from "react-native";

import { darkPalette, lightPalette, logDarkPalette, logLightPalette, type LogPalette, type Palette } from "./palettes";
export type { LogPalette, Palette };

/** Optional dark mode follows the system. Colour is never the only status: labels always carry the meaning. */
export function usePalette(): Palette {
  return useColorScheme() === "dark" ? darkPalette : lightPalette;
}

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const MIN_TOUCH = 56; // large one-thumb targets

export function useLogPalette(): LogPalette {
  return useColorScheme() === "dark" ? logDarkPalette : logLightPalette;
}
