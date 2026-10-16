import { consecutiveWorkouts, monthImprovementPct, paceImproved, type HistorySession, type PaceStatus, type SetupType } from "@gain/engine";

export type MilestoneKind = "goal_reached" | "goal_improved" | "streak" | "month_pct";

export interface Milestone {
  kind: MilestoneKind;
  streak?: number;
  pct?: number;
  status?: PaceStatus;
}

const MIN_STREAK = 3;

/** Session-level facts for the finish recap. Nothing here is stored; it is derived from logs already on the phone. */
export function sessionMilestones(input: {
  finishedAt: number[];
  nowMs: number;
  monthHistory: HistorySession[] | null;
  monthSetup: SetupType | null;
  trainedGoalLift: boolean;
  paceBefore: PaceStatus | null;
  paceAfter: PaceStatus | null;
}): Milestone[] {
  const out: Milestone[] = [];
  if (input.trainedGoalLift && input.paceAfter === "reached") out.push({ kind: "goal_reached" });
  else if (input.trainedGoalLift && input.paceBefore && input.paceAfter && paceImproved(input.paceBefore, input.paceAfter)) {
    out.push({ kind: "goal_improved", status: input.paceAfter });
  }
  const streak = consecutiveWorkouts(input.finishedAt, input.nowMs);
  if (streak >= MIN_STREAK) out.push({ kind: "streak", streak });
  if (input.monthHistory && input.monthSetup) {
    const pct = monthImprovementPct(input.monthHistory, input.monthSetup, input.nowMs);
    if (pct != null && pct > 0) out.push({ kind: "month_pct", pct });
  }
  return out;
}
