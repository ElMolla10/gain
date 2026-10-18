/**
 * Today 10x motion (spec §5, §6), pure: timing constants, the pager's claim / commit predicates and the unrack sequence. Every animation
 * runs on the native driver; with Reduce Motion everything becomes a 200 ms crossfade and the haptics stay. Nothing loops while idle.
 */
export const TODAY_MOTION = {
  /** The bar lifts 8 dp over 0–120 ms; at 120 ms: unrack() + navigate. */
  unrackLift: 120,
  unrackLiftDp: 8,
  pagerSettle: 120,
  pagerSpringBack: 180,
  plateSlide: 100,
  plateStagger: 20,
  pathOpen: 240,
  pathClose: 180,
  pathPanelFade: 120,
  pathStep: 48,
  pathHeroScale: 1.02,
  pathRestOpacity: 0.6,
  crossfade: 200,
} as const;

export const PAGER = {
  /** Claim only past 24 dp horizontally AND at more than twice the vertical travel (angle lock). */
  claimDx: 24,
  angle: 2,
  /** Touches starting this close to either screen edge belong to the system. */
  edge: 20,
  commitShare: 0.3,
  commitVelocity: 0.3,
} as const;

/** Whether the hero pager takes over this gesture (measured from the touch start). */
export function pagerClaims(g: { dx: number; dy: number; x0: number; width: number }): boolean {
  if (g.x0 < PAGER.edge || g.x0 > g.width - PAGER.edge) return false;
  return Math.abs(g.dx) > PAGER.claimDx && Math.abs(g.dx) > PAGER.angle * Math.abs(g.dy);
}

/**
 * On release: -1 previous, +1 next, 0 spring back. Toward the START edge is the next day (right → left in English, left → right in
 * Arabic), committed past 30% of the width or faster than 0.3 dp/ms.
 */
export function pagerCommit(g: { dx: number; vx: number; width: number; rtl: boolean }): -1 | 0 | 1 {
  const far = Math.abs(g.dx) > g.width * PAGER.commitShare || Math.abs(g.vx) > PAGER.commitVelocity;
  if (!far || g.dx === 0) return 0;
  const towardStart = g.rtl ? g.dx > 0 : g.dx < 0;
  return towardStart ? 1 : -1;
}

/** The day index after a pager step, clamped (no wrap-around). */
export function stepDay(index: number, step: -1 | 0 | 1, count: number): number {
  return Math.max(0, Math.min(count - 1, index + step));
}

/** A tap on the bar (opens the load path): released within 8 dp and 250 ms. */
export const isBarTap = (d: number, ms: number): boolean => Math.abs(d) < 8 && ms < 250;

/**
 * The unrack sequence: lift (animated, not awaited), then at `unrackLift` ms the Medium haptic and navigate. With Reduce Motion the
 * haptic and navigate run at 0 (a crossfade, no lift). Navigation never waits on an animation; if the lift throws, it navigates anyway.
 */
export function runUnrack(deps: { reduced: boolean; lift: (ms: number) => void; haptic: () => void; navigate: () => void; later: (fn: () => void, ms: number) => unknown }): void {
  const go = () => {
    deps.haptic();
    deps.navigate();
  };
  if (deps.reduced) return go();
  try {
    deps.lift(TODAY_MOTION.unrackLift);
  } catch {
    return go();
  }
  deps.later(go, TODAY_MOTION.unrackLift);
}

/** The load path's open animation plan: scale + stagger normally, a plain crossfade with Reduce Motion. */
export function pathPlan(reduced: boolean, steps: number): { kind: "crossfade" | "full"; duration: number; heroScale: number; stepDelays: number[] } {
  if (reduced) return { kind: "crossfade", duration: TODAY_MOTION.crossfade, heroScale: 1, stepDelays: Array.from({ length: steps }, () => 0) };
  return { kind: "full", duration: TODAY_MOTION.pathOpen, heroScale: TODAY_MOTION.pathHeroScale, stepDelays: Array.from({ length: steps }, (_, i) => i * TODAY_MOTION.pathStep) };
}
