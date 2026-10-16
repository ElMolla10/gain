import { describe, expect, it } from "vitest";
import { analyzeEvaluation, parseEvaluationExport } from "../src/logic/mlEvaluationAnalysis";
import { buildEvaluationReport, type EvaluationSample } from "../src/logic/mlEvaluationReport";
const sample = (extra: Partial<EvaluationSample> = {}): EvaluationSample => ({ exerciseId: "bench", sessionGroup: "session-1",
  predictedReps: 8, actualReps: 8, features: { previous_reps: 10, relative_load_change: 0 }, ...extra });
const report = (samples: EvaluationSample[]) => buildEvaluationReport("test-model", samples,
  { captured: samples.length, pending: 0, invalidated: 0, excludedCurrentState: 0 });

describe("real-workout evidence analysis", () => {
  it("resamples sessions and preserves paired headline denominators, deterministically", () => {
    const input = report(Array.from({ length: 6 }, (_, i) => sample({ sessionGroup: `session-${i}`, predictedReps: 8 + i / 10 })));
    const first = analyzeEvaluation(input);
    expect(analyzeEvaluation(input)).toEqual(first);
    expect(first.uncertainty.repeatPrevious).toMatchObject({ pairedSessions: 6, ungroupedSamples: 0, unavailableReason: null, resamples: 2000 });
    expect(first.uncertainty.repeatPrevious.lower).toBeGreaterThan(1);
    expect(first.uncertainty.repeatPrevious.upper).toBeLessThanOrEqual(2);
    expect(first.byLoadChange[0]!.comparisons.repeatPrevious).toEqual(input.comparisons.repeatPrevious);
  });
  it("does not turn hundreds of correlated sets into hundreds of independent sessions", () => {
    const input = report(Array.from({ length: 500 }, () => sample()));
    expect(analyzeEvaluation(input).uncertainty.repeatPrevious).toMatchObject({ pairedSessions: 1, lower: null, upper: null, unavailableReason: "too-few-sessions" });
  });
  it("retains cluster uncertainty even with many identical sets per session", () => {
    const samples = Array.from({ length: 6 }, (_, i) => Array.from({ length: 50 }, () => sample({ sessionGroup: `s-${i}`, predictedReps: i < 3 ? 8 : 12 }))).flat();
    const interval = analyzeEvaluation(report(samples)).uncertainty.repeatPrevious;
    expect(interval.lower).toBeLessThan(interval.upper!);
    expect(interval.lower).toBeLessThanOrEqual(0);
    expect(interval.upper).toBeGreaterThan(0);
  });
  it("never invents session identity for legacy exports or silently drops ungrouped paired sets", () => {
    const samples = Array.from({ length: 6 }, (_, i) => sample({ sessionGroup: `s-${i}` }));
    const result = analyzeEvaluation(report([...samples, sample({ sessionGroup: undefined })]));
    expect(result.uncertainty.repeatPrevious).toMatchObject({ ungroupedSamples: 1, lower: null, unavailableReason: "missing-session-groups" });
    expect(parseEvaluationExport(JSON.parse(JSON.stringify(report([sample({ sessionGroup: undefined })])))).model.count).toBe(1);
  });
  it("counts only baseline-eligible sessions for each paired interval", () => {
    const samples = Array.from({ length: 6 }, (_, i) => sample({ sessionGroup: `s-${i}`, features: { previous_reps: 10, relative_load_change: 0.05 } }));
    const result = analyzeEvaluation(report(samples));
    expect(result.sessionCount).toBe(6);
    expect(result.uncertainty.repeatPrevious).toMatchObject({ pairedSessions: 0, lower: null });
    expect(result.uncertainty.loadAdjusted).toMatchObject({ pairedSessions: 6, unavailableReason: null });
  });
  it("partitions load, history and missing inputs and measures a descriptive overprediction tail", () => {
    const result = analyzeEvaluation(report([
      sample({ predictedReps: 11 }),
      sample({ features: { relative_load_change: -0.1, previous_workout_first_reps: 8, previous_set_rpe: 10 } }),
      sample({ features: { relative_load_change: 0.05, rest_before_set_seconds: 90 } }),
      sample({ features: { relative_load_change: null } }),
    ]));
    expect(result.byLoadChange.map(x => x.model.count)).toEqual([1, 1, 1, 1]);
    expect(result.byPriorHistory.map(x => x.model.count)).toEqual([1, 3]);
    expect(result.byFeatureAvailability[0]).toMatchObject({ feature: "previous_set_rpe", observed: { model: { count: 1 } }, missing: { model: { count: 3 } } });
    expect(result.overprediction).toEqual({ thresholdReps: 3, count: 1, percent: 25 });
    const empty = analyzeEvaluation(report([]));
    expect(empty.overprediction.percent).toBeNull();
    expect(empty.uncertainty.loadAdjusted.lower).toBeNull();
  });
});

describe("shared export validation", () => {
  it("recomputes scores instead of trusting stale or tampered summaries", () => {
    const input = JSON.parse(JSON.stringify(report([sample()])));
    input.model.meanAbsoluteError = 999;
    input.coverage.evaluated = 999;
    expect(parseEvaluationExport(input)).toEqual(report([sample()]));
  });
  it.each([
    { features: null }, { features: [] }, { features: { previous_reps: "10" } },
    { features: { previous_reps: Infinity } }, { exerciseId: "" }, { sessionGroup: " " },
    { actualReps: 1.5 }, { actualReps: 0 }, { predictedReps: 51 }, { predictedReps: NaN },
  ])("rejects malformed samples: %j", patch => {
    const input = report([sample()]);
    Object.assign(input.samples[0]!, patch);
    expect(() => parseEvaluationExport(input)).toThrow("Invalid evaluation sample");
  });
  it("rejects invalid or unreconciled coverage without accepting untrusted totals", () => {
    for (const patch of [{ captured: 99 }, { pending: -1 }, { invalidated: 0.5 }, { excludedCurrentState: "0" }]) {
      const input = report([sample()]);
      Object.assign(input.coverage, patch);
      expect(() => parseEvaluationExport(input)).toThrow();
    }
    const input = report([sample()]);
    input.coverage = { captured: 5, evaluated: 1, pending: 2, invalidated: 1, excludedCurrentState: 1 };
    expect(parseEvaluationExport(input).coverage).toEqual(input.coverage);
  });
  it("rejects unrelated JSON instead of crashing in statistical computation", () => {
    for (const input of [null, [], {}, { format: "other" }]) expect(() => parseEvaluationExport(input)).toThrow("Not a GAIN evaluation export");
  });
});
