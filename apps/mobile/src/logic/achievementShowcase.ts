/**
 * Achievements round 2: pure selectors for the showcase (plate, PR spotlight, shelves, ledger teaser).
 * Presentation only. Every number here is read from rows the engine already returned (`listCabinet()` / `getHome()`);
 * nothing re-evaluates a rule, adds a query or invents a metric (no XP, levels, rarity or streaks).
 */
import {
  ACHIEVEMENT_CATALOG,
  DEDICATED_TIERS,
  HUNDRED_CLUB_TIERS,
  MULTI_YEAR_TIERS,
  QUALIFIED_WEEK_TIERS,
  SPECTRUM_TIERS,
  UNIQUE_BADGE_IDS,
  identityKey,
  repBand,
  type AchievementEvidence,
  type IdentityRef,
} from "@gain/engine";
import { isolateLtr, NBSP, type Lang } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { catalogIndex, ledgerItems, type SurfaceBadge } from "./achievementSurface";
import { unitLabel, weightText, type Unit } from "./units";

type T = (key: StringKey, params?: Record<string, string | number>) => string;
type StrengthPrEvidence = Extract<AchievementEvidence, { kind: "strength_pr" }>;

const LOAD_EPS = 1e-6;
/** Same character the rest of the app uses for ranges (DESIGN.md S-1). */
const EN_DASH = "\u2013";
/** True minus sign for a negative delta. */
const MINUS = "\u2212";

// ── Training days and the Lifetime Plate ─────────────────────────────────────────────────────────────

export type PlateTier = "steel" | "green" | "yellow" | "blue" | "red";
export const PLATE_ORDER: readonly PlateTier[] = ["steel", "green", "yellow", "blue", "red"];

export interface TrainingDays {
  days: number | null;
  /** True when only a lower bound is known ("1000+"): every hundred_club tier is earned and no passthrough count exists. */
  floor: boolean;
}

/**
 * The plate number. Prefers the engine's passed-through `stats.qualifyingDays` (PR A); otherwise the `progressCurrent` of the
 * lowest-target in-progress `hundred_club_*` row, which the engine fills with the same count. All four tiers earned and no
 * passthrough → `{ days: 1000, floor: true }`. Nothing known yet → `{ days: null }`.
 */
export function trainingDays(cabinet: readonly SurfaceBadge[], stats?: { qualifyingDays?: number | null } | null): TrainingDays {
  const passed = stats?.qualifyingDays;
  if (typeof passed === "number" && Number.isFinite(passed) && passed >= 0) return { days: passed, floor: false };
  const club = cabinet.filter((r) => r.badgeId.startsWith("hundred_club_"));
  const inProgress = club
    .filter((r) => r.status === "in_progress" && r.progressCurrent !== null)
    .sort((a, b) => (a.progressTarget ?? 0) - (b.progressTarget ?? 0));
  if (inProgress[0]) return { days: inProgress[0].progressCurrent, floor: false };
  const top = HUNDRED_CLUB_TIERS[HUNDRED_CLUB_TIERS.length - 1]!;
  if (HUNDRED_CLUB_TIERS.every((tier) => club.some((r) => r.badgeId === `hundred_club_${tier}` && r.status === "earned"))) {
    return { days: top, floor: true };
  }
  return { days: null, floor: false };
}

/** steel < 100 ≤ green < 250 ≤ yellow < 500 ≤ blue < 1000 ≤ red (thresholds from HUNDRED_CLUB_TIERS). */
export function plateTier(days: number | null): PlateTier {
  const d = days ?? 0;
  let i = 0;
  for (const tier of HUNDRED_CLUB_TIERS) if (d >= tier) i++;
  return PLATE_ORDER[i]!;
}

/** The plate being worked toward, or null on the red plate. */
export function nextPlate(days: number | null): PlateTier | null {
  const i = PLATE_ORDER.indexOf(plateTier(days));
  return PLATE_ORDER[i + 1] ?? null;
}

/** Training days to the next plate, or null on the red plate. */
export function daysToNext(days: number | null): number | null {
  const d = days ?? 0;
  const next = HUNDRED_CLUB_TIERS.find((tier) => d < tier);
  return next === undefined ? null : next - d;
}

