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
  /**
   * 1 dp edge around a `fill` (primary button) so its shape survives glare: olive #5C8A00 in light (lime on white is only 1.31:1;
   * the edge is 3.8:1 against bone), transparent in dark where lime already stands out.
   */
  fillEdge: string;
  /**
   * "Done" treatment (a ticked set): a muted green fill with a green outline and a green check, so a finished set never competes with the
   * lime that is reserved for the current unfinished row and the primary actions. Done is carried by the check mark + the checkbox state, not by colour alone.
   */
  doneFill: string;
  doneEdge: string;
  onDone: string;
  /**
   * The done TICK, solid: the box is filled (not just tinted) so done vs ready reads as solid vs hollow at a glance, at least 3.9:1
   * against `raised` in both themes, and the check inverts to `onDoneSolid` (about 5:1). Status is the fill + glyph, never hue alone.
   */
  doneSolid: string;
  onDoneSolid: string;
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
  fillEdge: "transparent",
  doneFill: "#2E4A38",
  doneEdge: "#5E8F72",
  onDone: c.success,
  doneSolid: "#5E8F72",
  onDoneSolid: "#10120E",
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
  fillEdge: "#5C8A00",
  doneFill: "#CDE6D5",
  doneEdge: "#3F8A5F",
  onDone: "#1B6B3E",
  doneSolid: "#2F7A50",
  onDoneSolid: "#FFFFFF",
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
  /** Filled controls (primary buttons, the current set): lime, with ink on it. A finished set uses `doneFill` instead. */
  fill: string;
  onFill: string;
  fillPressed: string;
  /** Done tick (a logged set): muted green fill, outline and check colour. See Palette.doneFill. */
  doneFill: string;
  doneEdge: string;
  onDone: string;
  /** Solid done tick and its inverted check (see Palette.doneSolid). */
  doneSolid: string;
  onDoneSolid: string;
  /** Background of a ticked (logged) row: only a quiet olive wash; the muted green check is what says "done". */
  doneBg: string;
  /** Background of the set the lifter is on now (the first unticked row of an exercise): clearly stronger than `doneBg`. */
  activeBg: string;
  warn: string;
  danger: string;
  onDanger: string;
  /** Boundary of outlined controls: at least 3:1 against bg and card. `line` is decoration only. */
  edge: string;
}

const logOf = (p: Palette, doneBg: string, activeBg: string = p.tint): LogPalette => ({ activeBg, doneSolid: p.doneSolid, onDoneSolid: p.onDoneSolid, bg: p.bg, card: p.card, field: p.raised, line: p.border, text: p.text, muted: p.muted, accent: p.accent, fill: p.fill, onFill: p.onFill, fillPressed: p.fillPressed, doneFill: p.doneFill, doneEdge: p.doneEdge, onDone: p.onDone, doneBg, warn: p.warn, danger: p.danger, onDanger: p.onDanger, edge: p.edge });
export const logDarkPalette: LogPalette = logOf(darkPalette, "#1C2315");
// Light: the current-set wash is a step stronger than `tint` (#E7F2C4 is only 1.08:1 on bone); text on it stays about 13:1.
export const logLightPalette: LogPalette = logOf(lightPalette, "#EEF4DC", "#DCEBB0");

/** Colours handed to the navigation container, so tab bar, headers and the logger all use the one identity. */
export function navColors(p: Palette): { primary: string; background: string; card: string; text: string; border: string; notification: string } {
  return { primary: p.accent, background: p.bg, card: p.card, text: p.text, border: p.border, notification: p.accent };
}

export type Appearance = "dark" | "light" | "system";
export const APPEARANCES: readonly Appearance[] = ["dark", "light", "system"];
/** Dark (ink + lime) is the default; anything unknown falls back to it. */
export const parseAppearance = (raw: string | null | undefined): Appearance => (raw === "light" || raw === "system" ? raw : "dark");

// ── Achievements round 2: decorative art tokens (spec-achievements-r2 §3) ─────────────────────────────────────────────────────────
// The art is decoration: every tier and state is also given in text (plate caption, medal state line), so none of these carry meaning
// alone. Light-mode arcs and rings use `accent`-strength colours, never lime fill (S-10).

