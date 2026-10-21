import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Rules of Hooks, checked as source text (react-native cannot be loaded in Node). A component that returns early
 * (loading / error / empty state) and calls a hook afterwards crashes when the data arrives, because React sees
 * more hooks than on the previous render. HistoryScreen did exactly that.
 * Heuristic: inside one top-level function, a single-line `  if (...) return ...;` at the function's own indent
 * must not be followed by a top-level `use...(` hook call.
 */
const root = join(__dirname, "..", "src");
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const files = walk(root).filter((f) => /\.tsx$/.test(f));

export function hooksAfterEarlyReturn(source: string): string[] {
  const found: string[] = [];
  let earlyReturnAt: number | null = null;
  source.split(/\r?\n/).forEach((line, i) => {
    // A new top-level function starts a fresh component.
    if (/^(export )?(default )?function\s/.test(line) || /^(export )?const \w+ = (React\.)?(memo\()?\(/.test(line)) earlyReturnAt = null;
    if (earlyReturnAt === null && /^ {2}if \(.*\) return\b/.test(line)) earlyReturnAt = i + 1;
    else if (earlyReturnAt !== null && /^ {2}(const .* = |void )?use[A-Z]\w*\(/.test(line)) found.push(`line ${i + 1} (early return on line ${earlyReturnAt}): ${line.trim()}`);
  });
  return found;
}

describe("hooks are never called after an early return", () => {
  it("detects the bug it guards against", () => {
    const bad = ["export function Screen() {", "  const [a] = useState(0);", "  if (!a) return null;", "  const m = useMemo(() => 1, []);", "}"].join("\n");
    expect(hooksAfterEarlyReturn(bad)).toHaveLength(1);
  });
  it("accepts hooks placed above the early return", () => {
    const good = ["export function Screen() {", "  const m = useMemo(() => 1, []);", "  if (!m) return null;", "  return null;", "}"].join("\n");
    expect(hooksAfterEarlyReturn(good)).toEqual([]);
  });
  it("no screen or component in src does it", () => {
    const bad = files.flatMap((f) => hooksAfterEarlyReturn(readFileSync(f, "utf8")).map((m) => `${f.slice(root.length + 1)}: ${m}`));
    expect(bad).toEqual([]);
  });
});
