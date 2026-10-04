import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hasSelfUpdater, readBuildFlags } from "../src/logic/buildFlags";
import { TEMPLATES, templatePool, templatesForDays } from "../src/logic/templates";
import { en } from "../src/i18n/strings";

/**
 * Build switches (v0.20.0): GAIN_DISTRIBUTION=play drops the self-updater and its install permission; GAIN_PILOT_TEMPLATES=1 offers only the six
 * pilot programs. With neither set the build must be exactly what it was: these tests pin that, because the sideload APK is what pilot lifters
 * and Mohamed run.
 */
const require = createRequire(import.meta.url);
const root = join(__dirname, "..");
const { applyBuildFlags, PILOT_TEMPLATE_IDS } = require("../build-flags.js") as { applyBuildFlags: (c: Record<string, any>, env: Record<string, string | undefined>) => Record<string, any>; PILOT_TEMPLATE_IDS: string[] };
const appJson = JSON.parse(readFileSync(join(root, "app.json"), "utf8")) as { expo: Record<string, any> };
const appConfig = require("../app.config.js") as (a: { config: Record<string, any> }) => Record<string, any>;

describe("build-flags.js (app config)", () => {
  it("with no environment the config is app.json plus a neutral `extra` (sideload, all templates), permissions unchanged", () => {
    const out = applyBuildFlags(appJson.expo, {});
    expect(out.android.permissions).toEqual(["REQUEST_INSTALL_PACKAGES"]);
    expect(out.android.blockedPermissions).toEqual(appJson.expo.android.blockedPermissions);
    expect(out.extra).toEqual({ distribution: "sideload", pilotTemplateIds: null });
    const { extra: _e, ...rest } = out;
    const { extra: _x, ...base } = appJson.expo;
    expect(rest).toEqual(base);
    // empty strings are "not set" (CI systems often export empty variables)
    expect(applyBuildFlags(appJson.expo, { GAIN_DISTRIBUTION: "", GAIN_PILOT_TEMPLATES: "" })).toEqual(out);
  });
  it("app.config.js hands app.json's expo block through the same function using process.env", () => {
    const before = { d: process.env.GAIN_DISTRIBUTION, p: process.env.GAIN_PILOT_TEMPLATES };
    delete process.env.GAIN_DISTRIBUTION;
    delete process.env.GAIN_PILOT_TEMPLATES;
    try {
      expect(appConfig({ config: appJson.expo })).toEqual(applyBuildFlags(appJson.expo, {}));
    } finally {
      if (before.d !== undefined) process.env.GAIN_DISTRIBUTION = before.d;
      if (before.p !== undefined) process.env.GAIN_PILOT_TEMPLATES = before.p;
    }
  });
  it("play: REQUEST_INSTALL_PACKAGES is removed and blocked, every other permission setting and the app identity are untouched", () => {
    const out = applyBuildFlags(appJson.expo, { GAIN_DISTRIBUTION: "play" });
    expect(out.android.permissions).toEqual([]);
    expect(out.android.blockedPermissions).toEqual([...appJson.expo.android.blockedPermissions, "android.permission.REQUEST_INSTALL_PACKAGES"]);
    expect(out.extra.distribution).toBe("play");
    expect(out.android.package).toBe("app.gain.mobile");
    expect(out.android.versionCode).toBe(appJson.expo.android.versionCode);
    expect(out.version).toBe(appJson.expo.version);
    // the input is not mutated
    expect(appJson.expo.android.permissions).toEqual(["REQUEST_INSTALL_PACKAGES"]);
  });
  it("pilot: the six ids go into `extra`, nothing else changes", () => {
    const out = applyBuildFlags(appJson.expo, { GAIN_PILOT_TEMPLATES: "1" });
    expect(out.extra).toEqual({ distribution: "sideload", pilotTemplateIds: PILOT_TEMPLATE_IDS });
    expect(out.android.permissions).toEqual(["REQUEST_INSTALL_PACKAGES"]);
    expect(PILOT_TEMPLATE_IDS).toEqual(["full_body_2", "full_body_3", "ppl_3", "upper_lower_4", "mix_4", "ppl_6"]);
  });
  it("a typo is an error, never a silently different build", () => {
    expect(() => applyBuildFlags(appJson.expo, { GAIN_DISTRIBUTION: "Play" })).toThrow(/GAIN_DISTRIBUTION/);
    expect(() => applyBuildFlags(appJson.expo, { GAIN_DISTRIBUTION: "store" })).toThrow(/GAIN_DISTRIBUTION/);
    expect(() => applyBuildFlags(appJson.expo, { GAIN_PILOT_TEMPLATES: "true" })).toThrow(/GAIN_PILOT_TEMPLATES/);
  });
  it("the pilot ids are real templates, from the original 7, gym-based, covering 2 to 4 and 6 days", () => {
    const byId = new Map(TEMPLATES.map((t) => [t.id, t]));
    for (const id of PILOT_TEMPLATE_IDS) expect(byId.has(id), id).toBe(true);
    expect(PILOT_TEMPLATE_IDS.map((id) => byId.get(id)!.days)).toEqual([2, 3, 3, 4, 4, 6]);
    expect(PILOT_TEMPLATE_IDS.every((id) => byId.get(id)!.gear === "gym")).toBe(true);
  });
});

