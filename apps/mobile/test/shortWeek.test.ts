import { describe, expect, it } from "vitest";
import { groupOfPattern } from "../src/logic/exposure";
import { newExercise, validateDraft, type ProgrammeDraft } from "../src/logic/programmeDraft";
import { FLOOR_SETS, MIN_GOAL_SETS, rebuildShortWeek, type Rebuild } from "../src/logic/shortWeek";
import { estimateSessionMinutes, instantiateTemplate, TEMPLATES } from "../src/logic/templates";
import { freshDb } from "./helpers";

const pat: Record<string, string> = { bench: "horizontal_push", row: "horizontal_pull", curl: "elbow_flexion", press: "vertical_push", squat: "squat", rdl: "hinge", tri: "elbow_extension", calf: "calf", lat: "vertical_pull", row2: "horizontal_pull" };
const patternOf = (id: string) => pat[id];
const ex = (id: string, sets = 3, goal = false) => newExercise(id, { sets, isGoalLift: goal });
const draft = (days: [string, ReturnType<typeof ex>[]][]): ProgrammeDraft => ({ name: "P", days: days.map(([name, exercises]) => ({ name, exercises })) });
const ok = (r: Rebuild | string): Rebuild => {
  if (typeof r === "string") throw new Error(r);
  return r;
};
const ids = (r: Rebuild) => r.draft.days.map((d) => d.exercises.map((e) => e.exerciseId));

describe("rebuildShortWeek by hand", () => {
  // Upper (bench goal, row, curl, tri), Lower (squat goal, rdl, calf), Pull (lat, curl)
  const p = draft([
    ["Upper", [ex("bench", 3, true), ex("row"), ex("curl", 2), ex("tri", 2)]],
    ["Lower", [ex("squat", 3, true), ex("rdl"), ex("calf", 2)]],
    ["Pull", [ex("lat"), ex("curl", 2)]],
  ]);

  it("refuses impossible asks", () => {
    expect(rebuildShortWeek(p, { days: 0, minutes: null, patternOf })).toBe("days_bad");
    expect(rebuildShortWeek(p, { days: 4, minutes: null, patternOf })).toBe("days_bad");
    expect(rebuildShortWeek(p, { days: 2, minutes: 5, patternOf })).toBe("minutes_bad");
    expect(rebuildShortWeek({ name: "x", days: [] }, { days: 1, minutes: null, patternOf })).toBe("empty");
  });

  it("all days and no time limit changes nothing", () => {
    const r = ok(rebuildShortWeek(p, { days: 3, minutes: null, patternOf }));
    expect(r.cuts).toEqual([]);
    expect(r.draft.days).toEqual(p.days);
  });

  it("2 days: keeps the days with goal lifts, moves nothing that is already kept, and lists the dropped day", () => {
    const r = ok(rebuildShortWeek(p, { days: 2, minutes: null, patternOf }));
    expect(r.draft.days.map((d) => d.name)).toEqual(["Upper", "Lower"]);
    expect(r.cuts.filter((c) => c.kind === "day_dropped")).toEqual([{ kind: "day_dropped", day: "Pull", reason: "days" }]);
    // Pull's accessories are cut: lat (back) is not a priority group (goal lifts are chest and quads), curl is not either
    expect(r.cuts.filter((c) => c.kind === "exercise_removed").map((c) => c.exerciseId).sort()).toEqual(["curl", "lat"]);
    expect(validateDraft(r.draft)).toEqual([]);
  });

  it("1 day: the second goal lift moves to the kept day instead of vanishing with its day", () => {
    const r = ok(rebuildShortWeek(p, { days: 1, minutes: null, patternOf }));
    expect(r.draft.days).toHaveLength(1);
    const kept = r.draft.days[0]!.exercises.map((e) => e.exerciseId);
    expect(kept).toContain("bench");
    expect(kept).toContain("squat");
    expect(r.cuts.some((c) => c.kind === "moved" && c.exerciseId === "squat" && c.toDay === "Upper")).toBe(true);
  });

  it("time budget: accessories of other muscles go first, from the end of the day; goal lifts stay", () => {
    // Upper is 3+3+2+2 = 10 sets = 30 min. Budget 21 min = 7 sets.
    const r = ok(rebuildShortWeek(p, { days: 3, minutes: 21, patternOf }));
    const upper = r.draft.days[0]!;
    expect(upper.exercises.map((e) => e.exerciseId)).toEqual(["bench", "row"]); // curl, tri (arms) removed from the end; chest and back kept
    expect(r.minutes[0]).toBeLessThanOrEqual(21);
    expect(r.cuts.filter((c) => c.day === "Upper").map((c) => [c.kind, c.exerciseId, c.reason])).toEqual([["exercise_removed", "tri", "time"], ["exercise_removed", "curl", "time"]]);
  });

  it("when only goal lifts are left it trims their sets last, never below 3", () => {
    const only = draft([["A", [ex("bench", 5, true), ex("row", 3)]]]);
    const r = ok(rebuildShortWeek(only, { days: 1, minutes: 14, patternOf })); // bench alone: 4 sets = 14 min (5 sets = 16)
    expect(r.draft.days[0]!.exercises.map((e) => e.exerciseId)).toEqual(["bench"]); // the row went first
    expect(r.draft.days[0]!.exercises[0]!.sets).toBe(4);
    expect(r.overBudget).toBe(false);
    expect(r.cuts.map((c) => [c.kind, c.exerciseId, c.fromSets, c.toSets])).toEqual([["exercise_removed", "row", 3, undefined], ["sets_reduced", "bench", 5, 4]]);
  });

  it("two goal lifts that cannot fit stay at 3 sets each and the result is flagged over budget, not cut", () => {
    const two = draft([["A", [ex("bench", 4, true), ex("squat", 4, true)]]]);
    const r = ok(rebuildShortWeek(two, { days: 1, minutes: 10, patternOf }));
    expect(r.draft.days[0]!.exercises.map((e) => [e.exerciseId, e.sets])).toEqual([["bench", 3], ["squat", 3]]);
    expect(r.overBudget).toBe(true);
  });

  it("priority muscle floor: the goal's muscle keeps its exposure on a dropped day", () => {
    // chest goal lift on Upper; Chest B day also trains chest. Drop to 1 day: the second chest exercise must move to keep the floor of min(orig, 6) sets.
    const q = draft([["Upper", [ex("bench", 3, true), ex("row", 3)]], ["Chest B", [ex("press", 1), ex("curl", 2)]], ["Chest C", [ex("squat", 3)]]]);
    const r = ok(rebuildShortWeek(q, { days: 1, minutes: null, patternOf, extraPriority: ["quads"] }));
    const kept = r.draft.days[0]!.exercises.map((e) => e.exerciseId);
    expect(kept).toContain("squat"); // quads is a priority muscle (a muscle goal): 3 sets, floor min(3, 6) = 3
    expect(r.floorMissed).toEqual([]);
  });
});

