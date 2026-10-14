import { describe, expect, it } from "vitest";
import { baselineReps, buildEvaluationReport, type EvaluationSample } from "../src/logic/mlEvaluationReport";
const sample = (extra: Partial<EvaluationSample> = {}): EvaluationSample => ({ exerciseId: "bench", predictedReps: 8, actualReps: 8,
  features: { previous_reps: 10, relative_load_change: 0, previous_workout_first_reps: null, sleep_hours: null, load_convention: -1 }, ...extra });
const report = (samples: EvaluationSample[]) => buildEvaluationReport("test-model", samples, { captured: samples.length, pending: 0, invalidated: 0, excludedCurrentState: 0 });
describe("before-set baseline comparisons", () => {
  it("compares model and repeat baseline on exactly the same eligible same-load sets", () => {
    const r = report([sample(), sample({ actualReps: 7, predictedReps: 9 }), sample({ actualReps: 5, predictedReps: 20, features: { previous_reps: 10, relative_load_change: 0.2 } })]);
    expect(r.model.count).toBe(3);
    const pair = r.comparisons.repeatPrevious;
    expect(pair.model.count).toBe(2);
    expect(pair.baseline.count).toBe(2);
    expect(pair.model.meanAbsoluteError).toBe(1);
    expect(pair.baseline.meanAbsoluteError).toBe(2.5);
    expect(pair.maeImprovement).toBe(1.5);
    expect(pair.modelWins).toBe(2);
  });
  it("uses frozen prior reps and relative load, with bounded load-adjusted extrapolation", () => {
    expect(baselineReps({ previous_reps: 10, relative_load_change: 0 }, "loadAdjusted")).toBe(10);
    expect(baselineReps({ previous_reps: 10, relative_load_change: 0.05 }, "loadAdjusted")).toBeCloseTo(8.095238);
    expect(baselineReps({ previous_reps: 10, relative_load_change: -0.2 }, "loadAdjusted")).toBeCloseTo(20);
    for (const relative_load_change of [-1, -0.21, 0.06, NaN, Infinity]) expect(baselineReps({ previous_reps: 10, relative_load_change }, "loadAdjusted")).toBeNull();
    expect(baselineReps({ previous_reps: 40, relative_load_change: 0 }, "repeatPrevious")).toBe(40);
    expect(baselineReps({ previous_reps: 40, relative_load_change: 0 }, "loadAdjusted")).toBeNull();
    expect(baselineReps({ relative_load_change: 0 }, "repeatPrevious")).toBeNull();
    expect(baselineReps({ previous_reps: 10 }, "repeatPrevious")).toBeNull();
  });
  it("keeps fractional errors and inclusive thresholds, counting wins, ties and losses", () => {
    const r = report([sample({ predictedReps: 7, actualReps: 8 }), sample({ predictedReps: 10, actualReps: 8 }), sample({ predictedReps: 4.99, actualReps: 8 })]);
    expect(r.model.withinOnePercent).toBeCloseTo(100 / 3);
    expect(r.model.withinTwoPercent).toBeCloseTo(200 / 3);
    expect(r.model.meanOverprediction).toBeCloseTo(-0.67);
    expect(r.comparisons.repeatPrevious).toMatchObject({ modelWins: 1, ties: 1, baselineWins: 1 });
  });
  it("reports null scores for an empty cohort instead of inventing zero error or superiority", () => {
    const r = report([]);
    expect(r.model.meanAbsoluteError).toBeNull();
    expect(r.comparisons.repeatPrevious.maeImprovement).toBeNull();
    expect(r.comparisons.loadAdjusted.baseline.count).toBe(0);
    expect(r.byExercise).toEqual([]);
    expect(r.samples).toEqual([]);
  });
  it("separates exercise and known-history cohorts and exposes null/absent features", () => {
    const r = report([sample(), sample({ exerciseId: "row", features: { previous_reps: 8, relative_load_change: 0, previous_workout_first_reps: 9, sleep_hours: 7 } }), sample({ features: { previous_reps: 8, relative_load_change: 0 } })]);
    expect(r.byExercise.map(x => [x.exerciseId, x.model.count])).toEqual([["bench", 2], ["row", 1]]);
    expect(r.byHistory.priorFirstSetUnavailable.count).toBe(2);
    expect(r.byHistory.priorFirstSetAvailable.count).toBe(1);
    expect(r.featureCoverage.find(x => x.feature === "load_convention")).toEqual({ feature: "load_convention", observed: 0, missing: 3 });
    expect(r.featureCoverage.find(x => x.feature === "sleep_hours")).toEqual({ feature: "sleep_hours", observed: 1, missing: 2 });
  });
  it("reproduces paired metrics from exported samples without reevaluating or changing the model", () => {
    const original = report([sample(), sample({ exerciseId: "row", actualReps: 6 })]);
    const exported = JSON.parse(JSON.stringify(original));
    expect(buildEvaluationReport(exported.modelVersion, exported.samples, exported.coverage)).toEqual(original);
    expect(JSON.stringify(original)).not.toContain("sessionId");
    expect(JSON.stringify(original)).not.toContain("targetSetId");
  });
  it("rejects nonfinite prediction/outcome values rather than poisoning averages", () => {
    for (const predictedReps of [NaN, Infinity, -1, 51]) expect(() => report([sample({ predictedReps })])).toThrow();
    expect(() => report([sample({ actualReps: 0 })])).toThrow();
  });
});