export type PlateColourName = "steel" | "green" | "yellow" | "blue" | "red";
export interface PlateColours {
  face: string;
  hi: string;
  lo: string;
  lip: string;
  /** Rim arc drawn toward THIS plate (the arc always shows the next plate's colour), dark / light. */
  arcDark: string;
  arcLight: string;
}

/** Competition bumper colours at the hundred_club tiers. */
export const PLATE_COLOURS: Record<PlateColourName, PlateColours> = {
  steel: { face: "#5B6356", hi: "#8A9384", lo: "#2F342B", lip: "#252A21", arcDark: "#8A9580", arcLight: "#7A876E" },
  green: { face: "#2F8F55", hi: "#5FC285", lo: "#17542F", lip: "#123F23", arcDark: "#3FAE6A", arcLight: "#1F7A43" },
  yellow: { face: "#E3B52C", hi: "#F7DA7A", lo: "#94720F", lip: "#6E540A", arcDark: "#E3B52C", arcLight: "#8C6A00" },
  blue: { face: "#2F6BD0", hi: "#6F9DEB", lo: "#173C7E", lip: "#112D5E", arcDark: "#5B93F0", arcLight: "#2F6BD0" },
  red: { face: "#D23C35", hi: "#E8625A", lo: "#7C1C18", lip: "#5E1411", arcDark: "#E5534B", arcLight: "#B42E28" },
};

export interface AchievementArt {
  /** Rim / ring track behind a progress arc. */
  track: string;
  /** The arc when complete or in the mono variant: lime on dark, olive accent on light (S-10). */
  arcDone: string;
  /** Plate collar hole and its numeral. */
  collar: string;
  collarText: string;
  collarLabel: string;
  /** Dashed outlines: an empty plate, a locked medal, an unloaded sleeve slot (state cue ≥3:1, S-4). */
  ghost: string;
  /** Steel hub / sleeve ramp. */
  steelHi: string;
  steelMid: string;
  steelLo: string;
  /** Loaded sleeve plate face and its outline. */
  loaded: string;
  loadedEdge: string;
  shadowOpacity: number;
  /** Plate hub (steel) gradient, its rim, bolts and the collar edge; the cast shadow and the specular highlight. */
  hubHi: string;
  hubMid: string;
  hubLo: string;
  hubEdge: string;
  bolt: string;
  collarEdge: string;
  shadow: string;
  specular: string;
  /** Medal stage (detail sheet) and cabinet ledges. */
  stage: string;
  ledge: string;
  ledgeHi: string;
}

export const achievementArtDark: AchievementArt = {
  track: "#242A1F",
  arcDone: c.lime,
  collar: "#0B0D09",
  collarText: "#F5F6EF",
  collarLabel: "#B2B9A6",
  ghost: "#8A9580",
  steelHi: "#E4E9EC",
  steelMid: "#A7B0B6",
  steelLo: "#4E565C",
  loaded: c.lime,
  loadedEdge: "#10120E",
  shadowOpacity: 0.5,
  hubHi: "#EEF1F3",
  hubMid: "#A9B1B7",
  hubLo: "#5A6268",
  hubEdge: "#3A4045",
  bolt: "#4A5258",
  collarEdge: "#2A2F33",
  shadow: "#000000",
  specular: "#FFFFFF",
  stage: "#151912",
  ledge: "#2C3326",
  ledgeHi: "#3A4332",
};

export const achievementArtLight: AchievementArt = {
  track: "#D3D8C5",
  arcDone: "#3C5700",
  collar: "#0B0D09",
  collarText: "#F5F6EF",
  collarLabel: "#B2B9A6",
  ghost: "#7A876E",
  steelHi: "#E4E9EC",
  steelMid: "#8E979E",
  steelLo: "#4E565C",
  loaded: c.lime,
  loadedEdge: "#3C5700",
  shadowOpacity: 0.18,
  hubHi: "#EEF1F3",
  hubMid: "#A9B1B7",
  hubLo: "#5A6268",
  hubEdge: "#3A4045",
  bolt: "#4A5258",
  collarEdge: "#2A2F33",
  shadow: "#000000",
  specular: "#FFFFFF",
  stage: "#ECEFE2",
  ledge: "#DDE2D0",
  ledgeHi: "#F2F4EA",
};
