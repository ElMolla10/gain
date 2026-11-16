/** Content-relative offset that keeps the focused cell inside the logger's measured viewport. */
export function inputScrollOffset(top: number, height: number, scrollY: number, viewportHeight: number): number {
  if (viewportHeight <= 0) return scrollY;
  const gap = 8;
  if (top < scrollY + gap) return Math.max(0, top - gap);
  if (top + height > scrollY + viewportHeight - gap) return Math.max(0, top + height - viewportHeight + gap);
  return scrollY;
}
