import { HevyParseError, parseCsv, parseHevyCsv, validCalendarFields } from "./hevy";
export { HevyParseError as ImportParseError } from "./hevy";
import type { EquipmentType, LoggedSet, SetupType } from "./types";

/**
 * Hevy and Strong CSV import, source-neutral. Pure functions, no I/O. Everything is read exactly as written in the file:
 * a unit that the file does not state is reported as "unknown" and the lifter must say it; nothing is guessed.
 */
export type ImportSource = "hevy" | "strong" | "fitnotes" | "csv";
export type WeightUnit = "kg" | "lb";

/** A row with seconds and/or metres instead of reps (plank, dead hang, farmer's walk). Kept so it can be imported once the exercise is a timed one. */
export interface ImportedTimedSet {
  load: number;
  durationS: number | null;
  distanceM: number | null;
  warmup?: boolean;
  tags?: string[];
}

export interface ImportedExercise {
  /** The title exactly as exported. */
  title: string;
  sets: LoggedSet[];
  /** Rows with no reps but a duration or a distance. Also counted in `skippedRows` (they are only imported for a timed exercise). Omitted = none. */
  timed?: ImportedTimedSet[];
  /** Rows that were not a usable set (rest timers, timed or cardio rows with no reps). */
  skippedRows: number;
}

export interface ImportedWorkout {
  source: ImportSource;
  title: string;
  /** Local wall-clock ISO ("2026-09-29T15:15:00"): exports carry no time zone. */
  startTime: string;
  endTime: string | null;
  /** Stable identity for "already imported": source + start + title. */
  key: string;
  exercises: ImportedExercise[];
}

export interface ImportParse {
  source: ImportSource;
  /** Unit the weights in `workouts` are in. "unknown": the file does not say (Strong's plain "Weight" column). */
  unit: WeightUnit | "unknown";
  workouts: ImportedWorkout[];
  warnings: string[];
  rowCount: number;
}

export const LB_PER_KG = 0.45359237;
/** 135 lb -> 61.23 kg. Rounded to 0.01 kg: gym loads never need more. */
export const lbToKg = (lb: number): number => Math.round(lb * LB_PER_KG * 100) / 100;

export const workoutKey = (source: ImportSource, title: string, startTime: string): string => `${source}|${startTime}|${title}`;

/** First CSV row split on `delimiter` outside quotes (just enough to read a header). */
function headerOf(text: string, delimiter: string): string[] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const nl = src.search(/\r|\n/);
  return (parseCsv(nl < 0 ? src : src.slice(0, nl), delimiter)[0] ?? []).map((h) => h.trim());
}

function detectDelimiter(text: string): "," | ";" {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const nl = src.search(/\r|\n/);
  const line = nl < 0 ? src : src.slice(0, nl);
  let inQ = false;
  let commas = 0;
  let semis = 0;
  for (const c of line) {
    if (c === '"') inQ = !inQ;
    else if (!inQ && c === ",") commas++;
    else if (!inQ && c === ";") semis++;
  }
  return semis > commas ? ";" : ",";
}

const normHeader = (h: string): string => h.trim().toLowerCase().replace(/\s+/g, " ");

/** Which app exported this file, from its header. Null when it looks like none of the known formats. */
export function detectSource(text: string): ImportSource | null {
  const h = headerOf(text, detectDelimiter(text)).map(normHeader);
  if (h.includes("exercise_title") && h.includes("start_time")) return "hevy";
  if (h.includes("exercise name") && h.includes("workout name") && h.includes("set order")) return "strong";
  if (h.includes("exercise") && h.includes("category") && h.includes("date") && h.includes("reps") && h.some((x) => x.startsWith("weight"))) return "fitnotes";
  if (suggestCsvMapping(h)) return "csv";
  return null;
}

export function parseImport(text: string): ImportParse {
  const source = detectSource(text);
  if (source === "hevy") return parseHevy(text);
  if (source === "strong") return parseStrong(text);
  if (source === "fitnotes") return parseFitNotes(text);
  if (source === "csv") return parseMappedCsv(text, suggestCsvMapping(headerOf(text, detectDelimiter(text)).map(normHeader))!);
  throw new HevyParseError("This file is not a supported workout export. Use a CSV file with exercise, date, weight and reps columns");
}

export function csvHeaders(text: string): string[] {
  return headerOf(text, detectDelimiter(text));
}

