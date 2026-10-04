import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** iOS-only build switches in build-flags.js (docs/IOS.md). They must never touch the Android section or the default result. */
const require = createRequire(import.meta.url);
const { applyBuildFlags } = require("../build-flags.js") as { applyBuildFlags: (c: Record<string, any>, env: Record<string, string | undefined>) => Record<string, any> };
const base = (JSON.parse(readFileSync(join(__dirname, "..", "app.json"), "utf8")) as { expo: Record<string, any> }).expo;

describe("iOS build switches", () => {
  it("with none set, ios and plugins are exactly app.json's", () => {
    const out = applyBuildFlags(base, {});
    expect(out.ios).toEqual(base.ios);
    expect(out.plugins).toEqual(base.plugins);
    expect(applyBuildFlags(base, { GAIN_IOS_BUNDLE_ID: "", GAIN_IOS_TEAM_ID: "", GAIN_IOS_SCENES: "" })).toEqual(out);
  });
  it("a personal bundle id and team id replace only those two iOS fields", () => {
    const out = applyBuildFlags(base, { GAIN_IOS_BUNDLE_ID: "com.mohamed.gain", GAIN_IOS_TEAM_ID: "AB12CD34EF" });
    expect(out.ios).toEqual({ ...base.ios, bundleIdentifier: "com.mohamed.gain", appleTeamId: "AB12CD34EF" });
    expect(out.android).toEqual(base.android);
    expect(base.ios.bundleIdentifier).toBe("app.gain.mobile"); // input not mutated
  });
  it("rejects a bundle id or team id that Apple would refuse", () => {
    for (const bad of ["gain", "com.my gain.app", "com..gain", "com.gain_app.x", "com.gain."]) expect(() => applyBuildFlags(base, { GAIN_IOS_BUNDLE_ID: bad }), bad).toThrow(/GAIN_IOS_BUNDLE_ID/);
    for (const bad of ["ab12cd34ef", "AB12CD34E", "AB12CD34EFG", "AB12 D34EF"]) expect(() => applyBuildFlags(base, { GAIN_IOS_TEAM_ID: bad }), bad).toThrow(/GAIN_IOS_TEAM_ID/);
  });
  it("GAIN_IOS_SCENES=1 appends the scene-support plugin; anything but 0/1 is an error", () => {
    const out = applyBuildFlags(base, { GAIN_IOS_SCENES: "1" });
    expect(out.plugins.at(-1)).toEqual(["expo-build-properties", { ios: { enableSceneSupport: true } }]);
    expect(out.plugins.slice(0, -1)).toEqual(base.plugins);
    expect(out.android).toEqual(base.android);
    expect(() => applyBuildFlags(base, { GAIN_IOS_SCENES: "yes" })).toThrow(/GAIN_IOS_SCENES/);
  });
  it("combines with the Android switches without changing them", () => {
    const out = applyBuildFlags(base, { GAIN_DISTRIBUTION: "play", GAIN_IOS_BUNDLE_ID: "com.mohamed.gain" });
    expect(out.android.permissions).toEqual([]);
    expect(out.extra.distribution).toBe("play");
    expect(out.ios.bundleIdentifier).toBe("com.mohamed.gain");
  });
});