describe("a priority floor that cannot be met does not push the cuts onto the goal lift", () => {
  it("1 kept day, back is the goal muscle on 2 days: the 2-session floor is unmet from the start, accessories still go before goal sets", () => {
    const p = draft([
      ["A", [ex("lat", 4, true), ex("row", 3), ex("curl", 3), ex("tri", 3)]],
      ["B", [ex("row2", 3), ex("press", 3)]],
    ]);
    const r = ok(rebuildShortWeek(p, { days: 1, minutes: 27, patternOf }));
    const kept = r.draft.days[0]!.exercises;
    expect(kept.find((e) => e.exerciseId === "lat")!.sets).toBe(4); // goal lift untouched
    expect(r.overBudget).toBe(false);
    expect(r.minutes[0]!).toBeLessThanOrEqual(27);
    expect(kept.map((e) => e.exerciseId).sort()).toEqual(["lat", "row", "row2"]); // non-priority work went first
    // The unmet floor is not made worse: at least the original 6 sets of back remain.
    expect(kept.filter((e) => e.exerciseId !== "curl").reduce((n, e) => n + e.sets, 0)).toBeGreaterThanOrEqual(6);
    expect(r.floorMissed).toContain("back"); // and it is still reported as missed (2 sessions are impossible on 1 day)
  });
});

