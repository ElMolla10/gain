import type { LoggedSet } from "./types";

/** Stored on a logged working set. Never inferred from the weight, and never a replacement for warmup / drop / failure. */
export const ROLE_TOP_TAG = "role:top";
export const ROLE_BACKOFF_TAG = "role:backoff";

export type SetRole = "top" | "backoff";

/** One working set of the next session. `position` is 1-based in log order. */
export interface SetTarget {
  position: number;
  role: SetRole;
  load: number | null;
  reps: number | null;
}

export function roleOfTags(tags: readonly string[] | undefined): SetRole | null {
  if (!tags) return null;
  if (tags.includes(ROLE_TOP_TAG)) return "top";
  if (tags.includes(ROLE_BACKOFF_TAG)) return "backoff";
  return null;
}

const isScheme = (topSets: number | null | undefined, plannedSets: number | null | undefined): topSets is number =>
  typeof topSets === "number" && topSets >= 1 && (plannedSets == null || topSets < plannedSets);

/**
 * Trusted working sets that are judged for a top-set / back-off scheme.
 * Straight sets (no real scheme): every trusted set, so the heaviest load of the session still wins.
 * Scheme: sets tagged `role:top`, in order, when any set carries a role tag; otherwise the first `topSets`
 * trusted working sets in log order. A lighter set inside that group stays in it. A heavier set outside it is not the top.
 */
export function selectJudgedSets(trusted: LoggedSet[], topSets: number | null | undefined, plannedSets: number | null | undefined): LoggedSet[] {
  if (!isScheme(topSets, plannedSets)) return trusted;
  const n = Math.max(1, Math.floor(topSets));
  const anyRole = trusted.some((x) => roleOfTags(x.tags) !== null);
  if (anyRole) {
    const tagged = trusted.filter((x) => roleOfTags(x.tags) === "top");
    if (tagged.length > 0) return tagged;
  }
  return trusted.slice(0, n);
}

/**
 * Next-session targets, one per planned working set. Null for straight sets (no real back-off scheme): the headline
 * target is the whole plan, as before. Top slots copy the engine proposal. Later slots copy last session's working
 * set at that same index, or stay empty. The top load is never copied onto a back-off slot.
 */
export function buildSetTargets(args: {
  plannedSets: number;
  topSets: number | null | undefined;
  top: { load: number | null; reps: number | null };
  lastWorking: { load: number; reps: number }[];
}): SetTarget[] | null {
  const { plannedSets, topSets, top, lastWorking } = args;
  if (!(typeof topSets === "number" && topSets >= 1 && plannedSets >= 1 && topSets < plannedSets)) return null;
  const n = Math.floor(topSets);
  const sets = Math.floor(plannedSets);
  const out: SetTarget[] = [];
  for (let i = 1; i <= sets; i++) {
    if (i <= n) out.push({ position: i, role: "top", load: top.load, reps: top.reps });
    else {
      const prev = lastWorking[i - 1];
      out.push({ position: i, role: "backoff", load: prev ? prev.load : null, reps: prev ? prev.reps : null });
    }
  }
  return out;
}

/** Headline load edit: every top slot follows. Back-off slots are left alone. */
export function applyHeadlineLoad(targets: SetTarget[], load: number, reps?: number | null): SetTarget[] {
  return targets.map((s) => (s.role === "top" ? { ...s, load, reps: reps === undefined ? s.reps : reps } : s));
}

/** One slot. A top slot edits every top slot so they stay the same target. A back-off slot edits only itself. */
export function applySlotLoad(targets: SetTarget[], position: number, load: number, reps?: number | null): SetTarget[] {
  const slot = targets.find((s) => s.position === position);
  if (!slot) return targets;
  if (slot.role === "top") return applyHeadlineLoad(targets, load, reps);
  return targets.map((s) => (s.position === position ? { ...s, load, reps: reps === undefined ? s.reps : reps } : s));
}

/** Accept puts the top slots back on the proposed headline. Back-off edits the lifter already saved stay. */
export function acceptSetTargets(targets: SetTarget[], proposal: { load: number | null; reps: number | null }): SetTarget[] {
  return targets.map((s) => (s.role === "top" ? { ...s, load: proposal.load, reps: proposal.reps } : s));
}

export function parseSetTargets(json: string | null | undefined): SetTarget[] | null {
  if (json == null || json === "") return null;
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(v) || v.length === 0) return null;
  const out: SetTarget[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    const position = o.position;
    const role = o.role;
    if (typeof position !== "number" || !Number.isInteger(position) || position < 1) return null;
    if (role !== "top" && role !== "backoff") return null;
    if (o.load != null && typeof o.load !== "number") return null;
    if (o.reps != null && typeof o.reps !== "number") return null;
    out.push({
      position,
      role,
      load: typeof o.load === "number" && Number.isFinite(o.load) ? o.load : null,
      reps: typeof o.reps === "number" && Number.isFinite(o.reps) ? o.reps : null,
    });
  }
  return out;
}
