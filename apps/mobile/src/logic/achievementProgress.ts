import type { SetupType } from "@gain/engine";

export const TRAINING_BADGES = [1, 5, 10, 25, 50, 100, 250, 500] as const;
export const BREAKTHROUGH_BADGES = [1, 5, 10, 25, 50, 100] as const;
export const WEEK_BADGES = [4, 12, 26, 52, 104] as const;
export const MONTH_BADGES = [1, 3, 6, 12, 24, 36] as const;
export const YEAR_BADGES = [1, 2, 3] as const;
export const GOAL_BADGES = [1, 3, 5, 10] as const;

/** Two distinct training days qualify a week; three qualified weeks qualify a month. */
export function consistencyAchievementStats(times: readonly number[], now = Date.now(), startsOn = 1) {
  const uniqueDays = new Map<string, Date>();
  for (const time of times) {
    if (!Number.isFinite(time) || time > now) continue;
    const d = new Date(time);
    d.setHours(12, 0, 0, 0);
    uniqueDays.set(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, d);
  }
  const weeks = new Map<string, { start: Date; days: number }>();
  for (const d of uniqueDays.values()) {
    const start = new Date(d);
    start.setDate(d.getDate() - (d.getDay() - startsOn + 7) % 7);
    const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
    const week = weeks.get(key);
    if (week) week.days++;
    else weeks.set(key, { start, days: 1 });
  }
  const qualified = [...weeks.values()].filter(w => w.days >= 2);
  const monthCounts = new Map<number, number>();
  for (const week of qualified) {
    const month = week.start.getFullYear() * 12 + week.start.getMonth();
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
  }
  const activeMonths = new Set([...monthCounts].filter(([, count]) => count >= 3).map(([month]) => month));
  const currentMonth = new Date(now).getFullYear() * 12 + new Date(now).getMonth();
  let consistentYears = 0;
  for (let years = 1; years <= YEAR_BADGES.at(-1)!; years++) {
    const width = 12 * years;
    for (let end = currentMonth; end >= Math.min(...activeMonths, currentMonth); end--) {
      const count = [...activeMonths].filter(month => month <= end && month > end - width).length;
      if (count >= years * 10) { consistentYears = years; break; }
    }
  }
  const nextYear = consistentYears + 1;
  let bestMonthsInWindow = 0;
  if (nextYear <= YEAR_BADGES.at(-1)!) {
    for (let end = currentMonth; end >= Math.min(...activeMonths, currentMonth); end--) {
      const count = [...activeMonths].filter(month => month <= end && month > end - 12 * nextYear).length;
      bestMonthsInWindow = Math.max(bestMonthsInWindow, count);
    }
  }
  return { trainingDays: uniqueDays.size, qualifiedWeeks: qualified.length, activeMonths: activeMonths.size,
    consistentYears, nextYearProgress: nextYear > YEAR_BADGES.at(-1)! ? 1 : bestMonthsInWindow / (10 * nextYear) };
}

export interface BreakthroughInput {
  lineId: string;
  exerciseId: string;
  nameEn: string;
  nameAr: string;
  setup: SetupType;
  sessionId: string;
  at: number;
  load: number;
}

export interface Breakthrough {
  lineId: string;
  exerciseId: string;
  nameEn: string;
  nameAr: string;
  at: number;
  load: number;
  previous: number;
  assisted: boolean;
}

/** One weight breakthrough per exercise session; the first session establishes the baseline. */
export function strengthBreakthroughs(rows: readonly BreakthroughInput[], now = Date.now()): Breakthrough[] {
  const sessions = new Map<string, BreakthroughInput[]>();
  for (const row of rows) {
    if (!Number.isFinite(row.at) || row.at > now || !Number.isFinite(row.load) || row.load < 0) continue;
    const key = `${row.lineId}:${row.sessionId}`;
    const group = sessions.get(key) ?? [];
    group.push(row);
    sessions.set(key, group);
  }
  const best = new Map<string, number>();
  const events: Breakthrough[] = [];
  for (const sets of [...sessions.values()].sort((a, b) => a[0]!.at - b[0]!.at || a[0]!.sessionId.localeCompare(b[0]!.sessionId))) {
    const first = sets[0]!;
    const assisted = first.setup === "assisted";
    const load = assisted ? Math.min(...sets.map(s => s.load)) : Math.max(...sets.map(s => s.load));
    const previous = best.get(first.lineId);
    if (previous !== undefined && (assisted ? load < previous - 1e-6 : load > previous + 1e-6)) {
      events.push({ lineId: first.lineId, exerciseId: first.exerciseId, nameEn: first.nameEn, nameAr: first.nameAr,
        at: first.at, load, previous, assisted });
    }
    if (previous === undefined || (assisted ? load < previous : load > previous)) best.set(first.lineId, load);
  }
  return events.reverse();
}

export function badgeStatus(count: number, thresholds: readonly number[]): { earned: number[]; next: number | null; progress: number } {
  const earned = thresholds.filter(n => n <= count);
  const previous = earned.at(-1) ?? 0;
  const next = thresholds.find(n => n > count) ?? null;
  return { earned, next, progress: next === null ? 1 : (count - previous) / (next - previous) };
}
