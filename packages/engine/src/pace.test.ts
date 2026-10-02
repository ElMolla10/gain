import { describe, expect, it } from "vitest";
import { epley, median } from "./line";
import { bodyweightPace, liftPace, musclePace, theilSen, type BodyweightEntry, type LiftExposure } from "./pace";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 2); // 2026-10-02
const days = (n: number) => n * DAY;

/** 8 sessions, one every 3.5 days, ending `lastAgo` days ago; e1RM 100, 101, ... 107. Hand check: 2 per week, +1 kg e1RM per session. */
function steady(lastAgo = 0): LiftExposure[] {
  return Array.from({ length: 8 }, (_, i) => ({ at: NOW - days(lastAgo) - days((7 - i) * 3.5), e1rm: 100 + i }));
}

describe("helpers", () => {
  it("epley and median and theil-sen on hand values", () => {
    expect(epley(100, 5)).toBeCloseTo(116.667, 3);
    expect(epley(100, 1)).toBe(100);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(theilSen([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }])).toBe(2);
    expect(theilSen([{ x: 1, y: 1 }])).toBeNull();
  });
});

describe("liftPace (target 100 x 5 = e1RM 116.67)", () => {
  const goal = (targetDate: string | null) => ({ targetLoad: 100, targetReps: 5, targetDate });

  it("projects from rate and weekly frequency: remaining 10.67, +1/session, 2/week -> 5.33 weeks", () => {
    const p = liftPace(goal(null), steady(), NOW);
    expect(p.targetE1rm).toBe(116.67);
    expect(p.currentE1rm).toBe(106); // median of 105,106,107
    expect(p.exposuresPerWeek).toBe(2);
    expect(p.ratePerExposure).toBe(1);
    expect(p.projectedDate).toBe("2026-11-08"); // 37.3 days after 2026-10-02
    expect(p.status).toBe("on_pace");
  });

  it("is ahead / on pace / behind depending on the date", () => {
    // 2026-11-20 is 50 days away -> 14.29 exposures -> needs 0.747 per session; has 1 -> ratio 1.34
    expect(liftPace(goal("2026-11-20"), steady(), NOW).status).toBe("ahead");
    // 2026-11-10: 40 days -> 11.43 exposures -> needs 0.933; ratio 1.07
    const on = liftPace(goal("2026-11-10"), steady(), NOW);
    expect(on.status).toBe("on_pace");
    expect(on.requiredPerExposure).toBe(0.934);
    // 2026-10-20: 19 days -> 5.43 exposures -> needs 1.96; ratio 0.51
    expect(liftPace(goal("2026-10-20"), steady(), NOW).status).toBe("behind");
  });

  it("a missed fortnight halves the weekly exposures, moves the projected date later and can flip on pace to behind", () => {
    const missed = liftPace(goal("2026-11-10"), steady(14), NOW);
    expect(missed.exposuresPerWeek).toBe(1); // 4 sessions in the 28-day window
    expect(missed.projectedDate).toBe("2026-12-15"); // 10.67 weeks
    expect(missed.status).toBe("behind");
  });

  it("flat or falling e1RM is behind, with no projected date", () => {
    const flat = steady().map((h) => ({ ...h, e1rm: 100 }));
    const p = liftPace(goal("2027-03-01"), flat, NOW);
    expect(p.status).toBe("behind");
    expect(p.projectedDate).toBeNull();
    expect(liftPace(goal(null), flat, NOW).status).toBe("behind");
  });

  it("says plainly when it is too thin", () => {
    expect(liftPace(goal(null), [], NOW)).toMatchObject({ status: "too_thin", thin: "no_history", currentE1rm: null });
    expect(liftPace(goal(null), steady().slice(0, 3), NOW)).toMatchObject({ status: "too_thin", thin: "few_exposures", ratePerExposure: null });
  });

  it("reached when the recent median is at or above the target", () => {
    expect(liftPace(goal(null), steady().map((h) => ({ ...h, e1rm: 120 })), NOW).status).toBe("reached");
  });

  it("a date in the past with the goal not reached is behind and flagged", () => {
    const p = liftPace(goal("2026-09-01"), steady(), NOW);
    expect(p.status).toBe("behind");
    expect(p.dateGone).toBe(true);
  });

  it("one lucky or bad session barely moves the rate (median-based)", () => {
    const h = steady();
    h[5] = { ...h[5]!, e1rm: 130 }; // a fat-finger style outlier
    const p = liftPace(goal(null), h, NOW);
    expect(p.ratePerExposure).toBeGreaterThan(0.9);
    expect(p.ratePerExposure).toBeLessThan(1.1);
  });
});

