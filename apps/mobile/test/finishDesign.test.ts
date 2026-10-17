import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { finishStatCells, forecastOrder, whyDetail } from "../src/logic/finishLayout";
import { en, ar } from "../src/i18n/strings";

const src = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");
const finish = src("screens/FinishScreen.tsx");
const forecast = src("components/FinishedDayForecast.tsx");

describe("Finish design audit (F-1, F-3..F-8)", () => {
  it("F-1: next workout comes right after the title, before stats, PBs and sharing", () => {
    const i = (s: string) => finish.indexOf(s);
    expect(i("finish.title")).toBeGreaterThan(-1);
    expect(i("<FinishedDayForecast")).toBeGreaterThan(i("<SaveStatusLine"));
    expect(i("statCells.map")).toBeGreaterThan(i("<FinishedDayForecast"));
    expect(i("recap.personalBests")).toBeGreaterThan(i("statCells.map"));
    expect(i("<HeroAchievement")).toBeGreaterThan(i("statCells.map"));
    expect(i("<MenuSheet")).toBeGreaterThan(i("<AchievementCard"));
  });
  it("F-1: the goal lift leads when it has a target; otherwise the first with a target", () => {
    const exs = [{ exerciseId: "a", t: true }, { exerciseId: "b", t: false }, { exerciseId: "c", t: true }];
    expect(forecastOrder(exs, "c", (e) => e.t).lead?.exerciseId).toBe("c");
    expect(forecastOrder(exs, "b", (e) => e.t).lead?.exerciseId).toBe("a");
    expect(forecastOrder(exs, null, (e) => e.t).rest.map((e) => e.exerciseId)).toEqual(["b", "c"]);
    expect(forecastOrder([], null, () => true).lead).toBeNull();
  });
  it("F-1/F-4: lead is a strip with the name inside and the load at 36; no outer Card; other rows are 56 dp", () => {
    expect(forecast).toMatch(/fontSize: ty\.load/);
    expect(forecast).not.toMatch(/<TargetStrip/);
    expect(forecast).toMatch(/minHeight: 56/);
    expect(forecast).toMatch(/fontSize: ty\.section, fontWeight: "600", color: p\.accent/);
  });
  it("F-3: Why is shown only when there is more to say, and the sentence is body text", () => {
    expect(whyDetail("Load up. You hit all reps last time.", "Load up.")).toBe("You hit all reps last time.");
    expect(whyDetail("Load up.", "Load up.")).toBe("");
    expect(forecast).toMatch(/\{more \? \(/);
    expect(forecast).toMatch(/icon="why"/);
  });
  it("F-5: one row of stats with isolated numbers and unit words in the language", () => {
    const cells = finishStatCells({ sets: 14, exercises: 5, volume: "1240", minutes: 48 },
      { sets: "مجموعات", exercises: "تمارين", volume: "الحجم", duration: "المدة", unit: "كجم", min: "د" });
    expect(cells.map((c) => c.key)).toEqual(["sets", "exercises", "volume", "duration"]);
    expect(cells[2]!.value).toBe("\u20661240\u2069 كجم");
    expect(finishStatCells({ sets: 0, exercises: 0, volume: null, minutes: null }, { sets: "", exercises: "", volume: "", duration: "", unit: "", min: "" })).toHaveLength(2);
    expect(finish).toMatch(/fontSize: ty\.caption \}\}>\{c\.label\}/);
    expect(finish).not.toMatch(/<AppText ltr/);
  });
  it("F-6: no trophy emoji; a drawn icon in accent", () => {
    expect(finish).not.toContain("🏆");
    expect(finish).toMatch(/<Icon name="trophy" color=\{p\.accent\} size=\{20\}/);
    expect(src("components/Icon.tsx")).toMatch(/trophy: \[/);
  });
  it("F-7: one Share button; text, PDF and link live in a menu; the link keeps its consent step", () => {
    expect(finish.match(/icon="export"/g)?.length).toBe(1);
    expect(finish).toMatch(/onPress=\{\(\) => setShareOpen\(true\)\}/);
    expect(finish.indexOf("link.consent.body")).toBeLessThan(finish.indexOf("onPress={shareLink}"));
    expect(en["finish.share"]).toBe("Share");
    expect(ar["finish.share"]).toMatch(/[\u0600-\u06FF]/);
  });
  it("F-8: the forecast hint is one short line", () => {
    expect(forecast).toContain('t("finish.nextHintShort")');
    expect(en["finish.nextHintShort"].length).toBeLessThan(60);
    expect(ar["finish.nextHintShort"].length).toBeLessThan(60);
  });
});

describe("Finish evidence lines read in the language's order (S-1 / F-2)", () => {
  it("set evidence keeps the Arabic unit outside any LTR isolate", async () => {
    const { formatSetEvidence } = await import("../src/logic/achievementEvidence");
    const ar1 = formatSetEvidence(57.5, 8, "ar", "kg");
    expect(ar1).toBe("\u206657.5\u2069 كجم × \u20668\u2069");
    expect(ar1.startsWith("\u2066") && ar1.endsWith("\u2069") && /\u2066[^\u2069]*[\u0600-\u06FF]/.test(ar1)).toBe(false);
    expect(formatSetEvidence(57.5, 8, "en", "kg")).toBe("\u206657.5\u2069 kg × \u20668\u2069");
  });
});
