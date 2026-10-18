/**
 * Achievements round 2: the earn moment's choreography as data (spec §6.1). Pure, so the variant chooser and the haptic schedule can be
 * tested without a renderer. The component plays it with RN Animated (native driver) and these timers.
 */
import type { AchievementEvidence } from "@gain/engine";
import { PLATE_ORDER, plateTier, type PlateTier } from "./achievementShowcase";
import { prestigeForBadge, type SurfaceBadge } from "./achievementSurface";

export type EarnVariant = "standard" | "pr" | "legacy" | "plate";
export type EarnHaptic = "land" | "legacy" | "celebrate";

/**
 * A Standard: Foundation / Forged / Masterwork. B Strength PR: odometer + delta chip. C Legacy: ring pulse + Heavy (multi_year_*,
 * dedicated_50/100). D Plate tier-up: a hundred_club_* hero is the plate, not a medal.
 */
export function earnVariant(hero: Pick<SurfaceBadge, "badgeId" | "evidence">): EarnVariant {
  if (hero.badgeId.startsWith("hundred_club_")) return "plate";
  if (hero.badgeId === "strength_pr" && hero.evidence?.kind === "strength_pr") return "pr";
  if (prestigeForBadge(hero.badgeId) === "legacy") return "legacy";
  return "standard";
}

/** Milestones (ms from start) of the timeline. */
export const EARN = { dim: 150, land: 380, plateLand: 250, specFrom: 420, specTo: 900, textAt: 600, textFor: 250, ringAt: 900, ringFor: 450, settle: 1000, liftFrom: 1400, liftTo: 1700, odoFrom: 400, odoTo: 1000, chipFor: 160, fade: 200, plateSwapFrom: 250, plateSwapTo: 600 } as const;

/**
 * Haptics in time order. Exactly one Success (celebrate) per earn moment; Reduce Motion fires only that one (no Medium or Heavy).
 * Medium and Heavy are iOS-only inside `haptics`; Android hears only the existing Success vibration.
 */
export function earnSchedule(variant: EarnVariant, reduced: boolean): { at: number; haptic: EarnHaptic }[] {
  if (reduced) return [{ at: EARN.fade, haptic: "celebrate" }];
  const land = { at: variant === "plate" ? EARN.plateLand : EARN.land, haptic: "land" as const };
  const out: { at: number; haptic: EarnHaptic }[] = [land];
  if (variant === "legacy") out.push({ at: EARN.ringAt, haptic: "legacy" });
  out.push({ at: EARN.settle, haptic: "celebrate" });
  return out;
}

/** When the moment is settled (announce, end state). */
export const settleAt = (reduced: boolean): number => (reduced ? EARN.fade : EARN.settle);

/**
 * Plays a schedule with the given timer, firing each haptic once. Returns `skip()`, which cancels the rest and fires the Success now
 * if it hasn't fired yet (so a skipped moment still gets exactly one), and `cancel()`, which stops without firing.
 */
export function runSchedule(
  schedule: { at: number; haptic: EarnHaptic }[],
  fire: (h: EarnHaptic) => void,
  timer: { set: (fn: () => void, ms: number) => unknown; clear: (id: unknown) => void } = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) },
): { skip: () => void; cancel: () => void } {
  const fired = new Set<EarnHaptic>();
  const ids = schedule.map((s) =>
    timer.set(() => {
      if (fired.has(s.haptic)) return;
      fired.add(s.haptic);
      fire(s.haptic);
    }, s.at),
  );
  const cancel = () => ids.forEach((id) => timer.clear(id));
  return {
    cancel,
    skip: () => {
      cancel();
      if (!fired.has("celebrate")) {
        fired.add("celebrate");
        fire("celebrate");
      }
    },
  };
}

/** Plate tier-up: the plate before this tier (the one the arc completes and crossfades away from). */
export function plateTierUp(hero: { evidence: AchievementEvidence | null; badgeId: string }): { days: number; from: PlateTier; to: PlateTier } {
  const tier = Number(hero.badgeId.replace("hundred_club_", "")) || 100;
  const days = hero.evidence?.kind === "hundred_club" ? hero.evidence.days : tier;
  const to = plateTier(Math.max(days, tier));
  const from = PLATE_ORDER[Math.max(0, PLATE_ORDER.indexOf(to) - 1)]!;
  return { days, from, to };
}

/** Odometer frame: the load shown at progress 0..1, rounded to the 0.5 grid so it never shows odd decimals. */
export function odometer(from: number, to: number, progress: number): number {
  const k = Math.max(0, Math.min(1, progress));
  if (k >= 1) return to;
  return Math.round((from + (to - from) * (1 - Math.pow(1 - k, 3))) * 2) / 2;
}

/** Cabinet unveil (spec §6.1 E): each earned medal fades and scales in over 300 ms, 40 ms after the one before. */
export const UNVEIL_STAGGER = 40;
export const UNVEIL_EACH = 300;
export const unveilDuration = (n: number): number => (n <= 0 ? 0 : (n - 1) * UNVEIL_STAGGER + UNVEIL_EACH);

/** Reading order of the earned medals across the shelves (slot → index), the order they unveil in. */
export function unveilOrder(groups: readonly { items: readonly { slot: string; state: string }[] }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const g of groups) for (const i of g.items) if (i.state === "earned") out.set(i.slot, out.size);
  return out;
}

/** The input range of medal `index` on the unveil clock (ms). */
export const unveilWindow = (index: number): [number, number] => [index * UNVEIL_STAGGER, index * UNVEIL_STAGGER + UNVEIL_EACH];
