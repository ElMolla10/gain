// Pure colour tables (no React Native import) so tests can check contrast. theme.ts picks one by the chosen appearance.
// Brand values come from design/tokens.ts (the identity kit); the semantic extras (tints, light-theme status colours) are
// derived for this app and documented in docs/DESIGN.md.
import { gainTokens } from "./design/tokens";

const c = gainTokens.colors;

export interface Palette {
  /** Screen background (dark: ink, light: bone). */
  bg: string;
  /** Cards and rows (dark: surface, light: white). */
  card: string;
  /** A step above `card`: wells, set rows, the target strip's neighbours. */
  raised: string;
  text: string;
  muted: string;
  /** Accent as TEXT or ICON colour on bg/card: lime on dark, dark olive on light. Never use it as a fill. */
  accent: string;
  /** Primary action FILL: electric lime in both themes. */
  fill: string;
  /** Text and icons on a `fill` surface: ink, never white. */
  onFill: string;
  /** `fill` while pressed (slightly darker). */
  fillPressed: string;
  /** Selected-state background that is quieter than `fill` (target strip, selected row). */
  tint: string;
  /** Decoration only (hairlines, card borders). Not an interactive boundary. */
  border: string;
  /** Boundary of inputs, chips and switches: at least 3:1 against bg, card and raised (WCAG 1.4.11). */
  edge: string;
  disabled: string;
  onDisabled: string;
  /** Status foregrounds: readable as text on bg, card and their own `*Bg` tint. Status is always icon/label + colour. */
  success: string;
  warn: string;
  danger: string;
  successBg: string;
  warnBg: string;
  dangerBg: string;
  /** Text or icon on a solid `danger` surface (the swipe-to-delete action). */
  onDanger: string;
}

export const darkPalette: Palette = {
  bg: c.ink,
  card: c.surface,
  raised: c.raised,
  text: c.text,
  muted: c.muted,
  accent: c.lime,
  fill: c.lime,
  onFill: c.darkAccentText,
  fillPressed: "#9FD816",
  tint: "#2A3320",
  border: c.border,
  edge: "#8A9580",
  disabled: "#2E3527",
  onDisabled: "#A3AB97",
  success: c.success,
  warn: c.warning,
  danger: c.error,
  successBg: "#1C3326",
  warnBg: "#382F15",
  dangerBg: "#3D211E",
  onDanger: c.ink,
};

export const lightPalette: Palette = {
  bg: c.lightBackground,
  card: c.lightSurface,
  raised: "#ECEFE2",
  text: c.lightText,
  muted: c.lightMuted,
  accent: c.lightAccentText,
  fill: c.lime,
  onFill: c.ink,
  fillPressed: "#9FD816",
  tint: "#E7F2C4",
  border: "#D3D8C5",
  edge: c.lightBorder,
  disabled: "#DDE0D2",
  onDisabled: "#4F5B45",
  success: "#1B6B3E",
  warn: "#7A5200",
  danger: "#A3231A",
  successBg: "#DCF2E4",
  warnBg: "#FAEDC4",
  dangerBg: "#FCE4E1",
  onDanger: "#FFFFFF",
};

/**
 * Colours of the active workout screen. It is the same identity as every other screen (same accent, same surfaces): the logger is
 * a view over the main palette plus two extras (`field`, `doneBg`). Status is never colour alone: ticks, "W" and text carry it too.
 */
export interface LogPalette {
  bg: string;
  card: string;
  /** Input wells and unticked set rows. */
  field: string;
  line: string;
  text: string;
  muted: string;
  /** Accent as text / icon colour on `bg` (lime on dark, dark olive on light). */
  accent: string;
  /** Filled controls (done tick, primary buttons): lime, with ink on it. */
  fill: string;
  onFill: string;
  fillPressed: string;
  /** Background of a ticked (logged) row. */
  doneBg: string;
  warn: string;
  danger: string;
  onDanger: string;
  /** Boundary of outlined controls: at least 3:1 against bg and card. `line` is decoration only. */
  edge: string;
}

const logOf = (p: Palette, doneBg: string): LogPalette => ({ bg: p.bg, card: p.card, field: p.raised, line: p.border, text: p.text, muted: p.muted, accent: p.accent, fill: p.fill, onFill: p.onFill, fillPressed: p.fillPressed, doneBg, warn: p.warn, danger: p.danger, onDanger: p.onDanger, edge: p.edge });
export const logDarkPalette: LogPalette = logOf(darkPalette, "#273518");
export const logLightPalette: LogPalette = logOf(lightPalette, "#E4F2BC");

/** Colours handed to the navigation container, so tab bar, headers and the logger all use the one identity. */
export function navColors(p: Palette): { primary: string; background: string; card: string; text: string; border: string; notification: string } {
  return { primary: p.accent, background: p.bg, card: p.card, text: p.text, border: p.border, notification: p.accent };
}

export type Appearance = "dark" | "light" | "system";
export const APPEARANCES: readonly Appearance[] = ["dark", "light", "system"];
/** Dark (ink + lime) is the default; anything unknown falls back to it. */
export const parseAppearance = (raw: string | null | undefined): Appearance => (raw === "light" || raw === "system" ? raw : "dark");
