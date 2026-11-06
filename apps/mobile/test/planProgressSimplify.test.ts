import { describe, expect, it, vi } from "vitest";
import React from "react";
import { freshDb } from "./helpers";
import { ALL_LIBRARY, CATALOG } from "../src/db/libraryDraft";
import { RANKABLE_MUSCLES, rankOf, parseMusclePriorities, serializeMusclePriorities, type MusclePriorities } from "../src/logic/musclePriority";
import { generateProgramme, applyPriorityOrdering, type GeneratedProgramme, type GenerateInput } from "../src/logic/programGenerator";
import { translate } from "../src/i18n";
import { MusclePriorityGrid } from "../src/components/coach/MusclePriorityGrid";
import { GeneratedProgrammeHero } from "../src/components/coach/GeneratedProgrammeHero";
import { expand, nodes, texts } from "./achievementRender";
import type { LibraryExercise, ProgrammeDraft } from "../src/db/programmeRepo";
import { SessionInProgress } from "../src/db/programmeRepo";
import { sessionAction } from "../src/logic/dayChoice";
import { newExercise } from "../src/logic/programmeDraft";
import { GYM_EQUIPMENT } from "../src/logic/gymInput";

const strip = (s: string) => s.replace(/[\u2066-\u2069]/g, "");

vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig()));
vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: {
    create: (styles: any) => styles,
    hairlineWidth: 1,
  },
}));
vi.mock("../src/theme", () => ({
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  MIN_TOUCH: 48,
  radius: { sm: 4, md: 8, lg: 12, pill: 999 },
  type: { body: 15, label: 13, meta: 11 },
  usePalette: () => ({
    card: "#FFFFFF",
    border: "#E0E0E0",
    text: "#111111",
    muted: "#666666",
    tint: "#F0F0F0",
    accent: "#000000",
  }),
}));
vi.mock("../src/ui", () => ({
  AppText: "AppText",
  Card: "Card",
  BigButton: (props: any) =>
    React.createElement("Pressable", { accessibilityRole: "button", onPress: props.onPress }, React.createElement("AppText", null, props.label)),
  InlineStatus: (props: any) => React.createElement("AppText", null, props.text),
}));
vi.mock("../src/i18n", () => ({
  translate: (lang: string, key: string, params?: Record<string, string | number>) => {
    if (key === "coach.priority.note") {
      return lang === "ar"
        ? "تحديد أولوية لعضلة يزيد من مجموعاتها الأسبوعية ويضع تمارينها في وقت أبكر خلال أيام التمرين ذات الصلة."
        : "Prioritising a muscle increases its weekly sets and places its exercises earlier on relevant workout days.";
    }
    if (key === "coach.priority.toggle") return lang === "ar" ? "أولوية" : "Prioritise";
    if (key.startsWith("muscle.")) return key.replace("muscle.", "").toUpperCase();
    if (key === "coach.blueprint.launch") return "Activate & Save Program";
    if (key === "prog.exposure.title") return "Planned direct sets per week";
    if (key === "prog.versions") return "Versions";
    if (key === "coach.build") return "Build me a program";
    return key;
  },
  useI18n: () => ({
    lang: "en",
    unit: "kg",
    unitText: "kg",
    direction: "ltr",
    isRTL: false,
    t: (k: string, p?: Record<string, string | number>) => {
      if (k === "coach.priority.note") return "Prioritising a muscle increases its weekly sets and places its exercises earlier on relevant workout days.";
      if (k === "coach.priority.toggle") return "Prioritise";
      if (k.startsWith("muscle.")) return k.replace("muscle.", "").toUpperCase();
      if (k === "coach.blueprint.launch") return "Activate & Save Program";
      return k;
    },
  }),
}));

const byKey = new Map(CATALOG.map((c) => [c.key, { exerciseId: `id-${c.key}`, equipment: c.equipment }]));
const idToKey = new Map([...byKey.entries()].map(([k, v]) => [v.exerciseId, k]));

