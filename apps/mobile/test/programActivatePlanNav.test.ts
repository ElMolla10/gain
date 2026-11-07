import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { en, ar } from "../src/i18n/strings";
import { freshDb } from "./helpers";
import { generateProgramme, type GenerateInput } from "../src/logic/programGenerator";
import { GYM_EQUIPMENT } from "../src/logic/gymInput";
import { CATALOG } from "../src/db/libraryDraft";
import { DraftInvalid } from "../src/db/programmeRepo";

const byKey = new Map(CATALOG.map((c) => [c.key, { exerciseId: `id-${c.key}`, equipment: c.equipment }]));

const baseInput = (over: Partial<GenerateInput> = {}): GenerateInput => ({
  goal: "hypertrophy",
  experience: "intermediate",
  daysPerWeek: 4,
  sessionMinutes: 75,
  equipment: [...GYM_EQUIPMENT],
  priorities: {},
  avoid: [],
  lang: "en",
  ...over,
});

describe("Build me a program -> Activate & Save Program: Nested Navigation & Save Handler", () => {
  const appPath = join(__dirname, "..", "App.tsx");
  const programGeneratePath = join(__dirname, "..", "src", "screens", "ProgramGenerateScreen.tsx");
  const programmePath = join(__dirname, "..", "src", "screens", "ProgrammeScreen.tsx");
  const uiPath = join(__dirname, "..", "src", "ui.tsx");

  const appSrc = readFileSync(appPath, "utf8");
  const programGenerateSrc = readFileSync(programGeneratePath, "utf8");
  const programmeSrc = readFileSync(programmePath, "utf8");
  const uiSrc = readFileSync(uiPath, "utf8");

  describe("Navigation structure in App.tsx", () => {
    it("declares Tabs in the root Stack and Programme inside Tabs bottom tab navigator", () => {
      // Stack registers Tabs
      expect(appSrc).toContain('<Stack.Screen name="Tabs" component={Tabs}');
      // Tabs registers Programme as Plan tab
      expect(appSrc).toContain('<Tab.Screen name="Programme" component={ProgrammeScreen}');
      // ProgramGenerate is on the root Stack
      expect(appSrc).toContain('<Stack.Screen name="ProgramGenerate" component={ProgramGenerateScreen}');
      // Neither Today nor Programme are direct stack screens
      expect(appSrc).not.toContain('<Stack.Screen name="Today"');
      expect(appSrc).not.toContain('<Stack.Screen name="Programme"');
    });
  });

  describe("ProgramGenerateScreen save handler", () => {
    it("navigates to the nested Plan tab (Tabs -> Programme) with activated: true, not Today", () => {
      expect(programGenerateSrc).not.toContain('nav.navigate("Today")');
      expect(programGenerateSrc).toContain('nav.navigate("Tabs", { screen: "Programme", params: { activated: true } })');
    });

    it("guards against double-taps using activatingRef and busy state", () => {
      expect(programGenerateSrc).toContain("activatingRef.current = true;");
      expect(programGenerateSrc).toContain("setBusy(true);");
      expect(programGenerateSrc).toContain("if (!preview || busy || activatingRef.current) return;");
      expect(programGenerateSrc).toContain("activatingRef.current = false;");
      expect(programGenerateSrc).toContain("setBusy(false);");
    });

    it("stays on the builder and displays an error notice when save fails", () => {
      expect(programGenerateSrc).toContain("catch (e) {");
      expect(programGenerateSrc).toContain('setMessage(t("prog.switch.error"))');
      expect(programGenerateSrc).toContain('<Notice kind="error">{message}</Notice>');
    });
  });

  describe("ProgrammeScreen one-time confirmation banner", () => {
    it("reads route.params?.activated and shows a dismissible success notice", () => {
      expect(programmeSrc).toContain("const route = useRoute();");
      expect(programmeSrc).toContain("const params = (route.params ?? {}) as ProgrammeRouteParams;");
      expect(programmeSrc).toContain("const showActivatedNotice = Boolean(params.activated) && !dismissed;");
      expect(programmeSrc).toContain('<Notice\n          kind="success"\n          title={t("prog.activated")}');
      expect(programmeSrc).toContain('dismissLabel={t("prog.activated.dismiss")}');
      expect(programmeSrc).toContain("onDismiss={dismissNotice}");
      expect(programmeSrc).toContain('actionLabel={t("prog.activated.dismiss")}');
      expect(programmeSrc).toContain("onAction={dismissNotice}");
    });

    it("clears the activated route param on dismiss and when the tab loses focus so it never reappears on later visits", () => {
      expect(programmeSrc).toContain("nav.setParams({ activated: undefined });");
      expect(programmeSrc).toContain("if (params.activated) {\n          nav.setParams({ activated: undefined });\n        }");
    });

    it("displays the newly activated program below the banner", () => {
      const bannerIdx = programmeSrc.indexOf("showActivatedNotice ? (");
      const titleIdx = programmeSrc.indexOf("{data.name}");
      expect(bannerIdx).toBeGreaterThan(0);
      expect(titleIdx).toBeGreaterThan(bannerIdx);
    });
  });

  describe("Notice UI component support for dismissal", () => {
    it("supports optional onDismiss and dismissLabel with accessible close button", () => {
      expect(uiSrc).toContain("dismissLabel?: string;");
      expect(uiSrc).toContain("onDismiss?: () => void;");
      expect(uiSrc).toContain('accessibilityLabel={dismissLabel ?? "Dismiss"}');
      expect(uiSrc).toContain('<Icon name="close" color={p.muted} size={18} />');
    });
  });

  describe("Localized confirmation copy", () => {
    it("has clear localized strings for 'Your plan is ready' in English and Arabic", () => {
      expect(en["prog.activated"]).toBe("Your plan is ready");
      expect(ar["prog.activated"]).toBe("برنامجك جاهز");
      expect(en["prog.activated.dismiss"]).toBe("Dismiss");
      expect(ar["prog.activated.dismiss"]).toBe("إغلاق");
    });
  });
});

