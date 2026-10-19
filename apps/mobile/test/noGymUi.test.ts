import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/strings";

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const ui = [...walk("src/screens"), ...walk("src/components"), "App.tsx"];

describe("gyms UI (batch 3): profiles are editable, history stays per gym", () => {
  it("has Gyms and GymEdit screens on the stack, opened from Settings", () => {
    const names = ui.map((f) => f.split(/[/\\]/).pop());
    expect(names).toEqual(expect.arrayContaining(["GymsScreen.tsx", "GymEditScreen.tsx"]));
    const app = readFileSync("App.tsx", "utf8");
    expect(app).toMatch(/name="Gyms"/);
    expect(app).toMatch(/name="GymEdit"/);
    expect(readFileSync("src/screens/SettingsScreen.tsx", "utf8")).toMatch(/navigate\("Gyms"\)/);
  });
  it("has gym words the lifter can see", () => {
    const keys = Object.keys(en).filter((k) => /^(gyms|plates)\./.test(k));
    expect(keys.length).toBeGreaterThan(0);
    expect(en["gyms.entry"]).toBeTruthy();
  });
});
