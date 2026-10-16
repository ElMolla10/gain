import { describe, expect, it } from "vitest";
import { describeDecision, describeWhyWeight, type DecisionPayload } from "../src/logic/why";
import { LRI, translate } from "../src/i18n/format";
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
    expect(sections.map((s) => s.title)).toEqual(["The reason", "What you did (observed)", "Loads available", "Left out", "The rule's reading (interpretation)"]);
    expect(clean(sections[0]!.lines[0]!)).toMatch(/After/);
    expect(clean(sections[0]!.lines.join(" "))).toContain("Go up to 62.5 kg");
    expect(clean(sections[1]!.lines[0]!)).toContain("60 kg × 10");
    expect(sections[1]!.lines).toHaveLength(3);
    expect(clean(sections[2]!.lines.join(" "))).toContain("62.5");
    expect(clean(sections[2]!.lines.join(" "))).toContain("2.5");
    expect(sections[4]!.lines.join(" ")).toContain("rule-v0.5");
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
    expect(clean(sections[0]!.lines.join(" "))).toMatch(/nothing is proposed/);
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
    expect(clean(sections[0]!.lines.join(" "))).toContain("Go up to 137.8 lb");
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

describe("Why this weight? from a logged set", () => {
  it("names the triggering set, session position, rule step, and machine loads, with LTR-isolated numbers", () => {
    const spec = { equipment: "machine" as const, increment: 5, min: 10, max: 100 };
    const en = describeWhyWeight(
      { trigger: { load: 60, reps: 10, rir: 2 }, position: "early", action: "increase", loadSpec: spec, loadSource: "line" },
      L("en"),
      "en",
    );
    expect(clean(en.sentence)).toContain("After 60 kg × 10");
    expect(clean(en.sentence)).toContain("RIR 2");
    expect(en.sentence).toContain("early");
    expect(en.sentence).toContain("increased");
    expect(en.sentence).toContain("this machine's weights");
    const ar = describeWhyWeight(
      { trigger: { load: 60, reps: 10 }, position: "late", action: "maintain", loadSpec: spec, loadSource: "line", experimental: true, missing: ["rir", "sleep"] },
      L("ar"),
      "ar",
    );
    expect(ar.sentence).toMatch(/[\u0600-\u06FF]/);
    expect(ar.sentence).toContain(`${LRI}`);
    expect(ar.sentence).toContain("×");
    expect(ar.details.join(" ")).toMatch(/[\u0600-\u06FF]/);
    expect(ar.details.join(" ")).toContain("rir");
  });
  it("names earlier same-muscle work when a later-in-session reduction was applied", () => {
    const en = describeWhyWeight(
      { trigger: { load: 20, reps: 12 }, action: "maintain", afterExercise: "Bench Press" },
      L("en"),
      "en",
    );
    expect(clean(en.sentence)).toContain("Later in the session after Bench Press");
    const ar = describeWhyWeight(
      { trigger: { load: 20, reps: 12 }, action: "maintain", afterExercise: "بنش" },
      L("ar"),
      "ar",
    );
    expect(ar.sentence).toMatch(/[\u0600-\u06FF]/);
    expect(ar.sentence).toContain("بنش");
  });
  it("names a fatigued or returning flag and omits it when cleared", () => {
    const fatigued = describeWhyWeight(
      { trigger: { load: 60, reps: 8 }, action: "maintain", readiness: "fatigued" },
      L("en"),
      "en",
    );
    expect(clean(fatigued.sentence)).toContain("Adjusted because you marked unusually fatigued");
    expect(fatigued.sentence).not.toMatch(/recovery|%/i);
    const returning = describeWhyWeight(
      { trigger: { load: 60, reps: 8 }, action: "maintain", readiness: "returning" },
      L("en"),
      "en",
    );
    expect(clean(returning.sentence)).toContain("Adjusted because you marked returning after a break");
    const normal = describeWhyWeight(
      { trigger: { load: 60, reps: 8 }, action: "maintain" },
      L("en"),
      "en",
    );
    expect(clean(normal.sentence)).not.toContain("unusually fatigued");
    expect(clean(normal.sentence)).not.toContain("returning after a break");
    const ar = describeWhyWeight(
      { trigger: { load: 60, reps: 8 }, action: "maintain", readiness: "fatigued" },
      L("ar"),
      "ar",
    );
    expect(ar.sentence).toMatch(/[\u0600-\u06FF]/);
  });
});
