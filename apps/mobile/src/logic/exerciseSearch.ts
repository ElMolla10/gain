import { CATALOG_BY_KEY } from "../db/libraryDraft";
import { GEARS, GROUP_OF_MUSCLE, MUSCLE_GROUPS, type Gear, type LibraryGroup } from "../db/library";
import type { LibraryExercise } from "../db/programmeRepo";
import { normalizeSearch } from "../i18n/format";
import { groupOfPattern } from "./exposure";

/**
 * Picker search over the shipped library (600+ rows) and the lifter's own exercises.
 * The searchable text of every row is built ONCE per list (buildSearchIndex), so a keystroke is a filter over plain strings.
 * Every word typed must be found somewhere in the English name, Arabic name or Arabic aliases (letters unified: ة/ه, أ/ا, ى/ي).
 */
export interface SearchRow {
  ex: LibraryExercise;
  /** English name, Arabic name and aliases, normalised, joined. */
  hay: string;
  /** Normalised names that count as "starts with" for ranking. */
  heads: string[];
  group: LibraryGroup | null;
  gear: Gear;
  muscle: string | null;
}

export { GEARS, MUSCLE_GROUPS };
export type { Gear, LibraryGroup };

/** English words with punctuation as spaces, so "pull-up" is found by "pull up" and "(cable)" by "cable". */
const plain = (s: string): string => normalizeSearch(s).replace(/[-_/().,+]+/g, " ").replace(/\s+/g, " ").trim();

const GROUP_OF_EXPOSURE: Record<string, LibraryGroup | null> = {
  chest: "chest", back: "back", shoulders: "shoulders", biceps: "biceps", triceps: "triceps", quads: "quads", hamstrings: "hamstrings", calves: "calves", other: null,
};

/** Muscle group and gear of a row: from the shipped catalogue by seed_key; for the lifter's own exercise from its pattern and equipment (no guess beyond that). */
export function metaOf(ex: Pick<LibraryExercise, "seedKey" | "pattern" | "equipment">): { group: LibraryGroup | null; gear: Gear; muscle: string | null } {
  const c = ex.seedKey ? CATALOG_BY_KEY.get(ex.seedKey) : undefined;
  if (c) return { group: GROUP_OF_MUSCLE[c.muscle], gear: c.gear, muscle: c.muscle };
  return { group: GROUP_OF_EXPOSURE[groupOfPattern(ex.pattern)] ?? null, gear: ex.equipment === "plate" ? "bodyweight" : ex.equipment, muscle: null };
}

export function buildSearchIndex(list: LibraryExercise[]): SearchRow[] {
  return list.map((ex) => {
    const names = [ex.nameEn, ex.nameAr, ...ex.aliasesAr];
    const heads = names.map(plain);
    return { ex, hay: heads.join(" | "), heads, ...metaOf(ex) };
  });
}

export interface SearchOptions {
  query: string;
  group?: LibraryGroup | null;
  gear?: Gear | null;
  /** Exercise ids to leave out (already in the day). */
  exclude?: readonly string[];
}

/** Matching rows, best first: name starts with the query, then a word starts with it, then anywhere. Same rank keeps the list's (alphabetical) order. */
export function searchExercises(index: SearchRow[], o: SearchOptions): LibraryExercise[] {
  const q = plain(o.query);
  const words = q === "" ? [] : q.split(" ");
  const skip = o.exclude && o.exclude.length > 0 ? new Set(o.exclude) : null;
  const hits: { ex: LibraryExercise; rank: number; i: number }[] = [];
  for (let i = 0; i < index.length; i++) {
    const r = index[i]!;
    if (skip?.has(r.ex.id)) continue;
    if (o.group && r.group !== o.group) continue;
    if (o.gear && r.gear !== o.gear) continue;
    let rank = 0;
    if (words.length > 0) {
      let ok = true;
      for (const w of words) {
        if (!r.hay.includes(w)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      rank = r.heads.some((h) => h.startsWith(q)) ? 0 : r.hay.includes(` ${q}`) || r.heads.some((h) => h.includes(` ${q}`)) ? 1 : 2;
    }
    hits.push({ ex: r.ex, rank, i });
  }
  if (words.length > 0) hits.sort((a, b) => a.rank - b.rank || a.i - b.i);
  return hits.map((h) => h.ex);
}

/** How many rows the picker draws at once; the rest sit behind "Show more". */
export const PICKER_PAGE = 50;
