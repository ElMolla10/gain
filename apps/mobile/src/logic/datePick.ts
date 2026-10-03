/** Date picking without typing: three selectors (day, month, year) that can only produce a real calendar date. Pure; no native module, works offline and in RTL. */

export interface DateParts {
  y: number | null;
  m: number | null;
  d: number | null;
}

export const EMPTY_DATE: DateParts = { y: null, m: null, d: null };

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Days in a month. With no year yet, February counts as 29 (the day is clamped once a year is chosen). */
export function daysInMonth(y: number | null, m: number): number {
  if (m === 2) return y === null || isLeap(y) ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

/** "2027-06-30" -> parts. Anything that is not a real calendar date gives empty parts. */
export function splitIso(s: string): DateParts {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return { ...EMPTY_DATE };
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo) ? { y, m: mo, d } : { ...EMPTY_DATE };
}

/** Parts -> "YYYY-MM-DD", or "" while any part is missing (the field then counts as not set). */
export function joinIso(p: DateParts): string {
  if (p.y === null || p.m === null || p.d === null) return "";
  if (p.d > daysInMonth(p.y, p.m)) return "";
  return `${String(p.y).padStart(4, "0")}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** After the month or year changes, a day that no longer exists (31 -> 30, 29 Feb in a common year) moves to the last day of that month. */
export function clampDay(p: DateParts): DateParts {
  if (p.m === null || p.d === null) return p;
  const max = daysInMonth(p.y, p.m);
  return p.d > max ? { ...p, d: max } : p;
}

export function setPart(p: DateParts, part: keyof DateParts, value: number | null): DateParts {
  return clampDay({ ...p, [part]: value });
}

export const dayOptions = (p: DateParts): number[] => Array.from({ length: p.m === null ? 31 : daysInMonth(p.y, p.m) }, (_, i) => i + 1);
export const monthOptions = (): number[] => Array.from({ length: 12 }, (_, i) => i + 1);

/** Years offered. "past" counts down from this year (birthdays), "future" counts up (goal dates). */
export function yearOptions(kind: "past" | "future", nowMs: number, span: number, minAge = 0): number[] {
  const now = new Date(nowMs).getUTCFullYear();
  if (kind === "future") return Array.from({ length: span + 1 }, (_, i) => now + i);
  return Array.from({ length: span - minAge + 1 }, (_, i) => now - minAge - i);
}
