/**
 * Exercise drag-and-drop helpers. The visible rows stay in their original slots
 * while the held row follows the finger and surrounding rows slide out of its way.
 * No changes are committed until the user taps Done.
 */
export function moveIndex<T>(items: readonly T[], from: number, to: number): T[] {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return [...items];
  const copy = [...items];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item!);
  return copy;
}

export function dragDestination(from: number, dy: number, rowHeight: number, count: number): number {
  if (count <= 0 || rowHeight <= 0 || !Number.isFinite(dy)) return from;
  const target = from + Math.round(dy / rowHeight);
  return Math.max(0, Math.min(count - 1, target));
}

/** Offset of a bystander row while another row is lifted. */
export function gapOffset(index: number, from: number, to: number, rowHeight: number): number {
  if (index === from) return 0;
  if (from < to && index > from && index <= to) return -rowHeight;
  if (from > to && index >= to && index < from) return rowHeight;
  return 0;
}
