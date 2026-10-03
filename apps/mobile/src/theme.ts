import { useSyncExternalStore } from "react";
import { useColorScheme } from "react-native";

import { APPEARANCES, parseAppearance, type Appearance, darkPalette, lightPalette, logDarkPalette, logLightPalette, type LogPalette, type Palette } from "./palettes";
export type { LogPalette, Palette };

/**
 * One visual identity: charcoal background with a mint-green accent, in the logger, the navigation and every screen. Dark is the default;
 * the lifter can switch to light or follow the system in Settings > Display. Other colours are for warnings and status only.
 * Colour is never the only status: labels always carry the meaning.
 */
export { APPEARANCES, parseAppearance, type Appearance };

let appearance: Appearance = "dark";
const listeners = new Set<() => void>();
export function setAppearance(a: Appearance): void {
  if (a === appearance) return;
  appearance = a;
  listeners.forEach((l) => l());
}
export const getAppearance = (): Appearance => appearance;
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** The chosen appearance setting (dark, light or system), re-rendering when it changes. */
export function useAppearance(): Appearance {
  return useSyncExternalStore(subscribe, getAppearance, getAppearance);
}

/** The scheme actually drawn: the chosen appearance, or the system's when "system". */
export function useIsDark(): boolean {
  const system = useColorScheme();
  const a = useSyncExternalStore(subscribe, getAppearance, getAppearance);
  return a === "system" ? system === "dark" : a === "dark";
}

export function usePalette(): Palette {
  return useIsDark() ? darkPalette : lightPalette;
}

/**
 * Spacing: tighter than before (less padding, less copy) so a screen shows more at once. Touch targets stay at 48 dp or more.
 */
export const space = { xs: 4, sm: 8, md: 12, lg: 18, xl: 28 };
export const MIN_TOUCH = 48;

/** Type scale (dp, before the user's font scaling, which is always honoured): titles 28-32, sections 18-20, body 15-16, secondary 12-14. */
export const type = { title: 28, titleLarge: 32, section: 19, sectionSmall: 18, body: 16, bodySmall: 15, secondary: 13, caption: 12 };

export function useLogPalette(): LogPalette {
  return useIsDark() ? logDarkPalette : logLightPalette;
}
