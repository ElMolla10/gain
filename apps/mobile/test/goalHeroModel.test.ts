import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ar, en } from "../src/i18n/strings";
import { goalHeroModel } from "../src/logic/goalHero";

describe("Goals hero never shows the target as current strength (batch item 21)", () => {
  it("no history: empty, no percent or checkpoints", () => {
    expect(goalHeroModel(null, 120)).toEqual({ kind: "empty" });
  });
  it("0 current: 0%, the whole way to go", () => {
    expect(goalHeroModel(0, 100)).toEqual({ kind: "progress", percent: 0, deltaKg: 100, cp1: 40, cp2: 75 });
  });
  it("mid-way", () => {
    expect(goalHeroModel(80, 100)).toEqual({ kind: "progress", percent: 80, deltaKg: 20, cp1: 88, cp2: 95 });
  });
  it("reached (and beyond) caps at 100% with nothing left", () => {
    expect(goalHeroModel(100, 100)).toMatchObject({ kind: "progress", percent: 100, deltaKg: 0 });
    expect(goalHeroModel(110, 100)).toMatchObject({ kind: "progress", percent: 100, deltaKg: 0 });
  });
  it("GoalsScreen passes the real current (or null), never the target as a fallback", () => {
    const src = readFileSync(join(__dirname, "../src/screens/GoalsScreen.tsx"), "utf8");
    expect(src).not.toContain("?? pace.goal.targetLoad");
    expect(src).toContain("currentE1rm={pace.pace.currentE1rm}");
  });
  it("the card hides progress, checkpoints and current plates when empty; EN + AR empty line", () => {
    const card = readFileSync(join(__dirname, "../src/components/goals/GoalHeroIronCard.tsx"), "utf8");
    expect(card).toContain("currentE1rm: number | null;");
    expect(card.match(/model\.kind === "progress" \?/g)?.length).toBe(2);
    expect(card).toContain('t("goals.hero.noData", { exercise: isolateParam(exerciseName) })');
    expect(en["goals.hero.noData"]).toBe("Log {exercise} once to see how close you are.");
    expect(ar["goals.hero.noData"]).toBe("سجّل {exercise} مرة واحدة لترى كم اقتربت من هدفك.");
  });
});
