import type { GymLoadSpec, LoggedSet } from "./types";
import { isTrustedWorkingSet } from "./outlier";
import { nextLoadBelow } from "./loads";

/** Stored on a logged working set. Never inferred from the weight, and never a replacement for warmup / drop / failure. */
export const ROLE_TOP_TAG = "role:top";
export const ROLE_BACKOFF_TAG = "role:backoff";
/** Stable 1-based working-set identity. Written once. A later delete or a reorder must not move it. */
export const SLOT_TAG_PREFIX = "slot:";

export type SetRole = "top" | "backoff";

/** One working set of the next session. `position` is the 1-based slot, not "whichever row is first on screen". */
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

/** First `slot:N` tag, 1-based. Anything else (including `slot:0` or junk) is ignored. */
export function slotOfTags(tags: readonly string[] | undefined): number | null {
  if (!tags) return null;
  for (const t of tags) {
    if (!t.startsWith(SLOT_TAG_PREFIX)) continue;
    const n = Number(t.slice(SLOT_TAG_PREFIX.length));
    if (Number.isInteger(n) && n >= 1) return n;
  }
  return null;
}

export function roleForSlot(topSets: number, slot: number): SetRole {
  return slot <= topSets ? "top" : "backoff";
}

const stripSlotRole = (tags: readonly string[]): string[] => tags.filter((t) => t !== ROLE_TOP_TAG && t !== ROLE_BACKOFF_TAG && !t.startsWith(SLOT_TAG_PREFIX));

const isScheme = (topSets: number | null | undefined, plannedSets: number | null | undefined): topSets is number =>
  typeof topSets === "number" && topSets >= 1 && (plannedSets == null || topSets < plannedSets);

/**
 * Tags to store when a set is logged or updated.
 * Warm-up or drop: slot and role come off (failure and any other tag stay).
 * A set that already has a slot keeps that slot; the role follows the slot.
 * A set that already has a role and no slot keeps the role. No new index is invented, so a delete cannot turn a back-off into a top set.
 * Otherwise the caller's slot is written, and only when this exercise is a real top-set scheme. Straight sets are not retagged.
 */
export function tagsForLoggedSet(args: {
  tags: readonly string[];
  warmup: boolean;
  topSets: number | null | undefined;
  plannedSets: number | null | undefined;
  slot?: number | null;
}): string[] {
  if (args.warmup || args.tags.includes("drop")) return stripSlotRole(args.tags);
  if (!isScheme(args.topSets, args.plannedSets)) return [...args.tags];
  const rest = stripSlotRole(args.tags);
  const existingSlot = slotOfTags(args.tags);
  if (existingSlot != null) {
    const role = roleForSlot(args.topSets, existingSlot);
    return [...rest, `${SLOT_TAG_PREFIX}${existingSlot}`, role === "top" ? ROLE_TOP_TAG : ROLE_BACKOFF_TAG];
  }
  if (roleOfTags(args.tags)) {
    const role = roleOfTags(args.tags)!;
    return [...rest, role === "top" ? ROLE_TOP_TAG : ROLE_BACKOFF_TAG];
  }
  if (args.slot != null && args.slot >= 1) {
    const role = roleForSlot(args.topSets, args.slot);
    return [...rest, `${SLOT_TAG_PREFIX}${args.slot}`, role === "top" ? ROLE_TOP_TAG : ROLE_BACKOFF_TAG];
  }
  return rest;
}

/** Write a slot whose role already agrees with the set. Used when a session is opened, not when an edit recomputes position. */
export function tagsWithSlot(tags: readonly string[], slot: number, topSets: number): string[] {
  const role = roleForSlot(topSets, slot);
  return [...stripSlotRole(tags), `${SLOT_TAG_PREFIX}${slot}`, role === "top" ? ROLE_TOP_TAG : ROLE_BACKOFF_TAG];
}

/**
 * Trusted working sets that are judged for a top-set / back-off scheme.
 * Straight sets (no real scheme): every trusted set, so the heaviest load of the session still wins.
 * Scheme with no slot and no role tag: nothing is judged. Log order is not identity, so an old session cannot
 * earn a load increase and a heavier set logged later is not presented as the top.
 * Scheme with any slot or role tag: slot wins (`slot` <= topSets), else `role:top`. A lighter set inside that group stays in it.
 * A heavier set outside it is not the top. If the tags name no top set, the result is empty: back-offs are not promoted.
 */
