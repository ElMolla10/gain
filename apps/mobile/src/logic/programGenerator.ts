import type { EquipmentType } from "@gain/engine";
import { CATALOG, CATALOG_BY_KEY } from "../db/libraryDraft";
import { GROUP_OF_MUSCLE, type LibraryGroup } from "../db/library/types";
import { estimateSessionMinutes, instantiateTemplate, TEMPLATES, type Instantiated, type LibraryLookup, type Template } from "./templates";
import { filterTemplates } from "./templateFilter";
import type { TemplateGear, TemplateGoal, TemplateLevel } from "./templateTypes";
import { addExercise, MAX_SETS, newExercise, type DraftExercise, type ProgrammeDraft } from "./programmeDraft";
import { rankOf, scaleSets, type MusclePriorities, type MuscleRank } from "./musclePriority";

export type GeneratorGoal = "strength" | "hypertrophy" | "general";
export type GeneratorExperience = "beginner" | "intermediate";

export interface GenerateInput {
  goal: GeneratorGoal;
  experience: GeneratorExperience;
  daysPerWeek: number;
  sessionMinutes: number;
  equipment: EquipmentType[];
  priorities: MusclePriorities;
  /** Names or keys to leave out (e.g. "RDLs", "hip thrusts"). */
  avoid: string[];
  lang: "en" | "ar";
}

export interface GeneratedProgramme {
  draft: ProgrammeDraft;
  template: Template;
  dropped: { day: string; key: string; reason: "equipment" | "time" | "avoid" }[];
}

export function gearFromEquipment(eq: readonly EquipmentType[]): TemplateGear {
  if (eq.includes("barbell") || eq.includes("machine") || eq.includes("cable")) return "gym";
  if (eq.includes("dumbbell")) return "dumbbell";
  return "bodyweight";
}

const AVOID_ALIASES: Record<string, string[]> = {
  rdl: ["rdl", "romanian"],
  romanian: ["rdl", "romanian"],
  "hip thrust": ["hip thrust", "hip_thrust"],
  hipthrust: ["hip thrust", "hip_thrust"],
};

function normalizePhrase(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .replace(/\bs\b/g, "")
    .replace(/s\b/g, "")
    .trim();
}

export function avoidPhrases(avoid: readonly string[]): string[] {
  return avoid.map(normalizePhrase).filter((p) => p.length >= 3);
}

export function matchesAvoid(ex: { key: string; nameEn: string }, phrases: readonly string[]): boolean {
  if (phrases.length === 0) return false;
  const hay = `${ex.key.replace(/_/g, " ")} ${ex.nameEn}`.toLowerCase();
  for (const p of phrases) {
    const aliases = AVOID_ALIASES[p] ?? AVOID_ALIASES[p.replace(/ /g, "")] ?? [p];
    if (aliases.some((a) => hay.includes(a))) return true;
  }
  return false;
}

/**
 * Prefer an exact days/goal/level/gear match. 4-day hypertrophy at a gym lands on Push/Pull/Legs/Upper when it is in the pool.
 */
export function pickGeneratorTemplate(input: GenerateInput, pool: readonly Template[] = TEMPLATES): Template | null {
  const gear = gearFromEquipment(input.equipment);
  const goal: TemplateGoal = input.goal;
  const level: TemplateLevel = input.experience;
  const venue = gear === "gym" ? "gym" : "home";
  const exact = filterTemplates(pool, { days: input.daysPerWeek, venue, gear, goal, level });
  const list =
    exact.length > 0
      ? exact
      : filterTemplates(pool, { days: input.daysPerWeek, venue, gear, goal: null, level: null });
  const from = list.length > 0 ? list : pool.filter((t) => t.days === input.daysPerWeek);
  if (from.length === 0) {
    const fewer = pool.filter((t) => t.days < input.daysPerWeek && t.days > 0).sort((a, b) => b.days - a.days);
    return fewer[0] ?? null;
  }
  const ppl = from.find((t) => t.id === "ppl_upper_4");
  if (ppl) return ppl;
  return from[0] ?? null;
}

