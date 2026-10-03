import { useSyncExternalStore } from "react";
import { useColorScheme } from "react-native";

import { gainTokens } from "./design/tokens";
import { APPEARANCES, parseAppearance, type Appearance, darkPalette, lightPalette, logDarkPalette, logLightPalette, type LogPalette, type Palette } from "./palettes";
export type { LogPalette, Palette };

/**
 * One visual identity (GAIN identity v1): electric lime on ink in dark, ink on bone with lime fills in light. Dark is the default;
 * the lifter can switch to light or follow the system in Settings > Display. Lime is the single accent; status colours are for status only.
 * Colour is never the only status: labels and icons always carry the meaning.
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

export function useLogPalette(): LogPalette {
  return useIsDark() ? logDarkPalette : logLightPalette;
}

/** Spacing: 4 px base; 16 gutters; 24 between sections (kit tokens). `lg` and `xl` are the gutter and the section gap. */
export const space = gainTokens.spacing;
/** Corners: inputs 8, actions 12, cards 16, sheets 24 (kit tokens). */
export const radius = gainTokens.radius;
export const MIN_TOUCH = gainTokens.interaction.minTouchTarget;
export const INPUT_HEIGHT = gainTokens.interaction.inputHeight;
export const PRIMARY_HEIGHT = gainTokens.interaction.primaryButtonHeight;
/** Motion (ms). Zero when the lifter asked for reduced motion; see useReducedMotion in ui.tsx. */
export const motion = gainTokens.interaction.motionMs;

/**
 * Type scale (dp, before the user's font scaling, which is always honoured): display 48, load 36, screen title 28, section 20,
 * body 16, label 14, caption 13. The older names are aliases so every screen draws from the same seven sizes.
 */
export const type = {
  display: gainTokens.type.display.size,
  load: gainTokens.type.load.size,
  title: gainTokens.type.screen.size,
  titleLarge: gainTokens.type.screen.size,
  section: gainTokens.type.section.size,
  sectionSmall: gainTokens.type.body.size,
  body: gainTokens.type.body.size,
  bodySmall: gainTokens.type.label.size,
  label: gainTokens.type.label.size,
  secondary: gainTokens.type.caption.size,
  caption: gainTokens.type.caption.size,
};
/** Every font size the app may draw (kit scale + Arabic body 17). Enforced by test/design.test.ts. */
export const TYPE_SIZES: readonly number[] = [13, 14, 16, 17, 20, 28, 36, 48];
