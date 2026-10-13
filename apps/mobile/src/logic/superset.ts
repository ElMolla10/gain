/**
 * Order, grouping and rest-timer rules for today's list of exercises: program slots in program order, exercises the lifter added
 * after them, and supersets pulled next to each other. Pure, so it is tested without a phone. Nothing here touches the program.
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
 * Slots in the order they are shown. `programmeSlots` = the day's exercises in program order. Added exercises follow, by the order they
 * were added. Removed ones are left out. The members of a superset (2 or more shown exercises with the same group) are shown together,
 * at the place of the first member, keeping their own relative order.
 */
export function orderSlots(programmeSlots: readonly string[], states: StateMap): string[] {
  const added = Object.values(states)
    .filter((s): s is Partial<SlotState> & { slot: string } => !!s && !!s.added && typeof s.slot === "string")
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((s) => s.slot);
  const base = [...programmeSlots, ...added.filter((s) => !programmeSlots.includes(s))].filter((s) => !states[s]?.removed);
  // Before the lifter reorders, preserve the programme order plus added exercises.
  // After a manual reorder, positions are written for *every* visible slot.
  // Merely adding an exercise has a position too, so it must NOT activate this
  // override unless a programme slot was explicitly given a position.
  const hasCustomOrder = programmeSlots.some((s) => !states[s]?.removed && !states[s]?.added && states[s]?.position != null);
  if (hasCustomOrder) {
    base.sort((a, b) => (states[a]?.position ?? Number.MAX_SAFE_INTEGER) - (states[b]?.position ?? Number.MAX_SAFE_INTEGER));
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

/** Dragging a superset moves it as one indivisible block, including all the
 * exercises in their existing relative order; no logged set is touched. */
export function reorderBlocks(order: readonly string[], states: StateMap): { id: string; slots: string[] }[] {
  const letters = supersetLabels(order, states);
  const seen = new Set<string>();
  const out: { id: string; slots: string[] }[] = [];
  for (const slot of order) {
    if (seen.has(slot)) continue;
    const g = states[slot]?.superset;
    const slots = g && letters[slot]
      ? order.filter(s => states[s]?.superset === g && letters[s])
      : [slot];
    slots.forEach(s => seen.add(s));
    out.push({ id: slots.length > 1 ? `group:${g}` : `slot:${slot}`, slots });
  }
  return out;
}

/** Reject any reordered list with missing/extra slots, or one that breaks a
 * superset into nonadjacent slots. Input is untrusted even if it came from UI. */
export function validReorder(order: readonly string[], proposed: readonly string[], states: StateMap): boolean {
  if (order.length !== proposed.length || new Set(proposed).size !== order.length) return false;
  if (order.some(s => !proposed.includes(s))) return false;
  // A superset's members must stay together in exactly their original order.
  for (const block of reorderBlocks(order, states)) {
    if (block.slots.length < 2) continue;
    const start = proposed.indexOf(block.slots[0]!);
    if (block.slots.some((slot, i) => proposed[start + i] !== slot)) return false;
  }
  return true;
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
