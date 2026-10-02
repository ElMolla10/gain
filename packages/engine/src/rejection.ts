import type { RejectionMemory, RejectionRecord } from "./types";

/** After this many rejections of the same jump kind on a line, stop proposing it. */
export const REJECTION_THRESHOLD = 3;

export const emptyRejectionMemory = (): RejectionMemory => ({ records: [] });

const find = (m: RejectionMemory, lineKey: string, jumpKind: string) =>
  m.records.find((r) => r.lineKey === lineKey && r.jumpKind === jumpKind);

export function rejectionCount(m: RejectionMemory, lineKey: string, jumpKind: string): number {
  return find(m, lineKey, jumpKind)?.count ?? 0;
}

export function isJumpBlocked(
  m: RejectionMemory,
  lineKey: string,
  jumpKind: string,
  threshold: number = REJECTION_THRESHOLD,
): boolean {
  return rejectionCount(m, lineKey, jumpKind) >= threshold;
}

/** Returns a new memory (inputs are never mutated). */
export function recordRejection(
  m: RejectionMemory,
  lineKey: string,
  jumpKind: string,
  at: string,
): RejectionMemory {
  const existing = find(m, lineKey, jumpKind);
  const next: RejectionRecord = {
    lineKey,
    jumpKind,
    count: (existing?.count ?? 0) + 1,
    lastRejectedAt: at,
  };
  return { records: [...m.records.filter((r) => r !== existing), next] };
}

/** Accepting (or loading) a jump of that kind clears its rejection count: the lifter has changed their mind. */
export function recordAcceptance(m: RejectionMemory, lineKey: string, jumpKind: string): RejectionMemory {
  return { records: m.records.filter((r) => !(r.lineKey === lineKey && r.jumpKind === jumpKind)) };
}

export const recordsForLine = (m: RejectionMemory, lineKey: string): RejectionRecord[] =>
  m.records.filter((r) => r.lineKey === lineKey);
