import type { EquipmentType } from "@gain/engine";
import type { AppServices } from "../AppContext";
import type { LibraryExercise } from "../db/programmeRepo";
import { ceilingForName } from "./ceilings";
import { defaultGymLoads, defaultGymName } from "./defaultGym";
import { GYM_EQUIPMENT } from "./gymInput";
import { DAYS_OPTIONS, MINUTES_OPTIONS } from "./onboarding";
import { generateProgramme, type GeneratedProgramme, type GeneratorExperience, type GeneratorGoal } from "./programGenerator";
import type { Unit } from "./units";

export type TrainingEnvironment = "gym" | "dumbbell";
export const TRAINING_ENVIRONMENTS: readonly TrainingEnvironment[] = ["gym", "dumbbell"] as const;

export function equipmentForEnvironment(env: TrainingEnvironment): EquipmentType[] {
  if (env === "dumbbell") return ["dumbbell"];
  return [...GYM_EQUIPMENT];
}

export interface FirstAnswers {
  days: number | null;
  environment: TrainingEnvironment | null;
  goal: GeneratorGoal;
  experience: GeneratorExperience;
  minutes: number;
  avoidText: string;
  skipLegs: boolean;
}

interface SavedSetup {
  version: 1;
  started: boolean;
  answers: FirstAnswers;
}

export interface FirstSetupState extends SavedSetup {
  loading: boolean;
  busy: boolean;
  preview: GeneratedProgramme | null;
  library: LibraryExercise[];
  error: "answers" | "build" | "save" | "restore" | "persist" | null;
}

export const FIRST_SETUP_KEY = "first_program_setup_v1";

export const emptyFirstSetup = (): SavedSetup => ({
  version: 1,
  started: false,
  answers: {
    days: null,
    environment: null,
    goal: "general",
    experience: "beginner",
    minutes: 45,
    avoidText: "",
    skipLegs: false,
  },
});

export function parseFirstSetup(raw: string | null): SavedSetup {
  try {
    const v = JSON.parse(raw ?? "null");
    const a = v?.answers;
    if (v?.version !== 1 || typeof v.started !== "boolean" || typeof a !== "object" || !a) return emptyFirstSetup();

    if (a.days !== null && (typeof a.days !== "number" || !DAYS_OPTIONS.includes(a.days))) {
      return emptyFirstSetup();
    }
    if (a.environment !== null && a.environment !== "gym" && a.environment !== "dumbbell" && !Array.isArray(a.equipment)) {
      return emptyFirstSetup();
    }

    const days = typeof a.days === "number" && DAYS_OPTIONS.includes(a.days) ? a.days : null;
    let environment: TrainingEnvironment | null = null;
    if (a.environment === "gym" || a.environment === "dumbbell") {
      environment = a.environment;
    } else if (Array.isArray(a.equipment) && a.equipment.length > 0) {
      environment =
        a.equipment.includes("barbell") || a.equipment.includes("machine") || a.equipment.includes("cable")
          ? "gym"
          : "dumbbell";
    }

    const goal: GeneratorGoal = ["strength", "hypertrophy", "general"].includes(a.goal) ? a.goal : "general";
    const experience: GeneratorExperience = ["beginner", "intermediate"].includes(a.experience) ? a.experience : "beginner";
    const minutes: number = typeof a.minutes === "number" && MINUTES_OPTIONS.includes(a.minutes) ? a.minutes : 45;
    const avoidText: string = typeof a.avoidText === "string" ? a.avoidText : "";
    const skipLegs: boolean = typeof a.skipLegs === "boolean" ? a.skipLegs : false;

    return {
      version: 1,
      started: v.started,
      answers: {
        days,
        environment,
        goal,
        experience,
        minutes,
        avoidText,
        skipLegs,
      },
    };
  } catch {
    return emptyFirstSetup();
  }
}

