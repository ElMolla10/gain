import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const require = createRequire(import.meta.url);
const { inspectMetadata } = require("../../../scripts/ios-archive-report.cjs") as {
  inspectMetadata: (info: Record<string, unknown>, privacy: Record<string, unknown>, bundle: string, build: string) => string[];
};
const config = JSON.parse(readFileSync(join(__dirname, "../app.json"), "utf8")).expo;
const info = () => ({ CFBundleIdentifier: "com.mo.gain", CFBundleVersion: "42", CFBundleShortVersionString: "0.22.0",
  CFBundleSupportedPlatforms: ["iPhoneOS"], UIDeviceFamily: [1], ITSAppUsesNonExemptEncryption: false });

describe("read-only archive metadata inspection (stand-in plutil; no native build)", () => {
  it("accepts the intended device identity and reviewed optional-server manifest", () => {
    expect(inspectMetadata(info(), config.ios.privacyManifests, "com.mo.gain", "42")).toEqual([]);
  });
  it("rejects drift in identity, build, platform, device family and HTTP policy", () => {
    for (const patch of [{ CFBundleIdentifier: "com.other.gain" }, { CFBundleVersion: "1" }, { CFBundleShortVersionString: "" },
      { CFBundleSupportedPlatforms: ["iPhoneSimulator"] }, { UIDeviceFamily: [1, 2] },
      { ITSAppUsesNonExemptEncryption: true }, { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true } }]) {
      expect(inspectMetadata({ ...info(), ...patch }, config.ios.privacyManifests, "com.mo.gain", "42").length).toBeGreaterThan(0);
    }
  });
  it("rejects an empty collection declaration or unreviewed tracking", () => {
    for (const patch of [{ NSPrivacyCollectedDataTypes: [] }, { NSPrivacyTracking: true }, { NSPrivacyTrackingDomains: ["tracker.test"] }, { NSPrivacyAccessedAPITypes: [] }]) {
      expect(inspectMetadata(info(), { ...config.ios.privacyManifests, ...patch }, "com.mo.gain", "42").length).toBeGreaterThan(0);
    }
  });
  it("inspects archive layout, fails on missing JS, and never reports native QA as passed", () => {
    const root = mkdtempSync(join(tmpdir(), "gain-archive-report-"));
    try {
      const archive = join(root, "GAIN 42.xcarchive");
      const app = join(archive, "Products/Applications/GAIN.app");
      mkdirSync(app, { recursive: true }); mkdirSync(join(root, "bin"));
      // Test helper only: cat JSON in place of macOS plutil. No Apple tooling is exercised.
      writeFileSync(join(root, "bin/plutil"), '#!/bin/sh\nfor arg do last="$arg"; done\ncat "$last"\n', { mode: 0o755 });
      writeFileSync(join(archive, "Info.plist"), JSON.stringify({ ApplicationProperties: { ApplicationPath: "Applications/GAIN.app" } }));
      writeFileSync(join(app, "Info.plist"), JSON.stringify(info()));
      writeFileSync(join(app, "PrivacyInfo.xcprivacy"), JSON.stringify(config.ios.privacyManifests));
      const run = () => execFileSync(process.execPath, [join(__dirname, "../../../scripts/ios-archive-report.cjs"), archive, "com.mo.gain", "42"],
        { encoding: "utf8", env: { ...process.env, PATH: `${join(root, "bin")}:${process.env.PATH}` }, stdio: "pipe" });
      expect(run).toThrow();
      writeFileSync(join(app, "main.jsbundle"), "test fixture, not a real bundle");
      const report = JSON.parse(run());
      expect(report.passed).toBe(true);
      expect(report.remaining.join(" ")).toContain("does not run the app");
      writeFileSync(join(archive, "Info.plist"), JSON.stringify({ ApplicationProperties: { ApplicationPath: "../../escape.app" } }));
      expect(run).toThrow();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
