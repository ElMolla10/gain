import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/strings";

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const ui = [...walk("src/screens"), ...walk("src/components"), "App.tsx"];

describe("no gym UI (v0.8.0): the gym is a silent default in the data layer", () => {
  it("has no Gym screen, tab, route or navigation to one", () => {
    const names = ui.map((f) => f.split("/").pop());
    expect(names.filter((n) => /^Gym/.test(n ?? ""))).toEqual([]);
    for (const f of ui) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/name="Gym(Edit)?"|navigate\(\s*"Gym|GymScreen|GymEditScreen|GymFormView/);
    }
  });
  it("has no gym words in the strings the lifter can see", () => {
    const keys = Object.keys(en).filter((k) => /^(gym|tab\.gym)/.test(k));
    expect(keys).toEqual([]);
  });
});
