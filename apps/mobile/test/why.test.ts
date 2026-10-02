import { describe, expect, it } from "vitest";
import { describeDecision, type DecisionPayload } from "../src/logic/why";
import { translate } from "../src/i18n/format";
import type { StringKey } from "../src/i18n/strings";
import { freshDb } from "./helpers";

const clean = (x: string) => x.replace(/[\u2066-\u2069]/g, "");
const L = (lang: "en" | "ar") => (k: string, p?: Record<string, string | number>) => translate(lang, k as StringKey, p);

async function benchDecision() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const gymId = (await ctx.repos.getActiveGymId())!;
  const gym = await ctx.repos.loadGymFingerprint(gymId);
  for (let r = 0; r < 3; r++) {
    for (let d = 0; d < 4; d++) {
      const next = (await ctx.repos.getNextDay())!;
      const exs = await ctx.repos.listDayExercises(next.day.id);
      const { id } = await ctx.workout.startOrResumeSession(next.day.id, gymId);
      const ex = exs[0]!;
      const reps = r === 0 ? 9 : 10;
      const sets = d === 0 ? [[60, reps], [60, reps], [60, reps]] : [[50, 10]];
      for (const [load, rp] of sets) await ctx.workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load: load!, reps: rp! }, { gym, equipment: ex.equipment, setup: ex.setup });
      ctx.deps.tick(1000);
      await ctx.workout.finishSession(id);
      const w = await ctx.finish.writeNextSessionTargets(id);
      ctx.deps.tick(86_400_000);
      if (r === 2 && d === 3) {
        const bench = (await ctx.finish.getTargets(w!.sessionId))[0]!;
        return { d: (await ctx.finish.getDecision(bench.id))!, bench };
      }
    }
  }
  throw new Error("unreachable");
}

describe("Why this weight? shows the logged inputs", () => {
  it("lists the sentence, observed sessions, gym loads, exclusions and the rule's reading in separate sections", async () => {
    const { d } = await benchDecision();
    const sections = describeDecision(d.payload as DecisionPayload, { ruleVersion: d.ruleVersion, path: d.path }, L("en"), "en");
    expect(sections.map((s) => s.title)).toEqual(["The reason", "What you did (observed)", "This gym's loads", "Left out", "The rule's reading (interpretation)"]);
    expect(sections[0]!.lines[0]).toContain("Go up to 62.5 kg");
    expect(clean(sections[1]!.lines[0]!)).toContain("60 kg × 10");
    expect(sections[1]!.lines).toHaveLength(3);
    expect(clean(sections[2]!.lines.join(" "))).toContain("62.5");
    expect(clean(sections[2]!.lines.join(" "))).toContain("2.5");
    expect(sections[4]!.lines.join(" ")).toContain("rule-v0.3");
    expect(sections[4]!.lines.join(" ")).toContain("the next real load");
  });
  it("renders in Arabic too, without leftover placeholders", async () => {
    const { d } = await benchDecision();
    const sections = describeDecision(d.payload as DecisionPayload, { ruleVersion: d.ruleVersion, path: d.path }, L("ar"), "ar");
    const text = sections.flatMap((s) => [s.title, ...s.lines]).join("\n");
    expect(text).toMatch(/[\u0600-\u06FF]/);
    expect(text).not.toMatch(/\{\w+\}/);
  });
  it("a no-history target explains that nothing was found", async () => {
    const ctx = await freshDb();
    await ctx.repos.seedIfNeeded();
    const gymId = (await ctx.repos.getActiveGymId())!;
    const gym = await ctx.repos.loadGymFingerprint(gymId);
    const next = (await ctx.repos.getNextDay())!;
    const ex = (await ctx.repos.listDayExercises(next.day.id))[0]!;
    const { id } = await ctx.workout.startOrResumeSession(next.day.id, gymId);
    await ctx.workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load: 60, reps: 8 }, { gym, equipment: ex.equipment, setup: ex.setup });
    ctx.deps.tick(1000);
    await ctx.workout.finishSession(id);
    const w = await ctx.finish.writeNextSessionTargets(id);
    const t = (await ctx.finish.getTargets(w!.sessionId))[0]!;
    const d = (await ctx.finish.getDecision(t.id))!;
    const sections = describeDecision(d.payload, { ruleVersion: d.ruleVersion, path: d.path }, L("en"), "en");
    expect(sections[1]!.lines).toEqual(["No comparable sessions were found."]);
    expect(sections[0]!.lines[0]).toMatch(/nothing is proposed/);
  });
});

describe("Why screen: an oversized step", () => {
  it("proposed anyway (load currency) is explained as the smallest weight available, not 'other ways come first'", async () => {
    const { d } = await benchDecision();
    const payload = structuredClone(d.payload) as DecisionPayload;
    payload.inputs.gym.jumpTooBig = true;
    payload.inputs.gym.jumpRatio = 0.25;
    payload.inputs.gym.maxJumpRatio = 0.1;
    const text = (cur: "load" | "quality") => {
      payload.proposal.currency = cur;
      return describeDecision(payload, { ruleVersion: d.ruleVersion, path: d.path }, L("en"), "en")
        .flatMap((s) => s.lines)
        .map(clean)
        .join("\n");
    };
    expect(text("load")).toContain("smallest weight available here");
    expect(text("quality")).toContain("other ways to progress come first");
  });
});

describe("Why this weight? in pounds", () => {
  it("shows the same facts in lb: the sentence, the sessions and the gym's next load", async () => {
    const { d } = await benchDecision();
    const sections = describeDecision(d.payload as DecisionPayload, { ruleVersion: d.ruleVersion, path: d.path }, L("en"), "en", "lb");
    expect(sections[0]!.lines[0]).toContain("Go up to 137.8 lb");
    expect(clean(sections[1]!.lines[0]!)).toContain("132.3 lb × 10");
    expect(clean(sections[2]!.lines.join(" "))).toContain("137.8 lb");
    expect(clean(sections.flatMap((x) => x.lines).join(" "))).not.toMatch(/\bkg\b/);
  });
  it("Arabic uses the draft Arabic unit label", async () => {
    const { d } = await benchDecision();
    const sections = describeDecision(d.payload as DecisionPayload, { ruleVersion: d.ruleVersion, path: d.path }, L("ar"), "ar", "lb");
    expect(clean(sections[1]!.lines[0]!)).toContain("132.3 باوند");
  });
});
