// The set scheme as a row of pips (design audit P-3): top sets, back-offs, or straight working sets. Pure, so tests can check it.
export type Pip = "top" | "backoff" | "work";

/** One pip per set: the first `topSets` are top sets and the rest back-offs; a straight scheme (no top sets) is all "work". */
export function schemePips(sets: number, topSets: number | null | undefined): Pip[] {
  const n = Math.max(0, Math.floor(sets));
  const top = topSets ? Math.min(n, Math.max(0, Math.floor(topSets))) : 0;
  if (!top) return Array.from({ length: n }, () => "work" as const);
  return Array.from({ length: n }, (_, i) => (i < top ? "top" : "backoff"));
}

export function schemeCounts(pips: readonly Pip[]): { top: number; backoff: number } {
  return { top: pips.filter((x) => x === "top").length, backoff: pips.filter((x) => x === "backoff").length };
}
