/**
 * Order, grouping and rest-timer rules for today's list of exercises: the session's saved order when one exists, otherwise program slots
 * in program order and exercises the lifter added after them, with supersets pulled next to each other. Pure, so it is tested without a
 * phone. Nothing here touches the program.
 */
export interface SlotState {
  slot: string;
  removed: boolean;
  added: boolean;
  position: number | null;
  superset: string | null;
}

export type StateMap = Record<string, Partial<SlotState> | undefined>;

const SS = "ss-";

/**
 * Slots in the order they are shown. `programmeSlots` = the day's exercises in program order. Before a session is reordered, added
 * exercises follow by the order they were added. A reorder writes a position for every shown programme slot, which makes position the
 * session-wide order. Removed ones are left out. The members of a superset (2 or more shown exercises with the same group) are shown
 * together, at the place of the first member, keeping their own relative order.
 */
export function orderSlots(programmeSlots: readonly string[], states: StateMap): string[] {
  const added = Object.values(states)
    .filter((s): s is Partial<SlotState> & { slot: string } => !!s && !!s.added && typeof s.slot === "string")
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((s) => s.slot);
  let base = [...programmeSlots, ...added.filter((s) => !programmeSlots.includes(s))].filter((s) => !states[s]?.removed);
  // Added exercises have always used position among themselves. A programme slot with a position is the unambiguous marker that this
  // workout has a saved session-wide order; reorder persistence writes every visible slot in one transaction.
  if (programmeSlots.some((s) => states[s]?.position !== null && states[s]?.position !== undefined)) {
    base = base
      .map((slot, index) => ({ slot, index, position: states[slot]?.position }))
      .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) || a.index - b.index)
      .map((x) => x.slot);
  }
  const members = new Map<string, string[]>();
  for (const s of base) {
    const g = states[s]?.superset;
    if (g) members.set(g, [...(members.get(g) ?? []), s]);
  }
  const out: string[] = [];
  for (const s of base) {
    if (out.includes(s)) continue;
    out.push(s);
    const g = states[s]?.superset;
    const all = g ? members.get(g) ?? [] : [];
    if (all.length >= 2) for (const m of all) if (!out.includes(m)) out.push(m);
  }
  return out;
}

/** Superset letter (A, B, ...) for each shown slot that really is in a superset (2+ shown members), in display order. */
export function supersetLabels(order: readonly string[], states: StateMap): Record<string, string> {
  const count = new Map<string, number>();
  for (const s of order) {
    const g = states[s]?.superset;
    if (g) count.set(g, (count.get(g) ?? 0) + 1);
  }
  const letter = new Map<string, string>();
  const out: Record<string, string> = {};
  for (const s of order) {
    const g = states[s]?.superset;
    if (!g || (count.get(g) ?? 0) < 2) continue;
    if (!letter.has(g)) letter.set(g, String.fromCharCode(65 + (letter.size % 26)));
    out[s] = letter.get(g)!;
  }
  return out;
}

export type MoveDirection = "up" | "down";
export type MoveOutcome = "moved" | "boundary" | "completed" | "missing";

/** A slot is complete only when its prescribed number of ordinary/failure working sets is saved. */
export function completedWorkoutSlots(
  exercises: readonly { slot: string; exerciseId: string; sets: number }[],
  loggedSets: readonly { exerciseId: string; warmup: boolean; tags: readonly string[]; outlierStatus: string }[],
): Set<string> {
  const counts = new Map<string, number>();
  for (const set of loggedSets) {
    if (set.warmup || set.tags.includes("drop") || set.outlierStatus === "rejected") continue;
    counts.set(set.exerciseId, (counts.get(set.exerciseId) ?? 0) + 1);
  }
  return new Set(exercises.filter((exercise) => (counts.get(exercise.exerciseId) ?? 0) >= Math.max(1, exercise.sets)).map((exercise) => exercise.slot));
}

