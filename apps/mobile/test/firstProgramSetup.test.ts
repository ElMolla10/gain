import { beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOG } from "../src/db/libraryDraft";
import { DAYS_OPTIONS } from "../src/logic/onboarding";
import {
  createFirstProgramSetup,
  parseFirstSetup,
  emptyFirstSetup,
  equipmentForEnvironment,
  TRAINING_ENVIRONMENTS,
  type TrainingEnvironment,
} from "../src/logic/firstProgramSetup";

const keys = new Map(CATALOG.map((c) => [c.key, { exerciseId: c.key, equipment: c.equipment }]));
const library = CATALOG.map((c) => ({ id: c.key, seedKey: c.key, nameEn: c.en, nameAr: c.ar, equipment: c.equipment }));

function harness(raw: string | null = null, lang: "en" | "ar" = "en") {
  const services = {
    repos: {
      getSetting: vi.fn().mockResolvedValue(raw),
      setSetting: vi.fn().mockResolvedValue(undefined),
      getRepCeilingDefaults: vi.fn().mockResolvedValue({ upper: 10, lower: 12, lateral_raise: 15 }),
    },
    programmes: { seedKeyMap: vi.fn().mockResolvedValue(keys), listExercises: vi.fn().mockResolvedValue(library) },
    onboarding: { complete: vi.fn().mockResolvedValue({ programmeId: "new", gymId: "gym" }) },
  };
  const changed = vi.fn(),
    done = vi.fn();
  const flow = createFirstProgramSetup(services as any, () => ({ lang, unit: "kg" }), changed, done);
  return { flow, services, done };
}

const basicAnswers = { days: 3, environment: "dumbbell" as const };