/** Column indexes for a generic CSV. Required: exercise, date, weight, reps. */
export interface CsvMapping {
  exercise: number;
  date: number;
  weight: number;
  reps: number;
  set?: number;
  workout?: number;
}

const headerIndex = (headers: string[], ...names: string[]): number => headers.findIndex((h) => names.includes(normHeader(h)));

/** Guess a mapping from header names. Null when a required column is missing. */
export function suggestCsvMapping(headers: string[]): CsvMapping | null {
  const h = headers.map(normHeader);
  const exercise = headerIndex(h, "exercise", "exercise name", "name", "title");
  const date = headerIndex(h, "date", "workout date", "day", "start", "start time");
  const weight = headerIndex(h, "weight", "weight (kg)", "weight (lbs)", "weight (lb)", "load", "kg", "lbs");
  const reps = headerIndex(h, "reps", "repetitions", "rep");
  if (exercise < 0 || date < 0 || weight < 0 || reps < 0) return null;
  const set = headerIndex(h, "set", "set order", "set number");
  const workout = headerIndex(h, "workout", "workout name", "session");
  const m: CsvMapping = { exercise, date, weight, reps };
  if (set >= 0) m.set = set;
  if (workout >= 0) m.workout = workout;
  return m;
}

/**
 * A date the file wrote: ISO datetime, ISO date, or a numeric date. Invalid values return null (the row is a warning, never a silent shift).
 * Ambiguous 1–12 / 1–12 / year is read as month/day/year.
 */
export function parseFlexibleDate(s: string): string | null {
  const t = s.trim();
  if (t === "") return null;
  try {
    return parseStrongDate(t);
  } catch {
    /* other shapes */
  }
  let m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(t);
  if (m) {
    if (!validCalendarFields(+m[1]!, +m[2]!, +m[3]!, 0, 0, 0)) return null;
    return `${m[1]}-${m[2]}-${m[3]}T00:00:00`;
  }
  m = /^\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\s*$/.exec(t);
  if (m) {
    const a = +m[1]!, b = +m[2]!, y = +m[3]!;
    const dmy = a > 12;
    const day = dmy ? a : b;
    const month = dmy ? b : a;
    if (!validCalendarFields(y, month, day, 0, 0, 0)) return null;
    const p = (n: number) => String(n).padStart(2, "0");
    return `${y}-${p(month)}-${p(day)}T00:00:00`;
  }
  return null;
}

export function parseMappedCsv(text: string, mapping: CsvMapping): ImportParse {
  return parseColumnar(text, "csv", mapping);
}

function parseFitNotes(text: string): ImportParse {
  const delimiter = detectDelimiter(text);
  const header = headerOf(text, delimiter).map(normHeader);
  const mapping: CsvMapping = {
    date: headerIndex(header, "date"),
    exercise: headerIndex(header, "exercise"),
    weight: headerIndex(header, "weight (kg)", "weight (lbs)", "weight (lb)", "weight"),
    reps: headerIndex(header, "reps"),
  };
  if (mapping.date < 0 || mapping.exercise < 0 || mapping.weight < 0 || mapping.reps < 0) {
    throw new HevyParseError("Missing FitNotes columns: Date, Exercise, Weight, Reps");
  }
  return parseColumnar(text, "fitnotes", mapping, { kind: headerIndex(header, "kind"), time: headerIndex(header, "time") });
}