/** 0..1 share of the way from this plate's threshold to the next one (1 on the red plate). Drives the rim arc. */
export function plateProgress(days: number | null): number {
  const d = days ?? 0;
  const next = HUNDRED_CLUB_TIERS.find((tier) => d < tier);
  if (next === undefined) return 1;
  const prev = [...HUNDRED_CLUB_TIERS].reverse().find((tier) => d >= tier) ?? 0;
  return Math.max(0, Math.min(1, (d - prev) / (next - prev)));
}

// ── Strength PRs ─────────────────────────────────────────────────────────────────────────────────────

const isPr = (r: SurfaceBadge): r is SurfaceBadge & { evidence: StrengthPrEvidence } =>
  r.badgeId === "strength_pr" && r.status === "earned" && r.evidence?.kind === "strength_pr";

const newestFirst = (a: SurfaceBadge, b: SurfaceBadge) => (b.earnedAtUtc ?? 0) - (a.earnedAtUtc ?? 0) || a.id.localeCompare(b.id);

export const prIdentityKey = (id: IdentityRef): string => identityKey(id.exerciseId, id.equipment, id.setup);

/** Every earned, verified strength PR, newest first. */
export function verifiedPrs(cabinet: readonly SurfaceBadge[]): (SurfaceBadge & { evidence: StrengthPrEvidence })[] {
  return cabinet.filter(isPr).sort(newestFirst);
}

/** The newest earned strength PR ("Latest verified PR", never "best"), or null. */
export function latestPr(cabinet: readonly SurfaceBadge[]): (SurfaceBadge & { evidence: StrengthPrEvidence }) | null {
  return verifiedPrs(cabinet)[0] ?? null;
}

export interface StairStep {
  load: number;
  reps: number;
  localDate: string;
  /** Same load, more reps: drawn as a small tick instead of a rise. */
  repOnly: boolean;
}

/** All earned strength PRs on one identity (exercise + equipment + setup), oldest first. */
export function prStair(cabinet: readonly SurfaceBadge[], identity: IdentityRef): StairStep[] {
  const key = prIdentityKey(identity);
  return cabinet
    .filter(isPr)
    .filter((r) => prIdentityKey(r.evidence.identity) === key)
    .sort((a, b) => a.evidence.newBest.localDate.localeCompare(b.evidence.newBest.localDate) || (a.earnedAtUtc ?? 0) - (b.earnedAtUtc ?? 0))
    .map((r) => ({
      load: r.evidence.newBest.load,
      reps: r.evidence.newBest.reps,
      localDate: r.evidence.newBest.localDate,
      repOnly: Math.abs(r.evidence.newBest.load - r.evidence.previousBest.load) <= LOAD_EPS && r.evidence.newBest.reps > r.evidence.previousBest.reps,
    }));
}

export interface Plaque {
  row: SurfaceBadge & { evidence: StrengthPrEvidence };
  /** Verified PRs on this lift. */
  count: number;
}

/** The latest PR on up to `max` other lifts (not the spotlight's), newest first, each with its PR count. */
export function plaques(cabinet: readonly SurfaceBadge[], max = 4): Plaque[] {
  const all = verifiedPrs(cabinet);
  const spotlight = all[0] ? prIdentityKey(all[0].evidence.identity) : null;
  const byKey = new Map<string, Plaque>();
  for (const row of all) {
    const key = prIdentityKey(row.evidence.identity);
    if (key === spotlight) continue;
    const hit = byKey.get(key);
    if (hit) hit.count++;
    else byKey.set(key, { row, count: 1 });
  }
  return [...byKey.values()].slice(0, max);
}

/** The Arabic count noun: 3–10 take the plural, everything else (1, 2, 11+) the singular ("6 أرقام", "22 رقم"). */
export const arPluralKey = <K extends string>(n: number, singular: K, plural: K): K => (n >= 3 && n <= 10 ? plural : singular);

/**
 * The PR delta chip, from real sets (never e1RM):
 * - path B → "Stronger at 6–10 reps" (band from repBand(newBest.reps));
 * - assisted with less assistance → "−5 kg assistance";
 * - heavier → "+4 kg";
 * - same load, more reps → "+1 rep".
 * Numbers are isolated, the unit stays in the language after a no-break space, and no Arabic is ever LTR-isolated (S-1).
 */