/**
 * Move one uncompleted exercise by one visible place. A real superset is one block: selecting either member moves the whole group, and
 * the group is locked only when a member is in `completedSlots`. A partial set does not lock it. This changes only an array of session
 * slot ids; callers persist the returned order.
 */
export function moveWorkoutSlot(
  order: readonly string[],
  states: StateMap,
  completedSlots: ReadonlySet<string>,
  slot: string,
  direction: MoveDirection,
): { order: string[]; outcome: MoveOutcome } {
  if (!order.includes(slot)) return { order: [...order], outcome: "missing" };

  const groupCounts = new Map<string, number>();
  for (const id of order) {
    const group = states[id]?.superset;
    if (group) groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
  }
  const blocks: string[][] = [];
  const seen = new Set<string>();
  for (const id of order) {
    if (seen.has(id)) continue;
    const group = states[id]?.superset;
    const block = group && (groupCounts.get(group) ?? 0) >= 2 ? order.filter((x) => states[x]?.superset === group) : [id];
    blocks.push(block);
    for (const member of block) seen.add(member);
  }

  const from = blocks.findIndex((block) => block.includes(slot));
  const moving = blocks[from]!;
  if (moving.some((id) => completedSlots.has(id))) return { order: [...order], outcome: "completed" };
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= blocks.length) return { order: [...order], outcome: "boundary" };
  const next = [...blocks];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return { order: next.flat(), outcome: "moved" };
}

/** Positions that `orderSlots` reads back as `order`. Existing slot fields stay; only `position` changes. */
export function applyMovePositions<T extends { position: number | null }>(
  states: Readonly<Record<string, T | undefined>>,
  order: readonly string[],
  blank: (slot: string) => T,
): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [slot, state] of Object.entries(states)) if (state) next[slot] = { ...state };
  order.forEach((id, index) => {
    next[id] = { ...(next[id] ?? blank(id)), position: index + 1 };
  });
  return next;
}

export interface MoveAction {
  direction: MoveDirection;
  label: string;
  accessibilityLabel: string;
}

/** Menu actions for one slot. Boundaries, completed exercises and locked supersets simply have no invalid action to tap. */
export function buildMoveActions(
  order: readonly string[],
  states: StateMap,
  completedSlots: ReadonlySet<string>,
  slot: string,
  copy: { up: string; down: string; accessibilityLabel: (direction: MoveDirection) => string },
): MoveAction[] {
  const actions: MoveAction[] = [];
  for (const direction of ["up", "down"] as const) {
    if (moveWorkoutSlot(order, states, completedSlots, slot, direction).outcome !== "moved") continue;
    actions.push({ direction, label: copy[direction], accessibilityLabel: copy.accessibilityLabel(direction) });
  }
  return actions;
}

/** Group values to save so that `b` joins the superset of `a` (a new one if `a` has none). Only the slots that change are returned. */
export function joinSuperset(states: StateMap, a: string, b: string): Record<string, string> {
  if (a === b) return {};
  const group = states[a]?.superset ?? `${SS}${a}`;
  const out: Record<string, string> = {};
  if (states[a]?.superset !== group) out[a] = group;
  if (states[b]?.superset !== group) out[b] = group;
  return out;
}

/** Take `slot` out of its superset. A group left with one member simply stops showing as a superset. */
export const leaveSuperset = (slot: string): Record<string, null> => ({ [slot]: null });

/**
 * Rest timer in a superset: no rest between the exercises of a round, rest after the LAST exercise of the group (in display order).
 * An exercise that is not in a superset always rests after its set.
 */
export function restAfterSet(order: readonly string[], states: StateMap, slot: string): boolean {
  const labels = supersetLabels(order, states);
  if (!(slot in labels)) return true;
  const g = states[slot]?.superset;
  const groupOrder = order.filter((s) => states[s]?.superset === g);
  return groupOrder[groupOrder.length - 1] === slot;
}
