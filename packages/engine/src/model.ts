import type { DecisionInputs, Proposal } from "./types";

/**
 * Typed seam for a later model layer. NOTHING in this package implements or calls it.
 * The rule engine sets `proposal.needsModel` when it is unsure. A model may then offer an alternative,
 * but it can never invent history, and nothing changes the plan until the lifter accepts.
 */
export interface ModelRequest {
  ruleProposal: Proposal;
  inputs: DecisionInputs;
}

export interface ModelAdvice {
  /** Must be a load that exists in the gym and within one gym step of the rule's anchor; `vetModelAdvice` (modelGuard.ts) re-checks it. */
  load: number | null;
  /** Must be a whole number inside the lift's rep range. */
  reps: number | null;
  /** A key from MODEL_RATIONALE_KEYS. Never free text: the model cannot write anything the lifter reads. */
  rationaleKey: string;
  confidence: "low" | "medium" | "high";
}

export interface ModelAdvisor {
  advise(request: ModelRequest): Promise<ModelAdvice | null>;
}
