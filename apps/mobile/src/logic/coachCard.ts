import { isTimed, quantityText, targetPhrase, targetQuantity } from "./quantity";
import { renderReason } from "@gain/engine";
import { COACH_LIMITS, type CoachCardPayload } from "@gain/sync";
import type { PaceResult } from "../db/goalRepo";
import type { SessionSummary, TargetRow } from "../db/finishRepo";
import { formatLoad, isolateLtr, translate, type Lang } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { describePace, type PaceContext } from "./paceText";
import { localizeReason, type Unit } from "./units";

/**
 * The coach card: what the lifter did, the next targets, and the goal pace line, as one page the lifter sends to a coach.
 * It never carries bodyweight, never claims a record without history, and always carries the not-a-doctor line.
 * Pure: the screen turns the HTML into a PDF and opens the share sheet.
 */

export interface CardInput {
  lang: Lang;
  unit: Unit;
  /** yyyy-mm-dd of the finished session. */
  date: string;
  summary: SessionSummary;
  /** Next session's day name and targets; null when none is planned. */
  next: { dayName: string; targets: TargetRow[] } | null;
  /** One pace sentence, or null when there is no goal OR the goal is a bodyweight goal (bodyweight is never put on the card). */
  paceLine: string | null;
}

export interface CardBlock {
  heading: string;
  lines: string[];
}

export interface CardModel {
  lang: Lang;
  dir: "ltr" | "rtl";
  title: string;
  date: string;
  blocks: CardBlock[];
  footer: string;
}

export function buildCardModel(i: CardInput): CardModel {
  const { lang, unit } = i;
  const t = (key: StringKey, params?: Record<string, string | number>) => translate(lang, key, params);

  const done: string[] = [];
  for (const e of i.summary.exercises) {
    const name = lang === "ar" ? e.nameAr : e.nameEn;
    const parts: string[] = [];
    if (e.counted > 0) parts.push(t("finish.countedLine", { n: e.counted }));
    const letters = { s: t("qty.s"), m: t("qty.m") };
    if (e.top && e.measure && isTimed(e.measure) && e.top.quantity !== undefined) parts.push(t("card.topSetTimed", { q: targetPhrase(e.top.load, e.top.quantity, e.measure, (kg) => formatLoad(kg, lang, unit), letters) }));
    else if (e.top) parts.push(t("card.topSet", { load: formatLoad(e.top.load, lang, unit), reps: e.top.reps }));
    if (e.top) {
      for (const r of e.records) {
        if (r === "load") parts.push(t("finish.record.load", { load: formatLoad(e.top.load, lang, unit) }));
        if (r === "quantity_at_load" && e.measure && e.top.quantity !== undefined) {
          const q = quantityText(e.top.quantity, e.measure, letters);
          parts.push(e.top.load > 0 ? t("finish.record.quantity", { load: formatLoad(e.top.load, lang, unit), q }) : t("finish.record.quantityBare", { q }));
        }
        if (r === "reps_at_load") parts.push(t("finish.record.reps", { load: formatLoad(e.top.load, lang, unit), reps: e.top.reps }));
      }
    }
    if (e.firstTime) parts.push(t("finish.firstTime"));
    if (e.warmups + e.unconfirmed > 0) parts.push(t("finish.excludedNote", { warmups: e.warmups, unconfirmed: e.unconfirmed }));
    done.push(`${name}: ${parts.join(" · ")}`);
  }

  const blocks: CardBlock[] = [{ heading: t("card.done"), lines: done }];

  if (i.next === null) blocks.push({ heading: t("card.nextNone"), lines: [t("card.noNext")] });
  else {
    const lines = i.next.targets.map((tg) => {
      const name = lang === "ar" ? tg.nameAr : tg.nameEn;
      if (tg.status === "rejected") return `${name}: ${t("finish.rejectedNote")}`;
      if (tg.currency === "none" || tg.effectiveLoad === null) return `${name}: ${t("finish.noTarget")}`;
      const target = isTimed(tg.measure)
        ? targetPhrase(tg.effectiveLoad, targetQuantity(tg, tg.measure) ?? 0, tg.measure, (kg) => formatLoad(kg, lang, unit), { s: t("qty.s"), m: t("qty.m") })
        : `${formatLoad(tg.effectiveLoad, lang, unit)} × ${isolateLtr(String(tg.reps ?? ""))}`;
      const reason = renderReason(localizeReason(tg.reason, unit, lang), lang);
      return `${name}: ${target} (${t(`finish.status.${tg.status}` as StringKey)}). ${reason}`;
    });
    blocks.push({ heading: t("card.next", { day: i.next.dayName }), lines });
  }

  if (i.paceLine) blocks.push({ heading: t("card.pace"), lines: [i.paceLine] });

  return {
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    title: t("card.title"),
    date: t("card.date", { date: i.date }),
    blocks,
    footer: t("card.notDoctor"),
  };
}

/** The card as the server's plain-text payload: same words as the PDF, every string clipped to the server's limits. */
export function toCoachPayload(m: CardModel): CoachCardPayload {
  const clip = (s: string) => (s.length > COACH_LIMITS.maxText ? s.slice(0, COACH_LIMITS.maxText - 1) + "…" : s);
  let budget: number = COACH_LIMITS.maxLines;
  const blocks = m.blocks.slice(0, COACH_LIMITS.maxBlocks).map((b) => {
    const lines = b.lines.slice(0, Math.max(0, budget)).map(clip);
    budget -= lines.length;
    return { heading: clip(b.heading), lines };
  });
  const out: CoachCardPayload = { lang: m.lang, dir: m.dir, title: clip(m.title), date: clip(m.date), blocks, footer: clip(m.footer) };
  // Total size cap: cut from the end (the last lines are the least important) rather than have the server refuse the whole card.
  while (JSON.stringify(out).length > COACH_LIMITS.maxBytes) {
    const last = out.blocks[out.blocks.length - 1]!;
    if (last.lines.length > 0) last.lines.pop();
    else if (out.blocks.length > 1) out.blocks.pop();
    else break;
  }
  return out;
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** One self-contained HTML page. dir and lang come from the card language, so Arabic cards are right-to-left. */
export function cardHtml(m: CardModel): string {
  const blocks = m.blocks
    .map((b) => `<h2>${esc(b.heading)}</h2>${b.lines.map((l) => `<p>${esc(l)}</p>`).join("")}`)
    .join("");
  return `<!DOCTYPE html><html lang="${m.lang}" dir="${m.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
body{font-family:sans-serif;margin:24px;color:#111;line-height:1.5}
h1{font-size:26px;margin:0 0 4px}
h2{font-size:18px;margin:20px 0 6px;border-bottom:1px solid #999;padding-bottom:2px}
p{font-size:15px;margin:6px 0}
.d{color:#555;margin:0 0 8px}
.f{margin-top:28px;font-size:12px;color:#555;border-top:1px solid #999;padding-top:8px}
</style></head><body><h1>${esc(m.title)}</h1><p class="d">${esc(m.date)}</p>${blocks}<p class="f">${esc(m.footer)}</p></body></html>`;
}

/** The pace line is shown only for lift and muscle goals. A bodyweight goal (or no goal) gives null: nothing about bodyweight goes on the card. */
export function cardPaceLine(pace: PaceResult, ctx: PaceContext): string | null {
  return pace.kind === "lift" || pace.kind === "muscle" ? describePace(pace, ctx).short : null;
}
