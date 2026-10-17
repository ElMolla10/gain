import type { Palette } from "../palettes";

/**
 * State colours for switches and the onboarding progress bar (Plate S-10). The lime fill is ~1.1–1.3:1 on light surfaces, so in light
 * mode a state boundary is drawn in `accent` (dark olive, 7.6:1+) instead. Dark mode keeps its lime look.
 */
export function switchColors(p: Palette, isLight: boolean, on: boolean): { trackOn: string; trackOff: string; thumb: string; iosBackground: string } {
  if (isLight) return { trackOn: p.accent, trackOff: p.edge, thumb: p.card /* white */, iosBackground: p.edge };
  return { trackOn: p.fill, trackOff: p.edge, thumb: on ? p.onFill : p.card, iosBackground: p.edge };
}

export function progressColors(p: Palette, isLight: boolean): { active: string; inactive: string; inactiveOpacity: number; height: number } {
  if (isLight) return { active: p.accent, inactive: p.edge, inactiveOpacity: 0.4, height: 6 };
  return { active: p.fill, inactive: p.border, inactiveOpacity: 1, height: 4 };
}
