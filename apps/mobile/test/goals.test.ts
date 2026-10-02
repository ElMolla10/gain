import { readFileSync } from "node:fs";
import { join } from "node:path";
import { epley, parseImport } from "@gain/engine";
import { describe, expect, it } from "vitest";
import { describePace } from "../src/logic/paceText";
import { buildGoal, emptyGoalForm, parseWeighIn } from "../src/logic/goalForm";
import { parseNumber } from "../src/logic/gymInput";
import { unitToKg, kgToUnit } from "../src/logic/units";
import { translate } from "../src/i18n/format";
import { formatLoad } from "../src/i18n/format";
import type { StringKey } from "../src/i18n/strings";
import { freshDb } from "./helpers";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 2, 12);

async function setup() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const gymId = (await ctx.repos.getActiveGymId())!;
  const lib = await ctx.programmes.listExercises();
  const bench = lib.find((e) => e.seedKey === "bench_press")!;
  const squat = lib.find((e) => e.seedKey === "squat" || /squat/i.test(e.nameEn))!;
  const day = (await ctx.db.get<{ id: string; programme_version_id: string }>("SELECT id, programme_version_id FROM programme_day LIMIT 1"))!;
  await ctx.db.run("INSERT OR IGNORE INTO exercise_line (id, exercise_id, gym_id, setup, created_at, updated_at) VALUES ('line-bench', ?, ?, 'free', 1, 1)", [bench.id, gymId]);
  const lineId = (await ctx.db.get<{ id: string }>("SELECT id FROM exercise_line WHERE exercise_id = ? AND gym_id = ? AND setup = 'free'", [bench.id, gymId]))!.id;
  let n = 0;
  /** A finished session at `at` with working sets (load, reps, extra columns). */
  async function session(at: number, sets: { load: number; reps: number; warmup?: boolean; outlier?: string; exerciseId?: string }[], status = "finished") {
    const sid = `s${++n}`;
    // The unique "one open session per day" index only covers planned/in-progress, so many finished sessions can share the day.
    await ctx.db.run("INSERT INTO session (id, programme_version_id, programme_day_id, gym_id, status, started_at, finished_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)", [sid, day.programme_version_id, day.id, gymId, status, at, at]);
    let pos = 0;
    for (const s of sets)
      await ctx.db.run(
        "INSERT INTO workout_set (id, session_id, exercise_id, line_id, position, load, reps, is_warmup, outlier_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)",
        [`${sid}-${pos}`, sid, s.exerciseId ?? bench.id, lineId, pos++, s.load, s.reps, s.warmup ? 1 : 0, s.outlier ?? "none"],
      );
  }
  return { ...ctx, gymId, bench, squat, session };
}

describe("goal storage", () => {
  it("one goal at a time: a new goal retires the old one; clear removes it", async () => {
    const { goals, bench } = await setup();
    expect(await goals.getGoal()).toBeNull();
    await goals.setGoal({ kind: "lift", exerciseId: bench.id, targetLoad: 100, targetReps: 5, targetDate: "2027-01-01" });
    expect(await goals.getGoal()).toEqual({ kind: "lift", exerciseId: bench.id, targetLoad: 100, targetReps: 5, targetDate: "2027-01-01" });
    await goals.setGoal({ kind: "bodyweight", targetWeightKg: 80, targetDate: null });
    expect(await goals.getGoal()).toEqual({ kind: "bodyweight", targetWeightKg: 80, targetDate: null });
    await goals.setGoal({ kind: "muscle", muscle: "back" });
    expect(await goals.getGoal()).toEqual({ kind: "muscle", muscle: "back" });
    await goals.clearGoal();
    expect(await goals.getGoal()).toBeNull();
    expect(await goals.getPace(NOW)).toEqual({ kind: "none" });
  });
});

