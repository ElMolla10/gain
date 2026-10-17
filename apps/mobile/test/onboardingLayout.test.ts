import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { firstInvalidGroup, footerMode, PROBLEM_GROUP, problemsFor } from "../src/logic/onboardingLayout";

const src = readFileSync(join(__dirname, "../src/screens/OnboardingScreen.tsx"), "utf8");
const ui = readFileSync(join(__dirname, "../src/ui.tsx"), "utf8");

describe("onboarding at large text (plan 1.5)", () => {
  it("the footer is sticky up to 1.3× text and scrolls with the content above it", () => {
    expect(footerMode(1)).toBe("sticky");
    expect(footerMode(1.3)).toBe("sticky");
    expect(footerMode(1.31)).toBe("inline");
    expect(footerMode(1.5)).toBe("inline");
    expect(src).toContain('footerInline={footerMode(fontScale) === "inline"}');
    expect(ui).toContain("{footer && !pinned ? <View style={{ gap: space.sm }}>{footer}</View> : null}");
  });
  it("step 1's secondary actions are one row of two QuietActions", () => {
    const footer = src.slice(src.indexOf("const footer = first ?"), src.indexOf(") : (", src.indexOf("const footer = first ?")));
    expect(footer.match(/<QuietAction /g)?.length).toBe(2);
    expect(footer).toContain('t("ob.skip")');
    expect(footer).toContain('t("ob.importFirst")');
    expect(footer).not.toMatch(/<BigButton variant="(secondary|quiet)"/);
  });
  it("each problem belongs to a group, and the first invalid group follows screen order", () => {
    expect(problemsFor("bodyweight", ["bodyweight_required", "height_bad"])).toEqual(["bodyweight_required"]);
    expect(firstInvalidGroup(["bodyweight_bad", "minutes_bad", "days_bad"])).toBe("days");
    expect(firstInvalidGroup(["height_bad", "goal_reps_bad"])).toBe("reps");
    expect(firstInvalidGroup([])).toBeNull();
    expect(Object.keys(PROBLEM_GROUP)).toHaveLength(13);
  });
  it("errors render inside their own group, not stacked at the end", () => {
    expect(src).not.toContain("{problemLines(problems)}");
    for (const g of ["days", "minutes", "goalKind", "exercise", "goalDate", "muscle", "birth"]) {
      const start = src.indexOf(`onLayout={at("${g}")}`);
      expect(start, g).toBeGreaterThan(-1);
      expect(src.slice(start, src.indexOf("</View>", start)), g).toContain(`groupErrors("${g}")`);
    }
    for (const g of ["load", "reps", "goalWeight", "height", "bodyweight"]) expect(src).toContain(`error={fieldError("${g}")}`);
    expect(src).toContain("borderStartWidth: bad ? 2 : 0, borderColor: p.danger");
  });
  it("a failed Next scrolls to the first invalid group", () => {
    const next = src.slice(src.indexOf("const next = () => {"), src.indexOf("goTo(STEPS[idx + 1]!)"));
    expect(next).toContain("firstInvalidGroup(problems)");
    expect(next).toContain("scrollRef.current?.scrollTo(");
  });
});
