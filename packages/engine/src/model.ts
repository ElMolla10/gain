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
  load: number | null;
  reps: number | null;
  /** Must be a load that exists in the gym; the caller re-checks before showing it. */
  rationaleKey: string;
  confidence: "low" | "medium" | "high";
}

export interface ModelAdvisor {
  advise(request: ModelRequest): Promise<ModelAdvice | null>;
}
