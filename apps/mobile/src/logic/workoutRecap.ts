import { isTrustedWorkingSet } from "@gain/engine";
import type { SessionSummary } from "../db/finishRepo";
import type { SessionDetail } from "../db/historyRepo";
import { translate, type Lang } from "../i18n/format";
import { quantityText, setQuantity } from "./quantity";
import { sessionMinutes } from "./historyRows";
import { kgToUnit, weightText, unitLabel, type Unit } from "./units";

/** Real logged-set statistics. Do not treat warm-ups, drops, questionable sets or holds as rep-based volume. */
export function workoutRecapStats(detail: SessionDetail, summary: SessionSummary) {
  const trusted = detail.exercises.flatMap(ex => ex.measure === "reps"
    ? ex.sets.filter(isTrustedWorkingSet)
    : []);
  const volumeKg = trusted.reduce((v, s) => v + s.load * s.reps, 0);
  return {
    exercises: summary.totals.exercises,
    sets: summary.totals.counted,
    volumeKg,
    durationMinutes: sessionMinutes(detail.startedAt, detail.finishedAt, detail.imported),
    personalBests: summary.totals.records,
  };
}

export function personalBestLines(summary: SessionSummary, lang: Lang, unit: Unit): string[] {
  const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate(lang, key, params).replace(/[\u2066\u2069]/g, "");
  const fmt = (kg: number) => `${weightText(kg, unit)} ${unitLabel(unit, lang)}`;
  return summary.exercises.flatMap(ex => {
    if (ex.firstTime || !ex.top) return [];
    const name = lang === "ar" ? ex.nameAr : ex.nameEn;
    return ex.records.map(record => {
      if (record === "load") return `${name} — ${t("finish.record.load", { load: fmt(ex.top!.load) })}`;
      if (record === "reps_at_load") return `${name} — ${t("finish.record.reps", { load: fmt(ex.top!.load), reps: ex.top!.reps })}`;
      if (record === "quantity_at_load" && ex.top?.quantity !== undefined && ex.measure) {
        const q = quantityText(ex.top.quantity, ex.measure, { s: t("qty.s"), m: t("qty.m") });
        return `${name} — ${ex.top.load > 0 ? t("finish.record.quantity", { load: fmt(ex.top.load), q }) : t("finish.record.quantityBare", { q })}`;
      }
      return "";
    }).filter(Boolean);
  });
}

/** Human-readable, plain-text workout sharing. All data stays on-device until the user opens the system share sheet. */
export function formatWorkoutShareText(detail: SessionDetail, summary: SessionSummary, lang: Lang, unit: Unit): string {
  const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate(lang, key, params).replace(/[\u2066\u2069]/g, "");
  const stats = workoutRecapStats(detail, summary);
  const pb = personalBestLines(summary, lang, unit);
  const label = unitLabel(unit, lang);
  const date = new Date(detail.finishedAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  const lines = [
    `GAIN · ${detail.dayName}`,
    date,
    `${t("recap.exercises")}: ${stats.exercises}  ·  ${t("workout.stat.sets")}: ${stats.sets}`,
    `${t("workout.stat.volume")}: ${Math.round(kgToUnit(stats.volumeKg, unit))} ${label}`,
    ...(stats.durationMinutes === null ? [] : [`${t("workout.stat.duration")}: ${stats.durationMinutes} ${t("workout.dur.m")}`]),
  ];
  if (pb.length > 0) lines.push("", `🏆 ${t("recap.personalBests")} (${pb.length})`, ...pb.map(x => `• ${x}`));
  for (const ex of detail.exercises) {
    lines.push("", lang === "ar" ? ex.nameAr : ex.nameEn);
    ex.sets.forEach((s, i) => {
      const load = `${weightText(s.load, unit)} ${label}`;
      const q = ex.measure === "reps"
        ? `${s.reps} ${t("workout.col.reps")}`
        : `${quantityText(setQuantity(s, ex.measure), ex.measure, { s: t("qty.s"), m: t("qty.m") })}`;
      const tags = [
        ...(s.warmup ? [t("history.warmup")] : []),
        ...(!s.warmup && s.tags.includes("drop") ? [t("history.drop")] : []),
        ...(!s.warmup && s.tags.includes("failure") ? [t("history.failure")] : []),
        ...(s.outlierStatus === "unconfirmed" ? [t("history.unconfirmed")] : []),
        ...(s.outlierStatus === "rejected" ? [t("history.rejected")] : []),
        ...(s.rir !== null && !s.warmup && ex.measure === "reps" ? [t("history.rir", { n: s.rir })] : []),
      ];
      lines.push(`${i + 1}. ${load} × ${q}${tags.length ? ` (${tags.join(", ")})` : ""}`);
    });
  }
  return lines.join("\n").trim();
}
