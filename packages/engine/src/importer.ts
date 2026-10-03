import { HevyParseError, parseCsv, parseHevyCsv } from "./hevy";
export { HevyParseError as ImportParseError } from "./hevy";
import type { EquipmentType, LoggedSet, SetupType } from "./types";

/**
 * Hevy and Strong CSV import, source-neutral. Pure functions, no I/O. Everything is read exactly as written in the file:
 * a unit that the file does not state is reported as "unknown" and the lifter must say it; nothing is guessed.
 */
export type ImportSource = "hevy" | "strong";
export type WeightUnit = "kg" | "lb";

export interface ImportedExercise {
  /** The title exactly as exported. */
  title: string;
  sets: LoggedSet[];
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

/** Which app exported this file, from its header. Null when it looks like neither. */
export function detectSource(text: string): ImportSource | null {
  const h = headerOf(text, detectDelimiter(text)).map((x) => x.toLowerCase());
  if (h.includes("exercise_title") && h.includes("start_time")) return "hevy";
  if (h.includes("exercise name") && h.includes("workout name") && h.includes("set order")) return "strong";
  return null;
}

export function parseImport(text: string): ImportParse {
  const source = detectSource(text);
  if (source === "hevy") return parseHevy(text);
  if (source === "strong") return parseStrong(text);
  throw new HevyParseError("This does not look like a Hevy or Strong export");
}

// ---- Hevy ---------------------------------------------------------------------------------------------------
function parseHevy(text: string): ImportParse {
  // Hevy names the weight column after the unit set in the app: weight_kg or weight_lbs.
  const inLbs = headerOf(text, ",").some((h) => h.toLowerCase() === "weight_lbs");
  const normalized = inLbs ? text.replace(/weight_lbs/i, "weight_kg").replace(/distance_miles/i, "distance_km") : text;
  const r = parseHevyCsv(normalized);
  const workouts: ImportedWorkout[] = r.workouts.map((w) => ({
    source: "hevy",
    title: w.title,
    startTime: w.startTime,
    endTime: w.endTime && w.endTime !== w.startTime ? w.endTime : null,
    key: workoutKey("hevy", w.title, w.startTime),
    exercises: w.exercises.map((e) => {
      const sets: LoggedSet[] = [];
      let skipped = 0;
      for (const s of e.sets) {
        if (s.reps === null || s.reps < 1) {
          skipped++;
          continue;
        }
        const set: LoggedSet = { load: s.weightKg ?? 0, reps: s.reps };
        if (s.type === "dropset") set.tags = ["drop"];
        else if (s.type === "failure") set.tags = ["failure"];
        else if (s.type === "warmup") set.warmup = true;
        if (s.rpe !== null) set.rir = Math.max(0, 10 - s.rpe);
        sets.push(set);
      }
      return { title: e.title, sets, skippedRows: skipped };
    }),
  }));
  return { source: "hevy", unit: inLbs ? "lb" : "kg", workouts, warnings: r.warnings, rowCount: r.rowCount };
}

// ---- Strong -------------------------------------------------------------------------------------------------
/** "2026-09-29 15:15:00", "2026-09-29 15:15" or "2026-09-29T15:15:00" -> "2026-09-29T15:15:00" (local wall clock). */
export function parseStrongDate(s: string): string {
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/.exec(s);
  if (!m) throw new HevyParseError(`Unrecognised date: "${s}"`);
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
    workouts: p.workouts.map((w) => ({ ...w, exercises: w.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, load: lbToKg(s.load) })) })) })),
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