describe("rebuildShortWeek over all templates", () => {
  it("never cuts a goal lift before an accessory, keeps floors, lists every cut, and hits the budget when it can", async () => {
    const { programmes } = await freshDb().then(async (c) => (await c.repos.seedIfNeeded(), c));
    const lib = await programmes.listExercises();
    const byKey = new Map(lib.filter((e) => e.seedKey).map((e) => [e.seedKey!, { exerciseId: e.id, equipment: e.equipment }]));
    const pattern = new Map(lib.map((e) => [e.id, e.pattern]));
    let combos = 0;
    for (const t of TEMPLATES) {
      for (const goalKey of ["bench_press", "back_squat", "lat_pulldown"]) {
        const base = instantiateTemplate(t, { byKey }, { lang: "en", goalLiftKey: goalKey, ceilingFor: () => 10 }).draft;
        const goalIds = new Set(base.days.flatMap((d) => d.exercises.filter((e) => e.isGoalLift).map((e) => e.exerciseId)));
        for (let days = 1; days <= base.days.length; days++) {
          for (const minutes of [null, 60, 45, 35, 30]) {
            combos++;
            const label = `${t.id} goal=${goalKey} days=${days} min=${minutes}`;
            const r = ok(rebuildShortWeek(base, { days, minutes, patternOf: (id) => pattern.get(id) }));
            expect(r.draft.days.length, label).toBe(days);
            expect(validateDraft(r.draft), label).toEqual([]);
            // 1. Every goal lift is still in the week.
            const after = new Set(r.draft.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)));
            for (const g of goalIds) expect(after.has(g), `${label}: goal lift kept`).toBe(true);
            // 2. A goal lift's sets are trimmed only when no accessory with a cuttable set is left in that session.
            for (const day of r.draft.days)
              for (const e of day.exercises.filter((x) => x.isGoalLift)) {
                const original = base.days.flatMap((d) => d.exercises).find((x) => x.exerciseId === e.exerciseId)!;
                if (e.sets < original.sets) {
                  expect(e.sets, label).toBeGreaterThanOrEqual(MIN_GOAL_SETS);
                  expect(day.exercises.filter((x) => !x.isGoalLift && x.sets > 2), `${label}: goal sets trimmed while accessories had spare sets`).toEqual([]);
                  expect(day.exercises.filter((x) => !x.isGoalLift && !goalIds.has(x.exerciseId)).length, label).toBeLessThanOrEqual(day.exercises.length);
                }
              }
            // 3. Within budget, or flagged honestly.
            if (minutes !== null) for (const m of r.minutes) if (m > minutes) expect(r.overBudget, label).toBe(true);
            // 4. Nothing silent: every original exercise is either still present, or has a cut entry.
            const cutIds = new Set(r.cuts.filter((c) => c.exerciseId).map((c) => `${c.exerciseId}`));
            for (const e of base.days.flatMap((d) => d.exercises)) expect(after.has(e.exerciseId) || cutIds.has(e.exerciseId), `${label}: ${e.exerciseId} neither kept nor listed`).toBe(true);
            // 5. Priority floor, when the original had the muscle: kept sets >= min(original, 6) unless reported as missed.
            for (const g of new Set([...goalIds].map((id) => groupOfPattern(pattern.get(id) ?? "other")))) {
              const orig = base.days.reduce((n, d) => n + d.exercises.filter((e) => groupOfPattern(pattern.get(e.exerciseId) ?? "other") === g).reduce((m, e) => m + e.sets, 0), 0);
              const now = r.draft.days.reduce((n, d) => n + d.exercises.filter((e) => groupOfPattern(pattern.get(e.exerciseId) ?? "other") === g).reduce((m, e) => m + e.sets, 0), 0);
              if (!r.floorMissed.includes(g)) expect(now, `${label}: ${g} floor`).toBeGreaterThanOrEqual(Math.min(orig, FLOOR_SETS));
            }
          }
        }
      }
    }
    expect(combos).toBeGreaterThan(300);
    expect(estimateSessionMinutes(10)).toBe(30);
  });
});

import { estimateDayMinutes, warmupSetsFor } from "../src/logic/duration";

describe("session length estimate counts rest, warm-ups and transitions (P23)", () => {
  it("is more than 3 min per set for a normal day, and grows with the rest time", () => {
    const day = { exercises: 5, sets: 15 };
    expect(estimateDayMinutes(day, 90)).toBe(Math.ceil((15 * (45 + 90) + 5 * 90 + 3 * 90) / 60)); // 46
    expect(estimateDayMinutes(day, 180)).toBeGreaterThan(estimateDayMinutes(day, 90));
    expect(estimateDayMinutes(day, 90)).toBeGreaterThan(45 - 1);
    expect(warmupSetsFor(0)).toBe(0);
    expect(warmupSetsFor(1)).toBe(2);
    expect(warmupSetsFor(4)).toBe(3);
    expect(estimateDayMinutes({ exercises: 0, sets: 0 })).toBe(0);
  });

  it("a longer rest makes the same budget need a smaller day, and a budget that cannot be met is reported, not hidden", () => {
    const p = draft([["A", [ex("bench", 4, true), ex("row", 3), ex("curl", 3), ex("tri", 3)]]]);
    const short = ok(rebuildShortWeek(p, { days: 1, minutes: 45, patternOf, restSeconds: 60 }));
    const long = ok(rebuildShortWeek(p, { days: 1, minutes: 45, patternOf, restSeconds: 240 }));
    const n = (r: typeof short) => r.draft.days[0]!.exercises.reduce((s, e) => s + e.sets, 0);
    expect(n(long)).toBeLessThan(n(short));
    expect(long.minutes[0]!).toBeLessThanOrEqual(45);
    const impossible = ok(rebuildShortWeek(draft([["A", [ex("bench", 4, true), ex("squat", 4, true)]]]), { days: 1, minutes: 20, patternOf, restSeconds: 240 }));
    expect(impossible.overBudget).toBe(true);
    expect(impossible.minutes[0]!).toBeGreaterThan(20);
  });
});
