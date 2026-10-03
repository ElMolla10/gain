import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { attemptFinish, runLoad } from "../src/logic/loadState";
import { ar, en } from "../src/i18n/strings";
import { freshDb } from "./helpers";

const src = (f: string) => readFileSync(join(__dirname, "..", "src", f), "utf8");

describe("P12 loading / empty / error are different states", () => {
  it("runLoad: value is ready, null is empty, a throw is error (never empty)", async () => {
    expect(await runLoad(async () => 5)).toEqual({ kind: "ready", data: 5 });
    expect(await runLoad(async () => null)).toEqual({ kind: "empty" });
    const seen = vi.fn();
    expect(await runLoad(async () => Promise.reject(new Error("db")), seen)).toEqual({ kind: "error" });
    expect(seen).toHaveBeenCalledOnce();
  });
  it("Today uses the three states and offers a retry; a failed read is no longer shown as 'no programme'", () => {
    const today = src("screens/TodayScreen.tsx");
    expect(today).toContain("runLoad");
    expect(today).toContain('state.kind === "error"');
    expect(today).toContain('t("today.error.retry")');
    expect(today).not.toContain("setData(null)");
  });
  it("the strings exist in both languages", () => {
    for (const k of ["today.error.title", "today.error.body", "today.error.retry", "workout.finishFailed.title", "workout.finishFailed.body", "workout.finishFailed.retry", "workout.loadError.title", "finish.error.title"] as const) {
      expect(en[k].length).toBeGreaterThan(5);
      expect(ar[k]).toMatch(/[\u0600-\u06FF]/);
    }
  });
});

describe("P12 finishing a workout fails safely", () => {
  it("attemptFinish never throws: a failure returns 'failed' and does not navigate", async () => {
    const go = vi.fn();
    const err = vi.fn();
    await expect(attemptFinish(async () => Promise.reject(new Error("disk full")), go, err)).resolves.toBe("failed");
    expect(go).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalledOnce();
    await expect(attemptFinish(async () => undefined, go)).resolves.toBe("done");
    expect(go).toHaveBeenCalledOnce();
  });
  it("a retry after a failed finish works and the active workout kept its sets in between", async () => {
    const { repos, workout } = await freshDb();
    await repos.seedIfNeeded();
    const gymId = (await repos.getActiveGymId())!;
    const gym = await repos.loadGymFingerprint(gymId);
    const day = (await repos.getNextDay())!.day;
    const ex = (await repos.listDayExercises(day.id))[0]!;
    const { id } = await workout.startOrResumeSession(day.id, gymId);
    await workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load: 60, reps: 8 }, { gym, equipment: ex.equipment, setup: ex.setup });
    let fail = true;
    const flaky = async () => {
      if (fail) throw new Error("SQLITE_FULL");
      await workout.finishSession(id);
    };
    expect(await attemptFinish(flaky, () => undefined)).toBe("failed");
    expect((await workout.getSession(id))!.status).toBe("in_progress"); // still the active workout
    expect(await workout.getOpenSession()).toMatchObject({ id });
    expect(await workout.listSessionSets(id)).toHaveLength(1);
    fail = false;
    expect(await attemptFinish(flaky, () => undefined)).toBe("done");
    expect((await workout.getSession(id))!.status).toBe("finished");
  });
  it("the workout screen no longer rethrows from the finish handler and shows a retry", () => {
    const w = src("screens/WorkoutScreen.tsx");
    const f = w.slice(w.indexOf("async function doFinish"), w.indexOf("async function doDiscard"));
    expect(f).not.toContain("throw");
    expect(f).toContain("attemptFinish");
    expect(w).toContain('t("workout.finishFailed.retry")');
  });
});