function parseColumnar(
  text: string,
  source: "fitnotes" | "csv",
  mapping: CsvMapping,
  extra: { kind?: number; time?: number } = {},
): ImportParse {
  const delimiter = detectDelimiter(text);
  const rows = parseCsv(text, delimiter);
  if (rows.length === 0) throw new HevyParseError("Empty file");
  const header = (rows[0] ?? []).map(normHeader);
  const wHeader = header[mapping.weight] ?? "";
  const unit: ImportParse["unit"] = wHeader.includes("kg") ? "kg" : wHeader.includes("lb") ? "lb" : "unknown";
  const warnings: string[] = [];
  const byKey = new Map<string, ImportedWorkout>();
  let rowCount = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    const start = parseFlexibleDate(row[mapping.date] ?? "");
    if (!start) {
      warnings.push(`row ${r + 1}: Unrecognised or invalid date: "${row[mapping.date] ?? ""}"; skipped`);
      continue;
    }
    const exTitle = (row[mapping.exercise] ?? "").trim();
    if (!exTitle) {
      warnings.push(`row ${r + 1}: no exercise name; skipped`);
      continue;
    }
    const title = mapping.workout !== undefined ? (row[mapping.workout] ?? "").trim() || `Workout ${start.slice(0, 10)}` : `Workout ${start.slice(0, 10)}`;
    rowCount++;
    const key = workoutKey(source, title, start);
    let w = byKey.get(key);
    if (!w) {
      w = { source, title, startTime: start, endTime: null, key, exercises: [] };
      byKey.set(key, w);
    }
    let ex = w.exercises.find((e) => e.title === exTitle);
    if (!ex) {
      ex = { title: exTitle, sets: [], skippedRows: 0 };
      w.exercises.push(ex);
    }
    const kindRaw = extra.kind !== undefined && extra.kind >= 0 ? (row[extra.kind] ?? "").trim() : mapping.set !== undefined ? (row[mapping.set] ?? "").trim() : "";
    const warmup = /^w(armup)?$/i.test(kindRaw);
    const reps = num(row[mapping.reps]);
    if (reps === null || reps < 1) {
      ex.skippedRows++;
      const secs = extra.time !== undefined && extra.time >= 0 ? parseDurationSeconds(row[extra.time] ?? "") : null;
      if (secs !== null && secs > 0) {
        const t: ImportedTimedSet = { load: num(row[mapping.weight]) ?? 0, durationS: Math.round(secs), distanceM: null };
        if (warmup) t.warmup = true;
        (ex.timed ??= []).push(t);
      }
      continue;
    }
    const set: LoggedSet = { load: num(row[mapping.weight]) ?? 0, reps };
    if (warmup) set.warmup = true;
    ex.sets.push(set);
  }
  const workouts = [...byKey.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
  return { source, unit, workouts, warnings, rowCount };
}

// ---- Hevy ---------------------------------------------------------------------------------------------------
function parseHevy(text: string): ImportParse {
  // Hevy names the weight column after the unit set in the app: weight_kg or weight_lbs.
  const inLbs = headerOf(text, ",").some((h) => h.toLowerCase() === "weight_lbs");
  const normalized = inLbs ? text.replace(/weight_lbs/i, "weight_kg").replace(/distance_miles/i, "distance_km") : text;
  const metresPerDistanceUnit = inLbs ? 1609.344 : 1000; // distance_km, or distance_miles in a pounds file
  const r = parseHevyCsv(normalized);
  const workouts: ImportedWorkout[] = r.workouts.map((w) => ({
    source: "hevy",
    title: w.title,
    startTime: w.startTime,
    endTime: w.endTime && w.endTime !== w.startTime ? w.endTime : null,
    key: workoutKey("hevy", w.title, w.startTime),
    exercises: w.exercises.map((e) => {
      const sets: LoggedSet[] = [];
      const timed: ImportedTimedSet[] = [];
      let skipped = 0;
      for (const s of e.sets) {
        if (s.reps === null || s.reps < 1) {
          skipped++;
          const durationS = s.durationSeconds !== null && s.durationSeconds > 0 ? Math.round(s.durationSeconds) : null;
          const distanceM = s.distanceKm !== null && s.distanceKm > 0 ? Math.round(s.distanceKm * metresPerDistanceUnit * 10) / 10 : null;
          if (durationS !== null || distanceM !== null) {
            const t: ImportedTimedSet = { load: s.weightKg ?? 0, durationS, distanceM };
            if (s.type === "warmup") t.warmup = true;
            else if (s.type === "dropset") t.tags = ["drop"];
            else if (s.type === "failure") t.tags = ["failure"];
            timed.push(t);
          }
          continue;
        }
        const set: LoggedSet = { load: s.weightKg ?? 0, reps: s.reps };
        if (s.type === "dropset") set.tags = ["drop"];
        else if (s.type === "failure") set.tags = ["failure"];
        else if (s.type === "warmup") set.warmup = true;
        if (s.rpe !== null) set.rir = Math.max(0, 10 - s.rpe);
        sets.push(set);
      }
      return timed.length > 0 ? { title: e.title, sets, timed, skippedRows: skipped } : { title: e.title, sets, skippedRows: skipped };
    }),
  }));
  return { source: "hevy", unit: inLbs ? "lb" : "kg", workouts, warnings: r.warnings, rowCount: r.rowCount };
}