export function selectJudgedSets(trusted: LoggedSet[], topSets: number | null | undefined, plannedSets: number | null | undefined): LoggedSet[] {
  if (!isScheme(topSets, plannedSets)) return trusted;
  const n = Math.max(1, Math.floor(topSets));
  const anySlot = trusted.some((x) => slotOfTags(x.tags) != null);
  const anyRole = trusted.some((x) => roleOfTags(x.tags) !== null);
  if (anySlot || anyRole) {
    return trusted.filter((x) => {
      const slot = slotOfTags(x.tags);
      if (slot != null) return slot <= n;
      return roleOfTags(x.tags) === "top";
    });
  }
  return [];
}

/** True when a top-set session recorded which sets were the top sets (a slot or a role tag). Untagged history has no identity: callers must not line it up as top then back-off. */
export function topIdentityKnown(sets: readonly { warmup?: boolean; tags?: readonly string[] }[]): boolean {
  return sets.some((s) => !s.warmup && !s.tags?.includes("drop") && (slotOfTags(s.tags) != null || roleOfTags(s.tags) != null));
}

/**
 * Last session's working sets lined up by slot. A hole is null, never the neighbour's load.
 * No slot tags: log order of non-warmup, non-drop sets. That is correct for straight sets.
 * A top-set scheme must not call this on a session that fails `topIdentityKnown`: log order is not a top set.
 */
export function workingLoadsBySlot(sets: readonly { load: number; reps: number; warmup?: boolean; tags?: readonly string[] }[]): ({ load: number; reps: number } | null)[] {
  const working = sets.filter((s) => !s.warmup && !s.tags?.includes("drop"));
  if (!working.some((s) => slotOfTags(s.tags) != null)) return working.map((s) => ({ load: s.load, reps: s.reps }));
  let max = 0;
  for (const s of working) {
    const slot = slotOfTags(s.tags);
    if (slot != null && slot > max) max = slot;
  }
  const out: ({ load: number; reps: number } | null)[] = Array.from({ length: max }, () => null);
  for (const s of working) {
    const slot = slotOfTags(s.tags);
    if (slot == null || out[slot - 1] != null) continue;
    out[slot - 1] = { load: s.load, reps: s.reps };
  }
  return out;
}

/**
 * The load a jump check or an empty-target prefill may call "last time".
 * Straight sets: the same heaviest-load reduce as before (`load >`, including assisted, where a smaller number is harder — that quirk is left alone).
 * A scheme: the heaviest set inside the judged group only. No judged top set means null, so a heavier back-off is not "last time".
 */
export function progressionAnchor(sets: readonly LoggedSet[], topSets: number | null | undefined, plannedSets: number | null | undefined): LoggedSet | null {
  if (!isScheme(topSets, plannedSets)) {
    return sets.reduce<LoggedSet | null>((a, s) => (a === null || s.load > a.load ? s : a), null);
  }
  const trusted = sets.filter((x) => isTrustedWorkingSet(x) && x.reps >= 1 && Number.isFinite(x.load));
  const judged = selectJudgedSets(trusted, topSets, plannedSets);
  if (judged.length === 0) return null;
  return judged.reduce((a, s) => (s.load > a.load ? s : a));
}

/**
 * Where an empty back-off editor starts. Not the headline: one real step lighter, so one tap on save cannot write the top load onto the back-off.
 * At the bottom of the rack there is no lighter step, so the headline is the only number, and the lifter still has to press save.
 */
export function emptyBackoffStart(headline: number, spec: GymLoadSpec | null, allowZero: boolean): number {
  if (!spec || !Number.isFinite(headline)) return headline;
  return nextLoadBelow(spec, headline, allowZero) ?? headline;
}

/**
 * Next-session targets, one per planned working set. Null for straight sets (no real back-off scheme): the headline
 * target is the whole plan, as before. Top slots copy the engine proposal. Later slots copy last session's working
 * set at that same slot, or stay empty. A missing slot is empty. The top load is never copied onto a back-off slot.
 */
export function buildSetTargets(args: {
  plannedSets: number;
  topSets: number | null | undefined;
  top: { load: number | null; reps: number | null };
  lastWorking: readonly ({ load: number; reps: number } | null | undefined)[];
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
      const ok = !!prev && Number.isFinite(prev.load) && Number.isFinite(prev.reps);
      out.push({ position: i, role: "backoff", load: ok ? prev!.load : null, reps: ok ? prev!.reps : null });
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