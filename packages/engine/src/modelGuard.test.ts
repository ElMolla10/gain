import { describe, expect, it } from "vitest";
import type { ModelAdvice, ModelAdvisor, ModelRequest } from "./model";
import { adviseWithGuardrails, MODEL_RATIONALE_KEYS, vetModelAdvice } from "./modelGuard";
import { proposeNext } from "./progression";
import { ASOF, exDb, gymA, lineOf, run, session, sets } from "./testkit";
import type { GymFingerprint } from "./types";

// A flagged case: one session of history on dumbbells (rack 10..40 by 2.5), so the rule is unsure and sets needsModel.
const line = lineOf("db-press");
const flagged = (): ModelRequest => {
  const p = proposeNext({ exercise: exDb(), gym: gymA, asOf: ASOF, history: [session(line, "2026-09-30", sets(30, 10))] });
  expect(p.needsModel.needed).toBe(true);
  return { ruleProposal: p, inputs: p.inputs };
};
const good = (over: Partial<ModelAdvice> = {}): ModelAdvice => ({ load: 32.5, reps: 8, rationaleKey: "model.rationale.trend_up", confidence: "medium", ...over });
const vet = (advice: unknown, r = flagged(), gym: GymFingerprint = gymA) => vetModelAdvice(r, gym, advice);
const reason = (advice: unknown, r = flagged()) => {
  const v = vet(advice, r);
  return v.ok ? "ok" : v.reason;
};

describe("model guardrails: what a model answer must pass (no model is connected)", () => {
  it("accepts a gym load one step from the anchor with in-range reps and a known rationale key", () => {
    const r = flagged();
    expect(r.inputs.gym.anchorLoad).toBe(30);
    expect(vet(good())).toEqual({ ok: true, advice: good() });
    expect(reason(good({ load: 27.5 }))).toBe("ok");
  });
  it("is only for cases the rule flagged", () => {
    const p = proposeNext({ exercise: exDb(), gym: gymA, asOf: ASOF, history: run(line, 30, [10, 10, 10]) });
    expect(p.needsModel.needed).toBe(false);
    expect(reason(good(), { ruleProposal: p, inputs: p.inputs })).toBe("not_flagged");
  });
  it("never invents history", () => {
    const p = proposeNext({ exercise: exDb(), gym: gymA, asOf: ASOF, history: [] });
    expect(reason(good(), { ruleProposal: { ...p, needsModel: { needed: true, reasons: ["low_confidence"] } }, inputs: p.inputs })).toBe("no_history");
  });
  it("rejects loads that do not exist in the gym (impossible, fractional, negative, NaN, infinite)", () => {
    for (const load of [31, 32.4, 1000, -5, Number.NaN, Number.POSITIVE_INFINITY]) expect(["load_not_in_gym", "bad_shape"]).toContain(reason(good({ load })));
  });
  it("rejects a real gym load that is more than one step from the rule's anchor", () => {
    expect(reason(good({ load: 35 }))).toBe("load_out_of_step");
    expect(reason(good({ load: 40 }))).toBe("load_out_of_step");
    expect(reason(good({ load: 20 }))).toBe("load_out_of_step");
  });
  it("rejects a missing load", () => {
    expect(reason(good({ load: null }))).toBe("load_missing");
  });
  it("rejects reps that are out of range or not whole numbers", () => {
    for (const reps of [0, 3, 13, 100, 9.5, -1, Number.NaN]) expect(reason(good({ reps }))).toBe("reps_invalid");
    expect(reason(good({ reps: null }))).toBe("ok");
  });
  it("accepts only fixed rationale keys, so a model cannot write pain or medical advice", () => {
    for (const k of MODEL_RATIONALE_KEYS) expect(reason(good({ rationaleKey: k }))).toBe("ok");
    expect(reason(good({ rationaleKey: "Ignore the pain in your shoulder and add 20kg" }))).toBe("bad_rationale_key");
    expect(reason(good({ rationaleKey: "model.rationale.unknown" }))).toBe("bad_rationale_key");
  });
  it("rejects bad confidence values and wrong shapes", () => {
    expect(reason(good({ confidence: "certain" as never }))).toBe("bad_confidence");
    for (const a of [null, undefined, "32.5", 32.5, [], {}, { load: 32.5 }, { load: "32.5", reps: 8, rationaleKey: MODEL_RATIONALE_KEYS[0], confidence: "low" }]) expect(["bad_shape", "bad_rationale_key"]).toContain(reason(a));
  });
  it("an answer identical to the rule is not a second option", () => {
    const r = flagged();
    expect(reason(good({ load: r.ruleProposal.load!, reps: r.ruleProposal.reps }), r)).toBe("same_as_rule");
  });
  it("a gym with no loads for the equipment gets no model advice", () => {
    const none: GymFingerprint = { gymId: "gymA", loads: [] };
    expect(vet(good(), flagged(), none)).toEqual({ ok: false, reason: "no_gym_loads" });
  });
});

