import { beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOG } from "../src/db/libraryDraft";
import { createFirstProgramSetup, parseFirstSetup, emptyFirstSetup } from "../src/logic/firstProgramSetup";

const keys = new Map(CATALOG.map(c => [c.key, { exerciseId: c.key, equipment: c.equipment }]));
const library = CATALOG.map(c => ({ id: c.key, seedKey: c.key, nameEn: c.en, nameAr: c.ar, equipment: c.equipment }));
function harness(raw: string | null = null, lang: "en" | "ar" = "en") {
  const services = {
    repos: { getSetting: vi.fn().mockResolvedValue(raw), setSetting: vi.fn().mockResolvedValue(undefined), getRepCeilingDefaults: vi.fn().mockResolvedValue({ upper: 10, lower: 12, lateral_raise: 15 }) },
    programmes: { seedKeyMap: vi.fn().mockResolvedValue(keys), listExercises: vi.fn().mockResolvedValue(library) },
    onboarding: { complete: vi.fn().mockResolvedValue({ programmeId: "new", gymId: "gym" }) },
  };
  const changed = vi.fn(), done = vi.fn();
  const flow = createFirstProgramSetup(services as any, () => ({ lang, unit: "kg" }), changed, done);
  return { flow, services, done };
}
const answers = { goal: "general" as const, experience: "beginner" as const, days: 3, minutes: 45, equipment: ["dumbbell" as const] };
describe("first-install program setup", () => {
  it("has no guessed training answers, never generates or saves on load/start", async () => {
    const { flow, services } = harness(); await flow.load(); expect(flow.state.started).toBe(false); expect(flow.state.answers).toEqual(emptyFirstSetup().answers);
    await flow.start(); expect(flow.state.started).toBe(true); expect(services.programmes.seedKeyMap).not.toHaveBeenCalled(); expect(services.onboarding.complete).not.toHaveBeenCalled();
    await flow.build(); expect(flow.state.preview).toBeNull(); expect(flow.state.error).toBe("answers");
  });
  it.each(["en", "ar"] as const)("%s previews the chosen beginner program and saves that exact draft only on Use", async lang => {
    const { flow, services, done } = harness(null, lang); await flow.load(); await flow.start(); await flow.update(answers); await flow.build();
    const preview = flow.state.preview!; expect(preview.draft.days).toHaveLength(3); expect(preview.draft.days.every(d => d.exercises.length > 0)).toBe(true); expect(services.onboarding.complete).not.toHaveBeenCalled();
    await flow.activate(); expect(services.onboarding.complete).toHaveBeenCalledOnce(); const input = services.onboarding.complete.mock.calls[0]![0];
    expect(input.programme).toBe(preview.draft); expect(input.profile).toMatchObject({ language: lang, daysPerWeek: 3, sessionMinutes: 45, equipment: ["dumbbell"], goal: null }); expect(input.gym.loads.map((l: any) => l.equipment)).toEqual(["dumbbell"]); expect(done).toHaveBeenCalledOnce();
  });
  it("restores answers after restart, with no generated intermediate program", async () => {
    const { flow, services } = harness(); await flow.load(); await flow.start(); await flow.update(answers); await flow.build();
    const raw = services.repos.setSetting.mock.calls.at(-1)![1]; const resumed = harness(raw); await resumed.flow.load(); expect(resumed.flow.state.started).toBe(true); expect(resumed.flow.state.answers).toEqual(flow.state.answers); expect(resumed.flow.state.preview).toBeNull(); expect(resumed.services.programmes.seedKeyMap).not.toHaveBeenCalled(); expect(resumed.services.onboarding.complete).not.toHaveBeenCalled();
  });
  it("clears previews on answers changing and ignores an older in-flight generation", async () => {
    const { flow, services } = harness(); await flow.load(); await flow.update(answers); await flow.build(); await flow.update({ days: 4 }); expect(flow.state.preview).toBeNull();
    let resolve!: (v: typeof keys) => void; services.programmes.seedKeyMap.mockReturnValueOnce(new Promise(r => resolve = r)); const pending = flow.build(); await flow.update({ minutes: 60 }); resolve(keys); await pending; expect(flow.state.preview).toBeNull();
  });
  it("does not use full gym as a fallback for an empty equipment selection", async () => {
    const { flow, services } = harness(); await flow.load(); await flow.update({ ...answers, equipment: [] }); await flow.build(); expect(flow.state.error).toBe("answers"); expect(services.programmes.seedKeyMap).not.toHaveBeenCalled();
  });
  it("handles resource and save failures without dismissing the preview, and prevents double activation", async () => {
    const { flow, services, done } = harness(); await flow.load(); await flow.update(answers); services.programmes.listExercises.mockRejectedValueOnce(Error("offline")); await flow.build(); expect(flow.state.error).toBe("build"); await flow.build(); const shown = flow.state.preview;
    services.onboarding.complete.mockRejectedValueOnce(Error("disk full")); await flow.activate(); expect(flow.state.preview).toBe(shown); expect(done).not.toHaveBeenCalled();
    await Promise.all([flow.activate(), flow.activate()]); expect(services.onboarding.complete).toHaveBeenCalledTimes(2); expect(done).toHaveBeenCalledOnce();
  });
  it("retrying confirmation after an answer-write failure can recover without changing answers", async () => {
    const { flow, services, done } = harness();
    await flow.load();
    services.repos.setSetting.mockRejectedValueOnce(Error("disk full"));
    await flow.update(answers);
    expect(flow.state.error).toBe("persist");
    await flow.build();
    await flow.activate();
    expect(done).toHaveBeenCalledOnce();
  });
  it("a failed restore can be retried without leaving the welcome action stuck", async () => {
    const { flow, services } = harness(); services.repos.getSetting.mockRejectedValueOnce(Error("read failed")); await flow.load(); expect(flow.state.error).toBe("restore"); await flow.load(); expect(flow.state.error).toBeNull(); await flow.start(); expect(flow.state.started).toBe(true);
  });
  it("malformed or unsupported persisted answers cannot activate a hidden program", () => {
    for (const raw of ["{", JSON.stringify({ version: 99, started: true, answers }), JSON.stringify({ version: 1, started: true, answers: { ...answers, days: 42 } })]) {
      const parsed = parseFirstSetup(raw); expect(parsed).toEqual(emptyFirstSetup());
    }
  });
});

