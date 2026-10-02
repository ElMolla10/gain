import type { EquipmentType, ImportParse, SetupType } from "@gain/engine";
import type { MappingChoice, TitlePreview } from "../db/importRepo";

/** What the lifter changed for one exported title, on top of the app's suggestion. */
export interface Override {
  /** Use this existing library exercise instead of the suggestion. */
  exerciseId?: string;
  /** Create a new exercise even when a library match was suggested. */
  createNew?: boolean;
  equipment?: EquipmentType;
  setup?: SetupType;
  pattern?: string;
  nameEn?: string;
}

export type Missing = "equipment" | "setup";

export interface Resolved {
  choice: MappingChoice | null;
  /** What the lifter still has to say; empty when `choice` is set. */
  missing: Missing[];
  /** How the choice came about, for the screen: a saved mapping, an exact library match, the lifter's pick, or a new exercise. */
  origin: "saved" | "library" | "picked" | "new";
}

/**
 * The decision for one title. Equipment and setup are only ever taken from the title or the lifter; when neither says,
 * the title stays unresolved ("Pull Up" could be assisted, weighted or plain). Assisted equipment implies the assisted setup.
 */
export function resolveTitle(t: TitlePreview, o: Override | undefined): Resolved {
  const s = t.suggestion;
  if (o?.exerciseId) return { choice: { kind: "existing", exerciseId: o.exerciseId }, missing: [], origin: "picked" };
  if ((s.kind === "saved" || s.kind === "library") && !o?.createNew) {
    return { choice: { kind: "existing", exerciseId: s.exerciseId }, missing: [], origin: s.kind };
  }
  const base = s.kind === "new" ? s : { nameEn: t.title.trim(), pattern: "other", equipment: null, setup: null };
  const equipment = o?.equipment ?? base.equipment;
  let setup = o?.setup ?? (o?.equipment && o.equipment !== base.equipment ? null : base.setup);
  if (setup === null && equipment) setup = equipment === "assisted" ? "assisted" : equipment === "plate" ? null : "free";
  const missing: Missing[] = [];
  if (!equipment) missing.push("equipment");
  else if (!setup) missing.push("setup");
  const nameEn = (o?.nameEn ?? base.nameEn).trim();
  if (!equipment || !setup || nameEn === "") return { choice: null, missing, origin: "new" };
  return { choice: { kind: "new", nameEn, pattern: o?.pattern ?? base.pattern, equipment, setup }, missing, origin: "new" };
}

export function resolveAll(titles: TitlePreview[], overrides: Record<string, Override>) {
  const out = titles.map((t) => ({ title: t, ...resolveTitle(t, overrides[t.title]) }));
  const mappings: Record<string, MappingChoice> = {};
  for (const r of out) if (r.choice) mappings[r.title.title] = r.choice;
  return { rows: out, mappings, unresolved: out.filter((r) => r.choice === null).length, ready: out.length > 0 && out.every((r) => r.choice !== null) };
}

/** Sets the equipment of every title that still lacks one. Titles that already state or got an equipment are left alone. */
export function applyEquipmentToUnresolved(titles: TitlePreview[], overrides: Record<string, Override>, equipment: EquipmentType): Record<string, Override> {
  const next = { ...overrides };
  for (const t of titles) {
    const r = resolveTitle(t, overrides[t.title]);
    if (r.choice === null && r.missing.includes("equipment")) next[t.title] = { ...next[t.title], equipment, setup: undefined };
  }
  return next;
}

/** "3 Jan 2026" style range without locale surprises: ISO dates as given. */
export const dateRange = (a: string | null, b: string | null): string => (a && b ? (a === b ? a : `${a} – ${b}`) : "");

/** The heaviest set (kg) in an already-converted import, or null when there is none. */
export function heaviestLoad(parse: ImportParse | null): number | null {
  if (!parse) return null;
  let best: number | null = null;
  for (const w of parse.workouts) for (const e of w.exercises) for (const s of e.sets) if (best === null || s.load > best) best = s.load;
  return best;
}