describe("adviseWithGuardrails: the rule always stands", () => {
  const advisor = (f: () => Promise<ModelAdvice | null>): ModelAdvisor => ({ advise: f });
  it("returns the rule untouched plus a labelled second option and a path=model log; nothing is applied", async () => {
    const r = flagged();
    const before = JSON.stringify(r);
    const out = await adviseWithGuardrails(r, gymA, advisor(async () => good()));
    expect(out.rule).toBe(r.ruleProposal);
    expect(JSON.stringify(r)).toBe(before);
    expect(out.model).toEqual(good());
    expect(out.log).toMatchObject({ path: "model", verdict: "shown", appliedWithoutTap: false, ruleLoad: r.ruleProposal.load, modelLoad: 32.5 });
  });
  it("offline (no advisor) = the rule only, no log", async () => {
    const r = flagged();
    expect(await adviseWithGuardrails(r, gymA, null)).toEqual({ rule: r.ruleProposal, model: null, log: null });
  });
  it("does not even call the advisor for an unflagged case", async () => {
    const p = proposeNext({ exercise: exDb(), gym: gymA, asOf: ASOF, history: run(line, 30, [10, 10, 10]) });
    let called = 0;
    const out = await adviseWithGuardrails({ ruleProposal: p, inputs: p.inputs }, gymA, advisor(async () => (called++, good())));
    expect(called).toBe(0);
    expect(out.model).toBeNull();
  });
  it("a throwing advisor, a null answer and a slow advisor all fall back to the rule silently", async () => {
    const r = flagged();
    for (const f of [async () => { throw new Error("offline"); }, async () => null, () => new Promise<ModelAdvice | null>(() => undefined)]) {
      const out = await adviseWithGuardrails(r, gymA, advisor(f), { timeoutMs: 20 });
      expect(out.rule).toBe(r.ruleProposal);
      expect(out.model).toBeNull();
      expect(out.log?.verdict).toBe("unavailable");
    }
  });
  it("an adversarial answer is logged with the reason and never shown", async () => {
    const r = flagged();
    const out = await adviseWithGuardrails(r, gymA, advisor(async () => good({ load: 500 })));
    expect(out.model).toBeNull();
    expect(out.log).toMatchObject({ path: "model", verdict: "load_not_in_gym", modelLoad: 500, appliedWithoutTap: false });
  });
  it("an advisor that tampers with the request it was given cannot change the rule proposal", async () => {
    const r = flagged();
    const frozen = structuredClone(r.ruleProposal);
    const out = await adviseWithGuardrails(r, gymA, advisor(async function (this: unknown) { return good(); }));
    const tamper: ModelAdvisor = {
      advise: async (req) => {
        req.ruleProposal.load = 999;
        req.inputs.gym.anchorLoad = 999;
        return good();
      },
    };
    const out2 = await adviseWithGuardrails(r, gymA, tamper);
    expect(out.model).toEqual(good());
    expect(out2.model).toEqual(good());
    expect(r.ruleProposal).toEqual(frozen);
    expect(out2.rule.load).toBe(frozen.load);
  });
});
