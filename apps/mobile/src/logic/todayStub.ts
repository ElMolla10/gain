/**
 * The "written at the door" stub and the rack rows' words (spec §1, §9), pure. Provenance comes from the stored decision (created_at) and
 * the latest finished session before it; "last time" from the decision inputs (or the preview's own inputs). Numbers are isolated,
 * units stay in the language, the arrow points along the reading direction (→ EN, ← AR), and nothing claims a "best" or a streak.
 */
import type { SessionSummary } from "@gain/engine";
import { formatLoad, isolateLtr, NBSP, type Lang } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { countKey } from "./achievementCopy";
import { formatDay } from "./dateText";
import { reasonTail } from "./todayCopy";
import type { Unit } from "./units";

type T = (key: StringKey, params?: Record<string, string | number>) => string;

export const stubArrow = (lang: Lang): string => (lang === "ar" ? "←" : "→");

/** "21:14", 24-hour, Western digits. */
export function clock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** The day name of the latest finished session before `createdAt` (sessions newest first), or null. */
export function writtenAfter(createdAt: number, sessions: readonly { dayName: string; finishedAt: number }[]): string | null {
  const s = sessions.filter((x) => x.finishedAt <= createdAt).sort((a, b) => b.finishedAt - a.finishedAt)[0];
  return s && s.dayName ? s.dayName : null;
}

export interface StubInput {
  /** A preview (no stored decision yet). */
  preview: boolean;
  createdAt: number | null;
  afterDay: string | null;
  /** The lifter edited the load: "You set {load} yourself" (no edit time is stored). */
  edited: { load: number } | null;
  last: SessionSummary | null;
  /** The delta chip text for the lead ("+2.5 kg", "+1 rep"...). */
  chip: string | null;
  /** The rendered reason (already localised); the stub shows its tail. */
  reason: string | null;
}

export interface StubLines {
  provenance: string;
  /** "Last time 100 kg × 10 → +2.5 kg: You hit 10 at 100 kg." or null when there is no last time. */
  lastTime: string | null;
}

/** "100 kg × 10 · 3 sets": the top load and the weakest reps at it (repsAtTop), with how many sets were at the top. Never a per-set list we do not have. */
export function lastText(last: SessionSummary, lang: Lang, unit: Unit, t: T): string {
  const sets = t(countKey(last.setsAtTop, lang, "today.stub.sets.one", "today.stub.sets.few"), { n: last.setsAtTop });
  return `${formatLoad(last.topLoad, lang, unit)}${NBSP}×${NBSP}${isolateLtr(String(last.repsAtTop))} · ${sets}`;
}

export function stubLines(input: StubInput, ctx: { lang: Lang; unit: Unit; t: T; now: number }): StubLines {
  const { lang, unit, t, now } = ctx;
  let provenance: string;
  if (input.edited) provenance = t("today.stub.edited", { load: formatLoad(input.edited.load, lang, unit) });
  else if (input.preview || input.createdAt === null) provenance = t("today.stub.preview");
  else {
    const when = `${formatDay(input.createdAt, lang, now)} ${clock(input.createdAt)}`;
    provenance = input.afterDay ? t("today.stub.written", { when, day: input.afterDay }) : t("today.stub.writtenNoDay", { when });
  }
  if (!input.last) return { provenance, lastTime: null };
  const head = t("today.stub.last", { last: lastText(input.last, lang, unit, t) });
  const tail = input.reason ? reasonTail(input.reason) : "";
  const delta = input.chip ? ` ${stubArrow(lang)} ${input.chip}` : "";
  return { provenance, lastTime: `${head}${delta}${tail ? `${lang === "ar" ? "،" : ":"} ${tail}` : ""}` };
}

/** The meta line under the rack: "6 exercises · 18 sets · ~54 min · done around 07:02". */
export function timeLine(n: number, sets: number, minutes: number, doneAt: string, lang: Lang, t: T): string {
  return t(countKey(n, lang, "today.time.one", "today.time.few"), { n, sets, min: minutes, time: doneAt });
}

/** The rack row's spoken label, chip inside it: "Incline dumbbell press, 3 sets of 8 to 10, target 28 kilograms for 9, plus 1 rep." */
export function rackA11yLabel(parts: { name: string; scheme: string; target: string | null; chip: string | null }, t: T, lang: Lang): string {
  const bits = [parts.name, parts.scheme];
  if (parts.target) bits.push(t("today.rack.a11yTarget", { target: parts.target }));
  if (parts.chip) bits.push(parts.chip);
  return bits.join(lang === "ar" ? "، " : ", ");
}
