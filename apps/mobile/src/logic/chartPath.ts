// Pure SVG path helpers for the Summary chart (no React Native import, so tests can check them).

/** A smooth path through the points (Catmull-Rom as cubic Béziers), never overshooting far between close points. */
export function smoothPath(xy: { x: number; y: number }[]): string {
  if (xy.length === 0) return "";
  if (xy.length === 1) return `M${xy[0]!.x},${xy[0]!.y}`;
  let d = `M${xy[0]!.x},${xy[0]!.y}`;
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[i - 1] ?? xy[i]!;
    const p1 = xy[i]!;
    const p2 = xy[i + 1]!;
    const p3 = xy[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}