// ---- Strong -------------------------------------------------------------------------------------------------
/** "2026-09-29 15:15:00", "2026-09-29 15:15" or "2026-09-29T15:15:00" -> "2026-09-29T15:15:00" (local wall clock). */
export function parseStrongDate(s: string): string {
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/.exec(s);
  if (!m) throw new HevyParseError(`Unrecognised date: "${s}"`);
  if (!validCalendarFields(+m[1]!, +m[2]!, +m[3]!, +m[4]!, +m[5]!, +(m[6] ?? "00"))) throw new HevyParseError(`Invalid calendar date: "${s}"`);
  const p = (n: string) => n.padStart(2, "0");
  return `${m[1]}-${m[2]}-${m[3]}T${p(m[4]!)}:${m[5]}:${m[6] ?? "00"}`;
}

/** "2h 38m", "45m", "1h", "01:02:00", "1:02", "3720" (seconds) -> seconds, or null. */
export function parseDurationSeconds(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  let m = /^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/i.exec(t);
  if (m && (m[1] || m[2] || m[3])) return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  m = /^(\d+):(\d{2}):(\d{2})$/.exec(t);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  m = /^(\d+):(\d{2})$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  if (/^\d+$/.test(t)) return Number(t);
  return null;
}

/** Adds seconds to a local wall-clock ISO string (UTC arithmetic on the fields, so no time zone or DST is involved). */
export function addSeconds(local: string, seconds: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(local)!;
  const t = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!) + seconds * 1000;
  return new Date(t).toISOString().slice(0, 19);
}

const num = (s: string | undefined): number | null => {
  if (s === undefined || s.trim() === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function parseStrongCsv(text: string): ImportParse {
  return parseStrong(text);
}

function parseStrong(text: string): ImportParse {
  const delimiter = detectDelimiter(text);
  const rows = parseCsv(text, delimiter);
  if (rows.length === 0) throw new HevyParseError("Empty file");
  const header = rows[0]!.map((h) => h.trim());
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h.toLowerCase()));
  const iDate = col("date");
  const iName = col("workout name");
  const iDur = col("duration", "duration (sec)");
  const iEx = col("exercise name");
  const iSet = col("set order");
  const iW = col("weight", "weight (kg)", "weight (lb)", "weight (lbs)");
  const iReps = col("reps");
  const iRpe = col("rpe");
  const iSecs = col("seconds");
  const missing = [["Date", iDate], ["Workout Name", iName], ["Exercise Name", iEx], ["Set Order", iSet], ["Weight", iW], ["Reps", iReps]].filter(([, i]) => (i as number) < 0).map(([n]) => n);
  if (missing.length > 0) throw new HevyParseError(`Missing columns: ${missing.join(", ")}`);
  const wHeader = header[iW]!.toLowerCase();
  const unit: ImportParse["unit"] = wHeader.includes("kg") ? "kg" : wHeader.includes("lb") ? "lb" : "unknown";

  const warnings: string[] = [];
  const byKey = new Map<string, ImportedWorkout>();
  let rowCount = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    let start: string;
    try {
      start = parseStrongDate(row[iDate] ?? "");
    } catch (e) {
      warnings.push(`row ${r + 1}: ${(e as Error).message}; skipped`);
      continue;
    }
    const title = (row[iName] ?? "").trim();
    const exTitle = (row[iEx] ?? "").trim();
    if (!exTitle) {
      warnings.push(`row ${r + 1}: no exercise name; skipped`);
      continue;
    }
    rowCount++;
    const key = workoutKey("strong", title, start);
    let w = byKey.get(key);
    if (!w) {
      const dur = iDur >= 0 ? parseDurationSeconds(row[iDur] ?? "") : null;
      w = { source: "strong", title, startTime: start, endTime: dur !== null && dur > 0 ? addSeconds(start, dur) : null, key, exercises: [] };
      byKey.set(key, w);
    }
    let ex = w.exercises.find((e) => e.title === exTitle);
    if (!ex) {
      ex = { title: exTitle, sets: [], skippedRows: 0 };
      w.exercises.push(ex);
    }
    const order = (row[iSet] ?? "").trim();
    if (/^rest timer$/i.test(order)) {
      ex.skippedRows++;
      continue;
    }
    const kind = /^\d+$/.test(order) ? "normal" : /^w$/i.test(order) ? "warmup" : /^d$/i.test(order) ? "drop" : /^f$/i.test(order) ? "failure" : null;
    if (kind === null) {
      warnings.push(`row ${r + 1}: unknown set order "${order}"; skipped`);
      ex.skippedRows++;
      continue;
    }
    const reps = num(row[iReps]);
    if (reps === null || reps < 1) {
      ex.skippedRows++;
      const secs = iSecs >= 0 ? num(row[iSecs]) : null;
      if (secs !== null && secs > 0) {
        const t: ImportedTimedSet = { load: num(row[iW]) ?? 0, durationS: Math.round(secs), distanceM: null };
        if (kind === "warmup") t.warmup = true;
        else if (kind === "drop") t.tags = ["drop"];
        else if (kind === "failure") t.tags = ["failure"];
        (ex.timed ??= []).push(t);
      }
      continue;
    }
    const set: LoggedSet = { load: num(row[iW]) ?? 0, reps };
    if (kind === "warmup") set.warmup = true;
    else if (kind === "drop") set.tags = ["drop"];
    else if (kind === "failure") set.tags = ["failure"];
    const rpe = iRpe >= 0 ? num(row[iRpe]) : null;
    if (rpe !== null && rpe > 0) set.rir = Math.max(0, 10 - rpe);
    ex.sets.push(set);
  }
  const workouts = [...byKey.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
  return { source: "strong", unit, workouts, warnings, rowCount };
}

