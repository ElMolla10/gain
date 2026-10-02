import { findSpec } from "@gain/engine";
import { describe, expect, it } from "vitest";
import { ProfileInvalid } from "../src/db/onboardingRepo";
import { GymInvalid } from "../src/db/gymRepo";
import { DraftInvalid, SessionInProgress } from "../src/db/programmeRepo";
import { SAMPLE_EXERCISES } from "../src/db/seedData";
import { draftHasExercise, isTodayOrLater, markGoalLift, optionalNumber, parseDate, validateProfile, type Profile } from "../src/logic/onboarding";
import { instantiateTemplate, TEMPLATES } from "../src/logic/templates";
import { freshDb } from "./helpers";

const NOW = Date.UTC(2026, 9, 2, 12);
const base: Profile = {
  language: "en", units: "kg", daysPerWeek: 4, sessionMinutes: 60, equipment: ["barbell", "dumbbell", "cable", "machine"],
  goal: { kind: "lift", exerciseId: "x", targetLoad: 100, targetReps: 5, targetDate: null }, heightCm: null, bodyweightKg: null,
};
const codes = (p: Profile) => validateProfile(p, NOW).map((x) => x.code);

describe("profile validation", () => {
  it("accepts the minimum: days, length, equipment, one goal; height and bodyweight stay optional", () => {
    expect(codes(base)).toEqual([]);
  });
  it("rejects bad days, minutes and empty equipment", () => {
    expect(codes({ ...base, daysPerWeek: 0 })).toEqual(["days_bad"]);
    expect(codes({ ...base, daysPerWeek: 8 })).toEqual(["days_bad"]);
    expect(codes({ ...base, sessionMinutes: 5 })).toEqual(["minutes_bad"]);
    expect(codes({ ...base, equipment: [] })).toEqual(["no_equipment"]);
  });
  it("lift goal needs an exercise, a load and reps; the date must be real and not past", () => {
    expect(codes({ ...base, goal: { kind: "lift", exerciseId: "", targetLoad: 0, targetReps: 0, targetDate: "2026-02-30" } })).toEqual(["goal_exercise_missing", "goal_load_bad", "goal_reps_bad", "goal_date_bad"]);
    expect(codes({ ...base, goal: { kind: "lift", exerciseId: "x", targetLoad: 100, targetReps: 5, targetDate: "2026-10-01" } })).toEqual(["goal_date_bad"]);
    expect(codes({ ...base, goal: { kind: "lift", exerciseId: "x", targetLoad: 100, targetReps: 5, targetDate: "2026-10-02" } })).toEqual([]);
  });
  it("a bodyweight goal requires a current bodyweight", () => {
    const g = { kind: "bodyweight" as const, targetWeightKg: 78, targetDate: null };
    expect(codes({ ...base, goal: g })).toEqual(["bodyweight_required"]);
    expect(codes({ ...base, goal: g, bodyweightKg: 82 })).toEqual([]);
    expect(codes({ ...base, goal: { ...g, targetWeightKg: 5 }, bodyweightKg: 82 })).toEqual(["goal_weight_bad"]);
  });
  it("sanity-checks optional height and bodyweight when given", () => {
    expect(codes({ ...base, heightCm: 20 })).toEqual(["height_bad"]);
    expect(codes({ ...base, bodyweightKg: 900 })).toEqual(["bodyweight_bad"]);
    expect(codes({ ...base, heightCm: 178, bodyweightKg: 82 })).toEqual([]);
  });
  it("dates and optional numbers", () => {
    expect(parseDate("2027-06-30")).toEqual({ y: 2027, m: 6, d: 30 });
    expect(parseDate("30/06/2027")).toBeNull();
    expect(isTodayOrLater("2026-10-02", NOW)).toBe(true);
    expect(optionalNumber("")).toBeNull();
    expect(optionalNumber("82.5")).toBe(82.5);
    expect(Number.isNaN(optionalNumber("abc"))).toBe(true);
  });
  it("marks one goal lift and clears the rest", () => {
    const lib = { byKey: new Map(SAMPLE_EXERCISES.map((e) => [e.key, { exerciseId: `id-${e.key}`, equipment: e.equipment }])) };
    const { draft } = instantiateTemplate(TEMPLATES.find((t) => t.id === "ppl_3")!, lib, { lang: "en", ceilingFor: () => 10, goalLiftKey: "bench_press" });
    const moved = markGoalLift(draft, "id-back_squat");
    const flagged = moved.days.flatMap((d) => d.exercises).filter((e) => e.isGoalLift).map((e) => e.exerciseId);
    expect(flagged).toEqual(["id-back_squat"]);
    expect(draftHasExercise(moved, "id-back_squat")).toBe(true);
    expect(draftHasExercise(moved, "id-nothing")).toBe(false);
  });
});

