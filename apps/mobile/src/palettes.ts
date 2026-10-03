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

export const lightPalette: Palette = { bg: "#f4f6f5", card: "#ffffff", text: "#141717", muted: "#566061", accent: "#17724c", accentText: "#ffffff", border: "#d9d9d4", disabled: "#b9b9b3", edge: "#82827d", danger: "#b00020", warn: "#a85f00" };
export const darkPalette: Palette = { bg: "#141617", card: "#1e2122", text: "#f2f4f3", muted: "#a9afad", accent: "#5eddaa", accentText: "#06150e", border: "#2f3435", disabled: "#555c5a", edge: "#7d8583", danger: "#ff8a8a", warn: "#e8a33a" };


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

export const logDarkPalette: LogPalette = { bg: "#141617", card: "#1e2122", field: "#272b2c", line: "#2f3435", text: "#f2f4f3", muted: "#a9afad", blue: "#5eddaa", blueFill: "#5eddaa", onBlue: "#06150e", doneBg: "#17342a", warn: "#f5b13d", danger: "#ff6b6b", onDanger: "#000000", edge: "#7d8583" };
export const logLightPalette: LogPalette = { bg: "#f4f6f5", card: "#ffffff", field: "#e7ecea", line: "#d5dbd9", text: "#141717", muted: "#566061", blue: "#17724c", blueFill: "#17724c", onBlue: "#ffffff", doneBg: "#dcefe5", warn: "#8a5a00", danger: "#c4262b", onDanger: "#ffffff", edge: "#82827d" };


/** Colours handed to the navigation container, so tab bar, headers and the logger all use the one primary accent. */
export function navColors(p: Palette): { primary: string; background: string; card: string; text: string; border: string; notification: string } {
  return { primary: p.accent, background: p.bg, card: p.card, text: p.text, border: p.border, notification: p.accent };
}

export type Appearance = "dark" | "light" | "system";
export const APPEARANCES: readonly Appearance[] = ["dark", "light", "system"];
/** Dark (charcoal + mint) is the default; anything unknown falls back to it. */
export const parseAppearance = (raw: string | null | undefined): Appearance => (raw === "light" || raw === "system" ? raw : "dark");