function reverseKeys(byKey: LibraryLookup["byKey"]): Map<string, string> {
  const m = new Map<string, string>();
  for (const [key, v] of byKey) m.set(v.exerciseId, key);
  return m;
}

function groupOfKey(key: string): LibraryGroup | null {
  const c = CATALOG_BY_KEY.get(key);
  return c ? GROUP_OF_MUSCLE[c.muscle] : null;
}

function groupOfId(id: string, idToKey: Map<string, string>): LibraryGroup | null {
  const key = idToKey.get(id);
  return key ? groupOfKey(key) : null;
}

export function weeklySetsByGroup(draft: ProgrammeDraft, idToKey: Map<string, string>): Map<string, number> {
  const m = new Map<string, number>();
  for (const day of draft.days) {
    for (const e of day.exercises) {
      const g = groupOfId(e.exerciseId, idToKey);
      if (!g) continue;
      m.set(g, (m.get(g) ?? 0) + e.sets);
    }
  }
  return m;
}

function trimDay(exercises: DraftExercise[], minutes: number, protect: Set<string>, drop: (key: string) => void, idToKey: Map<string, string>): DraftExercise[] {
  let list = exercises;
  const total = () => estimateSessionMinutes(list.reduce((n, e) => n + e.sets, 0));
  while (total() > minutes && list.length > 1) {
    let idx = -1;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i]!;
      if (e.isGoalLift || protect.has(e.exerciseId)) continue;
      idx = i;
      break;
    }
    if (idx < 0) break;
    const key = idToKey.get(list[idx]!.exerciseId);
    if (key) drop(key);
    list = list.filter((_, i) => i !== idx);
  }
  return list;
}

function applyAvoid(draft: ProgrammeDraft, phrases: string[], idToKey: Map<string, string>, dropped: GeneratedProgramme["dropped"]): ProgrammeDraft {
  if (phrases.length === 0) return draft;
  return {
    ...draft,
    days: draft.days
      .map((day) => {
        const exercises = day.exercises.filter((e) => {
          const key = idToKey.get(e.exerciseId);
          const cat = key ? CATALOG_BY_KEY.get(key) : undefined;
          const hit = cat ? matchesAvoid({ key: cat.key, nameEn: cat.en }, phrases) : key ? matchesAvoid({ key, nameEn: key }, phrases) : false;
          if (hit) dropped.push({ day: day.name, key: key ?? e.exerciseId, reason: "avoid" });
          return !hit;
        });
        return { ...day, exercises };
      })
      .filter((day) => day.exercises.length > 0),
  };
}

function applySetRanks(draft: ProgrammeDraft, priorities: MusclePriorities, idToKey: Map<string, string>): ProgrammeDraft {
  return {
    ...draft,
    days: draft.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((e) => {
        const g = groupOfId(e.exerciseId, idToKey);
        const rank: MuscleRank = g ? rankOf(priorities, g) : "normal";
        if (rank === "normal") return e;
        return { ...e, sets: scaleSets(e.sets, rank, MAX_SETS) };
      }),
    })),
  };
}

function dayScoreForGroup(dayName: string, already: boolean): number {
  const n = dayName.toLowerCase();
  if (already) return 0;
  if (/pull|upper|arm|push/.test(n)) return 1;
  return 2;
}

function extraForGroup(
  group: LibraryGroup,
  equipment: readonly EquipmentType[],
  phrases: readonly string[],
  usedKeys: Set<string>,
  byKey: LibraryLookup["byKey"],
): { exerciseId: string; key: string } | null {
  const eq = new Set(equipment);
  for (const c of CATALOG) {
    if (GROUP_OF_MUSCLE[c.muscle] !== group) continue;
    if (usedKeys.has(c.key)) continue;
    if (!eq.has(c.equipment)) continue;
    if (matchesAvoid({ key: c.key, nameEn: c.en }, phrases)) continue;
    const meta = byKey.get(c.key);
    if (!meta) continue;
    return { exerciseId: meta.exerciseId, key: c.key };
  }
  return null;
}