// ---- units --------------------------------------------------------------------------------------------------
/**
 * Weights in kilograms. A file in pounds is converted; an "unknown" unit needs the lifter's answer and throws without one,
 * so a pound file can never be stored as kilograms by accident.
 */
export function toKilograms(p: ImportParse, chosen?: WeightUnit): ImportParse {
  const unit = p.unit === "unknown" ? chosen : p.unit;
  if (unit === undefined) throw new HevyParseError("The weight unit of this file is not stated; say whether it is kg or lb");
  if (unit === "kg") return { ...p, unit: "kg" };
  return {
    ...p,
    unit: "kg",
    workouts: p.workouts.map((w) => ({ ...w, exercises: w.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, load: lbToKg(s.load) })), ...(e.timed ? { timed: e.timed.map((s) => ({ ...s, load: lbToKg(s.load) })) } : {}) })) })),
  };
}

// ---- classification ------------------------------------------------------------------------------------------
export interface TitleClass {
  /** Title without the "(Barbell)"-style suffix. */
  base: string;
  equipment: EquipmentType | null;
  setup: SetupType | null;
  /** The suffix text, if any. */
  suffix: string | null;
}

const SUFFIX_EQUIPMENT: Record<string, EquipmentType> = {
  barbell: "barbell",
  "ez bar": "barbell",
  "trap bar": "barbell",
  dumbbell: "dumbbell",
  cable: "cable",
  machine: "machine",
  "smith machine": "machine",
  "pec deck": "machine",
  "machine plates": "machine",
  "plate loaded": "machine",
  kettlebell: "dumbbell",
  band: "cable",
  "resistance band": "cable",
  plate: "plate",
};

/**
 * Equipment and setup ONLY from what the title says. "Bench Press (Barbell)" is a barbell; "Pull Up" says nothing, so both
 * are null and the lifter chooses. Smith and machine presses are never classed as barbell: they keep a separate line.
 */
export function classifyTitle(title: string): TitleClass {
  const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(title.trim());
  const base = (m ? m[1]! : title).trim();
  const suffix = m ? m[2]!.trim() : null;
  const k = suffix?.toLowerCase() ?? "";
  if (/assisted/.test(k) || /^assisted\b/i.test(base)) return { base, equipment: "assisted", setup: "assisted", suffix };
  if (k === "weighted" || /^weighted\b/i.test(base)) return { base, equipment: "plate", setup: "bodyweight_plus_added", suffix };
  if (k === "bodyweight") return { base, equipment: "plate", setup: "bodyweight_plus_added", suffix };
  const eq = SUFFIX_EQUIPMENT[k] ?? null;
  return { base, equipment: eq, setup: eq ? "free" : null, suffix };
}

const EQUIPMENT_WORDS = new Set(["barbell", "dumbbell", "cable", "machine", "smith"]);

/** Comparable form of a name: lower-case words without punctuation, equipment words and plural s, sorted. */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !EQUIPMENT_WORDS.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w))
    .sort()
    .join(" ");
}

export interface LibraryEntry {
  id: string;
  nameEn: string;
  equipment: EquipmentType;
  setup: SetupType;
}

/**
 * An exact match only: same words (any order) and, when the title states equipment, the same equipment. Anything less is
 * "no match": the lifter picks, so two movements are never merged on a hunch.
 */
