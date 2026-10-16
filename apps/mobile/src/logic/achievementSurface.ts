import {
  ACHIEVEMENT_CATALOG,
  UNIQUE_BADGE_IDS,
  type AchievementEvidence,
  type AchievementFamily,
  type AchievementStatus,
} from "@gain/engine";
import type { StringKey } from "../i18n/strings";
import type { Lang } from "../i18n/format";
import { formatSetEvidence } from "./achievementEvidence";
import type { Unit } from "./units";

export type PrestigeTier = "foundation" | "forged" | "masterwork" | "legacy";
export type CabinetStatusFilter = "all" | "earned" | "in_progress";
export type CabinetFamilyFilter = "all" | AchievementFamily;

export interface SurfaceBadge {
  id: string;
  badgeId: string;
  i18nKey: string;
  family: AchievementFamily;
  status: AchievementStatus;
  earnedAtUtc: number | null;
  earnedLocalDate: string | null;
  primarySessionId: string | null;
  evidence: AchievementEvidence | null;
  progressCurrent: number | null;
  progressTarget: number | null;
  isBackfilled: boolean;
  exerciseNameEn: string | null;
  exerciseNameAr: string | null;
}

export interface NextUpBadge {
  badgeId: string;
  i18nKey: string;
  current: number;
  target: number;
}

export interface EvidenceSheetContent {
  ruleKey:
    | "achv.rule.firstSession"
    | "achv.rule.weeks"
    | "achv.rule.pr"
    | "achv.rule.comeback"
    | "achv.rule.dedicated"
    | "achv.rule.blockBuilder"
    | "achv.rule.spectrum"
    | "achv.rule.hold"
    | "achv.rule.carry"
    | "achv.rule.workhorse"
    | "achv.rule.hundred"
    | "achv.rule.years"
    | "achv.rule.pin"
    | "achv.rule.quest";
  ruleParams: Record<string, string | number>;
  supportingSessionId: string | null;
  nextTier: { badgeId: string; i18nKey: string; current: number; target: number } | null;
}

export interface ShareCardParts {
  title: string;
  exercise: string | null;
  delta: string;
}

export interface SharePrivacy {
  absoluteWeight: boolean;
  bodyweight: boolean;
  gymLocation: boolean;
  fullLog: boolean;
}

export const DEFAULT_SHARE_PRIVACY: SharePrivacy = {
  absoluteWeight: false,
  bodyweight: false,
  gymLocation: false,
  fullLog: false,
};

const LOAD_EPS = 1e-6;
const LEDGER_BADGE_IDS = new Set([
  "first_session",
  "qualified_weeks_4",
  "strength_pr",
  "comeback",
  "workouts_100",
  "dedicated_10",
  "dedicated_25",
  "dedicated_50",
  "dedicated_100",
  "block_builder",
  "full_spectrum_4",
  "full_spectrum_12",
  "iron_hold",
  "iron_carry",
  "workhorse",
  "hundred_club_100",
  "hundred_club_250",
  "hundred_club_500",
  "hundred_club_1000",
  "multi_year_2",
  "multi_year_3",
  "multi_year_5",
  "pin_target",
  "quest_rhythm",
  "quest_craft",
  "quest_balance",
  "quest_foundation",
]);

const HERO_RANK: Record<string, number> = {
  long_horizon: 0,
  consistent_year: 1,
  consistent_month: 1,
  strength_pr: 2,
};

const RULE_PARAMS: Record<EvidenceSheetContent["ruleKey"], Record<string, string | number>> = {
  "achv.rule.firstSession": { sets: 3 },
  "achv.rule.weeks": { days: 2, sets: 3 },
  "achv.rule.pr": { baseline: 2, min: 3, max: 15, step: 1, bandA: "3–5", bandB: "6–10", bandC: "11–15", pct: "2.5" },
  "achv.rule.comeback": { gap: 14, weeks: 3, cooldown: 90 },
  "achv.rule.dedicated": { n: 10 },
  "achv.rule.blockBuilder": { months: 3 },
  "achv.rule.spectrum": { weeks: 4 },
  "achv.rule.hold": { band: "5" },
  "achv.rule.carry": { band: "5" },
  "achv.rule.workhorse": { min: 12, max: 20 },
  "achv.rule.hundred": { days: 100 },
  "achv.rule.years": { years: 2 },
  "achv.rule.pin": {},
  "achv.rule.quest": {},
};