describe("first-install two-question program setup", () => {
  it("has no preselected days or environment, never generates or saves on load/start", async () => {
    const { flow, services } = harness();
    await flow.load();
    expect(flow.state.started).toBe(false);
    expect(flow.state.answers.days).toBeNull();
    expect(flow.state.answers.environment).toBeNull();
    expect(flow.state.answers.experience).toBe("beginner");
    expect(flow.state.answers.goal).toBe("general");
    expect(flow.state.answers.minutes).toBe(45);

    await flow.start();
    expect(flow.state.started).toBe(true);
    expect(services.programmes.seedKeyMap).not.toHaveBeenCalled();
    expect(services.onboarding.complete).not.toHaveBeenCalled();

    await flow.build();
    expect(flow.state.preview).toBeNull();
    expect(flow.state.error).toBe("answers");
  });

  it.each(
    DAYS_OPTIONS.flatMap((days) =>
      TRAINING_ENVIRONMENTS.map((environment) => ({ days, environment })),
    ),
  )("generates complete equipment-compatible programs for $days days in $environment", async ({ days, environment }) => {
    const { flow } = harness();
    await flow.load();
    await flow.start();
    await flow.update({ days, environment });
    await flow.build();

    expect(flow.state.error).toBeNull();
    const preview = flow.state.preview;
    expect(preview).not.toBeNull();
    expect(preview!.draft.days).toHaveLength(days);
    expect(preview!.draft.days.every((d) => d.exercises.length >= 2)).toBe(true);

    const allowed = new Set(equipmentForEnvironment(environment));
    for (const day of preview!.draft.days) {
      for (const ex of day.exercises) {
        const item = library.find((l) => l.seedKey === ex.exerciseId || l.id === ex.exerciseId);
        expect(allowed.has(item?.equipment as any)).toBe(true);
      }
    }
  });

  it.each(["en", "ar"] as const)("%s previews the chosen program and saves that exact draft only on Use", async (lang) => {
    const { flow, services, done } = harness(null, lang);
    await flow.load();
    await flow.start();
    await flow.update(basicAnswers);
    await flow.build();

    const preview = flow.state.preview!;
    expect(preview.draft.days).toHaveLength(3);
    expect(preview.draft.days.every((d) => d.exercises.length > 0)).toBe(true);
    expect(services.onboarding.complete).not.toHaveBeenCalled();

    await flow.activate();
    expect(services.onboarding.complete).toHaveBeenCalledOnce();
    const input = services.onboarding.complete.mock.calls[0]![0];
    expect(input.programme).toBe(preview.draft);
    expect(input.profile).toMatchObject({ language: lang, daysPerWeek: 3, sessionMinutes: 45, equipment: ["dumbbell"], goal: null });
    expect(input.gym.loads.map((l: any) => l.equipment)).toEqual(["dumbbell"]);
    expect(done).toHaveBeenCalledOnce();
  });

  it("restores answers after restart, with no generated intermediate program", async () => {
    const { flow, services } = harness();
    await flow.load();
    await flow.start();
    await flow.update(basicAnswers);
    await flow.build();

    const raw = services.repos.setSetting.mock.calls.at(-1)![1];
    const resumed = harness(raw);
    await resumed.flow.load();
    expect(resumed.flow.state.started).toBe(true);
    expect(resumed.flow.state.answers).toEqual(flow.state.answers);
    expect(resumed.flow.state.preview).toBeNull();
    expect(resumed.services.programmes.seedKeyMap).not.toHaveBeenCalled();
    expect(resumed.services.onboarding.complete).not.toHaveBeenCalled();
  });

  it("preference changes invalidate the preview", async () => {
    const { flow } = harness();
    await flow.load();
    await flow.update(basicAnswers);
    await flow.build();
    expect(flow.state.preview).not.toBeNull();

    // Changing days invalidates preview
    await flow.update({ days: 4 });
    expect(flow.state.preview).toBeNull();

    await flow.build();
    expect(flow.state.preview).not.toBeNull();

    // Changing environment invalidates preview
    await flow.update({ environment: "gym" });
    expect(flow.state.preview).toBeNull();

    await flow.build();
    expect(flow.state.preview).not.toBeNull();

    // Changing starting default preference (e.g. goal or minutes or experience) invalidates preview
    await flow.update({ goal: "hypertrophy" });
    expect(flow.state.preview).toBeNull();

    await flow.build();
    expect(flow.state.preview).not.toBeNull();

    await flow.update({ skipLegs: true });
    expect(flow.state.preview).toBeNull();
  });

  it("ignores older in-flight generation requests when answers change", async () => {
    const { flow, services } = harness();
    await flow.load();
    await flow.update(basicAnswers);

    let resolve!: (v: typeof keys) => void;
    services.programmes.seedKeyMap.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const pending = flow.build();
    await flow.update({ days: 4 });
    resolve(keys);
    await pending;
    expect(flow.state.preview).toBeNull();
  });

  it("handles resource and save failures without dismissing the preview, and prevents double activation", async () => {
    const { flow, services, done } = harness();
    await flow.load();
    await flow.update(basicAnswers);
    services.programmes.listExercises.mockRejectedValueOnce(Error("offline"));
    await flow.build();
    expect(flow.state.error).toBe("build");
    await flow.build();
    const shown = flow.state.preview;

    services.onboarding.complete.mockRejectedValueOnce(Error("disk full"));
    await flow.activate();
    expect(flow.state.preview).toBe(shown);
    expect(flow.state.error).toBe("save");
    expect(done).not.toHaveBeenCalled();

    await Promise.all([flow.activate(), flow.activate()]);
    expect(services.onboarding.complete).toHaveBeenCalledTimes(2);
    expect(done).toHaveBeenCalledOnce();
  });

  it("retrying confirmation after an answer-write failure recovers cleanly", async () => {
    const { flow, services, done } = harness();
    await flow.load();
    services.repos.setSetting.mockRejectedValueOnce(Error("disk full"));
    await flow.update(basicAnswers);
    expect(flow.state.error).toBe("persist");
    await flow.build();
    await flow.activate();
    expect(done).toHaveBeenCalledOnce();
  });

  it("a failed restore can be retried without leaving the welcome action stuck", async () => {
    const { flow, services } = harness();
    services.repos.getSetting.mockRejectedValueOnce(Error("read failed"));
    await flow.load();
    expect(flow.state.error).toBe("restore");
    await flow.load();
    expect(flow.state.error).toBeNull();
    await flow.start();
    expect(flow.state.started).toBe(true);
  });

  it("malformed persisted answers fall back to clean empty setup with starting defaults", () => {
    for (const raw of ["{", JSON.stringify({ version: 99, started: true, answers: basicAnswers }), JSON.stringify({ version: 1, started: true, answers: { ...basicAnswers, days: 42 } })]) {
      const parsed = parseFirstSetup(raw);
      expect(parsed).toEqual(emptyFirstSetup());
    }
  });
});

describe("first setup with real SQLite repositories", () => {
  it.each(["en", "ar"] as const)("%s persists answers until confirmation and restores the exact saved exercises", async (lang) => {
    const { freshDb } = await import("./helpers");
    const services = await freshDb();
    await services.repos.seedIfNeeded();

    const flow = createFirstProgramSetup(services, () => ({ lang, unit: "kg" }), () => {}, () => {});
    await flow.load();
    await flow.start();
    await flow.update(basicAnswers);
    await flow.build();

    const draft = flow.state.preview!.draft;
    expect(await services.onboarding.getState()).toBeNull();
    expect(await services.db.get("SELECT id FROM programme WHERE is_sample=0 AND deleted_at IS NULL")).toBeNull();

    const resumed = createFirstProgramSetup(services, () => ({ lang, unit: "kg" }), () => {}, () => {});
    await resumed.load();
    expect(resumed.state.answers).toEqual(flow.state.answers);
    expect(resumed.state.preview).toBeNull();

    await flow.activate();
    expect(await services.onboarding.getState()).toBe("done");

    const active = (await services.programmes.getActive())!;
    const stored = await services.programmes.loadDraft(active.versionId);
    expect(stored).toEqual(draft);
    expect(active.isSample).toBe(false);

    const gym = await services.gyms.getGym((await services.repos.getActiveGymId())!);
    expect(gym!.loads.map((l) => l.equipment)).toEqual(["dumbbell"]);
    expect(await services.onboarding.markExistingInstall()).toBe(false);
  });
});