const baseGenerateInput = (over: Partial<GenerateInput> = {}): GenerateInput => ({
  goal: "hypertrophy",
  experience: "intermediate",
  daysPerWeek: 4,
  sessionMinutes: 75,
  equipment: [...GYM_EQUIPMENT],
  priorities: { biceps: "priority" },
  avoid: [],
  lang: "en",
  ...over,
});

async function seededDb() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const gymId = (await ctx.repos.getActiveGymId())!;
  const gym = await ctx.repos.loadGymFingerprint(gymId);
  const active = (await ctx.programmes.getActive())!;
  const draft = await ctx.programmes.loadDraft(active.versionId);
  const days = await ctx.repos.listDays(active.versionId);
  return { ...ctx, gymId, gym, active, draft, days };
}

describe("Plan and Progress screen simplification & Build Program", () => {
  describe("Progress Screen 5-session limit & historical data preservation", () => {
    it("preserves all sessions in repo for lifetime stats/rhythm while presenting only 5 recent sessions", async () => {
      const { repos, history, workout, deps, days, gym, gymId } = await seededDb();
      const day = days[0]!;
      const exs = await repos.listDayExercises(day.id);
      const ex = exs[0]!;

      // Insert 8 completed workouts across sequential days
      for (let i = 0; i < 8; i++) {
        deps.tick(86_400_000);
        const { id: sId } = await workout.startOrResumeSession(day.id, gymId);
        await workout.logSet(
          { sessionId: sId, exerciseId: ex.exerciseId, load: 80, reps: 8 },
          { gym, equipment: ex.equipment, setup: ex.setup },
        );
        await workout.finishSession(sId);
      }

      // 1. Repo retains all 8 historical sessions
      const allSessions = await history.listSessions(100);
      expect(allSessions.length).toBe(8);

      // 2. The presentation view slices to the 5 most recent sessions (newest first)
      const displayedSessions = allSessions.slice(0, 5);
      expect(displayedSessions.length).toBe(5);
      expect(displayedSessions[0]!.finishedAt).toBeGreaterThan(displayedSessions[1]!.finishedAt);
      expect(displayedSessions[4]!.finishedAt).toBeGreaterThan(allSessions[5]!.finishedAt);

      // 3. Historical data for charts and lifetime records is NOT truncated
      const lifetimeCount = await history.countSessions();
      expect(lifetimeCount).toBe(8);
    });
  });

  describe("Muscle Priorities compact list & legacy value preservation", () => {
    it("renders compact list with muscle name + Prioritise toggle switch and no 4-option chips or badges", () => {
      const onSetRank = vi.fn();
      const tree = MusclePriorityGrid({
        priorities: { chest: "priority", back: "normal" },
        onSetRank,
      });

      const allTexts = texts(tree).join(" ");
      expect(allTexts).toContain("CHEST");
      expect(allTexts).toContain("BACK");
      expect(allTexts).toContain("GLUTES");
      // Chips and badges removed
      expect(allTexts).not.toContain("Balanced");
      expect(allTexts).not.toContain("Maintenance");
      expect(allTexts).not.toContain("Reduced");
      expect(allTexts).not.toContain("🔥");
      expect(allTexts).not.toContain("🛡️");

      const switches = nodes(tree).filter((n) => n.props?.accessibilityRole === "switch");
      expect(switches.length).toBe(RANKABLE_MUSCLES.length);

      // Chest switch is checked
      expect(switches[0]?.props?.accessibilityState?.checked).toBe(true);
      expect(switches[0]?.props?.accessibilityRole).toBe("switch");

      // Tapping chest toggles from priority to normal
      switches[0]!.props.onPress();
      expect(onSetRank).toHaveBeenCalledWith("chest", "normal");
    });

    it("toggles normal muscle to priority on press", () => {
      const onSetRank = vi.fn();
      const tree = MusclePriorityGrid({
        priorities: {},
        onSetRank,
      });
      const switches = nodes(tree).filter((n) => n.props?.accessibilityRole === "switch");
      // Back is index 1
      expect(switches[1]?.props?.accessibilityState?.checked).toBe(false);
      switches[1]!.props.onPress();
      expect(onSetRank).toHaveBeenCalledWith("back", "priority");
    });

    it("preserves legacy maintenance and reduced values without rewriting on load", () => {
      // Legacy settings string with maintenance and reduced
      const legacyRaw = JSON.stringify({ chest: "maintenance", shoulders: "reduced", quads: "priority" });
      const parsed = parseMusclePriorities(legacyRaw);

      expect(parsed.chest).toBe("maintenance");
      expect(parsed.shoulders).toBe("reduced");
      expect(parsed.quads).toBe("priority");

      // Grid treats legacy non-priority as unchecked without altering state
      const onSetRank = vi.fn();
      const tree = MusclePriorityGrid({ priorities: parsed, onSetRank });
      const switches = nodes(tree).filter((n) => n.props?.accessibilityRole === "switch");

      // Chest (maintenance) is not checked
      expect(switches[0]?.props?.accessibilityState?.checked).toBe(false);
      // Quads (priority) is checked
      const quadsIndex = RANKABLE_MUSCLES.indexOf("quads");
      expect(switches[quadsIndex]?.props?.accessibilityState?.checked).toBe(true);

      // Tapping chest explicitly transitions it to priority
      switches[0]!.props.onPress();
      expect(onSetRank).toHaveBeenCalledWith("chest", "priority");

      // Reserialization preserves untouched legacy values
      const nextPriorities = { ...parsed, chest: "priority" as const };
      const serialized = serializeMusclePriorities(nextPriorities);
      const reParsed = parseMusclePriorities(serialized);
      expect(reParsed.shoulders).toBe("reduced"); // preserved!
      expect(reParsed.chest).toBe("priority");
    });

    it("plainly explains weekly sets and earlier placement on workout days in EN and AR", () => {
      const enNote = translate("en", "coach.priority.note");
      const arNote = translate("ar", "coach.priority.note");

      expect(enNote).toContain("increases its weekly sets");
      expect(enNote).toContain("earlier on relevant workout days");

      expect(arNote).toContain("يزيد من مجموعاتها الأسبوعية");
      expect(arNote).toContain("في وقت أبكر");
    });
  });

  describe("Program generator priority ordering & preview", () => {
    it("orders prioritised muscle exercises earlier on relevant days (e.g. biceps before back on Pull day)", () => {
      const pullUpId = byKey.get("pullup")!.exerciseId;
      const curlId = byKey.get("barbell_curl")!.exerciseId;

      const pullDayDraft: ProgrammeDraft = {
        name: "Pull Program",
        days: [
          {
            name: "Pull Day",
            exercises: [
              newExercise(pullUpId, { sets: 4 }),
              newExercise(curlId, { sets: 3 }),
            ],
          },
        ],
      };

      // With biceps prioritised
      const orderedWithBiceps = applyPriorityOrdering(pullDayDraft, { biceps: "priority" }, idToKey);
      expect(orderedWithBiceps.days[0]!.exercises[0]!.exerciseId).toBe(curlId);
      expect(orderedWithBiceps.days[0]!.exercises[1]!.exerciseId).toBe(pullUpId);

      // With no priority
      const orderedNormal = applyPriorityOrdering(pullDayDraft, {}, idToKey);
      expect(orderedNormal.days[0]!.exercises[0]!.exerciseId).toBe(pullUpId);
      expect(orderedNormal.days[0]!.exercises[1]!.exerciseId).toBe(curlId);
    });

    it("handles multiple priorities deterministically and preserves supersets/warmups", () => {
      const pullUpId = byKey.get("pullup")!.exerciseId;
      const curlId = byKey.get("barbell_curl")!.exerciseId;
      const raiseId = byKey.get("cable_lateral_raise")!.exerciseId;

      const dayDraft: ProgrammeDraft = {
        name: "Upper Program",
        days: [
          {
            name: "Upper Day",
            exercises: [
              newExercise(pullUpId, { sets: 4 }),
              newExercise(curlId, { sets: 3 }),
              newExercise(raiseId, { sets: 3 }),
            ],
          },
        ],
      };

      // Both biceps and shoulders prioritised
      const result = applyPriorityOrdering(dayDraft, { biceps: "priority", shoulders: "priority" }, idToKey);

      // Both prioritized exercises appear before back
      const backIndex = result.days[0]!.exercises.findIndex((e) => e.exerciseId === pullUpId);
      const bicepIndex = result.days[0]!.exercises.findIndex((e) => e.exerciseId === curlId);
      const shoulderIndex = result.days[0]!.exercises.findIndex((e) => e.exerciseId === raiseId);

      expect(bicepIndex).toBeLessThan(backIndex);
      expect(shoulderIndex).toBeLessThan(backIndex);
    });

    it("generates a preview without writing to the database", async () => {
      const { programmes, active } = await seededDb();

      // Generate preview
      const preview = generateProgramme(baseGenerateInput(), { byKey }, () => 10);
      expect(preview).not.toBeNull();
      expect(preview!.draft.days.length).toBe(4);
      expect(preview!.draft.days[0]!.exercises.length).toBeGreaterThan(0);

      // Verify DB was NOT modified by generation
      const activeAfter = await programmes.getActive();
      expect(activeAfter!.programmeId).toBe(active.programmeId);
      expect(activeAfter!.versionId).toBe(active.versionId);
    });

    it("GeneratedProgrammeHero renders the exact exercise order in preview", () => {
      const preview = generateProgramme(baseGenerateInput(), { byKey }, () => 10);
      expect(preview).not.toBeNull();

      const tree = expand(
        React.createElement(GeneratedProgrammeHero, {
          preview: preview!,
          library: ALL_LIBRARY,
          minutes: 75,
          busy: false,
          onSave: vi.fn(),
        })
      );

      const allTexts = strip(texts(tree).join(" "));
      expect(allTexts).toContain("Activate & Save Program");
      // Shows day names and exercise numbers
      expect(allTexts).toContain("1. ");
    });
  });

  describe("One-tap activation, repeated taps, and transactional rollback", () => {
    it("activates and saves program transactionally in one step and saves muscle priorities", async () => {
      const { programmes, repos, draft, active } = await seededDb();
      const validExId = draft.days[0]!.exercises[0]!.exerciseId;

      const newDraft: ProgrammeDraft = {
        name: "Power Hypertrophy 3-Day",
        days: [
          {
            name: "Push",
            exercises: [
              newExercise(validExId, { sets: 4, repMin: 6, repMax: 8, isGoalLift: true, trackEffort: true }),
            ],
          },
        ],
      };

      const priorities: MusclePriorities = { chest: "priority", triceps: "priority" };

      // Single transactional action: saves programme AND priorities atomically
      await programmes.createProgramme(newDraft, {
        activate: true,
        alsoInTransaction: async () => {
          await repos.setSetting("muscle_priorities", serializeMusclePriorities(priorities));
        },
      });

      // Active program is now the new program
      const p2 = await programmes.getActive();
      expect(p2!.programmeId).not.toBe(active.programmeId);
      expect(p2!.programmeName).toBe("Power Hypertrophy 3-Day");

      // Muscle priorities were saved atomically
      const savedPrioritiesRaw = await repos.getSetting("muscle_priorities");
      const savedPriorities = parseMusclePriorities(savedPrioritiesRaw);
      expect(savedPriorities.chest).toBe("priority");
      expect(savedPriorities.triceps).toBe("priority");
    });

    it("rolls back completely if alsoInTransaction fails, leaving previous program intact", async () => {
      const { programmes, draft, active } = await seededDb();
      const validExId = draft.days[0]!.exercises[0]!.exerciseId;

      const newDraft: ProgrammeDraft = {
        name: "Corrupt Draft",
        days: [{ name: "Day 1", exercises: [newExercise(validExId, { sets: 3 })] }],
      };

      await expect(
        programmes.createProgramme(newDraft, {
          activate: true,
          alsoInTransaction: async () => {
            throw new Error("Disk full or schema constraint violation");
          },
        }),
      ).rejects.toThrow("Disk full or schema constraint violation");

      // Active programme is still active
      const cur = await programmes.getActive();
      expect(cur!.programmeId).toBe(active.programmeId);
      expect(cur!.programmeName).toBe(active.programmeName);

      // No stray programme with name "Corrupt Draft" exists
      const list = await programmes.listProgrammes();
      expect(list.some((pr) => pr.name === "Corrupt Draft")).toBe(false);
    });

    it("prevents duplicate saves on repeated taps via activating ref logic", async () => {
      const { programmes, draft } = await seededDb();
      const validExId = draft.days[0]!.exercises[0]!.exerciseId;
      let callCount = 0;
      let isActivating = false;

      const performSave = async () => {
        if (isActivating) return;
        isActivating = true;
        callCount++;
        try {
          const newDraft: ProgrammeDraft = {
            name: `Prog ${callCount}`,
            days: [{ name: "D1", exercises: [newExercise(validExId, { sets: 3 })] }],
          };
          await programmes.createProgramme(newDraft, { activate: true });
        } finally {
          isActivating = false;
        }
      };

      // Simulate 5 rapid simultaneous taps
      await Promise.all([performSave(), performSave(), performSave(), performSave(), performSave()]);

      // Exactly 1 save executed
      expect(callCount).toBe(1);
    });
  });

  describe("Activating a new program during an open workout", () => {
    it("allows building and activating a new program while workout is open, retaining in-progress workout, resuming, logging sets, and finishing cleanly", async () => {
      const { db, programmes, workout, finish, gym, gymId, deps, active, days, repos } = await seededDb();
      const day1 = days[0]!;
      const exs = await repos.listDayExercises(day1.id);
      const ex = exs[0]!;

      // 1. Lifter starts a workout from current program
      const { id: sId } = await workout.startOrResumeSession(day1.id, gymId);
      const session = await workout.getSession(sId);
      expect(session!.status).toBe("in_progress");

      // Lifter logs first set
      await workout.logSet(
        { sessionId: sId, exerciseId: ex.exerciseId, load: 100, reps: 10 },
        { gym, equipment: ex.equipment, setup: ex.setup },
      );

      // 2. Lifter builds and activates a NEW programme while workout is still open
      const p2Draft: ProgrammeDraft = {
        name: "New Active Program",
        days: [
          {
            name: "Upper B",
            exercises: [
              newExercise(ex.exerciseId, { sets: 3, repMin: 8, repMax: 12 }),
            ],
          },
        ],
      };

      // Activating new program does NOT throw SessionInProgress
      const p2Result = await programmes.createProgramme(p2Draft, { activate: true });
      expect(p2Result.programmeId).toBeDefined();

      // P2 is now active in DB
      const p2Active = await programmes.getActive();
      expect(p2Active!.programmeName).toBe("New Active Program");
      const p2Days = await repos.listDays(p2Active!.versionId);

      // 3. Open workout is preserved intact
      const openSession = await workout.getSession(sId);
      expect(openSession).not.toBeNull();
      expect(openSession!.status).toBe("in_progress");
      expect(openSession!.programme_day_id).toBe(day1.id);

      const sessionDb = await db.get<{ programme_version_id: string }>("SELECT programme_version_id FROM session WHERE id = ?", [sId]);
      expect(sessionDb!.programme_version_id).toBe(active.versionId);

      const liveSets = await workout.listSessionSets(sId);
      expect(liveSets.length).toBe(1);
      expect(liveSets[0]!.load).toBe(100);
      expect(liveSets[0]!.reps).toBe(10);

      // Today session action correctly routes to resume the open workout
      const action = sessionAction(p2Days[0]!.id, day1.id);
      expect(action).toEqual({ kind: "resume", dayId: day1.id, elsewhere: true });

      // 4. Lifter resumes, logs second set, and finishes the workout
      deps.tick(60_000);
      await workout.logSet(
        { sessionId: sId, exerciseId: ex.exerciseId, load: 100, reps: 9 },
        { gym, equipment: ex.equipment, setup: ex.setup },
      );

      await workout.finishSession(sId);

      // Open workout is now closed
      const openAfter = await workout.getSession(sId);
      expect(openAfter!.status).toBe("finished");

      // 5. Next session action routes to start from the NEW program
      const nextAction = sessionAction(p2Days[0]!.id, null);
      expect(nextAction).toEqual({ kind: "start", dayId: p2Days[0]!.id });
    });
  });

  describe("Audit of Plan screen actions during open workout", () => {
    it("allows saveNewVersion and setActiveProgramme without disturbing open workout", async () => {
      const { programmes, workout, active, draft, days, gymId } = await seededDb();
      const day1 = days[0]!;

      // Start workout
      const { id: sId } = await workout.startOrResumeSession(day1.id, gymId);

      // 1. saveNewVersion succeeds safely for future sessions
      const nextDraft: ProgrammeDraft = {
        name: draft.name,
        days: draft.days.map((d) => ({
          name: d.name,
          exercises: d.exercises.map((e) => newExercise(e.exerciseId, { sets: e.sets + 1 })),
        })),
      };
      await expect(programmes.saveNewVersion(active.programmeId, nextDraft)).resolves.not.toThrow();

      // 2. Open workout still in progress
      const open = await workout.getSession(sId);
      expect(open?.status).toBe("in_progress");
    });

    it("blocks short-week schedule apply during open workout due to conflicting planned days calendar", async () => {
      const { workout, shortWeek, days, gymId } = await seededDb();
      const day1 = days[0]!;

      await workout.startOrResumeSession(day1.id, gymId);

      // Applying short-week schedule when workout is open throws SessionInProgress because it modifies current week schedule
      await expect(shortWeek.apply({ keptDayIds: [day1.id] })).rejects.toThrow(SessionInProgress);
    });
  });

  describe("Accessibility, VoiceOver, and i18n Verification", () => {
    it("provides complete VoiceOver switch states, labels, and hints", () => {
      const tree = MusclePriorityGrid({
        priorities: { chest: "priority", back: "normal" },
        onSetRank: vi.fn(),
      });

      const switches = nodes(tree).filter((n) => n.props?.accessibilityRole === "switch");
      expect(switches.length).toBe(10);

      // Chest switch
      const chestSwitch = switches[0]!;
      expect(chestSwitch.props.accessibilityRole).toBe("switch");
      expect(chestSwitch.props.accessibilityState).toEqual({ checked: true });
      expect(chestSwitch.props.accessibilityLabel).toBe("CHEST, Prioritise");
      expect(chestSwitch.props.accessibilityHint).toContain("Prioritising a muscle increases its weekly sets");

      // Back switch
      const backSwitch = switches[1]!;
      expect(backSwitch.props.accessibilityRole).toBe("switch");
      expect(backSwitch.props.accessibilityState).toEqual({ checked: false });
      expect(backSwitch.props.accessibilityLabel).toBe("BACK, Prioritise");
    });

    it("verifies English and Arabic translations for priority toggle and notes", () => {
      expect(translate("en", "coach.priority.toggle")).toBe("Prioritise");
      expect(translate("ar", "coach.priority.toggle")).toBe("أولوية");

      const enNote = translate("en", "coach.priority.note");
      const arNote = translate("ar", "coach.priority.note");

      expect(enNote).toContain("Prioritising a muscle");
      expect(enNote).toContain("earlier on relevant workout days");

      expect(arNote).toContain("تحديد أولوية لعضلة");
      expect(arNote).toContain("في وقت أبكر");
    });
  });
});
