import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { formatLoad } from "../src/i18n/format";
import { en, ar } from "../src/i18n/strings";
import { e1rmText, setText, tonnageInUnit } from "../src/logic/loadText";

const LRI = "\u2066", PDI = "\u2069", NB = "\u00A0";
const plain = (s: string) => s.split(LRI).join("").split(PDI).join("").split(NB).join(" ");

describe("10x cards show loads in the lifter's unit (batch item 20)", () => {
  it("100 kg is '100 kg' / '220.5 lb' in both languages, unit word outside the number's isolate", () => {
    expect(plain(formatLoad(100, "en", "kg"))).toBe("100 kg");
    expect(plain(formatLoad(100, "en", "lb"))).toBe("220.5 lb");
    expect(plain(formatLoad(100, "ar", "kg"))).toBe("100 كجم");
    expect(plain(formatLoad(100, "ar", "lb"))).toBe("220.5 باوند");
    expect(formatLoad(100, "ar", "lb")).toBe(`${LRI}220.5${PDI}${NB}باوند`);
  });

  it("set text (runway steps and top, apex set, strategy target): load × reps", () => {
    expect(plain(setText(100, 5, "en", "kg"))).toBe("100 kg × 5");
    expect(plain(setText(100, 5, "en", "lb"))).toBe("220.5 lb × 5");
    expect(plain(setText(100, 5, "ar", "lb"))).toBe("220.5 باوند × 5");
    expect(setText(100, 5, "ar", "kg")).toBe(`${LRI}100${PDI}${NB}كجم × ${LRI}5${PDI}`);
  });

  it("e1RM (goal hero, power curve) is rounded like a load: never 116.667", () => {
    expect(plain(e1rmText(116.6667, "en", "kg"))).toBe("116.7 kg");
    expect(plain(e1rmText(100, "en", "lb"))).toBe("220.5 lb");
    expect(plain(e1rmText(100, "ar", "kg"))).toBe("100 كجم");
    expect(plain(e1rmText(116.6667, "ar", "lb"))).toBe("257.3 باوند");
  });

  it("post-mortem tonnage uses kgToUnit, not a hard-coded factor", () => {
    expect(tonnageInUnit(1000, "kg")).toBe(1000);
    expect(tonnageInUnit(1000, "lb")).toBe(2205);
    expect(readFileSync(join(__dirname, "../src/components/history/SessionPostMortemHero.tsx"), "utf8")).not.toContain("2.20462");
  });

  it("the 'e1RM' fragment on the goal card is a string key in both languages", () => {
    expect(en["goals.bar.currentE1rm"]).toBe("{load} e1RM");
    expect(ar["goals.bar.currentE1rm"]).toContain("{load}");
    expect(ar["goals.bar.currentE1rm"]).not.toContain("e1RM");
    const curve = readFileSync(join(__dirname, "../src/components/trend/RepMaxPowerCurve.tsx"), "utf8");
    expect(curve).not.toMatch(/\}RM/);
    expect(readFileSync(join(__dirname, "../src/components/goals/GoalHeroIronCard.tsx"), "utf8")).not.toContain(" e1RM`");
  });
});

/** Components that must never build "<number> <unitText>" from a raw (kilogram) value. */
const ALLOWED: Record<string, string> = {
  // displayWeight is already kgToUnit(plate.kg, unit) and isolated.
  "BarbellPlateStudio.tsx": "accessibilityLabel={`+${displayWeight} ${unitText} pair`}",
};
// No importer (dead; to be deleted in a cleanup), so it never renders.
const DEAD = new Set(["history/ExerciseChronicleCard.tsx"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

describe("source guard: no `${x} ${unitText}` in components", () => {
  it("every load next to unitText goes through formatLoad instead", () => {
    const root = join(__dirname, "../src/components");
    const bad: string[] = [];
    for (const f of files(root)) {
      const rel = relative(root, f).split("\\").join("/");
      if (DEAD.has(rel)) continue;
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        if (!/\$\{[^}]+\} \$\{unitText\}/.test(line)) return;
        const name = rel.split("/").pop()!;
        if (ALLOWED[name] && line.includes(ALLOWED[name])) return;
        bad.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it("the dead file really has no importer", () => {
    const src = join(__dirname, "../src");
    const all = [...files(src), ...readdirSync(join(src, "screens")).map((n) => join(src, "screens", n))].filter((f) => /\.tsx?$/.test(f));
    expect(all.filter((f) => /from ".*ExerciseChronicleCard"/.test(readFileSync(f, "utf8")))).toEqual([]);
  });
});