describe("Database behavior: Open workout preservation and failure safety", () => {
  it("preserves an open workout and its logged sets when a newly generated program is activated", async () => {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    await ctx.repos.topUpLibrary();
    const gymId = (await ctx.repos.getActiveGymId())!;
    const gym = await ctx.repos.loadGymFingerprint(gymId);

    // Setup an initial active program
    const seed = await ctx.programmes.seedKeyMap();
    const initialGen = generateProgramme(baseInput(), { byKey: seed }, () => 10)!;
    const initialProg = await ctx.programmes.createProgramme(initialGen.draft, { activate: true });

    // Start a workout on day 1 of the initial program
    const days = await ctx.repos.listDays(initialProg.versionId);
    expect(days.length).toBeGreaterThan(0);
    const day1 = days[0]!;
    const dayExercises = await ctx.repos.listDayExercises(day1.id);
    expect(dayExercises.length).toBeGreaterThan(0);
    const exercise1 = dayExercises[0]!;
    const dctx = { gym, equipment: exercise1.equipment, setup: exercise1.setup };

    const { id: sessionId } = await ctx.workout.startOrResumeSession(day1.id, gymId);
    expect(sessionId).toBeTruthy();

    // Log a working set in this workout
    const loggedSet = await ctx.workout.logSet({
      sessionId,
      exerciseId: exercise1.exerciseId,
      load: 60,
      reps: 10,
      rir: 2,
      warmup: false,
    }, dctx);
    expect(loggedSet.id).toBeTruthy();

    // Confirm session is in progress
    const openBefore = await ctx.workout.getOpenSession();
    expect(openBefore?.id).toBe(sessionId);

    // Now user generates and activates a second program via builder
    const secondGen = generateProgramme(baseInput({ daysPerWeek: 3 }), { byKey: seed }, () => 10)!;
    expect(secondGen.draft.days).toHaveLength(3);
    const secondProg = await ctx.programmes.createProgramme(secondGen.draft, { activate: true });

    // Verify database confirms activation of second program
    const activeProg = await ctx.programmes.getActive();
    expect(activeProg?.programmeId).toBe(secondProg.programmeId);

    // CRITICAL: Verify open workout session is preserved
    const openAfter = await ctx.workout.getOpenSession();
    expect(openAfter?.id).toBe(sessionId);

    const openSessionDetails = await ctx.workout.getSession(sessionId);
    expect(openSessionDetails?.status).toBe("in_progress");

    // CRITICAL: Verify logged sets are intact
    const openSets = await ctx.workout.listSessionSets(sessionId);
    expect(openSets).toHaveLength(1);
    expect(openSets[0]!.id).toBe(loggedSet.id);
    expect(openSets[0]!.reps).toBe(10);
    expect(openSets[0]!.load).toBe(60);
  });

  it("leaves current program untouched if draft is invalid, staying on the builder", async () => {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    await ctx.repos.topUpLibrary();

    const seed = await ctx.programmes.seedKeyMap();
    const initialGen = generateProgramme(baseInput(), { byKey: seed }, () => 10)!;
    const initialProg = await ctx.programmes.createProgramme(initialGen.draft, { activate: true });

    // Try creating an invalid draft (empty days)
    const invalidDraft = { name: "Broken", days: [] };
    await expect(ctx.programmes.createProgramme(invalidDraft as any, { activate: true })).rejects.toThrow(DraftInvalid);

    // Active program must remain the initial one
    const activeProg = await ctx.programmes.getActive();
    expect(activeProg?.programmeId).toBe(initialProg.programmeId);
  });
});
