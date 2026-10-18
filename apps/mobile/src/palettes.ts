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
  /** Medal in progress: matte graphite silhouette, its edge, the dimmed motif and the boss (numeral disc) with its numeral. */
  medalProgressFill: string;
  medalProgressEdge: string;
  medalProgressMotif: string;
  medalProgressBoss: string;
  medalProgressBossText: string;
  /** Locked medal: flat recessed fill (the dashed contour is `ghost`). */
  medalLockedFill: string;
  /** Track behind a medal's progress ring (the ring itself is `arcDone`: lime on dark, olive on light). */
  ringTrack: string;
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
  medalProgressFill: "#3A4135",
  medalProgressEdge: "#6E7766",
  medalProgressMotif: "#5E6657",
  medalProgressBoss: "#2A3026",
  medalProgressBossText: "#C9CFC0",
  medalLockedFill: "#1E231A",
  ringTrack: "#414A36",
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
  medalProgressFill: "#CDD3C2",
  medalProgressEdge: "#8D987F",
  medalProgressMotif: "#6D7862",
  medalProgressBoss: "#5E6A53",
  medalProgressBossText: "#F2F4EC",
  medalLockedFill: "#E9ECE1",
  ringTrack: "#D3D8C5",
};

/** Medal materials, one per prestige tier (spec §3.2). Metals look the same on both themes; only the surroundings change. */
export type MedalMaterialName = "iron" | "steel" | "bronze" | "lime" | "seal";
export interface MedalMaterial {
  hi: string;
  base: string;
  lo: string;
  edge: string;
  /** The motif colour (stamped into the face). */
  ink: string;
  /** Numeral disc and its numeral (decorative duplicates of the caption). */
  boss: string;
  bossText: string;
  /** Engraved text on the medal back (UI text over the art; on `lo`, ≥4.5:1). */
  engrave: string;
}
/**
 * Quest seals use ONE wax colour for every month (owner decision, not the 12 monthly colourways in the spec); the month numeral on the
 * boss and the month in text still say which month it was.
 */
export const SEAL_COLOUR = "#B0654F";
export const MEDAL_MATERIALS: Record<MedalMaterialName, MedalMaterial> = {
  iron: { hi: "#7A8172", base: "#4A5045", lo: "#262A22", edge: "#8C9384", ink: "#1A1D17", boss: "#262A22", bossText: "#8C9384", engrave: "#C9CFC0" },
  steel: { hi: "#E4E9EC", base: "#A7B0B6", lo: "#5E676D", edge: "#F2F5F7", ink: "#2A3034", boss: "#5E676D", bossText: "#F2F5F7", engrave: "#F2F5F7" },
  bronze: { hi: "#F0C88A", base: "#B9813F", lo: "#6B4320", edge: "#E2B06D", ink: "#3A230F", boss: "#6B4320", bossText: "#E2B06D", engrave: "#F4DDB2" },
  lime: { hi: "#E9FF8F", base: "#A9E21A", lo: "#4F7406", edge: "#F4F6EC", ink: "#22320A", boss: "#4F7406", bossText: "#E9FF8F", engrave: "#E9FF8F" },
  seal: { hi: "#D99A86", base: SEAL_COLOUR, lo: "#7A3F2F", edge: "#F4F6EC", ink: "#10120E", boss: "#10120E", bossText: "#F4F6EC", engrave: "#F4F6EC" },
};
/** prestigeForBadge tier → material (iron_hold, iron_carry and full_spectrum_12 fall through to Foundation = iron, unchanged). */
export const MATERIAL_FOR_PRESTIGE: Record<"foundation" | "forged" | "masterwork" | "legacy", MedalMaterialName> = {
  foundation: "iron",
  forged: "steel",
  masterwork: "bronze",
  legacy: "lime",
};

// ---- Today 10x, "Today's Bar" (spec §2.1). They extend the r2 plate tokens (PLATE_COLOURS red/blue/yellow/green) and don't fork them. ----

/** A side-on plate's vertical ramp: lo 0% → face 16% → hi 34% → face 58% → lo 100%, plus the 1 dp lip / bevel stroke. */
export interface PlateRamp {
  face: string;
  hi: string;
  lo: string;
  lip: string;
}
export type TodayPlateName = "red" | "blue" | "yellow" | "green" | "white" | "chrome" | "iron";
const ramp = (p: PlateColours): PlateRamp => ({ face: p.face, hi: p.hi, lo: p.lo, lip: p.lip });
export const TODAY_PLATES: Record<TodayPlateName, PlateRamp> = {
  red: ramp(PLATE_COLOURS.red),
  blue: ramp(PLATE_COLOURS.blue),
  yellow: ramp(PLATE_COLOURS.yellow),
  green: ramp(PLATE_COLOURS.green),
  /** 5 kg, 0.5 kg. */
  white: { face: "#E6E9E2", hi: "#FFFFFF", lo: "#A3A99D", lip: "#6E7468" },
  /** 1.25 kg (in KG_PLATES, not IWF). */
  chrome: { face: "#B9C2C8", hi: "#F2F5F7", lo: "#5E676D", lip: "#454C51" },
  /** Every lb plate; the lip is the bevel highlight that carries the edge on dark. */
  iron: { face: "#3D4346", hi: "#6E777C", lo: "#1E2224", lip: "#7C858A" },
};
/** Ink for a numeral printed ON a plate face: dark on white/yellow/chrome/green, white on red/blue/iron (≥ 4.5:1). */
export const PLATE_NUMERAL_INK: Record<TodayPlateName, string> = {
  red: "#FFFFFF", blue: "#FFFFFF", iron: "#FFFFFF", white: "#10120E", yellow: "#10120E", chrome: "#10120E", green: "#10120E",
};

export interface BarSteel {
  base: string;
  hi: string;
  lo: string;
  edge: string;
}
/** Bar, sleeves and collars. Light is darker so the bar holds 3:1 on bone. */
export const BAR_STEEL: { dark: BarSteel; light: BarSteel } = {
  dark: { base: "#A7B0B6", hi: "#E4E9EC", lo: "#5E676D", edge: "#F2F5F7" },
  light: { base: "#78818A", hi: "#C9D0D5", lo: "#4E565C", edge: "#B9C1C7" },
};

/** The other objects of the hero (spec §2.3): rubber dumbbell heads, machine frames, the weight stack, ghost outlines. */
export interface TodayObjects {
  rubber: string;
  rubberEdge: string;
  rubberInk: string;
  frame: string;
  stackPlate: string;
  stackPlateEdge: string;
  /** Stack plates above the pin (the ones that lift). */
  stackLifted: string;
  /** Dashed ghost plates, outlines, the dial ring. */
  ghost: string;
  /** The dial arc and other strong strokes. */
  strong: string;
  shadow: string;
}
export const TODAY_OBJECTS: { dark: TodayObjects; light: TodayObjects } = {
  dark: { rubber: "#2A2F2B", rubberEdge: "#5A625C", rubberInk: "#C9D0C6", frame: "#2B302A", stackPlate: "#30362F", stackPlateEdge: "#4A524A", stackLifted: "#475048", ghost: "#8A9580", strong: "#F5F6EF", shadow: "#000000" },
  light: { rubber: "#30362F", rubberEdge: "#1A1E19", rubberInk: "#E6EAE0", frame: "#2B302A", stackPlate: "#3B4239", stackPlateEdge: "#252A23", stackLifted: "#5A6358", ghost: "#7A876E", strong: "#171C12", shadow: "#000000" },
};