async function setup() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const lib = await ctx.programmes.seedKeyMap();
  const sampleGym = (await ctx.repos.getActiveGymId())!;
  const sampleProg = (await ctx.programmes.getActive())!;
  const bench = lib.get("bench_press")!.exerciseId;
  const profile: Profile = { ...base, goal: { kind: "lift", exerciseId: bench, targetLoad: 100, targetReps: 5, targetDate: "2027-06-30" }, heightCm: 178, bodyweightKg: 82 };
  const { draft } = instantiateTemplate(TEMPLATES.find((t) => t.id === "upper_lower_4")!, { byKey: lib }, { lang: "en", ceilingFor: (k) => (/squat|leg|romanian|calf/.test(k) ? 12 : 10), goalLiftKey: "bench_press", equipment: profile.equipment });
  const rack = [{ equipment: "dumbbell" as const, loads: [10, 12.5, 15, 20, 22.5, 25] }, { equipment: "barbell" as const, increment: 2.5, min: 20, max: 200 }, { equipment: "cable" as const, increment: 5 }, { equipment: "machine" as const, increment: 10 }];
  return { ...ctx, lib, sampleGym, sampleProg, bench, profile, draft, rack };
}

describe("onboarding complete", () => {
  it("fresh install is not set up yet and is not mistaken for an existing one", async () => {
    const { onboarding } = await setup();
    expect(await onboarding.getState()).toBeNull();
    expect(await onboarding.markExistingInstall()).toBe(false);
  });

  it("saves the answers, the real rack and the first programme; retires the sample; plans the first session", async () => {
    const { onboarding, repos, gyms, programmes, finish, db, profile, draft, rack, sampleGym, sampleProg, bench } = await setup();
    const r = await onboarding.complete({ profile, programme: draft, gym: { name: "Club", loads: rack } });
    expect(await onboarding.getState()).toBe("done");
    // answers
    expect(await repos.getSetting("days_per_week")).toBe("4");
    expect(await repos.getSetting("session_minutes")).toBe("60");
    expect(JSON.parse((await repos.getSetting("equipment_json"))!)).toEqual(profile.equipment);
    expect(await repos.getSetting("height_cm")).toBe("178");
    const bw = await db.all<{ weight_kg: number }>("SELECT weight_kg FROM bodyweight_entry");
    expect(bw.map((x) => x.weight_kg)).toEqual([82]);
    expect(await onboarding.getGoal()).toEqual(profile.goal);
    // real rack, active
    expect(await repos.getActiveGymId()).toBe(r.gymId);
    const fp = await repos.loadGymFingerprint(r.gymId);
    expect(findSpec(fp, "dumbbell")!.loads).toEqual([10, 12.5, 15, 20, 22.5, 25]);
    // programme active, goal lift marked, sample retired
    const active = (await programmes.getActive())!;
    expect(active.programmeId).toBe(r.programmeId);
    expect(active.isSample).toBe(false);
    expect(await gyms.getGym(sampleGym)).toBeNull();
    expect(await db.get("SELECT id FROM programme WHERE id = ? AND deleted_at IS NULL", [sampleProg.programmeId])).toBeNull();
    const d = await programmes.loadDraft(active.versionId);
    expect(d.days.flatMap((x) => x.exercises).filter((e) => e.isGoalLift).map((e) => e.exerciseId)).toEqual([bench]);
    // first session planned at the new gym, with a target per exercise (no history: nothing invented)
    const planned = await db.get<{ id: string; gym_id: string }>("SELECT id, gym_id FROM session WHERE status = 'planned' AND deleted_at IS NULL");
    expect(planned!.gym_id).toBe(r.gymId);
    const targets = await finish.getTargets(planned!.id);
    expect(targets).toHaveLength(d.days[0]!.exercises.length);
    expect(targets.every((t) => t.currency === "none" && t.load === null)).toBe(true);
  });

  it("refuses a bad profile, rack or programme before writing anything", async () => {
    const { onboarding, profile, draft, rack, db, repos } = await setup();
    await expect(onboarding.complete({ profile: { ...profile, daysPerWeek: 0 }, programme: draft, gym: { name: "Club", loads: rack } })).rejects.toBeInstanceOf(ProfileInvalid);
    await expect(onboarding.complete({ profile, programme: draft, gym: { name: "", loads: rack } })).rejects.toBeInstanceOf(GymInvalid);
    await expect(onboarding.complete({ profile, programme: { name: "x", days: [] }, gym: { name: "Club", loads: rack } })).rejects.toBeInstanceOf(DraftInvalid);
    expect(await onboarding.getState()).toBeNull();
    expect(await repos.getSetting("days_per_week")).toBeNull();
    expect((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM gym WHERE is_sample = 0"))!.n).toBe(0);
    expect((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM programme WHERE is_sample = 0"))!.n).toBe(0);
  });

  it("refuses to run under an open workout, without creating a stray gym", async () => {
    const { onboarding, profile, draft, rack, db, repos, workout, sampleGym } = await setup();
    const next = (await repos.getNextDay())!;
    await workout.startOrResumeSession(next.day.id, sampleGym);
    await expect(onboarding.complete({ profile, programme: draft, gym: { name: "Club", loads: rack } })).rejects.toBeInstanceOf(SessionInProgress);
    expect((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM gym WHERE is_sample = 0"))!.n).toBe(0);
  });

  it("sample data that has real sessions on it is kept (inactive), so history never breaks", async () => {
    const { onboarding, profile, draft, rack, db, repos, workout, finish, sampleGym, sampleProg, gyms } = await setup();
    const next = (await repos.getNextDay())!;
    const { id } = await workout.startOrResumeSession(next.day.id, sampleGym);
    const ex = (await repos.listDayExercises(next.day.id))[0]!;
    const gym = await repos.loadGymFingerprint(sampleGym);
    await workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load: 40, reps: 8 }, { gym, equipment: ex.equipment, setup: ex.setup });
    await workout.finishSession(id);
    await finish.writeNextSessionTargets(id);
    await onboarding.complete({ profile, programme: draft, gym: { name: "Club", loads: rack } });
    expect(await gyms.getGym(sampleGym)).not.toBeNull();
    expect(await db.get("SELECT id FROM programme WHERE id = ? AND deleted_at IS NULL", [sampleProg.programmeId])).not.toBeNull();
    expect((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM workout_set WHERE session_id = ? AND deleted_at IS NULL", [id]))!.n).toBe(1);
    expect((await repos.getActiveGymId())).not.toBe(sampleGym);
  });

  it("an install with the lifter's own data is marked as set up instead of being pushed through onboarding", async () => {
    const { onboarding, gyms, rack } = await setup();
    await gyms.createGym({ name: "Mine", loads: rack });
    expect(await onboarding.markExistingInstall()).toBe(true);
    expect(await onboarding.getState()).toBe("skipped");
    expect(await onboarding.markExistingInstall()).toBe(false);
  });

  it("running setup again retires the earlier goal instead of keeping two", async () => {
    const { onboarding, profile, draft, rack, db } = await setup();
    await onboarding.complete({ profile, programme: draft, gym: { name: "Club", loads: rack } });
    const next: Profile = { ...profile, goal: { kind: "muscle", muscle: "back" } };
    await onboarding.complete({ profile: next, programme: { ...draft, name: "Second" }, gym: { name: "Home", loads: rack } });
    const live = await db.all("SELECT kind FROM goal WHERE deleted_at IS NULL");
    expect(live).toEqual([{ kind: "muscle" }]);
    expect((await onboarding.getGoal())).toEqual({ kind: "muscle", muscle: "back" });
  });
});
