import type { EquipmentType, SetupType } from "@gain/engine";
import { guessPattern } from "@gain/engine";
import type { LibraryExercise } from "../db/programmeRepo";
import { newExercise, type ProgrammeDraft } from "./programmeDraft";

export const PROGRAMME_SHARE_KIND = "gain.programme";
export const PROGRAMME_SHARE_VERSION = 1 as const;

export interface SharedExercise {
  name: string;
  equipment: EquipmentType;
  setup: SetupType;
  pattern: string;
  sets: number;
  repMin: number;
  repMax: number;
  isGoalLift?: boolean;
  trackEffort?: boolean;
  topSets?: number | null;
}

export interface ProgrammeSharePayload {
  v: typeof PROGRAMME_SHARE_VERSION;
  kind: typeof PROGRAMME_SHARE_KIND;
  name: string;
  days: { name: string; exercises: SharedExercise[] }[];
}

export class ProgrammeShareError extends Error {}

export function exportProgrammeShare(draft: ProgrammeDraft, library: Map<string, Pick<LibraryExercise, "nameEn" | "equipment" | "setup" | "pattern">>): ProgrammeSharePayload {
  return {
    v: PROGRAMME_SHARE_VERSION,
    kind: PROGRAMME_SHARE_KIND,
    name: draft.name.trim() || "Program",
    days: draft.days.map((d) => ({
      name: d.name,
      exercises: d.exercises.map((e) => {
        const lib = library.get(e.exerciseId);
        return {
          name: lib?.nameEn ?? e.exerciseId,
          equipment: lib?.equipment ?? "barbell",
          setup: lib?.setup ?? "free",
          pattern: lib?.pattern ?? "other",
          sets: e.sets,
          repMin: e.repMin,
          repMax: e.repMax,
          isGoalLift: e.isGoalLift || undefined,
          trackEffort: e.trackEffort || undefined,
          topSets: e.topSets ?? undefined,
        };
      }),
    })),
  };
}

export function parseProgrammeShare(text: string): ProgrammeSharePayload {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new ProgrammeShareError("This is not a GAIN program file");
  }
  const o = raw as Partial<ProgrammeSharePayload>;
  if (o.kind !== PROGRAMME_SHARE_KIND || o.v !== PROGRAMME_SHARE_VERSION || typeof o.name !== "string" || !Array.isArray(o.days)) {
    throw new ProgrammeShareError("This is not a GAIN program file");
  }
  return o as ProgrammeSharePayload;
}

export function programmeShareSummary(p: ProgrammeSharePayload): { days: number; exercises: number; lines: string[] } {
  const lines: string[] = [p.name];
  let exercises = 0;
  for (const d of p.days) {
    lines.push(d.name);
    for (const e of d.exercises) {
      exercises++;
      lines.push(`  ${e.name} — ${e.sets} × ${e.repMin}–${e.repMax}`);
    }
  }
  return { days: p.days.length, exercises, lines };
}

export function formatProgrammeShareText(p: ProgrammeSharePayload): string {
  return programmeShareSummary(p).lines.join("\n");
}

/** A new draft: exercise ids are names until the caller creates/matches library rows. */
export function draftFromShare(p: ProgrammeSharePayload): ProgrammeDraft {
  return {
    name: p.name.trim() || "Program",
    days: p.days.map((d) => ({
      name: d.name,
      exercises: d.exercises.map((e) =>
        newExercise(e.name, {
          sets: e.sets,
          repMin: e.repMin,
          repMax: e.repMax,
          isGoalLift: !!e.isGoalLift,
          trackEffort: !!e.trackEffort,
          topSets: e.topSets ?? null,
        }),
      ),
    })),
  };
}

export function shareExerciseMeta(e: SharedExercise): { nameEn: string; equipment: EquipmentType; setup: SetupType; pattern: string } {
  return { nameEn: e.name, equipment: e.equipment, setup: e.setup, pattern: e.pattern || guessPattern(e.name) };
}