export function matchLibrary(title: string, library: LibraryEntry[]): LibraryEntry | null {
  const c = classifyTitle(title);
  const key = nameKey(c.base);
  if (!key) return null;
  // The exact same name (ignoring case and spacing) wins when it is unique: "Squat (Smith Machine)" is never confused with "Squat (Machine)".
  const same = (a: string) => a.trim().toLowerCase().replace(/\s+/g, " ");
  const exact = library.filter((l) => same(l.nameEn) === same(title));
  if (exact.length === 1) return exact[0]!;
  // Equipment the title states, in brackets ("(Cable)") or as a word ("Dumbbell Row", "lateral raises machine"); one kind only, else it says nothing.
  const stated = c.equipment ?? wordEquipment(title);
  const smith = isSmith(title);
  let pool = library.filter((l) => {
    if (nameKey(classifyTitle(l.nameEn).base) !== key) return false;
    if (isSmith(l.nameEn) !== smith) return false; // a Smith machine lift keeps its own line
    // The library name may carry the equipment as a word ("Barbell Bench Press"): compare with the stated equipment.
    return stated === null ? true : l.equipment === stated && (c.equipment === null || c.setup === null || l.setup === c.setup);
  });
  if (pool.length <= 1) return pool[0] ?? null;
  const info = (l: LibraryEntry) => classifyTitle(l.nameEn);
  // Several library rows are the same movement in different variants: prefer the one whose bracket text is the title's own ("(Trap Bar)")...
  if (c.suffix) {
    const sfx = c.suffix.toLowerCase();
    const sameSuffix = pool.filter((l) => info(l).suffix?.toLowerCase() === sfx);
    if (sameSuffix.length === 1) return sameSuffix[0]!;
    if (sameSuffix.length > 1) pool = sameSuffix;
  }
  // ...a plain title ("Pull Up") that states no equipment means the plain lift, not its "(Assisted)" or "(Machine)" sibling...
  if (stated === null) {
    const plain = pool.filter((l) => info(l).equipment === null && info(l).setup === null);
    if (plain.length === 1) return plain[0]!;
    if (plain.length > 1) pool = plain;
  }
  // ...and the row without any bracket variant is the standard one ("Triceps Pushdown" vs "Triceps Pushdown (V Bar)").
  const bare = pool.filter((l) => info(l).suffix === null);
  return bare.length === 1 ? bare[0]! : null;
}

const isSmith = (name: string): boolean => /\bsmith\b/i.test(name);

/** Equipment named as a word in the title, when exactly one kind appears. */
function wordEquipment(title: string): EquipmentType | null {
  const found = new Set<EquipmentType>();
  const t = title.toLowerCase();
  if (/\bbarbell\b/.test(t)) found.add("barbell");
  if (/\bdumbbells?\b/.test(t)) found.add("dumbbell");
  if (/\bcables?\b/.test(t)) found.add("cable");
  if (/\bmachine\b|\bsmith\b/.test(t)) found.add("machine");
  return found.size === 1 ? [...found][0]! : null;
}

const PATTERN_RULES: [RegExp, string][] = [
  [/wrist|forearm|grip|farmer|hang|carry|walk/, "other"],
  [/leg curl|hamstring curl/, "knee_flexion"],
  [/leg extension|quad extension/, "knee_extension"],
  [/calf|calve/, "calf"],
  [/deadlift|rdl|hip thrust|good morning|back extension|hyperextension|glute bridge/, "hinge"],
  [/squat|leg press|lunge|hack|step.?up/, "squat"],
  [/lateral raise|side raise|front raise|upright row/, "shoulder_isolation"],
  [/face pull|rear delt|reverse fly|reverse pec|rear fly/, "rear_delt"],
  [/overhead press|shoulder press|military press|arnold|push press/, "vertical_push"],
  [/incline.*(press|fly|flye)|(press|fly|flye).*incline/, "incline_push"],
  [/bench|chest press|chest fly|pec deck|butterfly|push.?up|dip|cable crossover|flight/, "horizontal_push"],
  [/tricep|skull|pushdown|push down|kickback|close grip/, "elbow_extension"],
  [/pull.?up|chin.?up|pulldown|pull down|lat /, "vertical_pull"],
  [/row|shrug/, "horizontal_pull"],
  [/curl|preacher|concentration/, "elbow_flexion"],
];

/** A SUGGESTED movement pattern from the name (used only for exposure counts). "other" when no rule applies; the lifter can change it. */
export function guessPattern(title: string): string {
  const t = classifyTitle(title).base.toLowerCase();
  for (const [re, p] of PATTERN_RULES) if (re.test(t)) return p;
  return "other";
}