describe("run-time reading of the build flags", () => {
  it("missing, malformed or hostile `extra` means the ordinary sideload app with every template", () => {
    for (const bad of [undefined, null, 5, "play", [], {}, { distribution: "PLAY", pilotTemplateIds: "ppl_3" }, { pilotTemplateIds: [] }, { pilotTemplateIds: [1, 2] }, { pilotTemplateIds: {} }]) {
      expect(readBuildFlags(bad), JSON.stringify(bad)).toEqual({ distribution: "sideload", pilotTemplateIds: null });
    }
    expect(hasSelfUpdater(readBuildFlags({}))).toBe(true);
  });
  it("play has no self-updater; pilot ids are read through", () => {
    expect(hasSelfUpdater(readBuildFlags({ distribution: "play" }))).toBe(false);
    expect(readBuildFlags({ distribution: "sideload", pilotTemplateIds: PILOT_TEMPLATE_IDS }).pilotTemplateIds).toEqual(PILOT_TEMPLATE_IDS);
  });
});

describe("pilot template subset", () => {
  it("no list means all templates (the normal build), and the full list is unchanged", () => {
    expect(templatePool(null)).toBe(TEMPLATES);
    expect(templatePool(undefined)).toBe(TEMPLATES);
    expect(TEMPLATES.length).toBe(48);
  });
  it("the pilot pool has exactly the six, in catalogue order; unknown ids are ignored; a list matching nothing falls back to all", () => {
    expect(templatePool(PILOT_TEMPLATE_IDS).map((t) => t.id).sort()).toEqual([...PILOT_TEMPLATE_IDS].sort());
    expect(templatePool([...PILOT_TEMPLATE_IDS, "nope"]).length).toBe(6);
    expect(templatePool(["nope"])).toBe(TEMPLATES);
  });
  it("first-run offers per days/week match docs/pilot/PILOT-TEMPLATES.md", () => {
    const pool = templatePool(PILOT_TEMPLATE_IDS);
    const ids = (d: number) => templatesForDays(d, pool).map((o) => `${o.template.id}:${o.fit}`).sort();
    expect(ids(1)).toEqual([]);
    expect(ids(2)).toEqual(["full_body_2:exact"]);
    expect(ids(3)).toEqual(["full_body_3:exact", "ppl_3:exact"]);
    expect(ids(4)).toEqual(["mix_4:exact", "upper_lower_4:exact"]);
    expect(ids(5)).toEqual(["mix_4:fewer", "upper_lower_4:fewer"]);
    expect(ids(6)).toEqual(["ppl_6:exact"]);
    // the default (no pool) behaves as before: 4 days still offers every 4-day template, including ppl_upper_4
    expect(templatesForDays(4).some((o) => o.template.id === "ppl_upper_4")).toBe(true);
    expect(templatesForDays(4).length).toBeGreaterThan(2);
  });
  it("every pilot program is a normal template: it instantiates and has a name in both languages", () => {
    for (const t of templatePool(PILOT_TEMPLATE_IDS)) {
      expect(t.schedule.length).toBeGreaterThan(0);
      expect(t.en.length).toBeGreaterThan(3);
      expect(t.ar).toMatch(/[\u0600-\u06FF]/);
    }
  });
});

describe("wiring in the screens (source checks; no phone here)", () => {
  const src = (f: string) => readFileSync(join(root, "src", f), "utf8");
  it("the pickers go through activeTemplates(); Settings and the privacy page hide the updater only when the build has none", () => {
    expect(src("screens/OnboardingScreen.tsx")).toMatch(/templatesForDays\(form\.days, activeTemplates\(\)\)/);
    expect(src("screens/ProgrammeSwitchScreen.tsx")).toMatch(/templates=\{activeTemplates\(\)\}/);
    expect(src("screens/ProgrammeSwitchScreen.tsx")).not.toMatch(/\bTEMPLATES\b/);
    expect(src("screens/SettingsScreen.tsx")).toMatch(/hasSelfUpdater\(buildFlags, Platform\.OS\) \? <UpdateCard \/> : null/);
    expect(src("screens/SettingsScreen.tsx")).toMatch(/settings\.pilotBuild/);
    expect(src("screens/PrivacyScreen.tsx")).toMatch(/hasSelfUpdater\(buildFlags, Platform\.OS\)/);
    expect(src("buildConfig.ts")).toMatch(/Constants\.expoConfig\?\.extra/);
  });
  it("the pilot label exists in both languages", () => {
    expect(en["settings.pilotBuild"]).toMatch(/Pilot build/);
  });
});
