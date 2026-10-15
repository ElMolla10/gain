import type { EquipmentType, LoggedSet } from "./types";

/**
 * Hevy CSV export parser (columns: title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,
 * set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe). Pure functions, no I/O.
 * Times in Hevy exports carry no zone, so they are kept as local wall-clock ISO strings ("2026-09-29T15:15:00").
 */

export const HEVY_COLUMNS = [
  "title",
  "start_time",
  "end_time",
  "description",
  "exercise_title",
  "superset_id",
  "exercise_notes",
  "set_index",
  "set_type",
  "weight_kg",
  "reps",
  "distance_km",
  "duration_seconds",
  "rpe",
] as const;

export class HevyParseError extends Error {}

/** RFC 4180-ish CSV: quoted fields, "" escapes, CRLF/LF, newlines inside quotes, optional BOM. */
export function parseCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (inQuotes) throw new HevyParseError("Unterminated quoted field");
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Reject impossible fields before JavaScript can normalize them into another day. */
export function validCalendarFields(year: number, month: number, day: number, hour: number, minute: number, second = 0): boolean {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return [year, month, day, hour, minute, second].every(Number.isInteger) && year >= 1 && year <= 9999
    && days !== undefined && day >= 1 && day <= days && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59;
}

/** Accept explicit month names or ISO local dates; never guess ambiguous numeric dates or time zones. */
export function parseHevyDate(s: string): string {
  const monthFirst = /^\s*([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?\s*$/i.exec(s);
  const dayFirst = /^\s*(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?\s*$/i.exec(s);
  const iso = /^\s*(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?\s*$/.exec(s);
  if (!monthFirst && !dayFirst && !iso) throw new HevyParseError(`Unrecognised date: "${s}"`);
  const monthName = monthFirst?.[1] ?? dayFirst?.[2];
  const month = iso ? Number(iso[2]) : MONTHS.indexOf(monthName!.slice(0, 3).toLowerCase()) + 1;
  if (!iso && month === 0) throw new HevyParseError(`Unrecognised month in date: "${s}"`);
  const year = Number(iso?.[1] ?? monthFirst?.[3] ?? dayFirst?.[3]);
  const day = Number(iso?.[3] ?? monthFirst?.[2] ?? dayFirst?.[1]);
  let h = Number(iso?.[4] ?? monthFirst?.[4] ?? dayFirst?.[4]);
  const minute = Number(iso?.[5] ?? monthFirst?.[5] ?? dayFirst?.[5]);
  const second = Number(iso?.[6] ?? monthFirst?.[6] ?? dayFirst?.[6] ?? 0);
  const ap = (monthFirst?.[7] ?? dayFirst?.[7])?.toUpperCase();
  if (ap) {
    if (h < 1 || h > 12) throw new HevyParseError(`Bad hour in date: "${s}"`);
    if (ap === "AM" && h === 12) h = 0;
    else if (ap === "PM" && h !== 12) h += 12;
  }
  if (!validCalendarFields(year, month, day, h, minute, second)) throw new HevyParseError(`Invalid calendar date: "${s}"`);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${String(year).padStart(4, "0")}-${p(month)}-${p(day)}T${p(h)}:${p(minute)}:${p(second)}`;
}

export interface HevySet {
  index: number;
  type: string;
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  rpe: number | null;
}

export interface HevyExercise {
  title: string;
  notes: string;
  supersetId: string | null;
  sets: HevySet[];
}

export interface HevyWorkout {
  title: string;
  startTime: string;
  endTime: string;
  description: string;
  exercises: HevyExercise[];
}

export interface HevyParseResult {
  workouts: HevyWorkout[];
  /** Human-readable problems that did not stop parsing (e.g. a row skipped). */
  warnings: string[];
  rowCount: number;
}

const num = (s: string | undefined): number | null => {
  if (s === undefined || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export function parseHevyCsv(text: string): HevyParseResult {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new HevyParseError("Empty file");
  const header = rows[0]!.map((h) => h.trim());
  const missing = HEVY_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) throw new HevyParseError(`Missing columns: ${missing.join(", ")}`);
  const idx = Object.fromEntries(HEVY_COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<(typeof HEVY_COLUMNS)[number], number>;
  const warnings: string[] = [];
  const byKey = new Map<string, HevyWorkout>();
  let rowCount = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    const get = (c: (typeof HEVY_COLUMNS)[number]) => row[idx[c]] ?? "";
    let start: string;
    try {
      start = parseHevyDate(get("start_time"));
    } catch (e) {
      warnings.push(`row ${r + 1}: ${(e as Error).message}; skipped`);
      continue;
    }
    let end = start;
    try {
      if (get("end_time").trim() !== "") end = parseHevyDate(get("end_time"));
    } catch {
      warnings.push(`row ${r + 1}: bad end_time, using start_time`);
    }
    const exTitle = get("exercise_title").trim();
    if (!exTitle) {
      warnings.push(`row ${r + 1}: no exercise_title; skipped`);
      continue;
    }
    rowCount++;
    const key = `${get("title")}\u0000${start}`;
    let w = byKey.get(key);
    if (!w) {
      w = { title: get("title"), startTime: start, endTime: end, description: get("description"), exercises: [] };
      byKey.set(key, w);
    }
    let ex = w.exercises.find((e) => e.title === exTitle);
    if (!ex) {
      ex = { title: exTitle, notes: get("exercise_notes"), supersetId: get("superset_id") || null, sets: [] };
      w.exercises.push(ex);
    }
    ex.sets.push({
      index: num(get("set_index")) ?? ex.sets.length,
      type: get("set_type") || "normal",
      weightKg: num(get("weight_kg")),
      reps: num(get("reps")),
      distanceKm: num(get("distance_km")),
      durationSeconds: num(get("duration_seconds")),
      rpe: num(get("rpe")),
    });
  }
  const workouts = [...byKey.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (const w of workouts) for (const e of w.exercises) e.sets.sort((a, b) => a.index - b.index);
  return { workouts, warnings, rowCount };
}

/** Equipment from a Hevy title suffix, e.g. "Bench Press (Barbell)". Null when the title does not say. */
export function equipmentFromTitle(title: string): EquipmentType | null {
  const m = /\(([^)]+)\)\s*$/.exec(title);
  if (!m) return null;
  const k = m[1]!.trim().toLowerCase();
  if (k === "barbell") return "barbell";
  if (k === "dumbbell") return "dumbbell";
  if (k === "cable") return "cable";
  if (k === "machine" || k === "pec deck" || k === "machine plates" || k === "weighted hyperextension") return "machine";
  if (k.includes("assisted")) return "assisted";
  return null;
}

/** Hevy sets -> engine sets. Drop sets are tagged "drop". RPE (if any) becomes reps in reserve = 10 - RPE. Sets with no reps are skipped. */
export function toLoggedSets(sets: HevySet[]): LoggedSet[] {
  const out: LoggedSet[] = [];
  for (const s of sets) {
    if (s.reps === null || s.reps < 1) continue;
    const set: LoggedSet = { load: s.weightKg ?? 0, reps: s.reps };
    if (s.type === "dropset") set.tags = ["drop"];
    else if (s.type === "warmup") set.warmup = true;
    if (s.rpe !== null) set.rir = Math.max(0, 10 - s.rpe);
    out.push(set);
  }
  return out;
}
