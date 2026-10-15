import type { Proposal } from "@gain/engine";
import type { TargetRow } from "../db/finishRepo";

/** An untouched planned target from an older build may have rounded a trusted logged load down.
 * Show the fresh rule proposal for that one case without changing accepted or edited targets. */
export function staleOffGridTarget(stored: TargetRow | null, proposal: Proposal): boolean {
  if (stored?.status !== "proposed" || stored.effectiveLoad === null || proposal.status !== "proposed" || proposal.load === null) return false;
  if (!proposal.warnings.includes("anchor_off_gym_loads")) return false;
  const trustedTop = proposal.inputs.sessions[0]?.topLoad;
  return trustedTop !== undefined && stored.effectiveLoad < trustedTop - 1e-6 && proposal.load >= trustedTop - 1e-6;
}
