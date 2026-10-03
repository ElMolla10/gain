import { allowsZero, findSpec, isGymLoad, nextLoadAbove, nextLoadBelow } from "./loads";
import type { ModelAdvice, ModelAdvisor, ModelRequest } from "./model";
import type { GymFingerprint, Proposal } from "./types";

/**
 * Guardrails for the future model layer (Step 23). PURE CODE: nothing here calls a model, a server or the network, and the app does not
 * use it yet. It exists so the rules a model's answer must pass are written down and tested BEFORE any model is connected.
 *
 * The rules (MASTER-PLAN Step 23):
 *  - a model is only asked about a case the rule engine flagged (`needsModel.needed`);
 *  - it can never invent history: no comparable history, no model advice;
 *  - its output is data, never prose: a rationale KEY from a fixed list (so it cannot give pain or medical advice in words);
 *  - the load must exist in this gym and be within ONE gym step of the rule's anchor (re-checked here, not trusted);
 *  - reps must be a whole number inside the rep range;
 *  - the rule proposal is never changed: advice is a second, labelled option, and nothing applies without the lifter's tap;
 *  - offline, slow, wrong or crashing model = the rule proposal alone, no error shown;
 *  - every call is logged with `path: "model"` (accepted or rejected, and why).
 */
export const MODEL_RATIONALE_KEYS = ["model.rationale.trend_up", "model.rationale.trend_flat", "model.rationale.recover", "model.rationale.repeat_last"] as const;

export type ModelRejection =
  | "not_flagged"
  | "no_history"
  | "no_gym_loads"
  | "bad_shape"
  | "bad_rationale_key"
  | "bad_confidence"
  | "no_anchor"
  | "load_missing"
  | "load_not_in_gym"
  | "load_out_of_step"
  | "reps_invalid"
  | "same_as_rule"
  | "unavailable";

export interface VettedAdvice {
  load: number;
  reps: number | null;
  rationaleKey: (typeof MODEL_RATIONALE_KEYS)[number];
  confidence: ModelAdvice["confidence"];
}

export type Vetted = { ok: true; advice: VettedAdvice } | { ok: false; reason: ModelRejection };

/** What goes in the decision log for a model call. `appliedWithoutTap` is always false: there is no code path that sets it true. */
export interface ModelLogEntry {
  path: "model";
  lineKey: string;
  ruleLoad: number | null;
  ruleReps: number | null;
  modelLoad: number | null;
  modelReps: number | null;
  verdict: "shown" | ModelRejection;
  appliedWithoutTap: false;
}

export interface ModelOutcome {
  /** Always the untouched rule proposal. */
  rule: Proposal;
  /** A second option to show next to the rule, or null (offline, unflagged, rejected, ...). */
  model: VettedAdvice | null;
  log: ModelLogEntry | null;
}

const isInt = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x);

/** Checks a model's answer. `advice` is untrusted (unknown shape) on purpose. */
export function vetModelAdvice(request: ModelRequest, gym: GymFingerprint, advice: unknown): Vetted {
  const { ruleProposal, inputs } = request;
  if (!ruleProposal.needsModel.needed) return { ok: false, reason: "not_flagged" };
  if (inputs.sessions.length === 0 || ruleProposal.status === "no_history") return { ok: false, reason: "no_history" };
  const spec = findSpec(gym, inputs.gym.equipment);
  if (!spec || ruleProposal.status === "no_gym_loads") return { ok: false, reason: "no_gym_loads" };

  if (typeof advice !== "object" || advice === null) return { ok: false, reason: "bad_shape" };
  const a = advice as Record<string, unknown>;
  if (!("load" in a) || !("reps" in a)) return { ok: false, reason: "bad_shape" };
  if (!(MODEL_RATIONALE_KEYS as readonly unknown[]).includes(a.rationaleKey)) return { ok: false, reason: "bad_rationale_key" };
  if (a.confidence !== "low" && a.confidence !== "medium" && a.confidence !== "high") return { ok: false, reason: "bad_confidence" };

  const load = a.load;
  if (typeof load !== "number" || !Number.isFinite(load)) return { ok: false, reason: load === null ? "load_missing" : "bad_shape" };
  const zero = allowsZero(inputs.line.setup);
  if (load < 0 || !isGymLoad(spec, load, zero)) return { ok: false, reason: "load_not_in_gym" };

  const anchor = inputs.gym.anchorLoad ?? ruleProposal.load;
  if (anchor === null || anchor === undefined) return { ok: false, reason: "no_anchor" };
  const harder = inputs.gym.nextHarderLoad ?? nextLoadAbove(spec, anchor, zero);
  const easier = inputs.gym.nextEasierLoad ?? nextLoadBelow(spec, anchor, zero);
  const lo = easier ?? anchor;
  const hi = harder ?? anchor;
  if (load < Math.min(lo, anchor) - 1e-6 || load > Math.max(hi, anchor) + 1e-6) return { ok: false, reason: "load_out_of_step" };

  let reps: number | null = null;
  if (a.reps !== null) {
    if (!isInt(a.reps) || a.reps < inputs.repRange.min || a.reps > inputs.repRange.max) return { ok: false, reason: "reps_invalid" };
    reps = a.reps;
  }
  if (load === ruleProposal.load && reps === ruleProposal.reps) return { ok: false, reason: "same_as_rule" };
  return { ok: true, advice: { load, reps, rationaleKey: a.rationaleKey as VettedAdvice["rationaleKey"], confidence: a.confidence } };
}

const logOf = (request: ModelRequest, advice: unknown, verdict: ModelLogEntry["verdict"]): ModelLogEntry => {
  const a = typeof advice === "object" && advice !== null ? (advice as Record<string, unknown>) : {};
  const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
  return {
    path: "model",
    lineKey: request.inputs.lineKey,
    ruleLoad: request.ruleProposal.load,
    ruleReps: request.ruleProposal.reps,
    modelLoad: num(a.load),
    modelReps: num(a.reps),
    verdict,
    appliedWithoutTap: false,
  };
};

/**
 * Asks the advisor (if there is one, the case is flagged, and it answers in time) and returns the rule proposal plus an optional vetted second
 * option. Never throws, never edits the rule proposal (the advisor gets a copy), and an unavailable model is silent: the lifter just sees the rule's number.
 */
export async function adviseWithGuardrails(
  request: ModelRequest,
  gym: GymFingerprint,
  advisor: ModelAdvisor | null,
  opts: { timeoutMs?: number } = {},
): Promise<ModelOutcome> {
  const rule = request.ruleProposal;
  if (!advisor || !rule.needsModel.needed) return { rule, model: null, log: null };
  let answer: unknown = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), opts.timeoutMs ?? 4000);
    });
    answer = await Promise.race([advisor.advise(structuredClone(request)), timeout]);
  } catch {
    return { rule, model: null, log: logOf(request, null, "unavailable") };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
  if (answer === null || answer === undefined) return { rule, model: null, log: logOf(request, null, "unavailable") };
  const v = vetModelAdvice(request, gym, answer);
  return v.ok ? { rule, model: v.advice, log: logOf(request, answer, "shown") } : { rule, model: null, log: logOf(request, answer, v.reason) };
}
