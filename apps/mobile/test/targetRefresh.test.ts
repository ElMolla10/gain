import { describe, expect, it } from "vitest";
import { proposeNext, type GymFingerprint, type HistorySession } from "@gain/engine";
import type { TargetRow } from "../src/db/finishRepo";
import { staleOffGridTarget } from "../src/logic/targetRefresh";

const gym: GymFingerprint = { gymId: "g", loads: [{ equipment: "dumbbell", increment: 2.5, min: 2.5 }] };
const line = { exerciseId: "preacher", gymId: "g", setup: "free" as const };
const history: HistorySession[] = [{ line, performedAt: "2026-10-10T21:20:00Z", sets: [{ load: 12, reps: 14 }, { load: 14, reps: 10 }] }];
const proposal = proposeNext({ exercise: { exerciseId: "preacher", name: "Preacher Curl (Dumbbell)", equipment: "dumbbell", setup: "free", repRange: { min: 8, max: 10 }, plannedSets: 2 }, gym, history, asOf: "2026-10-15T06:00:00Z" });
const saved = { status: "proposed", effectiveLoad: 12.5 } as TargetRow;

describe("an already planned workout after the grid correction", () => {
  it("shows the corrected trusted 14 kg load even when an old planned target said 12.5 kg", () => {
    expect(proposal.load).toBe(14);
    expect(staleOffGridTarget(saved, proposal)).toBe(true);
  });
  it("keeps edited and accepted targets, and does not override an intentional non-grid deload", () => {
    expect(staleOffGridTarget({ ...saved, status: "edited" }, proposal)).toBe(false);
    expect(staleOffGridTarget({ ...saved, status: "accepted" }, proposal)).toBe(false);
    expect(staleOffGridTarget(saved, { ...proposal, load: 12.5 })).toBe(false);
  });
});