function keysInDraft(draft: ProgrammeDraft, idToKey: Map<string, string>): Set<string> {
  const used = new Set<string>();
  for (const day of draft.days) for (const e of day.exercises) {
    const k = idToKey.get(e.exerciseId);
    if (k) used.add(k);
  }
  return used;
}

function applyPrioritySlots(
  draft: ProgrammeDraft,
  input: GenerateInput,
  idToKey: Map<string, string>,
  byKey: LibraryLookup["byKey"],
  protect: Set<string>,
): ProgrammeDraft {
  let next = draft;
  const used = keysInDraft(next, idToKey);
  for (const [group, rank] of Object.entries(input.priorities) as [LibraryGroup, MuscleRank][]) {
    if (rank !== "priority") continue;
    const have = weeklySetsByGroup(next, reverseKeys(byKey)).get(group) ?? 0;
    if (have >= 8) continue;
    const extra = extraForGroup(group, input.equipment, avoidPhrases(input.avoid), used, byKey);
    if (!extra) continue;
    const days = next.days.map((d, i) => ({ i, already: d.exercises.some((e) => groupOfId(e.exerciseId, reverseKeys(byKey)) === group), name: d.name }));
    days.sort((a, b) => dayScoreForGroup(a.name, a.already) - dayScoreForGroup(b.name, b.already));
    const target = days[0];
    if (!target) continue;
    const idToKeyNow = reverseKeys(byKey);
    const slot: DraftExercise = newExercise(extra.exerciseId, { sets: 3, repMin: 8, repMax: 12 });
    next = addExercise(next, target.i, slot);
    used.add(extra.key);
    protect.add(extra.exerciseId);
    idToKeyNow.set(extra.exerciseId, extra.key);
  }
  return next;
}

function applyTimeCap(draft: ProgrammeDraft, minutes: number, protect: Set<string>, idToKey: Map<string, string>, dropped: GeneratedProgramme["dropped"]): ProgrammeDraft {
  if (!(minutes > 0)) return draft;
  return {
    ...draft,
    days: draft.days.map((day) => ({
      ...day,
      exercises: trimDay(day.exercises, minutes, protect, (key) => dropped.push({ day: day.name, key, reason: "time" }), idToKey),
    })).filter((day) => day.exercises.length > 0),
  };
}

/**
 * Pick a catalogue template, instantiate it, then apply avoid-list and muscle-priority edits.
 * The result is an ordinary ProgrammeDraft the editor already knows how to save.
 */
export function generateProgramme(input: GenerateInput, lib: LibraryLookup, ceilingFor: (key: string) => number): GeneratedProgramme | null {
  const template = pickGeneratorTemplate(input);
  if (!template) return null;
  const inst: Instantiated = instantiateTemplate(template, lib, {
    lang: input.lang,
    equipment: input.equipment,
    sessionMinutes: input.sessionMinutes,
    ceilingFor,
  });
  const dropped: GeneratedProgramme["dropped"] = inst.dropped.map((d) => ({ ...d }));
  const phrases = avoidPhrases(input.avoid);
  let draft = applyAvoid(inst.draft, phrases, reverseKeys(lib.byKey), dropped);
  const protect = new Set<string>();
  draft = applySetRanks(draft, input.priorities, reverseKeys(lib.byKey));
  draft = applyPrioritySlots(draft, input, reverseKeys(lib.byKey), lib.byKey, protect);
  draft = applyTimeCap(draft, input.sessionMinutes, protect, reverseKeys(lib.byKey), dropped);
  return { draft, template, dropped };
}
