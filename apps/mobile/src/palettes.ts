// Pure colour tables (no React Native import) so tests can check contrast. theme.ts picks one by system theme.

export interface Palette {
  bg: string;
  card: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  border: string;
  disabled: string;
  /** Boundary of inputs and choice buttons: at least 3:1 against bg and card (WCAG 1.4.11). `border` is only decoration. */
  edge: string;
  /** Error text; readable on bg and card in both themes. */
  danger: string;
  /** Warning outline (e.g. a value that looks wrong). */
  warn: string;
}

export const lightPalette: Palette = { bg: "#f6f6f4", card: "#ffffff", text: "#141414", muted: "#5d5d5a", accent: "#1f6f4a", accentText: "#ffffff", border: "#d9d9d4", disabled: "#b9b9b3", edge: "#82827d", danger: "#b00020", warn: "#a85f00" };
export const darkPalette: Palette = { bg: "#101211", card: "#1a1d1b", text: "#f2f2ee", muted: "#a5a8a2", accent: "#4cc38a", accentText: "#06150e", border: "#303432", disabled: "#555955", edge: "#7c807b", danger: "#ff8a8a", warn: "#e8a33a" };


/**
 * Colours of the active workout screen (near-black in dark mode, soft grey and white in light mode). The accent is the SAME primary green
 * as the main palette (the field names `blue*` are historical): navigation, buttons and the logger share one accent.
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
  /** Text or icon on a `danger` background (the swipe-to-delete action). */
  onDanger: string;
  /** Boundary of outlined controls: at least 3:1 against bg and card. `line` is decoration only. */
  edge: string;
}

export const logDarkPalette: LogPalette = { bg: "#000000", card: "#111214", field: "#1e2024", line: "#2a2c31", text: "#f5f5f5", muted: "#9ea3ab", blue: "#4cc38a", blueFill: "#4cc38a", onBlue: "#06150e", doneBg: "#0f2a1e", warn: "#f5b13d", danger: "#ff6b6b", onDanger: "#000000", edge: "#6f757e" };
export const logLightPalette: LogPalette = { bg: "#f2f3f5", card: "#ffffff", field: "#e8eaee", line: "#d5d9df", text: "#111418", muted: "#566070", blue: "#1f6f4a", blueFill: "#1f6f4a", onBlue: "#ffffff", doneBg: "#dcefe5", warn: "#8a5a00", danger: "#c4262b", onDanger: "#ffffff", edge: "#707a8a" };


/** Colours handed to the navigation container, so tab bar, headers and the logger all use the one primary accent. */
export function navColors(p: Palette): { primary: string; background: string; card: string; text: string; border: string; notification: string } {
  return { primary: p.accent, background: p.bg, card: p.card, text: p.text, border: p.border, notification: p.accent };
}