/** Daily weigh-ins for 28 days, weight(d) = 83 - 0.1 d for d = -27..0 days: losing 0.7 kg per week, 83.0 today. */
function losing(): BodyweightEntry[] {
  return Array.from({ length: 28 }, (_, i) => {
    const d = i - 27;
    return { at: NOW + days(d), kg: Math.round((83 - 0.1 * d) * 10) / 10 };
  });
}

describe("bodyweightPace (goal 80 kg)", () => {
  const goal = (targetDate: string | null) => ({ targetKg: 80, targetDate });

  it("trend is the median of the last 7 days and slope is -0.7 kg/week", () => {
    const p = bodyweightPace(goal(null), losing(), NOW);
    expect(p.trendKg).toBe(83.3); // median of 83.6 ... 83.0
    expect(p.slopeKgPerWeek).toBe(-0.7);
    // 3.3 kg at 0.7 per week = 4.71 weeks = 33 days
    expect(p.projectedDate).toBe("2026-11-04");
    expect(p.status).toBe("on_pace");
  });

  it("is ahead / on pace / behind depending on the date", () => {
    // 2026-12-01: 60 days -> needs -0.385/week; has 0.7 toward -> ratio 1.8
    expect(bodyweightPace(goal("2026-12-01"), losing(), NOW).status).toBe("ahead");
    // 2026-10-30: 28 days -> needs -0.8; ratio 0.875
    const on = bodyweightPace(goal("2026-10-30"), losing(), NOW);
    expect(on.status).toBe("on_pace");
    expect(on.requiredKgPerWeek).toBeCloseTo(-0.8, 1);
    // 2026-10-20: 19 days -> needs -1.2; ratio 0.58
    expect(bodyweightPace(goal("2026-10-20"), losing(), NOW).status).toBe("behind");
  });

  it("one heavy day (water, a big meal) does not move the trend or the slope", () => {
    const e = losing();
    const idx = e.findIndex((x) => x.at === NOW - days(2));
    e[idx] = { ...e[idx]!, kg: e[idx]!.kg + 3 };
    const p = bodyweightPace(goal(null), e, NOW);
    expect(p.trendKg).toBe(83.4); // 83.3 -> 83.4: one day moved the median by 0.1 kg
    expect(Math.abs(p.slopeKgPerWeek! + 0.7)).toBeLessThan(0.03);
    expect(p.status).toBe("on_pace");
  });

  it("gaining when the goal is lower is behind", () => {
    const gaining = losing().map((e, i) => ({ ...e, kg: 80 + i * 0.1 }));
    const p = bodyweightPace(goal("2026-12-01"), gaining, NOW);
    expect(p.status).toBe("behind");
    expect(p.projectedDate).toBeNull();
  });

  it("works for a gaining goal (target above the trend)", () => {
    const gaining = losing().map((e, i) => ({ ...e, kg: 70 + i * 0.1 })); // +0.7/week, 72.7 today
    const p = bodyweightPace({ targetKg: 75, targetDate: null }, gaining, NOW);
    expect(p.slopeKgPerWeek).toBe(0.7);
    expect(p.status).toBe("on_pace");
  });

  it("reached within 0.3 kg", () => {
    expect(bodyweightPace({ targetKg: 83.5, targetDate: null }, losing(), NOW).status).toBe("reached");
  });

  it("too thin: nothing, two entries, or only old entries", () => {
    expect(bodyweightPace(goal(null), [], NOW)).toMatchObject({ status: "too_thin", thin: "no_entries" });
    const two = [{ at: NOW - days(3), kg: 84 }, { at: NOW, kg: 83.5 }];
    expect(bodyweightPace(goal(null), two, NOW)).toMatchObject({ status: "too_thin", thin: "few_entries", trendKg: 83.75, slopeKgPerWeek: null });
    expect(bodyweightPace(goal(null), [{ at: NOW - days(30), kg: 84 }], NOW)).toMatchObject({ status: "too_thin", thin: "stale", trendKg: null });
  });
});

describe("musclePace", () => {
  it("compares sessions per week with the default floor of 2", () => {
    const four = [days(-27), days(-20), days(-13), days(-6)].map((d) => NOW + d);
    const p = musclePace(four, NOW, null);
    expect(p.sessionsPerWeek).toBe(0.778); // 3 sessions after the first, over 27 days
    expect(p.status).toBe("behind");
    const many = Array.from({ length: 9 }, (_, i) => NOW - days(28 - i * 3.5));
    expect(musclePace(many, NOW, null).status).toBe("on_pace");
  });
  it("is too thin in the first week", () => {
    expect(musclePace([NOW - days(2)], NOW, null).status).toBe("too_thin");
    expect(musclePace([], NOW, NOW - days(2)).status).toBe("too_thin");
  });
});
