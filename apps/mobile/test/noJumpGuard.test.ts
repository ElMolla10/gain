import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ar, en } from "../src/i18n/strings";
import { topTrustedSet } from "../src/logic/lastTop";
import { freshDb } from "./helpers";

const src = (f: string) => readFileSync(join(__dirname, "..", "src", f), "utf8");

describe("big-jump confirmation removed: ticking logs the set directly", () => {
  it("logging a set more than 10% above last session saves it as typed (15 kg -> 20 kg, +33%)", async () => {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    const gymId = (await ctx.repos.getActiveGymId())!;
    const gym = await ctx.repos.loadGymFingerprint(gymId);
    const day = (await ctx.repos.getNextDay())!.day;
    const ex = (await ctx.repos.listDayExercises(day.id))[0]!;
    const dctx = { gym, equipment: ex.equipment, setup: ex.setup };
    const first = await ctx.workout.startOrResumeSession(day.id, gymId);
    await ctx.workout.logSet({ sessionId: first.id, exerciseId: ex.exerciseId, load: 15, reps: 8 }, dctx);
    ctx.deps.tick(1000);
    await ctx.workout.finishSession(first.id);
    ctx.deps.tick(3 * 86_400_000);
    const second = await ctx.workout.startOrResumeSession(day.id, gymId);
    expect(second.id).not.toBe(first.id);
    const r = await ctx.workout.logSet({ sessionId: second.id, exerciseId: ex.exerciseId, load: 20, reps: 8 }, dctx);
    const rows = await ctx.db.all<{ load: number; reps: number }>("SELECT load, reps FROM workout_set WHERE id = ?", [r.id]);
    expect(rows).toEqual([{ load: 20, reps: 8 }]);
  });
  it("the logger's tick goes straight to saving: no jump check, no confirmation sheet", () => {
    const hook = src("hooks/useWorkoutSession.ts");
    const logRow = hook.slice(hook.indexOf("async function logRow("), hook.indexOf("workout.logSet(", hook.indexOf("async function logRow(")));
    expect(logRow).not.toMatch(/checkJump|jumpAsk|setJumpAsk|okJumps|isAcceptedTarget|jumpThreshold/);
    expect(hook).not.toMatch(/jumpGuard|jump_confirm_pct|JUMP_SETTING_KEY/);
    expect(src("components/WorkoutSessionSheets.tsx")).not.toMatch(/jumpAsk|jump\.title|jumpOptions/);
    expect(existsSync(join(__dirname, "..", "src", "logic", "jumpGuard.ts"))).toBe(false);
  });
  it("the sheet's strings are gone in both languages", () => {
    for (const k of ["jump.title", "jump.anyway", "jump.repeat", "jump.reps", "jump.micro"]) {
      expect((en as Record<string, string>)[k]).toBeUndefined();
      expect((ar as Record<string, string>)[k]).toBeUndefined();
    }
  });
});

describe("9 the prefill fallback uses the heaviest TRUSTED set (kept from the removed jump guard)", () => {
  const set = (load: number, extra: Record<string, unknown> = {}) => ({ load, reps: 8, warmup: false, ...extra }) as import("@gain/engine").LoggedSet;
  it("ignores unconfirmed, rejected, warm-up and drop sets", () => {
    const top = topTrustedSet([set(80), set(200, { outlierStatus: "unconfirmed" }), set(190, { outlierStatus: "rejected" }), set(100, { warmup: true }), set(95, { tags: ["drop"] }), set(82.5, { outlierStatus: "confirmed" })]);
    expect(top?.load).toBe(82.5);
  });
  it("returns null when nothing is trusted", () => {
    expect(topTrustedSet([set(200, { outlierStatus: "unconfirmed" }), set(60, { warmup: true })])).toBeNull();
    expect(topTrustedSet([])).toBeNull();
    expect(topTrustedSet(null)).toBeNull();
    expect(topTrustedSet(undefined)).toBeNull();
  });
  it("the logger uses it for the prefill fallback", () => {
    expect(src("hooks/useWorkoutSession.ts").match(/topTrustedSet\(/g)).toHaveLength(1);
  });
});
