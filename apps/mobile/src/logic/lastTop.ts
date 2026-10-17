import { isTrustedWorkingSet, type LoggedSet } from "@gain/engine";

/**
 * The heaviest trusted working set of last time (9): warm-ups, drops and sets flagged as possible typos (unconfirmed/rejected) never
 * become the "last top" that the prefill falls back to. Null when none is trusted.
 */
export function topTrustedSet<S extends LoggedSet>(sets: readonly S[] | null | undefined): S | null {
  return (sets ?? []).filter(isTrustedWorkingSet).reduce<S | null>((a, s) => (a === null || s.load > a.load ? s : a), null);
}