export function prDelta(evidence: StrengthPrEvidence, lang: Lang, unit: Unit, t: T): string {
  const raw = evidence.newBest.load - evidence.previousBest.load;
  const band = repBand(evidence.newBest.reps);
  if (evidence.path === "B" && band) {
    return t("achv.r2.delta.stronger", { band: band.replace("-", EN_DASH) });
  }
  if (evidence.identity.setup === "assisted" && raw < -LOAD_EPS) {
    return t("achv.r2.delta.assist", { delta: `${isolateLtr(`${MINUS}${weightText(-raw, unit)}`)}${NBSP}${unitLabel(unit, lang)}` });
  }
  if (raw > LOAD_EPS) return `${isolateLtr(`+${weightText(raw, unit)}`)}${NBSP}${unitLabel(unit, lang)}`;
  const reps = Math.max(1, evidence.newBest.reps - evidence.previousBest.reps);
  const key: StringKey = lang === "ar" ? arPluralKey(reps, "achv.r2.delta.reps.one", "achv.r2.delta.reps.few") : reps === 1 ? "achv.r2.delta.reps.one" : "achv.r2.delta.reps.few";
  return t(key, { n: `+${reps}` });
}

// ── Medals, shelves and the ledger ───────────────────────────────────────────────────────────────────

export type Shelf = "strength" | "consistency" | "lifetime" | "mastery";
export const SHELF_ORDER: readonly Shelf[] = ["strength", "consistency", "lifetime", "mastery"];
export type MedalState = "earned" | "in_progress" | "locked";

export function shelfOf(badgeId: string): Shelf {
  if (badgeId.startsWith("hundred_club_") || badgeId.startsWith("multi_year_")) return "lifetime";
  if (badgeId.startsWith("dedicated_") || badgeId.startsWith("full_spectrum_")) return "mastery";
  if (badgeId === "first_session" || badgeId.startsWith("qualified_weeks_") || badgeId === "comeback" || badgeId.startsWith("quest_")) return "consistency";
  return "strength";
}

export interface ShelfItem {
  badgeId: string;
  i18nKey: string;
  state: MedalState;
  /** The cabinet row (for repeatables, the newest earned one); null for a catalog-only locked slot. */
  row: SurfaceBadge | null;
  /** Earned rows for a repeatable (×N); 1 or 0 for a unique. */
  count: number;
  repeatable: boolean;
}

export interface ShelfGroup {
  shelf: Shelf;
  items: ShelfItem[];
  earned: number;
}

const stateOf = (r: SurfaceBadge | null): MedalState => (r?.status === "earned" ? "earned" : r?.status === "in_progress" ? "in_progress" : "locked");

/**
 * The cabinet grouped onto four shelves, each in catalog order. Repeatables collapse to one slot with a ×N count; a repeatable that
 * was never earned is drawn from ACHIEVEMENT_CATALOG as locked (the way buildCabinet already makes locked rows for uniques).
 */
export function shelves(cabinet: readonly SurfaceBadge[]): ShelfGroup[] {
  const items: ShelfItem[] = [];
  for (const def of ACHIEVEMENT_CATALOG) {
    if (UNIQUE_BADGE_IDS.has(def.id)) {
      const row = cabinet.find((r) => r.badgeId === def.id) ?? null;
      items.push({ badgeId: def.id, i18nKey: def.i18nKey, state: stateOf(row), row, count: row?.status === "earned" ? 1 : 0, repeatable: false });
      continue;
    }
    const earned = cabinet.filter((r) => r.badgeId === def.id && r.status === "earned").sort(newestFirst);
    items.push({ badgeId: def.id, i18nKey: def.i18nKey, state: earned.length ? "earned" : "locked", row: earned[0] ?? null, count: earned.length, repeatable: true });
  }
  return SHELF_ORDER.map((shelf) => {
    const on = items.filter((i) => shelfOf(i.badgeId) === shelf);
    return { shelf, items: on, earned: on.filter((i) => i.state === "earned").length };
  });
}

const ratio = (r: SurfaceBadge | null): number => (r && (r.progressTarget ?? 0) > 0 ? (r.progressCurrent ?? 0) / (r.progressTarget ?? 1) : 0);

