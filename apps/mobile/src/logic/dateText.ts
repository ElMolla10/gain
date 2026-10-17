/**
 * The one way the app shows a day (Plate S-8): EN "Wed 16 Sep", AR "الأربعاء 16 سبتمبر", with the year only when it isn't the current
 * year, and Western digits in both languages (S-2). Names come from fixed tables rather than Intl, so the output is the same on Hermes,
 * iOS and Android whatever their ICU data says (ar-EG would print Eastern Arabic-Indic digits, and en-GB now says "Sept").
 * Exports and file names keep ISO dates; this is for the UI and share text only.
 */
export type DateLang = "en" | "ar";

const EN_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AR_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/** Eastern Arabic-Indic (U+0660–0669) and extended (U+06F0–06F9) digits → 0–9. */
export const toWesternDigits = (s: string): string =>
  s.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) & 0xf));

/** A local Date from epoch ms, a YYYY-MM-DD training day (read at local noon, so no timezone shifts it) or an ISO timestamp. */
function toDate(when: number | string): Date | null {
  if (typeof when === "number") return Number.isFinite(when) ? new Date(when) : null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(when);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  const ms = Date.parse(when);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

/** "Wed 16 Sep" / "الأربعاء 16 سبتمبر" (+ " 2025" outside the current year). Unreadable input is returned as it is. */
export function formatDay(when: number | string, lang: DateLang, now: number = Date.now()): string {
  const d = toDate(when);
  if (!d) return String(when);
  const year = d.getFullYear() === new Date(now).getFullYear() ? "" : ` ${d.getFullYear()}`;
  const days = lang === "ar" ? AR_DAYS : EN_DAYS;
  const months = lang === "ar" ? AR_MONTHS : EN_MONTHS;
  return toWesternDigits(`${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}${year}`);
}

/** A plain number with Western digits in both languages (counts, percentages); never for loads. */
export const formatNumber = (n: number, _lang: DateLang, decimals = 0): string =>
  toWesternDigits(n.toLocaleString("en-US", { maximumFractionDigits: decimals }));
