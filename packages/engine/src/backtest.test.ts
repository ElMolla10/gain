import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { backtest, gcdOfLoads, inferGrids, seriesFromWorkouts, summarize } from "./backtest";
import { parseHevyCsv } from "./hevy";
import { isGymLoad } from "./loads";

const read = (n: string) => readFileSync(new URL(`../../../fixtures/${n}`, import.meta.url), "utf8");

describe("gcdOfLoads", () => {
  it("finds the common step", () => {
    expect(gcdOfLoads([8, 10, 12, 14])).toBe(2);
    expect(gcdOfLoads([2.5, 7.5, 12.5])).toBe(2.5);
    expect(gcdOfLoads([20, 25, 50])).toBe(5);
  });
  it("ignores zeros and returns null with nothing", () => {
    expect(gcdOfLoads([0, 0])).toBeNull();
    expect(gcdOfLoads([])).toBeNull();
  });
});

describe("series from the synthetic export", () => {
  const { workouts } = parseHevyCsv(read("hevy-synthetic.csv"));
  const { series, skipped } = seriesFromWorkouts(workouts);
  it("splits by exercise, drops timed-only lifts and says so", () => {
    expect(series.map((s) => s.title).sort()).toEqual(["Bench Press (Barbell)", "Lateral Raise (Dumbbell)", "Pull Up"]);
    expect(skipped.map((s) => s.title)).toEqual(["Dead Hang"]);
  });
  it("treats a weightless lift as bodyweight", () => {
    expect(series.find((s) => s.title === "Pull Up")!.setup).toBe("bodyweight_plus_added");
  });
  it("infers a grid only from real logged loads", () => {
    expect(inferGrids(series).get("barbell")!.increment).toBe(2.5); // fewer than 3 distinct loads: default, labelled
  });
});

describe("walk-forward backtest on the real export (Mohamed's own real export, committed with his permission)", () => {
  const parsed = parseHevyCsv(read("hevy-export.csv"));
  it("parses the whole export", () => {
    expect(parsed.rowCount).toBe(1049);
    expect(parsed.workouts).toHaveLength(70);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.workouts[0]!.startTime.slice(0, 10)).toBe("2025-09-22");
    expect(parsed.workouts[parsed.workouts.length - 1]!.startTime.slice(0, 10)).toBe("2026-09-29");
  });
  const res = backtest(parsed.workouts, { repRange: { min: 6, max: 10 }, minSessions: 4 });
  it("evaluates hundreds of next sessions without crashing", () => {
    expect(res.outcomes.length).toBeGreaterThan(300);
  });
  it("is deterministic", () => {
    const again = backtest(parsed.workouts, { repRange: { min: 6, max: 10 }, minSessions: 4 });
    expect(again.outcomes).toEqual(res.outcomes);
  });
  it("rule-v0.4: a range with no top uses the GAIN ceilings (the Hevy backtest setup); a stated program top wins unless 'Use GAIN rep ceilings' is on", () => {
    const noTop = backtest(parsed.workouts, { repRange: { min: 6 }, minSessions: 4 });
    const forced = backtest(parsed.workouts, { repRange: { min: 6, max: 99 }, minSessions: 4, useGainCeilings: true });
    expect(forced.outcomes).toEqual(noTop.outcomes);
    const programWins = backtest(parsed.workouts, { repRange: { min: 6, max: 99 }, minSessions: 4 });
    expect(programWins.outcomes).not.toEqual(noTop.outcomes); // a 6-99 program never reaches its top, so it never proposes more load
    expect(summarize(programWins.outcomes).proposedUp).toBeLessThan(summarize(noTop.outcomes).proposedUp);
  });
  it("every proposed load exists on the inferred grid", () => {
    const grids = new Map(res.grids.map((g) => [g.key, g.increment]));
    for (const o of res.outcomes) {
      if (o.proposedLoad === null || o.proposedLoad === 0) continue;
      const inc = [...grids.values()].some((g) => isGymLoad({ equipment: "machine", increment: g }, o.proposedLoad!));
      expect(inc).toBe(true);
    }
  });
  it("only sessions that have earlier history are evaluated, all with a proposal", () => {
    const first = new Set(res.outcomes.map((o) => o.title));
    expect(first.size).toBeGreaterThan(10);
    expect(res.outcomes.every((o) => o.status === "proposed")).toBe(true);
  });
  it("summaries are internally consistent", () => {
    const s = summarize(res.outcomes);
    expect(s.exact).toBeLessThanOrEqual(s.loadMatch);
    expect(s.loadMatch).toBeLessThanOrEqual(s.n);
    expect(s.n).toBe(res.outcomes.length);
  });
});