/** Draft answers only: generating is explicit; activating writes the exact reviewed draft. */
export function createFirstProgramSetup(
  services: Pick<AppServices, "repos" | "programmes" | "onboarding">,
  preferences: () => { lang: "en" | "ar"; unit: Unit },
  changed: (state: FirstSetupState) => void,
  done: () => void,
) {
  let state: FirstSetupState = { ...emptyFirstSetup(), loading: true, busy: false, preview: null, library: [], error: null };
  let request = 0,
    writing: Promise<unknown> = Promise.resolve(),
    activated = false,
    activating = false;

  const emit = (patch: Partial<FirstSetupState>) => {
    state = { ...state, ...patch };
    changed(state);
  };

  const persist = async () => {
    const raw = JSON.stringify({ version: 1, started: state.started, answers: state.answers });
    const write = writing.catch(() => undefined).then(() => services.repos.setSetting(FIRST_SETUP_KEY, raw));
    writing = write;
    try {
      await write;
    } catch {
      emit({ error: "persist" });
    }
  };

  async function load() {
    try {
      emit({ ...parseFirstSetup(await services.repos.getSetting(FIRST_SETUP_KEY)), loading: false, error: null });
    } catch {
      emit({ loading: false, error: "restore" });
    }
  }

  async function start() {
    emit({ started: true, error: null });
    await persist();
  }

  async function update(patch: Partial<FirstAnswers>) {
    if (activating || activated) return;
    request++;
    emit({ answers: { ...state.answers, ...patch }, preview: null, error: null, busy: false });
    await persist();
  }

  async function build() {
    if (state.busy) return;
    const a = state.answers;
    if (!a.days || !a.environment) {
      emit({ error: "answers" });
      return;
    }
    const current = ++request;
    emit({ preview: null, busy: true, error: null });
    try {
      const [keys, limits, library] = await Promise.all([
        services.programmes.seedKeyMap(),
        services.repos.getRepCeilingDefaults(),
        services.programmes.listExercises(),
      ]);
      if (current !== request) return;
      const eq = equipmentForEnvironment(a.environment);
      const got = generateProgramme(
        {
          goal: a.goal,
          experience: a.experience,
          daysPerWeek: a.days,
          sessionMinutes: a.minutes,
          equipment: eq,
          priorities: {},
          avoid: a.avoidText.split(/[,،;]+/).map((s) => s.trim()).filter(Boolean),
          skipLegs: a.skipLegs,
          lang: preferences().lang,
        },
        { byKey: keys },
        (key) => ceilingForName(library.find((e) => e.seedKey === key)?.nameEn ?? key, limits),
      );
      if (!got || got.draft.days.length !== a.days || got.draft.days.some((d) => !d.exercises.length)) {
        emit({ error: "build" });
        return;
      }
      emit({ preview: got, library });
    } catch {
      if (current === request) emit({ error: "build" });
    } finally {
      if (current === request) emit({ busy: false });
    }
  }

  async function activate() {
    if (state.busy || !state.preview || activated) return;
    activating = true;
    const preview = state.preview,
      a = state.answers;
    emit({ busy: true, error: null });
    try {
      await persist();
      await writing;
      const { lang, unit } = preferences();
      const eq = equipmentForEnvironment(a.environment!);
      await services.onboarding.complete({
        profile: {
          language: lang,
          units: unit,
          daysPerWeek: a.days!,
          sessionMinutes: a.minutes,
          equipment: eq,
          goal: null,
          heightCm: null,
          bodyweightKg: null,
          birthDate: null,
        },
        programme: preview.draft,
        gym: {
          name: defaultGymName(lang),
          loads: defaultGymLoads(unit).filter((l) => eq.includes(l.equipment)),
        },
      });
      activated = true;
      done();
    } catch {
      emit({ error: "save" });
    } finally {
      activating = false;
      emit({ busy: false });
    }
  }

  return {
    get state() {
      return state;
    },
    load,
    start,
    update,
    build,
    activate,
  };
}
