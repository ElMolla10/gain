/**
 * Achievements round 2: the share posters' words (spec PR G). Pure, so privacy can be tested without a renderer. Every line comes from
 * existing selectors (shareCardCopy, evidenceLine, prDelta, plateCopy); no username, gym or QR, and with weights hidden (the default) no
 * load number appears anywhere on the PR poster: the staircase keeps its shape but carries no values.
 */
import type { AchievementEvidence } from "@gain/engine";
type StrengthPrEvidence = Extract<AchievementEvidence, { kind: "strength_pr" }>;
import type { Lang } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { countKey, exerciseName, plateCopy } from "./achievementCopy";
import { evidenceLine, formatSetEvidence } from "./achievementEvidence";
import { plateTier, prBaseline, prDelta, prStair, type PlateTier, type StairStep } from "./achievementShowcase";
import { prestigeForBadge, shareCardCopy, type SharePrivacy, type SurfaceBadge } from "./achievementSurface";
import { formatDayFull } from "./dateText";
import type { Unit } from "./units";

type T = (key: StringKey, params?: Record<string, string | number>) => string;

/** Poster sizes in dp; captured at 1080 px wide (×3). Medal and PR are 4:5, the plate 9:16. */
export const POSTER_W = 360;
export const POSTER_H = { medal: 450, pr: 450, plate: 640 } as const;
export const POSTER_PX = 1080;

export type PosterKind = keyof typeof POSTER_H;

export type PosterCopy =
  | { kind: "medal"; badgeId: string; eyebrow: string; title: string; line: string; date: string | null; footer: string }
  | {
      kind: "pr";
      badgeId: string;
      eyebrow: string;
      date: string | null;
      exercise: string;
      /** Weights on: "Before 12 kg × 6", the new set and the delta chip. Hidden: the qualitative line and "Weights hidden". */
      before: string | null;
      headline: string;
      chip: string | null;
      sub: string | null;
      steps: StairStep[];
      baseline: number | null;
      assisted: boolean;
      footer: string;
    }
  | { kind: "plate"; badgeId: string; eyebrow: string; days: number; floor: boolean; tier: PlateTier; tierName: string; since: string | null; weeks: string | null; footer: string };

export function posterKind(row: Pick<SurfaceBadge, "badgeId" | "evidence">): PosterKind {
  if (row.badgeId.startsWith("hundred_club_")) return "plate";
  if (row.evidence?.kind === "strength_pr") return "pr";
  return "medal";
}

export interface PosterContext {
  privacy: SharePrivacy;
  lang: Lang;
  unit: Unit;
  t: T;
  /** The cabinet, when known (Achievements tab): PR steps, "Training since" and the training-day count. */
  cabinet?: readonly SurfaceBadge[];
  /** Training days for the plate poster, when known (getHome stats); otherwise the hundred_club evidence. */
  days?: { days: number | null; floor: boolean } | null;
  qualifiedWeeks?: number | null;
}

export function posterCopy(row: SurfaceBadge, ctx: PosterContext): PosterCopy {
  const { lang, unit, t } = ctx;
  const footer = t("achv.r2.poster.from");
  const date = row.earnedLocalDate ? formatDayFull(row.earnedLocalDate, lang) : null;
  const kind = posterKind(row);
  if (kind === "plate") {
    const fromEvidence = row.evidence?.kind === "hundred_club" ? row.evidence.days : Number(row.badgeId.replace("hundred_club_", "")) || 0;
    const days = ctx.days?.days ?? fromEvidence;
    const floor = ctx.days?.days != null ? ctx.days.floor : false;
    const tier = plateTier(days);
    const first = ctx.cabinet?.find((r) => r.badgeId === "first_session" && r.status === "earned" && r.earnedLocalDate);
    const weeks = ctx.qualifiedWeeks ?? null;
    return {
      kind,
      badgeId: row.badgeId,
      eyebrow: t("achv.r2.plate.eyebrow"),
      days,
      floor,
      tier,
      tierName: t(`achv.r2.plate.${tier}` as StringKey),
      since: first?.earnedLocalDate ? t("achv.r2.poster.since", { date: formatDayFull(first.earnedLocalDate, lang) }) : null,
      weeks: weeks && weeks > 0 ? t(countKey(weeks, lang, "achv.r2.poster.weeks.one", "achv.r2.poster.weeks.few"), { n: weeks }) : null,
      footer,
    };
  }
  if (kind === "pr") {
    const e = row.evidence as StrengthPrEvidence;
    const shown = ctx.privacy.absoluteWeight;
    const cabinet = ctx.cabinet ?? [];
    const steps = cabinet.length ? prStair(cabinet, e.identity) : [];
    return {
      kind,
      badgeId: row.badgeId,
      eyebrow: t("achv.r2.poster.pr"),
      date,
      exercise: exerciseName(row, lang),
      before: shown ? t("achv.r2.poster.before", { set: formatSetEvidence(e.previousBest.load, e.previousBest.reps, lang, unit) }) : null,
      headline: shown ? formatSetEvidence(e.newBest.load, e.newBest.reps, lang, unit) : shareCardCopy(row, ctx).delta,
      chip: shown ? prDelta(e, lang, unit, t) : null,
      sub: shown ? null : t("achv.r2.poster.hidden"),
      // Without the cabinet (Finish) the stair is the two sets this PR compares; the shape only, never values.
      steps: steps.length ? steps : [{ load: e.newBest.load, reps: e.newBest.reps, localDate: e.newBest.localDate, repOnly: Math.abs(e.deltas.load) < 1e-6 }],
      baseline: (cabinet.length ? prBaseline(cabinet, e.identity) : null) ?? e.previousBest.load,
      assisted: e.identity.setup === "assisted",
      footer,
    };
  }
  return {
    kind,
    badgeId: row.badgeId,
    eyebrow: t("achv.r2.poster.medal", { prestige: t(`achv.prestige.${prestigeForBadge(row.badgeId)}` as StringKey) }),
    title: t(row.i18nKey as StringKey),
    line: evidenceLine(row.evidence, t, lang, unit, { nameEn: row.exerciseNameEn, nameAr: row.exerciseNameAr }),
    date,
    footer,
  };
}

/** Every string a poster prints (for audits). */
export function posterTexts(c: PosterCopy): string[] {
  const all =
    c.kind === "medal"
      ? [c.eyebrow, c.title, c.line, c.date]
      : c.kind === "pr"
        ? [c.eyebrow, c.date, c.exercise, c.before, c.headline, c.chip, c.sub]
        : [c.eyebrow, String(c.days), c.tierName, c.since, c.weeks];
  return [...all, c.footer].filter((s): s is string => !!s);
}
