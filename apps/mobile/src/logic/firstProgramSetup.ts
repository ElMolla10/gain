import type { EquipmentType } from "@gain/engine";
import type { AppServices } from "../AppContext";
import type { LibraryExercise } from "../db/programmeRepo";
import { ceilingForName } from "./ceilings";
import { defaultGymLoads, defaultGymName } from "./defaultGym";
import { GYM_EQUIPMENT } from "./gymInput";
import { DAYS_OPTIONS, MINUTES_OPTIONS } from "./onboarding";
import { generateProgramme, type GeneratedProgramme, type GeneratorExperience, type GeneratorGoal } from "./programGenerator";
import type { Unit } from "./units";

export interface FirstAnswers {
  goal: GeneratorGoal | null;
  experience: GeneratorExperience | null;
  days: number | null;
  minutes: number | null;
  equipment: EquipmentType[];
  avoidText: string;
  skipLegs: boolean;
}
interface SavedSetup { version: 1; started: boolean; answers: FirstAnswers }
export interface FirstSetupState extends SavedSetup {
  loading: boolean;
  busy: boolean;
  preview: GeneratedProgramme | null;
  library: LibraryExercise[];
  error: "answers" | "build" | "save" | "restore" | "persist" | null;
}
export const FIRST_SETUP_KEY = "first_program_setup_v1";
export const emptyFirstSetup = (): SavedSetup => ({ version: 1, started: false, answers: { goal: null, experience: null, days: null, minutes: null, equipment: [], avoidText: "", skipLegs: false } });
export function parseFirstSetup(raw: string | null): SavedSetup {
  try {
    const v = JSON.parse(raw ?? "null");
    const a = v?.answers;
    if (v?.version !== 1 || typeof v.started !== "boolean" || !a || ![null, "strength", "hypertrophy", "general"].includes(a.goal) || ![null, "beginner", "intermediate"].includes(a.experience)
      || (a.days !== null && !DAYS_OPTIONS.includes(a.days)) || (a.minutes !== null && !MINUTES_OPTIONS.includes(a.minutes))
      || !Array.isArray(a.equipment) || a.equipment.some((e: EquipmentType) => !GYM_EQUIPMENT.includes(e)) || typeof a.avoidText !== "string" || typeof a.skipLegs !== "boolean") return emptyFirstSetup();
    return { version: 1, started: v.started, answers: { goal: a.goal, experience: a.experience, days: a.days, minutes: a.minutes, equipment: [...new Set<EquipmentType>(a.equipment)], avoidText: a.avoidText, skipLegs: a.skipLegs } };
  } catch { return emptyFirstSetup(); }
}

/** Draft answers only: generating is explicit; activating writes the exact reviewed draft. */
export function createFirstProgramSetup(
  services: Pick<AppServices, "repos" | "programmes" | "onboarding">,
  preferences: () => { lang: "en" | "ar"; unit: Unit },
  changed: (state: FirstSetupState) => void,
  done: () => void,
) {
  let state: FirstSetupState = { ...emptyFirstSetup(), loading: true, busy: false, preview: null, library: [], error: null };
  let request = 0, writing: Promise<unknown> = Promise.resolve(), activated = false, activating = false;
  const emit = (patch: Partial<FirstSetupState>) => { state = { ...state, ...patch }; changed(state); };
  const persist = async () => {
    const raw = JSON.stringify({ version: 1, started: state.started, answers: state.answers });
    const write = writing.catch(() => undefined).then(() => services.repos.setSetting(FIRST_SETUP_KEY, raw));
    writing = write;
    try { await write; } catch { emit({ error: "persist" }); }
  };
  async function load() {
    try { emit({ ...parseFirstSetup(await services.repos.getSetting(FIRST_SETUP_KEY)), loading: false, error: null }); }
    catch { emit({ loading: false, error: "restore" }); }
  }
  async function start() { emit({ started: true, error: null }); await persist(); }
  async function update(patch: Partial<FirstAnswers>) {
    if (activating || activated) return;
    request++;
    emit({ answers: { ...state.answers, ...patch }, preview: null, error: null, busy: false });
    await persist();
  }
  async function build() {
    if (state.busy) return;
    const a = state.answers;
    if (!a.goal || !a.experience || !a.days || !a.minutes || !a.equipment.length) { emit({ error: "answers" }); return; }
    const current = ++request;
    emit({ preview: null, busy: true, error: null });
    try {
      const [keys, limits, library] = await Promise.all([services.programmes.seedKeyMap(), services.repos.getRepCeilingDefaults(), services.programmes.listExercises()]);
      if (current !== request) return;
      const got = generateProgramme({ goal: a.goal, experience: a.experience, daysPerWeek: a.days, sessionMinutes: a.minutes, equipment: a.equipment, priorities: {}, avoid: a.avoidText.split(/[,،;]+/).map(s => s.trim()).filter(Boolean), skipLegs: a.skipLegs, lang: preferences().lang },
        { byKey: keys }, key => ceilingForName(library.find(e => e.seedKey === key)?.nameEn ?? key, limits));
      if (!got || got.draft.days.length !== a.days || got.draft.days.some(d => !d.exercises.length)) { emit({ error: "build" }); return; }
      emit({ preview: got, library });
    } catch { if (current === request) emit({ error: "build" }); }
    finally { if (current === request) emit({ busy: false }); }
  }
  async function activate() {
    if (state.busy || !state.preview || activated) return;
    activating = true;
    const preview = state.preview, a = state.answers;
    emit({ busy: true, error: null });
    try {
      // Retry a failed draft write and finish only after all older writes settle.
      await persist();
      await writing;
      const { lang, unit } = preferences();
      await services.onboarding.complete({
        profile: { language: lang, units: unit, daysPerWeek: a.days!, sessionMinutes: a.minutes!, equipment: a.equipment, goal: null, heightCm: null, bodyweightKg: null, birthDate: null },
        programme: preview.draft,
        gym: { name: defaultGymName(lang), loads: defaultGymLoads(unit).filter(l => a.equipment.includes(l.equipment)) },
      });
      activated = true;
      done();
    } catch { emit({ error: "save" }); }
    finally { activating = false; emit({ busy: false }); }
  }
  return { get state() { return state; }, load, start, update, build, activate };
}
