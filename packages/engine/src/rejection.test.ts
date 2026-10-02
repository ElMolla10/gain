import { describe, expect, it } from "vitest";
import {
  emptyRejectionMemory,
  isJumpBlocked,
  recordAcceptance,
  recordRejection,
  recordsForLine,
  REJECTION_THRESHOLD,
  rejectionCount,
} from "./rejection";

describe("rejection memory", () => {
  const L = "bench|gymA|free";
  const K = "load:harder:2.5";
  it("starts empty and unblocked", () => {
    const m = emptyRejectionMemory();
    expect(rejectionCount(m, L, K)).toBe(0);
    expect(isJumpBlocked(m, L, K)).toBe(false);
  });
  it("the threshold is 3", () => expect(REJECTION_THRESHOLD).toBe(3));
  it("two rejections do not block, three do", () => {
    let m = emptyRejectionMemory();
    m = recordRejection(m, L, K, "2026-09-01");
    m = recordRejection(m, L, K, "2026-09-04");
    expect(isJumpBlocked(m, L, K)).toBe(false);
    m = recordRejection(m, L, K, "2026-09-08");
    expect(rejectionCount(m, L, K)).toBe(3);
    expect(isJumpBlocked(m, L, K)).toBe(true);
  });
  it("is immutable", () => {
    const m0 = emptyRejectionMemory();
    const m1 = recordRejection(m0, L, K, "2026-09-01");
    expect(m0.records).toHaveLength(0);
    expect(m1.records).toHaveLength(1);
  });
  it("counts per line and per jump kind", () => {
    let m = emptyRejectionMemory();
    for (let i = 0; i < 3; i++) m = recordRejection(m, L, K, "2026-09-01");
    expect(isJumpBlocked(m, "bench|home|free", K)).toBe(false);
    expect(isJumpBlocked(m, L, "load:harder:1.25")).toBe(false);
    expect(recordsForLine(m, L)).toHaveLength(1);
  });
  it("accepting a jump clears its count", () => {
    let m = emptyRejectionMemory();
    for (let i = 0; i < 3; i++) m = recordRejection(m, L, K, "2026-09-01");
    m = recordAcceptance(m, L, K);
    expect(isJumpBlocked(m, L, K)).toBe(false);
  });
  it("supports a custom threshold and remembers the last rejection date", () => {
    let m = recordRejection(emptyRejectionMemory(), L, K, "2026-09-01");
    m = recordRejection(m, L, K, "2026-09-09");
    expect(isJumpBlocked(m, L, K, 2)).toBe(true);
    expect(m.records[0]!.lastRejectedAt).toBe("2026-09-09");
  });
});
