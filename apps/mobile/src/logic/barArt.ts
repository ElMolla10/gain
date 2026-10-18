/**
 * Today's Bar geometry (spec §2.2), pure: every plate rect of the side-on barbell in a 380 × 132 view box. Plates stack from the inner
 * collar outward, heaviest first, mirrored left and right; if one side is too thick for the sleeve, every thickness scales down together.
 * The art scales as a whole (96 dp tall at large text). Colours are token NAMES; the component looks them up. The art never mirrors.
 */
import type { TodayPlateName } from "../palettes";
import type { Unit } from "./units";

export const HERO_W = 380;
export const HERO_H = 132;
export const HERO_H_LARGE = 96;
const LB_KG = 0.45359237;
const SLEEVE = 108;
const INNER_COLLAR = 10;
const CLAMP = 7;
const GAP = 0.8;
const BUMPER = HERO_H - 12;

/** Denomination (kg) → token, diameter (fraction of a bumper), thickness (dp at hero size). */
const KG: Record<string, [TodayPlateName, number, number]> = {
  "25": ["red", 1, 20], "20": ["blue", 1, 17], "15": ["yellow", 1, 14], "10": ["green", 1, 11],
  "5": ["white", 0.6, 9], "2.5": ["red", 0.5, 7], "2": ["blue", 0.47, 6], "1.5": ["yellow", 0.44, 6],
  "1.25": ["chrome", 0.45, 6], "1": ["green", 0.4, 5], "0.5": ["white", 0.36, 4],
};
/** lb iron plates, keyed by pounds. */
const LB: Record<string, [number, number]> = { "45": [1, 15], "35": [0.88, 13], "25": [0.76, 11], "10": [0.56, 8], "5": [0.46, 7], "2.5": [0.38, 5] };

export interface PlateLook {
  token: TodayPlateName;
  diameter: number;
  thickness: number;
}

/** How a plate of `kg` looks. Competition colours for kg plates, iron for lb plates; an unknown size is chrome, sized by weight. */
export function plateLook(kg: number, unit: Unit): PlateLook {
  const k = KG[String(Math.round(kg * 100) / 100)];
  const lbKey = String(Math.round((kg / LB_KG) * 2) / 2);
  const lb = LB[lbKey];
  if (unit === "lb" && lb) return { token: "iron", diameter: BUMPER * lb[0], thickness: lb[1] };
  if (k) return { token: k[0], diameter: BUMPER * k[1], thickness: k[2] };
  if (lb) return { token: "iron", diameter: BUMPER * lb[0], thickness: lb[1] };
  const frac = Math.max(0.36, Math.min(1, 0.36 + kg / 40));
  return { token: "chrome", diameter: BUMPER * frac, thickness: Math.max(4, Math.min(20, kg * 0.8)) };
}

export interface ArtRect {
  x: number;
  y: number;
  w: number;
  h: number;
  token: TodayPlateName;
}

export interface BarLayout {
  /** Loaded plates, both sleeves (left side first, inner → outer, then right). */
  plates: ArtRect[];
  /** Dashed ghost plates (the normal load in a lighter week, or the first-run hint). */
  ghosts: Omit<ArtRect, "token">[];
  /** Outer clamps, after the last plate on each side; none on an empty bar. */
  clamps: { x: number; y: number; w: number; h: number }[];
  cy: number;
  /** Inner collar faces. */
  xL: number;
  xR: number;
}

function side(list: readonly number[], unit: Unit, cy: number, xL: number, xR: number, gap: number) {
  const looks = list.map((kg) => plateLook(kg, unit));
  const total = looks.reduce((n, l) => n + l.thickness, 0) || 1;
  const room = SLEEVE - INNER_COLLAR - 12;
  const k = Math.min(1, room / (total + gap * looks.length));
  const left: ArtRect[] = [];
  const right: ArtRect[] = [];
  let x = 0;
  for (const l of looks) {
    const t = l.thickness * k;
    left.push({ x: xL - INNER_COLLAR - x - t, y: cy - l.diameter / 2, w: t, h: l.diameter, token: l.token });
    right.push({ x: xR + INNER_COLLAR + x, y: cy - l.diameter / 2, w: t, h: l.diameter, token: l.token });
    x += t + gap;
  }
  return { left, right, used: x };
}

export function barLayout(perSide: readonly number[], opts: { unit: Unit; ghost?: readonly number[] | null; lifted?: number }): BarLayout {
  const cy = HERO_H / 2 - (opts.lifted ?? 0);
  const xL = SLEEVE;
  const xR = HERO_W - SLEEVE;
  const ghost = opts.ghost ? side(opts.ghost, opts.unit, cy, xL, xR, 1.2) : null;
  const loaded = side(perSide, opts.unit, cy, xL, xR, GAP);
  const clamps =
    perSide.length > 0
      ? [
          { x: xL - INNER_COLLAR - loaded.used - CLAMP - 1, y: cy - 11, w: CLAMP, h: 22 },
          { x: xR + INNER_COLLAR + loaded.used + 1, y: cy - 11, w: CLAMP, h: 22 },
        ]
      : [];
  return {
    plates: [...loaded.left, ...loaded.right],
    ghosts: ghost ? [...ghost.left, ...ghost.right].map(({ token: _t, ...r }) => r) : [],
    clamps,
    cy,
    xL,
    xR,
  };
}

/** SVG shapes the hero bar draws: floor shadow, shaft, 2 sleeves, 2 inner collars, knurl, the plates, the clamps and any ghosts. */
export function barShapeCount(layout: BarLayout): number {
  return 6 + 1 + layout.plates.length + layout.clamps.length + layout.ghosts.length;
}

export const SLEEVE_LEN = SLEEVE;
export const INNER_COLLAR_W = INNER_COLLAR;

/** Plates per side the dock's grid mini can draw: up to 4 blocks per side; above 4 the outer plates merge into one block (≤12 shapes). */
export const GRID_MAX_PER_SIDE = 4;
export function gridPlates(perSide: readonly number[]): number[] {
  if (perSide.length <= GRID_MAX_PER_SIDE) return [...perSide];
  return [...perSide.slice(0, GRID_MAX_PER_SIDE - 1), perSide[GRID_MAX_PER_SIDE - 1]!];
}
/** Shapes in the grid mini: shaft + 2 collars + one rect per drawn plate. */
export const gridShapeCount = (perSide: readonly number[]): number => 3 + 2 * gridPlates(perSide).length;