export function prestigeForBadge(badgeId: string): PrestigeTier {
  if (badgeId === "first_session" || badgeId.startsWith("quest_")) return "foundation";
  if (badgeId === "qualified_weeks_4" || badgeId === "strength_pr" || badgeId === "dedicated_10" || badgeId === "workhorse" || badgeId === "pin_target") return "forged";
  if (badgeId === "qualified_weeks_12" || badgeId === "comeback" || badgeId === "dedicated_25" || badgeId === "full_spectrum_4" || badgeId === "block_builder") return "masterwork";
  if (badgeId.startsWith("hundred_club_") || badgeId.startsWith("multi_year_") || badgeId === "dedicated_50" || badgeId === "dedicated_100") return "legacy";
  return "foundation";
}

export function catalogIndex(badgeId: string): number {
  const i = ACHIEVEMENT_CATALOG.findIndex((b) => b.id === badgeId);
  return i === -1 ? 999 : i;
}

function heroRank(badgeId: string): number {
  if (badgeId.startsWith("hundred_club_") || badgeId.startsWith("multi_year_")) return 0;
  return HERO_RANK[badgeId] ?? 3;
}

export function pickHero(rows: SurfaceBadge[]): { hero: SurfaceBadge | null; rest: SurfaceBadge[] } {
  const eligible = rows.filter((r) => r.status === "earned" && !r.isBackfilled);
  eligible.sort(
    (a, b) => heroRank(a.badgeId) - heroRank(b.badgeId) || catalogIndex(a.badgeId) - catalogIndex(b.badgeId) || a.id.localeCompare(b.id),
  );
  const hero = eligible[0] ?? null;
  return { hero, rest: eligible.slice(1) };
}

export function buildCabinet(rows: SurfaceBadge[]): SurfaceBadge[] {
  const earnedUnique = new Map<string, SurfaceBadge>();
  const progressUnique = new Map<string, SurfaceBadge>();
  const repeatable: SurfaceBadge[] = [];
  for (const r of rows) {
    if (r.status === "revoked_by_edit") continue;
    if (UNIQUE_BADGE_IDS.has(r.badgeId)) {
      if (r.status === "earned") earnedUnique.set(r.badgeId, r);
      else if (r.status === "in_progress") progressUnique.set(r.badgeId, r);
    } else if (r.status === "earned") {
      repeatable.push(r);
    }
  }
  const items: SurfaceBadge[] = [];
  for (const def of ACHIEVEMENT_CATALOG) {
    if (!UNIQUE_BADGE_IDS.has(def.id)) continue;
    const earned = earnedUnique.get(def.id);
    if (earned) {
      items.push(earned);
      continue;
    }
    const prog = progressUnique.get(def.id);
    if (prog) {
      items.push(prog);
      continue;
    }
    items.push({
      id: `locked:${def.id}`,
      badgeId: def.id,
      i18nKey: def.i18nKey,
      family: def.family,
      status: "locked",
      earnedAtUtc: null,
      earnedLocalDate: null,
      primarySessionId: null,
      evidence: null,
      progressCurrent: null,
      progressTarget: null,
      isBackfilled: false,
      exerciseNameEn: null,
      exerciseNameAr: null,
    });
  }
  repeatable.sort((a, b) => (b.earnedAtUtc ?? 0) - (a.earnedAtUtc ?? 0) || a.id.localeCompare(b.id));
  items.push(...repeatable);
  return items;
}

export function filterCabinet(items: SurfaceBadge[], status: CabinetStatusFilter, family: CabinetFamilyFilter): SurfaceBadge[] {
  return items.filter((i) => {
    if (status === "earned" && i.status !== "earned") return false;
    if (status === "in_progress" && i.status !== "in_progress") return false;
    if (family !== "all" && i.family !== family) return false;
    return true;
  });
}

export function pickNextUp(progress: { badgeId: string; current: number; target: number }[], earnedBadgeIds: Iterable<string>): NextUpBadge[] {
  const earned = new Set(earnedBadgeIds);
  const byId = new Map(progress.map((p) => [p.badgeId, p]));
  const candidates: (NextUpBadge & { ratio: number; index: number })[] = [];
  ACHIEVEMENT_CATALOG.forEach((b, index) => {
    if (!UNIQUE_BADGE_IDS.has(b.id) || earned.has(b.id)) return;
    const p = byId.get(b.id);
    const current = p?.current ?? 0;
    const target = p?.target ?? (b.id === "first_session" ? 1 : 0);
    if (target <= 0) return;
    candidates.push({ badgeId: b.id, i18nKey: b.i18nKey, current, target, ratio: current / target, index });
  });
  candidates.sort((a, b) => b.ratio - a.ratio || a.index - b.index);
  return candidates.slice(0, 2).map(({ badgeId, i18nKey, current, target }) => ({ badgeId, i18nKey, current, target }));
}

