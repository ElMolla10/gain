/** What to change between two plate lists (one side, heaviest first): the multiset difference, both heaviest first. */
export function plateDelta(prev: readonly number[], cur: readonly number[]): { off: number[]; on: number[] } {
  const key = (n: number) => Math.round(n * 1000);
  const count = new Map<number, number>();
  for (const p of prev) count.set(key(p), (count.get(key(p)) ?? 0) + 1);
  const on: number[] = [];
  for (const c of cur) {
    const k = key(c);
    const n = count.get(k) ?? 0;
    if (n > 0) count.set(k, n - 1);
    else on.push(c);
  }
  const off: number[] = [];
  for (const p of prev) {
    const k = key(p);
    const n = count.get(k) ?? 0;
    if (n > 0) {
      off.push(p);
      count.set(k, n - 1);
    }
  }
  const desc = (a: number, b: number) => b - a;
  return { off: off.sort(desc), on: on.sort(desc) };
}