/** A partial lifter's shelf: everything earned plus the next 2 (in progress first, closest first). */
export function collapseForPartial(items: readonly ShelfItem[]): { visible: ShelfItem[]; hidden: number } {
  const earned = items.filter((i) => i.state === "earned");
  const rest = items
    .filter((i) => i.state !== "earned")
    .map((item, index) => ({ item, index }))
    .sort((a, b) => Number(b.item.state === "in_progress") - Number(a.item.state === "in_progress") || ratio(b.item.row) - ratio(a.item.row) || a.index - b.index)
    .slice(0, 2)
    .map((x) => x.item);
  const keep = new Set([...earned, ...rest]);
  const visible = items.filter((i) => keep.has(i));
  return { visible, hidden: items.length - visible.length };
}

/** The 3 in-progress uniques closest to done. hundred_club_* (the plate shows it) and quest_* (the seal shows it) are left out. */
export function almostThere(cabinet: readonly SurfaceBadge[]): SurfaceBadge[] {
  return cabinet
    .filter((r) => r.status === "in_progress" && UNIQUE_BADGE_IDS.has(r.badgeId) && (r.progressTarget ?? 0) > 0)
    .filter((r) => !r.badgeId.startsWith("hundred_club_") && !r.badgeId.startsWith("quest_"))
    .sort((a, b) => ratio(b) - ratio(a) || catalogIndex(a.badgeId) - catalogIndex(b.badgeId))
    .slice(0, 3);
}

/** Earned uniques, oldest first: the order behind "Medal 10 of 17". */
const earnedUniques = (cabinet: readonly SurfaceBadge[]) =>
  cabinet
    .filter((r) => r.status === "earned" && UNIQUE_BADGE_IDS.has(r.badgeId))
    .sort((a, b) => (a.earnedAtUtc ?? 0) - (b.earnedAtUtc ?? 0) || catalogIndex(a.badgeId) - catalogIndex(b.badgeId) || a.id.localeCompare(b.id));

/** "Medals x of 17": earned uniques over the unique catalog. */
export function medalCount(cabinet: readonly SurfaceBadge[]): { earned: number; total: number } {
  return { earned: earnedUniques(cabinet).length, total: UNIQUE_BADGE_IDS.size };
}

/** 1-based position of this row among earned uniques by earn time, or null for repeatables / unearned rows. */
export function medalOrdinal(cabinet: readonly SurfaceBadge[], rowId: string): number | null {
  const i = earnedUniques(cabinet).findIndex((r) => r.id === rowId);
  return i === -1 ? null : i + 1;
}

const TRACKS: Record<string, readonly number[]> = {
  qualified_weeks: QUALIFIED_WEEK_TIERS,
  dedicated: DEDICATED_TIERS,
  hundred_club: HUNDRED_CLUB_TIERS,
  multi_year: MULTI_YEAR_TIERS,
  full_spectrum: SPECTRUM_TIERS,
};

export interface TrackStep {
  badgeId: string;
  i18nKey: string;
  tier: number;
  state: MedalState;
  current: number | null;
  target: number | null;
}

/** Every tier of this badge's family in order, each with its cabinet state. Empty for badges without tiers. */
export function familyTrack(cabinet: readonly SurfaceBadge[], badgeId: string): TrackStep[] {
  const family = Object.keys(TRACKS).find((f) => badgeId.startsWith(`${f}_`));
  if (!family) return [];
  return TRACKS[family]!.map((tier) => {
    const id = `${family}_${tier}`;
    const def = ACHIEVEMENT_CATALOG.find((b) => b.id === id);
    const row = cabinet.find((r) => r.badgeId === id) ?? null;
    return { badgeId: id, i18nKey: def?.i18nKey ?? id, tier, state: stateOf(row), current: row?.progressCurrent ?? null, target: row?.progressTarget ?? null };
  });
}

/** The Ledger teaser: how many milestones, since when, and the latest 3 (newest first). */
export function ledgerSummary(earned: readonly SurfaceBadge[]): { count: number; since: string | null; latest: SurfaceBadge[] } {
  const items = ledgerItems([...earned]);
  return { count: items.length, since: items[0]?.earnedLocalDate ?? null, latest: items.slice(-3).reverse() };
}