export function ledgerItems(earned: SurfaceBadge[]): SurfaceBadge[] {
  return earned
    .filter((r) => r.status === "earned" && LEDGER_BADGE_IDS.has(r.badgeId))
    .sort((a, b) => (a.earnedAtUtc ?? 0) - (b.earnedAtUtc ?? 0) || catalogIndex(a.badgeId) - catalogIndex(b.badgeId) || a.id.localeCompare(b.id));
}

export function evidenceSheetContent(args: {
  badgeId: string;
  primarySessionId: string | null;
  qualifiedWeeksLifetime: number;
  weeks12Earned: boolean;
}): EvidenceSheetContent {
  const ruleKey: EvidenceSheetContent["ruleKey"] =
    args.badgeId === "first_session"
      ? "achv.rule.firstSession"
      : args.badgeId.startsWith("qualified_weeks")
        ? "achv.rule.weeks"
        : args.badgeId === "comeback"
          ? "achv.rule.comeback"
          : args.badgeId.startsWith("dedicated_")
            ? "achv.rule.dedicated"
            : args.badgeId === "block_builder"
              ? "achv.rule.blockBuilder"
              : args.badgeId.startsWith("full_spectrum")
                ? "achv.rule.spectrum"
                : args.badgeId === "iron_hold"
                  ? "achv.rule.hold"
                  : args.badgeId === "iron_carry"
                    ? "achv.rule.carry"
                    : args.badgeId === "workhorse"
                      ? "achv.rule.workhorse"
                      : args.badgeId.startsWith("hundred_club")
                        ? "achv.rule.hundred"
                        : args.badgeId.startsWith("multi_year")
                          ? "achv.rule.years"
                          : args.badgeId === "pin_target"
                            ? "achv.rule.pin"
                            : args.badgeId.startsWith("quest_")
                              ? "achv.rule.quest"
                              : "achv.rule.pr";
  const nextTier =
    args.badgeId === "qualified_weeks_4" && !args.weeks12Earned
      ? { badgeId: "qualified_weeks_12", i18nKey: "achv.weeks12", current: args.qualifiedWeeksLifetime, target: 12 }
      : null;
  return { ruleKey, ruleParams: RULE_PARAMS[ruleKey], supportingSessionId: args.primarySessionId, nextTier };
}

export function shareCardCopy(
  row: Pick<SurfaceBadge, "badgeId" | "i18nKey" | "evidence" | "exerciseNameEn" | "exerciseNameAr">,
  opts: {
    privacy: SharePrivacy;
    lang: Lang;
    unit: Unit;
    t: (key: StringKey, params?: Record<string, string | number>) => string;
  },
): ShareCardParts {
  const title = opts.t(row.i18nKey as StringKey);
  const evidence = row.evidence;
  if (evidence?.kind === "strength_pr") {
    const exercise = (opts.lang === "ar" ? row.exerciseNameAr : row.exerciseNameEn) || row.exerciseNameEn || row.exerciseNameAr || "";
    if (opts.privacy.absoluteWeight) {
      const before = formatSetEvidence(evidence.previousBest.load, evidence.previousBest.reps, opts.lang, opts.unit);
      const after = formatSetEvidence(evidence.newBest.load, evidence.newBest.reps, opts.lang, opts.unit);
      return { title, exercise, delta: opts.t("achv.share.delta", { before, after }) };
    }
    const qualitative: StringKey =
      evidence.deltas.load < -LOAD_EPS ? "achv.share.lessAssistance" : evidence.deltas.load > LOAD_EPS ? "achv.share.heavier" : evidence.deltas.reps > 0 ? "achv.share.plusRep" : "achv.share.stronger";
    return { title, exercise, delta: opts.t(qualitative) };
  }
  const key: StringKey =
    evidence?.kind === "first_session" ? "achv.share.firstSession" : evidence?.kind === "comeback" ? "achv.share.comeback" : "achv.share.weeks";
  return { title, exercise: null, delta: opts.t(key) };
}

export function formatShareCard(parts: ShareCardParts): string {
  return [parts.title, parts.exercise, parts.delta].filter((x): x is string => !!x && x.length > 0).join("\n");
}
