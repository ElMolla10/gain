import { describe, expect, it } from "vitest";
import { actionOf, hasNumber } from "../src/logic/decisionText";
import { describeDecisionSafe, type DecisionPayload } from "../src/logic/why";
import { translate } from "../src/i18n/format";
import type { StringKey } from "../src/i18n/strings";
import { freshDb } from "./helpers";

const L = (lang: "en" | "ar") => (k: string, p?: Record<string, string | number>) => translate(lang, k as StringKey, p);

/** Three rotations of the 4-day program so bench has history; returns every context needed. */
async function setup() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const gymId = (await ctx.repos.getActiveGymId())!;
  const gym = await ctx.repos.loadGymFingerprint(gymId);
  let lastWritten: string | null = null;
  const trainNext = async (benchReps?: number) => {
    const next = (await ctx.repos.getNextDay())!;
    const exs = await ctx.repos.listDayExercises(next.day.id);
    const { id } = await ctx.workout.startOrResumeSession(next.day.id, gymId);
    const ex = exs[0]!;
    const sets = benchReps && ex.nameEn === "Barbell Bench Press" ? [[60, benchReps], [60, benchReps], [60, benchReps]] : [[50, 10]];
    for (const [load, reps] of sets) await ctx.workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load: load!, reps: reps! }, { gym, equipment: ex.equipment, setup: ex.setup });
    ctx.deps.tick(1000);
    await ctx.workout.finishSession(id);
    const w = await ctx.finish.writeNextSessionTargets(id);
    lastWritten = w!.sessionId;
    ctx.deps.tick(86_400_000);
    return w!.sessionId;
  };
  for (let r = 0; r < 3; r++) for (let d = 0; d < 4; d++) await trainNext(r === 0 ? 9 : 10);
  return { ...ctx, gymId, gym, trainNext, planned: () => lastWritten! };
}

describe("decision log list", () => {
  it("lists decisions newest first with lift, gym, rule version, path and the sentence", async () => {
    const { decisions } = await setup();
    const all = await decisions.list({ limit: 500 });
    expect(all.length).toBeGreaterThan(10);
    for (let i = 1; i < all.length; i++) expect(all[i - 1]!.decidedAt).toBeGreaterThanOrEqual(all[i]!.decidedAt);
    const d = all[0]!;
    expect(d).toMatchObject({ ruleVersion: "rule-v0.3", path: "rule" });
    expect(d.nameEn).toBeTruthy();
    expect(d.nameAr).toMatch(/[\u0600-\u06FF]/);
    expect(d.gymName).toBeTruthy();
    expect(d.reason.key).toBeTruthy();
    expect(await decisions.count()).toBe(all.length);
  });

  it("filters by lift, pages, and the lift filter list counts decisions", async () => {
    const { decisions } = await setup();
    const lifts = await decisions.lifts();
    expect(lifts.length).toBeGreaterThan(1);
    const bench = lifts.find((l) => l.nameEn === "Barbell Bench Press")!;
    const onlyBench = await decisions.list({ exerciseId: bench.exerciseId });
    expect(onlyBench).toHaveLength(bench.count);
    expect(onlyBench.every((x) => x.exerciseId === bench.exerciseId)).toBe(true);
    expect(await decisions.count(bench.exerciseId)).toBe(bench.count);
    expect(await decisions.list({ limit: 2 })).toHaveLength(2);
    expect((await decisions.list({ limit: 2, offset: 2 }))[0]!.targetId).toBe((await decisions.list({ limit: 4 }))[2]!.targetId);
    expect(lifts.reduce((n, l) => n + l.count, 0)).toBe(await decisions.count());
  });

  it("shows what the lifter did: unanswered, accepted, edited, declined", async () => {
    const { decisions, finish, gym, planned, workout, repos } = await setup();
    const targets = await finish.getTargets(planned());
    const withNumber = targets.filter((t) => t.currency !== "none" && t.load !== null);
    expect(withNumber.length).toBeGreaterThanOrEqual(1);
    const t0 = withNumber[0]!;
    const row = async (id: string) => (await decisions.list({ limit: 200 })).find((x) => x.targetId === id)!;
    expect(actionOf(await row(t0.id)).key).toBe("dec.action.proposed");
    await finish.acceptTarget(t0.id);
    expect(actionOf(await row(t0.id)).key).toBe("dec.action.accepted");
    const session = (await workout.getSession(planned()))!;
    const ex = (await repos.listDayExercises(session.programme_day_id)).find((e) => e.exerciseId === t0.exerciseId)!;
    await finish.editTargetLoad(t0.id, t0.load!, gym, ex.equipment, ex.setup);
    const edited = actionOf(await row(t0.id));
    expect(edited.key).toBe("dec.action.edited");
    expect(edited.editedLoad).toBe(t0.load);
    await finish.rejectTarget(t0.id);
    expect(actionOf(await row(t0.id)).key).toBe("dec.action.rejected");
  });

  it("actionOf and hasNumber cover every state", () => {
    const base = { status: "proposed" as const, sessionStatus: "planned", editedLoad: null, currency: "load" };
    expect(actionOf(base).key).toBe("dec.action.proposed");
    expect(actionOf({ ...base, sessionStatus: "finished" }).key).toBe("dec.action.proposedDone");
    expect(actionOf({ ...base, status: "edited", editedLoad: 57.5 })).toEqual({ key: "dec.action.edited", editedLoad: 57.5 });
    expect(hasNumber({ load: 60, reps: 8, currency: "load" })).toBe(true);
    expect(hasNumber({ load: null, reps: null, currency: "none" })).toBe(false);
  });

  it("every listed decision traces to its stored inputs (observed sessions, gym loads, rule)", async () => {
    const { decisions, finish } = await setup();
    for (const d of await decisions.list({ limit: 200 })) {
      const stored = await finish.getDecision(d.targetId);
      expect(stored, d.targetId).not.toBeNull();
      const sections = describeDecisionSafe(stored!.payload, { ruleVersion: stored!.ruleVersion, path: stored!.path, reason: d.reason }, L("en"), "en");
      const titles = sections.map((s) => s.title);
      expect(titles).toContain(L("en")("why.observed"));
      expect(sections.flatMap((s) => s.lines).join(" ")).toContain(d.ruleVersion);
    }
  });

  it("rewritten (soft-deleted) planned targets are not listed twice", async () => {
    const { decisions, finish, repos, gymId, planned } = await setup();
    const before = await decisions.count();
    await finish.refreshPlannedSessions(gymId); // proposed targets are rewritten: old ones soft-deleted, new ones logged
    void repos; void planned;
    expect(await decisions.count()).toBe(before);
  });
});