describe("weigh-ins", () => {
  it("are saved in kg, listed newest first, soft-deleted, and refuse nonsense", async () => {
    const { goals, db, repos } = await setup();
    await goals.addWeighIn(82, NOW - 2 * DAY);
    await goals.addWeighIn(81.5, NOW);
    expect((await goals.listWeighIns()).map((w) => w.kg)).toEqual([81.5, 82]);
    expect(await repos.getSetting("bodyweight_kg")).toBe("81.5");
    await expect(goals.addWeighIn(5)).rejects.toThrow();
    const [first] = await goals.listWeighIns();
    await goals.deleteWeighIn(first!.id);
    expect((await goals.listWeighIns()).map((w) => w.kg)).toEqual([82]);
    expect(Number((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM bodyweight_entry"))!.n)).toBe(2); // soft delete: the row stays
  });
  it("typed weigh-ins convert from the lifter's unit and check the range", () => {
    expect(parseWeighIn("82.5", "kg", unitToKg, parseNumber)).toBe(82.5);
    expect(parseWeighIn("180", "lb", unitToKg, parseNumber)).toBeCloseTo(81.647, 3);
    expect(parseWeighIn("20", "kg", unitToKg, parseNumber)).toBeNull();
    expect(parseWeighIn("abc", "kg", unitToKg, parseNumber)).toBeNull();
    expect(parseWeighIn("700", "lb", unitToKg, parseNumber)).toBeNull(); // 317 kg
  });
});

describe("lift exposures and pace from the database", () => {
  it("takes the best working set per finished session and ignores warm-ups, unconfirmed/rejected sets, reps over 12 and unfinished sessions", async () => {
    const { goals, bench, session } = await setup();
    await session(NOW - 10 * DAY, [{ load: 60, reps: 10, warmup: true }, { load: 80, reps: 5 }, { load: 75, reps: 8 }]);
    await session(NOW - 6 * DAY, [{ load: 200, reps: 5, outlier: "unconfirmed" }, { load: 85, reps: 5 }]);
    await session(NOW - 3 * DAY, [{ load: 100, reps: 20 }, { load: 70, reps: 12 }]);
    await session(NOW - 1 * DAY, [{ load: 90, reps: 5 }], "in_progress");
    const ex = await goals.liftExposures(bench.id);
    expect(ex.map((e) => Math.round(e.e1rm * 100) / 100)).toEqual([
      Math.round(Math.max(epley(80, 5), epley(75, 8)) * 100) / 100, // 94.67 vs 95: the 75 x 8 set
      Math.round(epley(85, 5) * 100) / 100,
      Math.round(epley(70, 12) * 100) / 100,
    ]);
    expect(ex[0]!.e1rm).toBeCloseTo(95, 5);
    expect(ex.map((e) => e.at)).toEqual([NOW - 10 * DAY, NOW - 6 * DAY, NOW - 3 * DAY]);
  });

  it("a lift goal reads the logs: thin first, then on pace when the logs say so", async () => {
    const { goals, bench, session } = await setup();
    await goals.setGoal({ kind: "lift", exerciseId: bench.id, targetLoad: 100, targetReps: 5, targetDate: null });
    let r = await goals.getPace(NOW);
    expect(r).toMatchObject({ kind: "lift", pace: { status: "too_thin", thin: "no_history" } });
    // Four sessions, weekly, 80 x 5 -> 82.5 x 5 -> 85 x 5 -> 87.5 x 5
    for (let i = 0; i < 4; i++) await session(NOW - (21 - i * 7) * DAY, [{ load: 80 + i * 2.5, reps: 5 }]);
    r = await goals.getPace(NOW);
    if (r.kind !== "lift") throw new Error("expected lift");
    expect(r.pace.exposures).toBe(4);
    expect(r.pace.exposuresPerWeek).toBe(1);
    expect(r.pace.currentE1rm).toBe(Math.round(epley(85, 5) * 100) / 100); // median of the last three: 82.5, 85, 87.5 x 5 -> 85 x 5
    expect(r.pace.ratePerExposure).toBeCloseTo((epley(87.5, 5) - epley(80, 5)) / 3, 2);
    expect(r.pace.status).toBe("on_pace"); // no date: moving up
    expect(r.pace.projectedDate).not.toBeNull();
  });

  it("describes the result in words: the numbers it used, the unit, the date", async () => {
    const { goals, bench, session } = await setup();
    await goals.setGoal({ kind: "lift", exerciseId: bench.id, targetLoad: 100, targetReps: 5, targetDate: "2027-06-30" });
    for (let i = 0; i < 4; i++) await session(NOW - (21 - i * 7) * DAY, [{ load: 80 + i * 2.5, reps: 5 }]);
    const r = await goals.getPace(NOW);
    const bidi = (s: string) => s.replace(/[\u2066-\u2069]/g, "");
    const tr = (k: StringKey, p?: Record<string, string | number>) => bidi(translate("en", k, p));
    const txt = describePace(r, { t: tr, fmt: (kg) => formatLoad(kg, "en", "kg"), exerciseName: "Bench Press", muscleName: (m) => m });
    expect(txt.headline).toBe("Bench Press 100 kg x 5: ahead of pace");
    expect(txt.details.some((d) => d.startsWith("Now: estimated one-rep max 99.17 kg"))).toBe(true);
    expect(txt.details.some((d) => d.startsWith("Needed to hit the date"))).toBe(true);
    expect(txt.details.at(-1)).toBe("Target date: 2027-06-30");
    const lb = describePace(r, { t: tr, fmt: (kg) => formatLoad(kg, "en", "lb"), exerciseName: "Bench Press", muscleName: (m) => m });
    expect(lb.headline).toBe(`Bench Press ${kgToUnit(100, "lb")} lb x 5: ahead of pace`);
    const ar = describePace(r, { t: (k, p) => translate("ar", k, p), fmt: (kg) => formatLoad(kg, "ar", "kg"), exerciseName: "بنش", muscleName: (m) => m });
    expect(ar.headline).toContain("بنش");
    expect(ar.short).not.toContain("{");
  });
});

describe("bodyweight and muscle goals from the database", () => {
  it("bodyweight: a heavy day does not flip the answer; goal text is honest while thin", async () => {
    const { goals } = await setup();
    await goals.setGoal({ kind: "bodyweight", targetWeightKg: 80, targetDate: "2026-12-01" });
    expect(await goals.getPace(NOW)).toMatchObject({ kind: "bodyweight", pace: { status: "too_thin", thin: "no_entries" } });
    for (let d = -27; d <= 0; d++) await goals.addWeighIn(Math.round((83 - 0.1 * d) * 10) / 10 + (d === -2 ? 3 : 0), NOW + d * DAY);
    const r = await goals.getPace(NOW);
    if (r.kind !== "bodyweight") throw new Error("x");
    expect(r.pace.trendKg).toBe(83.4);
    expect(r.pace.status).toBe("ahead");
  });
  it("muscle: counts finished sessions that trained it", async () => {
    const { goals, session } = await setup();
    await goals.setGoal({ kind: "muscle", muscle: "chest" });
    // 9 chest sessions in 28 days (bench is chest) -> 8 intervals over 28 days = 2.0 a week
    for (let i = 0; i <= 8; i++) await session(NOW - (28 - i * 3.5) * DAY, [{ load: 80, reps: 5 }]);
    const r = await goals.getPace(NOW);
    if (r.kind !== "muscle") throw new Error("x");
    expect(r.pace.status).toBe("on_pace");
    expect(r.pace.sessionsPerWeek).toBe(2);
  });
});

describe("goal form", () => {
  const f = { ...emptyGoalForm(), kind: "lift" as const, exerciseId: "x", loadText: "100", repsText: "5", dateText: "" };
  it("builds a goal in kg from the lifter's unit and reuses the onboarding rules", () => {
    expect(buildGoal(f, "kg", NOW).goal).toEqual({ kind: "lift", exerciseId: "x", targetLoad: 100, targetReps: 5, targetDate: null });
    expect(buildGoal({ ...f, loadText: "225" }, "lb", NOW).goal).toMatchObject({ targetLoad: 102.058 });
    expect(buildGoal({ ...f, exerciseId: null, repsText: "0", dateText: "2020-01-01" }, "kg", NOW).problems).toEqual(["goal_exercise_missing", "goal_reps_bad", "goal_date_bad"]);
    expect(buildGoal(emptyGoalForm(), "kg", NOW)).toEqual({ goal: null, problems: ["goal_missing"] });
    expect(buildGoal({ ...emptyGoalForm(), kind: "bodyweight", weightText: "78" }, "kg", NOW).goal).toEqual({ kind: "bodyweight", targetWeightKg: 78, targetDate: null });
    expect(buildGoal({ ...emptyGoalForm(), kind: "bodyweight", weightText: "5" }, "kg", NOW).problems).toEqual(["goal_weight_bad"]);
    expect(buildGoal({ ...emptyGoalForm(), kind: "muscle" }, "kg", NOW).problems).toEqual(["goal_muscle_missing"]);
  });
});

describe("replay of the real Hevy history", () => {
  it("computes a pace for the lifts in Mohamed's export without inventing anything", async () => {
    const ctx = await setup();
    const hevy = parseImport(readFileSync(join(__dirname, "../../../fixtures/hevy-export.csv"), "utf8"));
    const p = await ctx.imports.preview(hevy);
    const mappings: Record<string, never> = {} as never;
    for (const t of p.titles) {
      const s = t.suggestion;
      (mappings as Record<string, unknown>)[t.title] = s.kind === "new" ? { kind: "new", nameEn: s.nameEn, pattern: s.pattern, equipment: s.equipment ?? "cable", setup: s.setup ?? "free" } : { kind: "existing", exerciseId: s.exerciseId };
    }
    await ctx.imports.importHistory({ parse: hevy, gymId: ctx.gymId, mappings, fileName: "hevy-export.csv" });
    const last = (await ctx.db.get<{ t: number }>("SELECT MAX(finished_at) AS t FROM session WHERE status = 'finished'"))!.t;
    const lib = await ctx.programmes.listExercises();
    const bench = lib.find((e) => e.seedKey === "bench_press")!;
    const exposures = await ctx.goals.liftExposures(bench.id);
    expect(exposures.length).toBeGreaterThan(5);
    const best = Math.max(...exposures.map((e) => e.e1rm));
    // A target 10% above his best estimate, no date: a real history must give a number-backed answer, not "too thin".
    await ctx.goals.setGoal({ kind: "lift", exerciseId: bench.id, targetLoad: Math.round(best * 1.1), targetReps: 1, targetDate: null });
    const r = await ctx.goals.getPace(last + DAY);
    if (r.kind !== "lift") throw new Error("x");
    expect(r.pace.status).not.toBe("too_thin");
    expect(r.pace.exposures).toBe(exposures.length);
    expect(r.pace.currentE1rm).not.toBeNull();
    console.log("HEVY REPLAY bench:", JSON.stringify(r.pace));
  });
});
