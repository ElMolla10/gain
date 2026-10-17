import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { en, ar } from "../src/i18n/strings";

const roots = [join(__dirname, "../src/screens"), join(__dirname, "../src/components")];
const files = roots.flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".tsx")).map((f) => join(d, f)));
const uses = files.flatMap((f) => [...readFileSync(f, "utf8").matchAll(/<EmptyState[^>]*?title=\{t\("([^"]+)"\)\}([^>]*)>/g)].map((m) => ({ file: f, key: m[1] ?? "", rest: m[0] })));

describe("2.12 empty states", () => {
  it("finds the empty states", () => expect(uses.length).toBeGreaterThanOrEqual(12));
  it("every EmptyState title is four words or fewer in English, and translated", () => {
    for (const u of uses) {
      const s = (en as Record<string, string>)[u.key];
      expect(s, u.key).toBeTruthy();
      expect(s.trim().split(/\s+/).length, `${u.key}: ${s}`).toBeLessThanOrEqual(4);
      expect((ar as Record<string, string>)[u.key], u.key).toBeTruthy();
    }
  });
  it("puts 24 dp (space.xl) between the text and the action", () => {
    const ui = readFileSync(join(__dirname, "../src/ui.tsx"), "utf8");
    const block = ui.slice(ui.indexOf("export function EmptyState"), ui.indexOf("export function LoadingState"));
    expect(block).toContain("gap: space.md");
    expect(block).toContain("marginTop: space.xl - space.md");
  });
});