describe("old rule versions still render", () => {
  it("a decision stored under an older rule with an unknown reason key and an unreadable payload does not crash", async () => {
    const { decisions, finish, db, planned } = await setup();
    const t = (await finish.getTargets(planned()))[0]!;
    await db.run("UPDATE target SET rule_version = 'rule-v0.1', reason_key = 'legacy_reason_x', reason_params_json = '{\"load\":55}' WHERE id = ?", [t.id]);
    await db.run("UPDATE decision_log SET rule_version = 'rule-v0.1', inputs_json = '{\"old\":true}' WHERE target_id = ?", [t.id]);
    const d = (await decisions.list({ limit: 200 })).find((x) => x.targetId === t.id)!;
    expect(d.ruleVersion).toBe("rule-v0.1");
    expect(d.reason).toEqual({ key: "legacy_reason_x", params: { load: 55 } });
    const stored = (await finish.getDecision(t.id))!;
    for (const lang of ["en", "ar"] as const) {
      const sections = describeDecisionSafe(stored.payload, { ruleVersion: stored.ruleVersion, path: stored.path, reason: d.reason }, L(lang), lang);
      const text = sections.flatMap((s) => s.lines).join("\n");
      expect(text).toContain("rule-v0.1");
      expect(text).toContain("legacy_reason_x");
    }
  });
  it("null payload and corrupt parameters also fall back", async () => {
    const reason = { key: "x", params: {} } as never;
    const s = describeDecisionSafe(null, { ruleVersion: "rule-v0.0", path: "rule", reason }, L("en"), "en");
    expect(s.flatMap((x) => x.lines).join(" ")).toContain("rule-v0.0");
    const bad = { proposal: { reason }, inputs: {} } as unknown as DecisionPayload;
    expect(() => describeDecisionSafe(bad, { ruleVersion: "rule-v0.0", path: "rule", reason }, L("en"), "en")).not.toThrow();
  });
});
