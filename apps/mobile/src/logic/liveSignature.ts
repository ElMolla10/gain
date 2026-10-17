import type { Decision } from "@gain/engine";
import { nextAdaptiveRow } from "./liveAdaptation";
import type { SetRowDraft } from "./workoutRows";

/**
 * What in the logger rows can change a live suggestion card: each row's identity, kind and saved state, the values of saved rows,
 * and for the next adaptive row its ghost target and whether its reps box is empty (expected reps fill only an empty box).
 * Draft values typed into unsaved rows are left out: since #219 they are never model input, so a keystroke keeps the signature.
 */
export function rowsSignature(rows: Record<string, SetRowDraft[]>): string {
  return JSON.stringify(Object.keys(rows).sort().map((id) => {
    const list = rows[id] ?? [];
    const next = nextAdaptiveRow(list);
    return [id, list.map((r) => [r.key, r.saved ? 1 : 0, r.dirty ? 1 : 0, r.warmup ? 1 : 0, r.tags.join(","), r.saved ? [r.load, r.reps, r.rir] : 0]),
      next ? [next.key, next.ghostLoad, next.ghostReps, next.reps === null ? 1 : 0] : null];
  }));
}

type Card = { decision: Decision; key: string; performance: string; fatigueKey: string; specKey: string; starting?: boolean };
const cardSame = (a: Card, b: Card) => a === b || (a.key === b.key && a.performance === b.performance && a.fatigueKey === b.fatigueKey && a.specKey === b.specKey
  && !!a.starting === !!b.starting && JSON.stringify(a.decision) === JSON.stringify(b.decision));

/** Same exercises with the same cards (by key, performance and decision): setting state again would only force another render. */
export function liveCardsEqual(a: Record<string, Card>, b: Record<string, Card>): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => b[k] !== undefined && cardSame(a[k]!, b[k]!));
}