describe("first setup with real SQLite repositories", () => {
  it.each(["en", "ar"] as const)("%s persists only answers until confirmation and restores the exact saved exercises", async lang => {
    const { freshDb } = await import("./helpers"); const services = await freshDb(); await services.repos.seedIfNeeded();
    const flow = createFirstProgramSetup(services, () => ({ lang, unit: "kg" }), () => { }, () => { });
    await flow.load(); await flow.start(); await flow.update(answers); await flow.build();
    const draft = flow.state.preview!.draft;
    expect(await services.onboarding.getState()).toBeNull();
    expect(await services.db.get("SELECT id FROM programme WHERE is_sample=0 AND deleted_at IS NULL")).toBeNull();
    const resumed = createFirstProgramSetup(services, () => ({ lang, unit: "kg" }), () => { }, () => { }); await resumed.load(); expect(resumed.state.answers).toEqual(flow.state.answers); expect(resumed.state.preview).toBeNull();
    await flow.activate(); expect(await services.onboarding.getState()).toBe("done");
    const active = (await services.programmes.getActive())!; const stored = await services.programmes.loadDraft(active.versionId);
    expect(stored).toEqual(draft); expect(active.isSample).toBe(false);
    expect((await services.gyms.getGym((await services.repos.getActiveGymId())!))!.loads.map(l => l.equipment)).toEqual(["dumbbell"]);
    expect(await services.onboarding.markExistingInstall()).toBe(false);
  });
});
